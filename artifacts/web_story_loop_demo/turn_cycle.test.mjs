import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

function spawnServer(testPort, extraEnv = {}) {
  const home = join(tmpdir(), `turn-cycle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      HOME: home,
      PORT: String(testPort),
      ANTHROPIC_BASE_URL: '',
      ANTHROPIC_AUTH_TOKEN: '',
      ANTHROPIC_API_KEY: '',
      HISTORICAL_RUNTIME_MODEL_PROVIDER: '',
      MODEL_PROVIDER: '',
      MINIMAX_API_KEY: '',
      MINIMAX_BASE_URL: '',
      TOKEN_PLAN_API_KEY: '',
      TOKEN_PLAN_BASE_URL: '',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { server, home, port: testPort };
}

function baseUrl(testPort) {
  return `http://127.0.0.1:${testPort}`;
}

async function waitForServer(proc, testPort, timeout = 5000) {
  const url = baseUrl(testPort);
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (proc.exitCode !== null) throw new Error(`server exited early with code ${proc.exitCode}`);
    try { const r = await fetch(`${url}/`); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

async function waitForJob(testPort, statusUrl, expectedStatus = 'succeeded', timeout = 10000) {
  const url = baseUrl(testPort);
  const started = Date.now();
  let snapshot;
  while (Date.now() - started < timeout) {
    const r = await fetch(`${url}${statusUrl}`);
    assert.equal(r.status, 200);
    snapshot = await r.json();
    if (snapshot.status === expectedStatus) return snapshot;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`job did not reach ${expectedStatus}; last status was ${snapshot?.status}`);
}

test('/api/turn/start returns briefing and situationRoom when model is unavailable (fallback)', async () => {
  const testPort = 8898;
  const { server, home } = spawnServer(testPort);

  try {
    await waitForServer(server, testPort);

    const response = await fetch(`${baseUrl(testPort)}/api/turn/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        caseId: 'einstein-1933',
        turn: 1,
        caseTitle: '爱因斯坦未离开德国',
        historicalAnchors: ['Einstein 1933 年 10 月未离开柏林'],
        riskLevel: 1,
      }),
    });

    assert.equal(response.status, 200);
    const started = await response.json();
    assert.equal(started.ok, true);
    assert.ok(started.jobId.startsWith('job-'));
    assert.equal(started.statusUrl, `/api/jobs/${started.jobId}`);

    const snapshot = await waitForJob(testPort, started.statusUrl, 'succeeded');
    assert.equal(snapshot.ok, true);
    assert.equal(snapshot.status, 'succeeded');
    assert.equal(snapshot.result.ok, true);
    assert.equal(snapshot.result.turn, 1);
    assert.equal(snapshot.result.stage, 'awaiting_player_choice');

    // Briefing should have intelCard
    assert.ok(snapshot.result.briefing, 'result should have briefing');
    assert.ok(snapshot.result.briefing.intelCard, 'briefing should have intelCard');
    assert.equal(snapshot.result.briefing.intelCard.classification, '绝密');
    assert.ok(snapshot.result.briefing.intelCard.header.documentId, 'should have document ID');
    assert.ok(Array.isArray(snapshot.result.briefing.intelCard.clues), 'clues should be array');
    assert.ok(snapshot.result.briefing.intelCard.clues.length > 0, 'should have clues');

    // Situation room should have nodes and action options
    assert.ok(snapshot.result.situationRoom, 'result should have situationRoom');
    assert.ok(Array.isArray(snapshot.result.situationRoom.nodes), 'nodes should be array');
    assert.ok(snapshot.result.situationRoom.nodes.length > 0, 'should have nodes');
    assert.ok(snapshot.result.situationRoom.actionOptions, 'should have actionOptions');
    assert.ok(Array.isArray(snapshot.result.situationRoom.actionOptions.options), 'options should be array');
    assert.ok(snapshot.result.situationRoom.actionOptions.options.length >= 1, 'should have at least 1 action option');

    // History flags should propagate
    assert.ok(snapshot.result.historyFlags.includes('fictional_branch'));
  } finally {
    server.kill('SIGTERM');
    await rm(home, { recursive: true, force: true });
  }
});

test('/api/turn/aftermath returns narrative and stateChanges when model is unavailable (fallback)', async () => {
  const testPort = 8899;
  const { server, home } = spawnServer(testPort);

  try {
    await waitForServer(server, testPort);

    const response = await fetch(`${baseUrl(testPort)}/api/turn/aftermath`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        turn: 1,
        playerChoiceId: 'action-secret-contact',
        playerChoiceLabel: '秘密接触爱因斯坦',
        narrativeContext: '爱因斯坦的名字仍在完整会员名册中。手写注释：教授希望留下。',
        worldState: {
          nodes: [
            { id: 'node-berlin-academy', label: '柏林科学院', type: 'organization', status: 'monitored' },
          ],
          riskIndicators: { overall: 1, max: 5, components: [] },
        },
        intelCardTitle: '柏林物理学会内部通信',
        briefingHistoryFlags: ['fictional_branch'],
        situationRoomHistoryFlags: [],
      }),
    });

    assert.equal(response.status, 200);
    const started = await response.json();
    assert.equal(started.ok, true);
    assert.ok(started.jobId.startsWith('job-'));

    const snapshot = await waitForJob(testPort, started.statusUrl, 'succeeded');
    assert.equal(snapshot.ok, true);
    assert.equal(snapshot.result.ok, true);
    assert.equal(snapshot.result.turn, 1);
    assert.equal(snapshot.result.stage, 'complete');

    assert.ok(snapshot.result.aftermath, 'result should have aftermath');
    assert.ok(typeof snapshot.result.aftermath.narrative === 'string', 'should have narrative text');
    assert.ok(Array.isArray(snapshot.result.aftermath.stateChanges), 'should have stateChanges array');
    assert.ok(Array.isArray(snapshot.result.aftermath.newClues), 'should have newClues array');
    assert.ok(Array.isArray(snapshot.result.aftermath.newNodes), 'should have newNodes array');
    assert.ok(Array.isArray(snapshot.result.aftermath.newEdges), 'should have newEdges array');

    assert.ok(snapshot.result.historyFlags.includes('fictional_branch'));

    for (const sc of snapshot.result.aftermath.stateChanges) {
      assert.ok(sc.id, 'stateChange should have id');
      assert.ok(sc.target, 'stateChange should have target');
      assert.ok(sc.field, 'stateChange should have field');
      assert.ok(['character.', 'organization.', 'risk.', 'clue.', 'flags.'].some(p => sc.target.startsWith(p)),
        `stateChange target "${sc.target}" should have valid prefix`);
      assert.ok(['player_visible', 'system_only'].includes(sc.visibility),
        `stateChange visibility should be player_visible or system_only`);
    }
  } finally {
    server.kill('SIGTERM');
    await rm(home, { recursive: true, force: true });
  }
});

test('legacy /api/generate still works for backward compatibility', async () => {
  const testPort = 8900;
  const { server, home } = spawnServer(testPort);

  try {
    await waitForServer(server, testPort);

    const response = await fetch(`${baseUrl(testPort)}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentTitle: '爱因斯坦仍在德国',
        currentStory: '测试故事',
        direction: '爱因斯坦秘密接触',
        pathTitles: ['爱因斯坦仍在德国'],
      }),
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(data, 'legacy endpoint should return data');
    assert.ok(data.historyFlags, 'should have historyFlags');
  } finally {
    server.kill('SIGTERM');
    await rm(home, { recursive: true, force: true });
  }
});

test('action options validate historical plausibility levels', async () => {
  const testPort = 8901;
  const { server, home } = spawnServer(testPort);

  try {
    await waitForServer(server, testPort);

    const response = await fetch(`${baseUrl(testPort)}/api/turn/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        caseId: 'einstein-1933',
        turn: 2,
        caseTitle: '爱因斯坦未离开德国',
        historicalAnchors: ['Einstein 1933 年 10 月未离开柏林'],
        riskLevel: 2,
        previousChoice: {
          label: '秘密接触爱因斯坦',
          consequencePreview: '接触已被记录',
        },
      }),
    });

    assert.equal(response.status, 200);
    const started = await response.json();
    const snapshot = await waitForJob(testPort, started.statusUrl, 'succeeded');

    const options = snapshot.result.situationRoom.actionOptions.options;
    for (const opt of options) {
      assert.ok(['high', 'medium', 'low'].includes(opt.historicalPlausibility),
        `Option "${opt.label}" should have valid historicalPlausibility`);
      assert.ok(typeof opt.riskCost === 'number', `Option "${opt.label}" should have numeric riskCost`);
      assert.ok(['low', 'medium', 'high'].includes(opt.intelReturn),
        `Option "${opt.label}" should have valid intelReturn`);
    }

    const impact = snapshot.result.situationRoom.actionOptions.previousChoiceImpact;
    if (impact) {
      assert.ok(impact.description, 'previousChoiceImpact should have description');
    }
  } finally {
    server.kill('SIGTERM');
    await rm(home, { recursive: true, force: true });
  }
});
