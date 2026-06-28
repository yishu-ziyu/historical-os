import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8935;
const baseUrl = `http://127.0.0.1:${PORT}`;

async function waitForServer(proc, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (proc.exitCode !== null) throw new Error(`server exited: ${proc.exitCode}`);
    try { const r = await fetch(`${baseUrl}/`); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

async function startTurn(caseId, turn, historicalAnchors = []) {
  const start = await fetch(`${baseUrl}/api/turn/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      caseId,
      turn,
      caseTitle: '爱因斯坦未离开德国',
      historicalAnchors,
      riskLevel: 1,
    }),
  }).then(r => r.json());
  assert.equal(start.ok, true);
  return await pollJob(start.statusUrl);
}

async function doAftermath(payload) {
  const start = await fetch(`${baseUrl}/api/turn/aftermath`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => r.json());
  assert.equal(start.ok, true);
  return await pollJob(start.statusUrl);
}

async function getCaseState(caseId) {
  const r = await fetch(`${baseUrl}/api/case/${encodeURIComponent(caseId)}`);
  if (r.status === 404) return null;
  return r.json();
}

async function resetCase(caseId) {
  return fetch(`${baseUrl}/api/case/reset`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ caseId }),
  }).then(r => r.json());
}

async function pollJob(statusUrl, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const r = await fetch(`${baseUrl}${statusUrl}`);
    const snap = await r.json();
    if (snap.status === 'succeeded') return snap;
    if (snap.status === 'failed') throw new Error(`job failed: ${snap.error?.message || 'unknown'}`);
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('job timed out');
}

function spawnServer(extraEnv = {}) {
  const home = join(tmpdir(), `turn-cycle-multi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      HOME: home,
      PORT: String(PORT),
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
  return { server, home };
}

test('case state accumulates nodes and edges across turns', async () => {
  const { server, home } = spawnServer();
  const caseId = 'test-einstein-multi-1';

  try {
    await waitForServer(server);
    await resetCase(caseId);

    // Turn 1: start
    const turn1 = await startTurn(caseId, 1);
    assert.equal(turn1.result.turn, 1);
    assert.ok(turn1.result.worldState, 'turn 1 should return worldState');

    // Do aftermath
    const after1 = await doAftermath({
      caseId,
      turn: 1,
      playerChoiceId: 'action-observe',
      playerChoiceLabel: '继续观察',
      narrativeContext: 'test',
      worldState: turn1.result.worldState,
      intelCardTitle: 'test',
    });
    assert.equal(after1.result.stage, 'complete');

    // Check case state accumulated
    const state1 = await getCaseState(caseId);
    assert.ok(state1.ok);
    assert.ok(Array.isArray(state1.caseState.nodes), 'should have nodes array');
    assert.ok(state1.caseState.nodes.length >= 1, 'should have at least one node');
    assert.ok(Array.isArray(state1.stateChangeHistory), 'should have stateChangeHistory');

    // Turn 2: start - should see accumulated state
    const turn2 = await startTurn(caseId, 2);
    assert.equal(turn2.result.turn, 2);
    const ws2 = turn2.result.worldState;
    assert.ok(ws2, 'turn 2 should return worldState');
    assert.ok(Array.isArray(ws2.nodes), 'world state should have nodes array');
    assert.ok(ws2.nodes.length >= 1, 'world state should have nodes from turn 1');

    // Do aftermath for turn 2
    const after2 = await doAftermath({
      caseId,
      turn: 2,
      playerChoiceId: 'action-act',
      playerChoiceLabel: '采取行动',
      narrativeContext: 'turn 2',
      worldState: ws2,
      intelCardTitle: 'turn 2',
    });
    assert.equal(after2.result.stage, 'complete');

    // Verify state continues to accumulate
    const state2 = await getCaseState(caseId);
    assert.ok(state2.stateChangeHistory.length >= state1.stateChangeHistory.length,
      'state change history should grow');
  } finally {
    server.kill('SIGTERM');
    await rm(home, { recursive: true, force: true });
  }
});

test('case state tracks risk components and overall', async () => {
  const { server, home } = spawnServer();
  const caseId = 'test-risk-tracking';

  try {
    await waitForServer(server);
    await resetCase(caseId);

    const turn1 = await startTurn(caseId, 1);
    const after1 = await doAftermath({
      caseId,
      turn: 1,
      playerChoiceId: 'act1',
      playerChoiceLabel: 'act1',
      narrativeContext: '',
      worldState: turn1.result.worldState,
      intelCardTitle: 't1',
    });

    const state = await getCaseState(caseId);
    assert.ok(state.caseState.riskIndicators);
    assert.equal(state.caseState.riskIndicators.max, 5);
    assert.ok(Array.isArray(state.caseState.riskIndicators.components));
    assert.ok(state.caseState.riskIndicators.components.length >= 1);
  } finally {
    server.kill('SIGTERM');
    await rm(home, { recursive: true, force: true });
  }
});

test('reset endpoint clears case state', async () => {
  const { server, home } = spawnServer();
  const caseId = 'test-reset';

  try {
    await waitForServer(server);
    await resetCase(caseId);

    // Create state via turn cycle (use fallback path so it works without model)
    const turn1 = await startTurn(caseId, 1);
    const stateBefore = await getCaseState(caseId);
    assert.ok(stateBefore, 'case state should exist after start');

    // Reset
    const resetResult = await resetCase(caseId);
    assert.equal(resetResult.ok, true);

    // Verify state is cleared
    const afterReset = await getCaseState(caseId);
    assert.equal(afterReset, null, 'case state should be null after reset');
  } finally {
    server.kill('SIGTERM');
    await rm(home, { recursive: true, force: true });
  }
});

test('5 consecutive turns maintain consistent state', async () => {
  const { server, home } = spawnServer();
  const caseId = 'test-five-turns';

  try {
    await waitForServer(server);
    await resetCase(caseId);

    let prevNodeCount = 0;
    let prevRisk = 0;

    for (let turn = 1; turn <= 5; turn++) {
      const start = await startTurn(caseId, turn);
      const ws = start.result.worldState;
      assert.ok(ws, `turn ${turn} should return worldState`);

      const after = await doAftermath({
        caseId,
        turn,
        playerChoiceId: `action-${turn}`,
        playerChoiceLabel: `action ${turn}`,
        narrativeContext: `turn ${turn} context`,
        worldState: ws,
        intelCardTitle: `turn ${turn} card`,
      });
      assert.equal(after.result.stage, 'complete');

      const state = await getCaseState(caseId);
      const nodeCount = state.caseState.nodes.length;
      // 节点数应该递增或保持（取决于 LLM 生成）
      assert.ok(nodeCount >= prevNodeCount, `node count should not decrease: ${nodeCount} >= ${prevNodeCount}`);
      prevNodeCount = nodeCount;

      // 风险条应该有效（0-5 之间）
      assert.ok(state.caseState.riskIndicators.overall >= 0, 'risk overall should be >= 0');
      assert.ok(state.caseState.riskIndicators.overall <= 5, 'risk overall should be <= 5');
    }

    // 5 回合后 case state 应该稳定
    const finalState = await getCaseState(caseId);
    assert.ok(finalState.ok, 'final state should be retrievable');
    assert.ok(Array.isArray(finalState.caseState.nodes), 'final state should have nodes');
    assert.ok(finalState.caseState.nodes.length >= 1, 'final state should have at least 1 node');
  } finally {
    server.kill('SIGTERM');
    await rm(home, { recursive: true, force: true });
  }
});

test('worldState is returned on every turn (not just first)', async () => {
  const { server, home } = spawnServer();
  const caseId = 'test-worldstate-persistence';

  try {
    await waitForServer(server);
    await resetCase(caseId);

    for (let turn = 1; turn <= 3; turn++) {
      const start = await startTurn(caseId, turn);
      assert.ok(start.result.worldState, `turn ${turn} start should include worldState`);
      assert.ok(start.result.worldState.anchor, `turn ${turn} worldState should have anchor`);
      assert.ok(Array.isArray(start.result.worldState.nodes), `turn ${turn} should have nodes array`);
      assert.ok(start.result.worldState.riskIndicators, `turn ${turn} should have riskIndicators`);
    }
  } finally {
    server.kill('SIGTERM');
    await rm(home, { recursive: true, force: true });
  }
});