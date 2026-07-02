// eval_narrative_quality.test.mjs
// Narrative quality evals for the alternate history story game
//
// Tests 3 quality dimensions against a running server with real LLM:
//   1. Drift range accuracy: conservative choice -> low sigma, etc.
//   2. Verdict matching: driftWeightLabel should match cumulative sigma
//   3. Narrative human-touch: last sentence must be sensory detail, no mechanism terms
//
// Run: node --test eval_narrative_quality.test.mjs
// Requires ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY, or MINIMAX_BASE_URL + MINIMAX_API_KEY

import { spawn } from 'node:child_process';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

// ═══ Configuration ═══════════════════════════════════════════════

const JOB_POLL_INTERVAL_MS = 300;
const JOB_TIMEOUT_MS = 120_000;
const CASE_ID_PREFIX = 'eval-nq';

const CASE_SEED = {
  caseTitle: '爱因斯坦未离开德国',
  historicalAnchors: [
    'Einstein 1933 年 10 月未离开柏林',
    '柏林物理学会存在犹太裔会员名单',
    '德国铀计划早期理论工作由理论物理研究所承担',
  ],
};

// ═══ Scoring: drift weight label (mirrors turn_cycle.js driftWeightLabel) ═══

function driftWeightLabel(sigma) {
  const s = Math.abs(Number(sigma) || 0);
  if (s < 0.35) return { label: '轻擦历史', severity: 'low' };
  if (s < 0.85) return { label: '推动时间线', severity: 'mid' };
  if (s < 1.6) return { label: '撕裂历史', severity: 'high' };
  return { label: '重写世界', severity: 'critical' };
}

// ═══ Scoring: narrative human-touch ══════════════════════════════

function getLastSentence(text) {
  if (!text || typeof text !== 'string') return '';
  const sentences = text.split(/[。！？.!?\n]+/).map(s => s.trim()).filter(Boolean);
  return sentences[sentences.length - 1] || '';
}

// Sensory detail patterns: sound, smell, touch, visual
const SENSORY_PATTERNS = [
  /声音|响起|静默|寂静|脚步|关门|铃声|歌声|低语|呼啸|叹息/,
  /气味|味道|烟味|墨香|咖啡|雪茄|潮湿|干燥|铁锈/,
  /触感|冰冷|温暖|颤抖|手心|指尖|粗糙|发烫/,
  /窗外|光线|阴影|瞳孔|眼底|面容|呼吸|脉搏/,
];

// Mechanism terms that must NOT appear in the ending sentence
const MECHANISM_TERMS = [
  '世界线', 'σ', '偏移', '分叉', '推演', '分析',
  '选择', '回合', '累计', '偏移量', 'delta',
];

function hasSensoryDetail(sentence) {
  return SENSORY_PATTERNS.some(p => p.test(sentence));
}

function lacksMechanismTerms(sentence) {
  return !MECHANISM_TERMS.some(t => sentence.includes(t));
}

function scoreNarrative(narrative) {
  const last = getLastSentence(narrative);
  const sensory = hasSensoryDetail(last);
  const clean = lacksMechanismTerms(last);
  return {
    score: (sensory && clean) ? 1 : 0,
    max: 1,
    sensory,
    clean,
    lastSentence: last,
  };
}

// ═══ Scoring: drift range ════════════════════════════════════════

function scoreDriftInRange(turnDelta, range) {
  const [min, max] = range;
  return (Number.isFinite(turnDelta) && turnDelta >= min && turnDelta <= max) ? 1 : 0;
}

function scoreVerdictMatch(cumulativeDelta, expectedLabel) {
  return driftWeightLabel(cumulativeDelta).label === expectedLabel ? 1 : 0;
}

// ═══ LLM credential check ═══════════════════════════════════════

function hasRealLLMCreds() {
  const ak = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
  const ab = process.env.ANTHROPIC_BASE_URL;
  const mk = process.env.MINIMAX_API_KEY || process.env.TOKEN_PLAN_API_KEY;
  const mb = process.env.MINIMAX_BASE_URL || process.env.TOKEN_PLAN_BASE_URL;
  return Boolean((ak && ab) || (mk && mb));
}

// ═══ Server management ══════════════════════════════════════════

function spawnEvalServer(port, extraEnv = {}) {
  const home = join(tmpdir(), `eval-nq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,    // inherit LLM creds so real calls work
      HOME: home,
      PORT: String(port),
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { server, home };
}

async function waitForServer(proc, port, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (proc.exitCode !== null) {
      throw new Error(`server exited early with code ${proc.exitCode}`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('server did not start within timeout');
}

async function waitForJob(port, statusUrl, timeoutMs = JOB_TIMEOUT_MS) {
  const base = `http://127.0.0.1:${port}`;
  const started = Date.now();
  let snapshot;
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`${base}${statusUrl}`);
    assert.equal(res.status, 200);
    snapshot = await res.json();
    if (snapshot.status === 'succeeded') return snapshot;
    if (snapshot.status === 'failed') {
      throw new Error(`job failed: ${snapshot.error?.message || 'unknown'}`);
    }
    await new Promise(r => setTimeout(r, JOB_POLL_INTERVAL_MS));
  }
  throw new Error(
    `job did not complete within ${timeoutMs}ms; last status: ${snapshot?.status}`
  );
}

// ═══ Turn flow ════════════════════════════════════════════════════

async function postTurnStart(port, caseId) {
  const res = await fetch(`http://127.0.0.1:${port}/api/turn/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      caseId,
      turn: 1,
      ...CASE_SEED,
      riskLevel: 1,
    }),
  });
  if (!res.ok) throw new Error(`turn/start HTTP ${res.status}`);
  return res.json();
}

async function postTurnAftermath(port, caseId, choice, worldState, intelCardTitle) {
  const res = await fetch(`http://127.0.0.1:${port}/api/turn/aftermath`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      turn: 1,
      caseId,
      playerChoiceId: choice.id,
      playerChoiceLabel: choice.label,
      narrativeContext: '',
      worldState: worldState || {},
      intelCardTitle: intelCardTitle || CASE_SEED.caseTitle,
      briefingHistoryFlags: ['fictional_branch'],
      situationRoomHistoryFlags: [],
      playerHistory: [],
    }),
  });
  if (!res.ok) throw new Error(`turn/aftermath HTTP ${res.status}`);
  return res.json();
}

async function resetCase(port, caseId) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/case/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseId }),
    });
    if (res.status !== 200 && res.status !== 404) {
      throw new Error(`case/reset HTTP ${res.status}`);
    }
  } catch (err) {
    // 404 on reset is fine (case doesn't exist yet)
    if (!err.message.includes('404')) throw err;
  }
}

// Pick the action option whose estimatedDrift.turnDelta is closest to the
// expected range. Prefers options inside the range (distance 0) over those outside.
function pickOptionByDrift(options, expectedRange) {
  const [rangeMin, rangeMax] = expectedRange;
  let best = options[0];
  let bestDist = Infinity;

  for (const opt of options) {
    const td = typeof opt.estimatedDrift?.turnDelta === 'number'
      ? opt.estimatedDrift.turnDelta
      : 0;
    let dist;
    if (td < rangeMin) dist = rangeMin - td;
    else if (td > rangeMax) dist = td - rangeMax;
    else dist = 0;
    if (dist < bestDist) {
      bestDist = dist;
      best = opt;
    }
  }

  return best;
}

// ═══ Golden Evals ════════════════════════════════════════════════
// Each eval defines a choice tier -> expected drift range, verdict label,
// and narrative human-touch requirement.
//
// Scoring per eval (3 criteria x 1 point each):
//   drift range  1 if turnDelta within [min, max], else 0
//   verdict      1 if driftWeightLabel(totalDelta).label matches expected, else 0
//   narrative    1 if last sentence has sensory detail AND no mechanism terms, else 0

const EVALS = [
  {
    id: 'conservative-observe',
    name: '保守观察 -> 低偏移 [0.0, 0.3]',
    description: '选择观察不做干预，LLM 应返回最低档偏移',
    expectedDriftRange: [0.0, 0.30],
    expectedVerdict: '轻擦历史',
  },
  {
    id: 'targeted-intervention',
    name: '针对性干预 -> 中偏移 [0.4, 0.8]',
    description: '通过第三方渠道递送信息，LLM 应返回中档偏移',
    expectedDriftRange: [0.4, 0.80],
    expectedVerdict: '推动时间线',
  },
  {
    id: 'high-risk-direct',
    name: '高风险直接行动 -> 高偏移 [0.9, 1.5]',
    description: '直接联系关键人物，LLM 应返回高档偏移',
    expectedDriftRange: [0.9, 1.50],
    expectedVerdict: '撕裂历史',
  },
  {
    id: 'history-changing',
    name: '改变历史走向 -> 极高偏移 [1.6, 2.5]',
    description: '安排秘密逃离，LLM 应返回极高偏移',
    expectedDriftRange: [1.6, 2.50],
    expectedVerdict: '重写世界',
  },
  {
    id: 'corrective-pullback',
    name: '纠偏回撤 -> 负向偏移 [-0.5, -0.1]',
    description: '撤销干预让时间线回归真实历史，LLM 应返回负偏移',
    expectedDriftRange: [-0.50, -0.10],
    expectedVerdict: '轻擦历史',
  },
];

// ═══ Test runner ═════════════════════════════════════════════════

for (const ev of EVALS) {
  test(ev.name, async () => {
    // Skip if no LLM credentials in environment
    // These evals require a real LLM call -- mock won't exercise narrative quality
    if (!hasRealLLMCreds()) {
      console.log(
        `[SKIP] ${ev.name} — 需要 LLM 凭据\n` +
        '  设置以下任一组合：\n' +
        '    ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY\n' +
        '    MINIMAX_BASE_URL + MINIMAX_API_KEY'
      );
      return;
    }

    // Each eval spawns its own server (port 8900+index) and cleans up.
    // This avoids EADDRINUSE and cross-test pollution.
    const testPort = 8900 + EVALS.indexOf(ev);
    const caseId = `${CASE_ID_PREFIX}-${EVALS.indexOf(ev)}`;
    const { server: serverProc, home: serverHome } = spawnEvalServer(testPort);

    try {
      console.error(ev.description);
      await waitForServer(serverProc, testPort);
      console.error(`server ready at port ${testPort}`);

      await resetCase(testPort, caseId);
      console.error(`case ${caseId} reset`);

      // Step 1: turn/start -> briefing + actionOptions with estimatedDrift
      const startResp = await postTurnStart(testPort, caseId);
      assert.ok(startResp.jobId, 'turn/start should return jobId');
      const startSnap = await waitForJob(testPort, startResp.statusUrl);

      assert.equal(startSnap.status, 'succeeded');
      const optCount = startSnap.result?.situationRoom?.actionOptions?.options?.length ?? 0;
      assert.ok(optCount >= 2,
        `need >= 2 action options to select drift tier, got ${optCount}`);

      const options = startSnap.result.situationRoom.actionOptions.options;
      const chosenOption = pickOptionByDrift(options, ev.expectedDriftRange);

      console.error(
        `selected: "${chosenOption.label}" (estimatedDrift: ${chosenOption.estimatedDrift?.turnDelta ?? 'none'}σ)`
      );

      // Step 2: turn/aftermath -> narrative + worldLineShift
      const aftermathResp = await postTurnAftermath(
        testPort,
        caseId,
        chosenOption,
        startSnap.result.worldState || {},
        startSnap.result.briefing?.intelCard?.header?.title
      );
      assert.ok(aftermathResp.jobId, 'aftermath should return jobId');
      const aftermathSnap = await waitForJob(testPort, aftermathResp.statusUrl);

      assert.equal(aftermathSnap.status, 'succeeded');
      assert.ok(aftermathSnap.result?.aftermath, 'should have aftermath');

      const aftermath = aftermathSnap.result.aftermath;
      const shift = aftermath.worldLineShift || {};
      const turnDelta = shift.turnDelta ?? 0;
      const totalDelta = shift.totalDelta ?? turnDelta;
      const narrative = aftermath.narrative || '';

      console.error(
        `worldLineShift: turnDelta=${turnDelta}σ totalDelta=${totalDelta}σ` +
        (shift.domains?.length ? ` domains=[${shift.domains.join(',')}]` : '')
      );
      if (shift.cause) console.error(`cause: ${shift.cause}`);

      // Step 3: Score (3 criteria x 1 point each)
      const driftScore = scoreDriftInRange(turnDelta, ev.expectedDriftRange);
      const verdictScore = scoreVerdictMatch(totalDelta, ev.expectedVerdict);
      const narrativeResult = scoreNarrative(narrative);
      const narrativeScore = narrativeResult.score;

      const total = driftScore + verdictScore + narrativeScore;

      console.error(
        `scores: drift=${driftScore}/1 verdict=${verdictScore}/1 narrative=${narrativeScore}/1 = ${total}/3`
      );
      console.error(`narrative last sentence: "${narrativeResult.lastSentence}"`);

      // Step 4: All 3 criteria must pass
      assert.ok(driftScore > 0,
        `[${ev.id}] drift ${turnDelta}σ outside [${ev.expectedDriftRange.join(',')}]`);
      assert.ok(verdictScore > 0,
        `[${ev.id}] verdict "${driftWeightLabel(totalDelta).label}" != expected "${ev.expectedVerdict}"`);
      assert.ok(narrativeScore > 0,
        `[${ev.id}] narrative ending: "${narrativeResult.lastSentence}"`);
    } finally {
      serverProc.kill('SIGTERM');
      await rm(serverHome, { recursive: true, force: true }).catch(() => {});
    }
  });
}
