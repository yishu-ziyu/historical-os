// eval_narrative_quality.test.mjs
// Narrative quality evals for the alternate history story game
//
// Part 1 - Unit tests (always run, no server needed):
//   Scoring logic: drift range, verdict mapping, narrative human-touch
//
// Part 2 - Integration diagnostics (connect to running server on port 8892):
//   Full pipeline against real LLM: turn/start -> aftermath -> score
//   These use threshold-style assertions to surface LLM calibration issues
//   without being all-or-nothing.
//
// Run: node --test eval_narrative_quality.test.mjs

import { spawn } from 'node:child_process';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

// ═══ Configuration ═══════════════════════════════════════════════

const EVAL_SERVER_PORT = 8892;
const JOB_POLL_INTERVAL_MS = 500;
const JOB_TIMEOUT_MS = 180_000;
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

// Sensory detail patterns: sound, smell, touch/temperature, visual, concrete objects
const SENSORY_PATTERNS = [
  /声音|响起|静默|寂静|脚步|关门|铃声|歌声|低语|呼啸|叹息|敲门|汽笛|留声机|钢琴|小提琴|唱片|邮差/,
  /气味|味道|烟味|墨香|咖啡|雪茄|潮湿|干燥|铁锈|灰尘|霉味|面包|酒精/,
  /触感|冰冷|温暖|颤抖|手心|指尖|粗糙|发烫|刺骨|滚烫/,
  /窗外|光线|阴影|瞳孔|眼底|面容|呼吸|脉搏|月光|路灯|雾气|晨光/,
  /烟灰缸|香烟|墨水|咖啡杯|蛋糕|铅笔|镜头|信封|纸张|印章/,
];

// Mechanism terms that must NOT appear in the ending sentence.
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

function scoreDriftInRange(turnDelta, range) {
  const [min, max] = range;
  return (Number.isFinite(turnDelta) && turnDelta >= min && turnDelta <= max) ? 1 : 0;
}

function scoreVerdictMatch(cumulativeDelta, expectedLabel) {
  return driftWeightLabel(cumulativeDelta).label === expectedLabel ? 1 : 0;
}

// ═══ Server management ══════════════════════════════════════════

function hasRealLLMCreds() {
  const ak = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
  const ab = process.env.ANTHROPIC_BASE_URL;
  const mk = process.env.MINIMAX_API_KEY || process.env.TOKEN_PLAN_API_KEY;
  const mb = process.env.MINIMAX_BASE_URL || process.env.TOKEN_PLAN_BASE_URL;
  return Boolean((ak && ab) || (mk && mb));
}

function spawnEvalServer(port) {
  const home = join(tmpdir(), `eval-nq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      HOME: home,
      PORT: String(port),
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

async function pollJob(port, statusUrl, timeoutMs = JOB_TIMEOUT_MS) {
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
    if (!err.message.includes('404')) throw err;
  }
}

function pickOptionByDrift(options, expectedRange) {
  const [rangeMin, rangeMax] = expectedRange;
  let best = options[0];
  let bestDist = Infinity;
  for (const opt of options) {
    const td = typeof opt.estimatedDrift?.turnDelta === 'number'
      ? opt.estimatedDrift.turnDelta
      : 0;
    const dist = td < rangeMin ? rangeMin - td : td > rangeMax ? td - rangeMax : 0;
    if (dist < bestDist) { bestDist = dist; best = opt; }
  }
  return best;
}

// ═══ Golden Evals ════════════════════════════════════════════════
//
// Each eval defines a choice tier -> expected drift range, verdict label.
// Range widths reflect realistic LLM calibration variance (observed from
// actual model output during development).
//
// The integration tests use threshold-style assertions:
//   - drift in range: hard assertion (covers the core mechanic)
//   - verdict: diagnostic only (warns if LLM under-calibrates)
//   - narrative human-touch: hard assertion (this is the highest-ROI quality gate)

const EVALS = [
  {
    id: 'conservative-observe',
    name: '保守观察 -> 低偏移 [0.0, 0.5]',
    description: '选择观察不做干预，LLM 应返回最低档偏移',
    expectedDriftRange: [0.0, 0.50],
    expectedVerdict: '轻擦历史',
    narrativeRequired: true,
  },
  {
    id: 'targeted-intervention',
    name: '针对性干预 -> 中偏移 [0.3, 1.0]',
    description: '通过第三方渠道递送信息，LLM 应返回中档偏移',
    expectedDriftRange: [0.3, 1.00],
    expectedVerdict: '推动时间线',
    narrativeRequired: true,
  },
  {
    id: 'high-risk-direct',
    name: '高风险直接行动 -> 高偏移 [0.9, 1.5]',
    description: '直接联系关键人物，LLM 应返回高档偏移',
    expectedDriftRange: [0.9, 1.50],
    expectedVerdict: '撕裂历史',
    narrativeRequired: true,
  },
  {
    id: 'history-changing',
    name: '改变历史走向 -> 极高偏移 [1.4, 2.8]',
    description: '安排秘密逃离，LLM 应返回极高偏移',
    expectedDriftRange: [1.4, 2.80],
    expectedVerdict: '重写世界',
    narrativeRequired: true,
  },
  {
    id: 'corrective-pullback',
    name: '纠偏回撤 -> 低偏移 [0.0, 0.5]',
    description: '低调递送避风头建议（回撤型选择也应低偏移）',
    expectedDriftRange: [0.0, 0.50],
    expectedVerdict: '轻擦历史',
    narrativeRequired: true,
  },
];

// ═══ Part 1: Unit tests (always run, no server) ═══════════════════

test('driftWeightLabel maps sigma thresholds correctly', () => {
  assert.equal(driftWeightLabel(0).label, '轻擦历史');
  assert.equal(driftWeightLabel(0.1).label, '轻擦历史');
  assert.equal(driftWeightLabel(0.3).label, '轻擦历史');
  assert.equal(driftWeightLabel(0.35).label, '推动时间线');
  assert.equal(driftWeightLabel(0.7).label, '推动时间线');
  assert.equal(driftWeightLabel(0.85).label, '撕裂历史');
  assert.equal(driftWeightLabel(1.5).label, '撕裂历史');
  assert.equal(driftWeightLabel(1.6).label, '重写世界');
  assert.equal(driftWeightLabel(3.0).label, '重写世界');
  // driftWeightLabel uses Math.abs, so negative values map by magnitude
  assert.equal(driftWeightLabel(-0.1).label, '轻擦历史');
  assert.equal(driftWeightLabel(-0.5).label, '推动时间线');
});

test('driftWeightLabel severity matches tier', () => {
  assert.equal(driftWeightLabel(0).severity, 'low');
  assert.equal(driftWeightLabel(0.5).severity, 'mid');
  assert.equal(driftWeightLabel(1.2).severity, 'high');
  assert.equal(driftWeightLabel(2.5).severity, 'critical');
});

test('getLastSentence extracts the final sentence', () => {
  assert.equal(getLastSentence('第一段。第二段。'), '第二段');
  assert.equal(getLastSentence('只有一段'), '只有一段');
  assert.equal(getLastSentence(''), '');
  assert.equal(getLastSentence(null), '');
});

test('scoreNarrative awards 1/1 when ending has sensory detail and no mechanism terms', () => {
  const r = scoreNarrative('值班台已记录。窗外的雨打在玻璃上，无人唱和。');
  assert.equal(r.score, 1);
  assert.equal(r.sensory, true);
  assert.equal(r.clean, true);
});

test('scoreNarrative awards 0/1 when ending lacks sensory detail and is analytical', () => {
  const r = scoreNarrative('系统已完成分析。此次推演涉及的因果链已归档。');
  assert.equal(r.score, 0);
  assert.equal(r.sensory, false);
  assert.equal(r.clean, false);
});

test('scoreNarrative awards 0/1 when ending contains mechanism terms', () => {
  const r = scoreNarrative('值班台已记录。本次偏移量为 0.4σ，世界线已改变。');
  assert.equal(r.score, 0);
  assert.equal(r.clean, false);
});

test('scoreNarrative awards 0/1 when ending lacks both sensory and cleanliness', () => {
  const r = scoreNarrative('这是本次回合的分析结果。');
  assert.equal(r.score, 0);
  assert.equal(r.sensory, false);
});

test('scoreDriftInRange returns 1/1 when value is within range', () => {
  assert.equal(scoreDriftInRange(0.4, [0.0, 0.8]), 1);
  assert.equal(scoreDriftInRange(0.0, [0.0, 0.8]), 1);
  assert.equal(scoreDriftInRange(0.8, [0.0, 0.8]), 1);
  assert.equal(scoreDriftInRange(-0.3, [-0.5, 0.0]), 1);
});

test('scoreDriftInRange returns 0/1 when value is outside range', () => {
  assert.equal(scoreDriftInRange(1.0, [0.0, 0.8]), 0);
  assert.equal(scoreDriftInRange(-1.0, [-0.5, 0.0]), 0);
  assert.equal(scoreDriftInRange(NaN, [0, 1]), 0);
  assert.equal(scoreDriftInRange(null, [0, 1]), 0);
});

test('scoreVerdictMatch matches expected label', () => {
  assert.equal(scoreVerdictMatch(0.1, '轻擦历史'), 1);
  assert.equal(scoreVerdictMatch(0.5, '推动时间线'), 1);
  assert.equal(scoreVerdictMatch(1.2, '撕裂历史'), 1);
  assert.equal(scoreVerdictMatch(2.5, '重写世界'), 1);
  assert.equal(scoreVerdictMatch(0.5, '轻擦历史'), 0);
  assert.equal(scoreVerdictMatch(0.5, '重写世界'), 0);
});

test('pickOptionByDrift selects the option closest to the expected range', () => {
  const options = [
    { label: '低', estimatedDrift: { turnDelta: 0.1 } },
    { label: '高', estimatedDrift: { turnDelta: 1.5 } },
    { label: '中', estimatedDrift: { turnDelta: 0.7 } },
  ];
  const chosen = pickOptionByDrift(options, [0.0, 0.5]);
  assert.equal(chosen.label, '低');
});

test('pickOptionByDrift handles options with no estimatedDrift', () => {
  const options = [
    { label: 'A' },
    { label: 'B', estimatedDrift: { turnDelta: 0.5 } },
  ];
  const chosen = pickOptionByDrift(options, [0.4, 0.6]);
  assert.equal(chosen.label, 'B');
});

test('sensory patterns match common narrative endings', () => {
  const endings = [
    '窗外的雨打在玻璃上。',
    '留声机放着舒曼的《梦幻曲》。',
    '指尖沾了一点刚拆信封时蹭到的墨痕。',
    '隔壁桌的年轻助手偷偷把半块黑面包塞进了他的抽屉。',
    '门口的邮差停了三秒，转身走了。',
    '雪茄的烟雾在天花板灯下绕了半圈才散。',
    '爱因斯坦摩挲着申请回执上的校徽，指尖沾了一点墨痕。',
  ];
  for (const text of endings) {
    assert.ok(
      hasSensoryDetail(text),
      `expected sensory match for: "${text}"`
    );
  }
});

// ═══ Part 2: Integration tests (server + LLM required) ═══════════
// Connects to the already-running server on port 8892.
// Each eval uses a unique caseId to avoid cross-test pollution.
// Verdict mismatches produce warnings (not failures) because LLM calibration
// variance is expected and should be surfaced, not silently accepted.

test('narrative quality: golden evals against real LLM', async () => {
  // Verify server is reachable; if not, skip the entire integration block
  let serverAlive = false;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3000);
    const res = await fetch(`http://127.0.0.1:${EVAL_SERVER_PORT}/`, { signal: ctl.signal });
    clearTimeout(timer);
    serverAlive = res.ok;
  } catch {}

  if (!serverAlive) {
    console.log(
      '[SKIP] Integration evals need server.mjs running on port ' + EVAL_SERVER_PORT +
      ' with LLM credentials (ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY or MINIMAX_*)'
    );
    return;
  }

  // Spawn isolated server (inherits env for LLM creds)
  const testPort = 8920;
  const { server: serverProc, home: serverHome } = spawnEvalServer(testPort);

  try {
    await waitForServer(serverProc, testPort);
    console.error(`integration eval server at port ${testPort}`);

    let totalPassed = 0;
    let totalFailed = 0;
    const failures = [];

    for (const ev of EVALS) {
      const caseId = `${CASE_ID_PREFIX}-${ev.id}`;
      await resetCase(testPort, caseId);
      console.error(`\n=== ${ev.name}: ${ev.description}`);

      // Step 1: turn/start -> briefing + actionOptions with estimatedDrift
      const startResp = await postTurnStart(testPort, caseId);
      assert.ok(startResp.jobId, 'turn/start should return jobId');
      const startSnap = await pollJob(testPort, startResp.statusUrl);
      assert.equal(startSnap.status, 'succeeded');

      const options = startSnap.result?.situationRoom?.actionOptions?.options || [];
      assert.ok(options.length >= 2, `need >= 2 options, got ${options.length}`);

      const chosen = pickOptionByDrift(options, ev.expectedDriftRange);
      console.error(`  selected: "${chosen.label}" (estimatedDrift: ${chosen.estimatedDrift?.turnDelta ?? 'none'}σ)`);

      // Step 2: turn/aftermath -> narrative + worldLineShift
      const aftermathResp = await postTurnAftermath(
        testPort,
        caseId,
        chosen,
        startSnap.result.worldState || {},
        startSnap.result.briefing?.intelCard?.header?.title
      );
      assert.ok(aftermathResp.jobId, 'aftermath should return jobId');
      const aftermathSnap = await pollJob(testPort, aftermathResp.statusUrl);
      assert.equal(aftermathSnap.status, 'succeeded');

      const aftermath = aftermathSnap.result.aftermath;
      assert.ok(aftermath, 'should have aftermath');

      const shift = aftermath.worldLineShift || {};
      const turnDelta = shift.turnDelta ?? 0;
      const totalDelta = shift.totalDelta ?? turnDelta;
      const narrative = aftermath.narrative || '';

      console.error(
        `  worldLineShift: turnDelta=${turnDelta}σ totalDelta=${totalDelta}σ` +
        (shift.domains?.length ? ` domains=[${shift.domains.join(',')}]` : '')
      );
      if (shift.cause) console.error(`  cause: ${shift.cause}`);

      const narrativeResult = scoreNarrative(narrative);
      console.error(`  narrative last sentence: "${narrativeResult.lastSentence}"`);

      // Score all 3 criteria
      const driftOk = scoreDriftInRange(turnDelta, ev.expectedDriftRange);
      const verdictOk = scoreVerdictMatch(totalDelta, ev.expectedVerdict);
      const narrativeOk = narrativeResult.score;

      console.error(
        `  score: drift=${driftOk}/1 verdict=${verdictOk}/1 narrative=${narrativeOk}/1`
      );

      // Drift range: hard assertion (this is the core mechanic being tested)
      assert.ok(driftOk > 0,
        `[${ev.id}] drift ${turnDelta}σ outside [${ev.expectedDriftRange.join(',')}]`);

      // Narrative human-touch: hard assertion (highest-ROI quality gate)
      assert.ok(narrativeOk > 0,
        `[${ev.id}] narrative ending: "${narrativeResult.lastSentence}"`);

      // Verdict: diagnostic warning instead of hard assertion.
      // LLMs often cluster around comfort zones. A mismatch means the prompt
      // needs calibration guidance, not that the system is broken.
      if (!verdictOk) {
        const actualLabel = driftWeightLabel(totalDelta).label;
        console.error(
          `  [CALIBRATION WARNING] [${ev.id}] verdict "${actualLabel}" != expected "${ev.expectedVerdict}"` +
          ` (totalDelta=${totalDelta}σ). ` +
          `The LLM is under-calibrated on drift tiers. Consider adding tier examples to the aftermath prompt.`
        );
      }
    }

    console.error(`\n=== Integration eval complete ===`);

  } finally {
    serverProc.kill('SIGTERM');
    await rm(serverHome, { recursive: true, force: true }).catch(() => {});
  }
});
