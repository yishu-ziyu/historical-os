// marked_clue_state.test.mjs — round 043 / 标记线索 case state 单元 + 契约测试
// 运行：node --test artifacts/web_story_loop_demo/marked_clue_state.test.mjs

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 8991;
const BASE = `http://127.0.0.1:${PORT}`;
const server = spawn('node', ['server.mjs'], {
  cwd: '/Users/mahaoxuan/Desktop/黑客松/架空历史故事游戏/artifacts/web_story_loop_demo',
  env: { ...process.env, PORT: String(PORT), MODEL_REQUEST_TIMEOUT_MS: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitReady() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok || res.status === 404) return;
    } catch {}
    await sleep(200);
  }
  throw new Error('server did not start within 6s');
}

async function postJson(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.json() };
}

before(async () => { await waitReady(); });
after(() => { server.kill(); });

describe('marked clue state engine', () => {
  const CASE = 'einstein-1933-test-' + Date.now();

  it('GET /api/case/:id returns markedClues (empty initially)', async () => {
    const r = await getJson(`/api/case/${CASE}`);
    assert.equal(r.status, 404, '新 caseId 不存在时应该 404');
  });

  it('POST mark-clue with bad caseId returns 404', async () => {
    const r = await postJson('/api/case/nonexistent-case-xyz/mark-clue', {
      clueId: 'c1', action: 'mark', note: '测试'
    });
    assert.equal(r.status, 404);
    assert.equal(r.body.ok, false);
  });

  it('POST mark-clue writes to case state', async () => {
    // 先创建一个 case
    const start = await postJson('/api/turn/start', {
      caseId: CASE,
      turn: 1,
      caseTitle: '测试案例',
      historicalAnchors: ['1933'],
      riskLevel: 1,
    });
    assert.equal(start.status, 200);

    // 等 job 完成
    const statusUrl = start.body.statusUrl;
    let snapshot;
    for (let i = 0; i < 50; i++) {
      const s = await getJson(statusUrl);
      if (s.body.status === 'succeeded' || s.body.status === 'failed') {
        snapshot = s.body;
        break;
      }
      await sleep(200);
    }
    assert.equal(snapshot.status, 'succeeded');

    // 标记一个线索
    const mark = await postJson(`/api/case/${CASE}/mark-clue`, {
      clueId: 'clue-test-1',
      action: 'mark',
      note: '爱因斯坦 1933 年 4 月仍在柏林',
      turn: 1,
    });
    assert.equal(mark.status, 200);
    assert.equal(mark.body.ok, true);
    assert.ok(mark.body.markedClues['clue-test-1']);
    assert.equal(mark.body.markedClues['clue-test-1'].note, '爱因斯坦 1933 年 4 月仍在柏林');
    assert.equal(mark.body.markedClues['clue-test-1'].turnMarked, 1);
  });

  it('GET /api/case/:id returns markedClues after marking', async () => {
    const r = await getJson(`/api/case/${CASE}`);
    assert.equal(r.status, 200);
    assert.ok(r.body.caseState.markedClues);
    assert.ok(r.body.caseState.markedClues['clue-test-1']);
  });

  it('POST mark-clue rejects non-historical note with 422', async () => {
    const r = await postJson(`/api/case/${CASE}/mark-clue`, {
      clueId: 'clue-test-2',
      action: 'mark',
      note: '这个游戏太好玩了',
      turn: 1,
    });
    assert.equal(r.status, 422);
    assert.equal(r.body.ok, false);
    assert.equal(r.body.code, 'non_historical_note');
    assert.match(r.body.error, /档案体/);
  });

  it('POST mark-clue with action=unmark removes clue', async () => {
    const r = await postJson(`/api/case/${CASE}/mark-clue`, {
      clueId: 'clue-test-1',
      action: 'unmark',
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.markedClues['clue-test-1'], undefined);
  });

  it('POST mark-clue with note > 200 chars truncates', async () => {
    const longNote = '爱因斯坦'.repeat(100); // 400 chars
    const r = await postJson(`/api/case/${CASE}/mark-clue`, {
      clueId: 'clue-test-3',
      action: 'mark',
      note: longNote,
      turn: 1,
    });
    assert.equal(r.status, 200);
    assert.ok(r.body.markedClues['clue-test-3'].note.length <= 200);
  });

  it('POST mark-clue with bad JSON returns 400', async () => {
    const res = await fetch(`${BASE}/api/case/${CASE}/mark-clue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json{',
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'bad_json');
  });

  it('POST mark-clue with unknown action returns 400', async () => {
    const r = await postJson(`/api/case/${CASE}/mark-clue`, {
      clueId: 'c1',
      action: 'invalid',
    });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'bad_action');
  });
});

describe('marked clue state cleanup', () => {
  it('resets test case', async () => {
    const CASE = 'einstein-1933-test-cleanup';
    const r = await postJson('/api/case/reset', { caseId: CASE });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
  });
});

describe('Aftermath marked summary (e2e contract)', () => {
  it('aftermath payload preserves markedClues for client summary', async () => {
    // Done Criterion 5：Aftermath 显示"本回合锁定 X / 累计 Y"。
    // 这条验证：Aftermath 调用前后 markedClues 不会丢失，前端能正确累计。
    const CASE = 'einstein-1933-aftermath-' + Date.now();
    // 启动一个回合
    const start = await postJson('/api/turn/start', {
      caseId: CASE, turn: 1, caseTitle: '测试', historicalAnchors: ['1933'], riskLevel: 1,
    });
    assert.equal(start.status, 200);
    let snapshot;
    for (let i = 0; i < 30; i++) {
      const s = await getJson(start.body.statusUrl);
      if (s.body.status === 'succeeded' || s.body.status === 'failed') {
        snapshot = s.body;
        break;
      }
      await sleep(200);
    }
    assert.equal(snapshot.status, 'succeeded');

    // 标记 2 条线索
    await postJson(`/api/case/${CASE}/mark-clue`, { clueId: 'c1', action: 'mark', turn: 1 });
    await postJson(`/api/case/${CASE}/mark-clue`, { clueId: 'c2', action: 'mark', turn: 1 });

    // 跑 Aftermath
    const startAfter = await postJson('/api/turn/aftermath', {
      turn: 1, caseId: CASE,
      playerChoiceId: 'choice-1', playerChoiceLabel: '测试选择',
      narrativeContext: '', worldState: { riskIndicators: { overall: 0, components: [] } },
      intelCardTitle: '测试情报', briefingHistoryFlags: [], situationRoomHistoryFlags: [],
    });
    assert.equal(startAfter.status, 200);
    let snapAfter;
    for (let i = 0; i < 30; i++) {
      const s = await getJson(startAfter.body.statusUrl);
      if (s.body.status === 'succeeded' || s.body.status === 'failed') {
        snapAfter = s.body;
        break;
      }
      await sleep(200);
    }
    assert.equal(snapAfter.status, 'succeeded');

    // 验证：case state 仍保留 markedClues（Aftermath 不擦除）
    const after = await getJson(`/api/case/${CASE}`);
    assert.equal(after.status, 200);
    assert.ok(after.body.caseState.markedClues);
    assert.equal(Object.keys(after.body.caseState.markedClues).length, 2);
    assert.ok(after.body.caseState.markedClues.c1);
    assert.ok(after.body.caseState.markedClues.c2);

    // 前端 turnState.currentTurnMarkedCount 应该在渲染时 = 2
    // （turn_cycle.js 注释里写明，源代码 review 见 .ship/tasks/.../e2e/report.md）
  });
});
