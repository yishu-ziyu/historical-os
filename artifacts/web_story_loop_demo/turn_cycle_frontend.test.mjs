import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

test('turn_cycle.js exports TurnCycle module with start/reset/getState', async () => {
  const src = await readFile(new URL('./turn_cycle.js', import.meta.url), 'utf8');
  assert.match(src, /window\.TurnCycle\s*=\s*\{/, 'should assign TurnCycle module to window');
  assert.match(src, /start:/, 'should export start function');
  assert.match(src, /reset:/, 'should export reset function');
  assert.match(src, /getState:/, 'should export getState function');
});

test('turn_cycle.js implements all three render functions', async () => {
  const src = await readFile(new URL('./turn_cycle.js', import.meta.url), 'utf8');
  assert.match(src, /function renderIntelCard/, 'should define renderIntelCard');
  assert.match(src, /function renderSituationRoom/, 'should define renderSituationRoom');
  assert.match(src, /function renderAftermath/, 'should define renderAftermath');
});

test('turn_cycle.js handles stage transitions correctly', async () => {
  const src = await readFile(new URL('./turn_cycle.js', import.meta.url), 'utf8');
  assert.match(src, /stage:\s*['"]idle['"]/, 'should initialize with idle stage');
  assert.match(src, /stage:\s*['"]awaiting_choice['"]/, 'should transition to awaiting_choice');
  assert.match(src, /['"]committing['"]/, 'should transition to committing on choice');
  assert.match(src, /['"]complete['"]/, 'should transition to complete after aftermath');
});

test('turn_cycle.js uses DOM-safe text assignment (no innerHTML)', async () => {
  const src = await readFile(new URL('./turn_cycle.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /innerHTML\s*=/, 'should not use innerHTML for security');
  assert.match(src, /textContent/, 'should use textContent for safe text rendering');
});

test('turn_cycle.js handles clue marking interaction', async () => {
  const src = await readFile(new URL('./turn_cycle.js', import.meta.url), 'utf8');
  assert.match(src, /function toggleClueMark/, 'should define toggleClueMark');
  assert.match(src, /\.classList\.toggle\(['"]marked['"]\)/, 'should toggle marked class');
});

test('turn_cycle.js posts to correct endpoints', async () => {
  const src = await readFile(new URL('./turn_cycle.js', import.meta.url), 'utf8');
  assert.match(src, /\/api\/turn\/start/, 'should call /api/turn/start');
  assert.match(src, /\/api\/turn\/aftermath/, 'should call /api/turn/aftermath');
});

test('index.html includes turn_cycle.js and turn cycle panel', async () => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(html, /script src=["']\.\/turn_cycle\.js["']/, 'should include turn_cycle.js script');
  assert.match(html, /id=["']turnCyclePanel["']/, 'should include turn cycle panel');
  assert.match(html, /id=["']briefingSection["']/, 'should include briefing section');
  assert.match(html, /id=["']situationSection["']/, 'should include situation section');
  assert.match(html, /id=["']aftermathSection["']/, 'should include aftermath section');
  assert.match(html, /id=["']startTurnBtn["']/, 'should include start turn button');
});

test('style.css includes turn cycle styles', async () => {
  const css = await readFile(new URL('./style.css', import.meta.url), 'utf8');
  assert.match(css, /\.turn-cycle-panel/, 'should include turn-cycle-panel styles');
  assert.match(css, /\.intel-card/, 'should include intel-card styles');
  assert.match(css, /\.situation-anchor/, 'should include situation-room anchor styles');
  assert.match(css, /\.aftermath-header/, 'should include aftermath styles');
  assert.match(css, /\.action-option/, 'should include action-option styles');
  assert.match(css, /\.risk-bar/, 'should include risk-bar styles');
});

test('end-to-end: /api/turn/start returns data consumable by frontend renderer', async () => {
  const testPort = 8903;
  const home = join(tmpdir(), `turn-cycle-e2e-${Date.now()}`);
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      HOME: home,
      PORT: String(testPort),
      ANTHROPIC_BASE_URL: '',
      ANTHROPIC_AUTH_TOKEN: '',
      ANTHROPIC_API_KEY: '',
      MINIMAX_API_KEY: '',
      MINIMAX_BASE_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const baseUrl = `http://127.0.0.1:${testPort}`;

  try {
    const started = Date.now();
    while (Date.now() - started < 5000) {
      try { const r = await fetch(`${baseUrl}/`); if (r.ok) break; } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }

    const response = await fetch(`${baseUrl}/api/turn/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        caseId: 'einstein-1933',
        turn: 1,
        caseTitle: '爱因斯坦未离开德国',
        historicalAnchors: ['Einstein 1933 年 10 月未离开柏林'],
      }),
    });

    const start = await response.json();
    assert.equal(start.ok, true);

    let snapshot;
    const pollStart = Date.now();
    while (Date.now() - pollStart < 10000) {
      const r = await fetch(`${baseUrl}${start.statusUrl}`);
      snapshot = await r.json();
      if (snapshot.status === 'succeeded') break;
      if (snapshot.status === 'failed') throw new Error(snapshot.error?.message);
      await new Promise((r) => setTimeout(r, 200));
    }

    assert.equal(snapshot.status, 'succeeded');
    const result = snapshot.result;

    // 验证前端 renderIntelCard 需要的字段
    assert.ok(result.briefing?.intelCard?.header, 'should have intelCard.header');
    assert.ok(result.briefing?.intelCard?.header?.title, 'should have title');
    assert.ok(result.briefing?.intelCard?.header?.documentId, 'should have documentId');
    assert.ok(result.briefing?.intelCard?.classification, 'should have classification');
    assert.ok(Array.isArray(result.briefing?.intelCard?.clues), 'clues should be array');

    // 验证前端 renderSituationRoom 需要的字段
    assert.ok(result.situationRoom?.anchor, 'should have anchor');
    assert.ok(Array.isArray(result.situationRoom?.nodes), 'nodes should be array');
    assert.ok(result.situationRoom?.riskIndicators, 'should have riskIndicators');
    assert.ok(Array.isArray(result.situationRoom?.actionOptions?.options), 'actionOptions.options should be array');

    // 验证 action-option 必需字段
    for (const opt of result.situationRoom.actionOptions.options) {
      assert.ok(opt.id, 'action should have id');
      assert.ok(opt.label, 'action should have label');
      assert.ok(opt.description !== undefined, 'action should have description');
      assert.ok(typeof opt.riskCost === 'number', 'action should have numeric riskCost');
      assert.ok(opt.consequencePreview !== undefined, 'action should have consequencePreview');
    }
  } finally {
    server.kill('SIGTERM');
    await rm(home, { recursive: true, force: true });
  }
});