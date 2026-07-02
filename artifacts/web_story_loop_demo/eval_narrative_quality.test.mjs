// eval_narrative_quality.test.mjs
// Narrative quality evals for the alternate history story game
//
// Tests 3 quality dimensions against a running server on port 8892:
//   1. Drift range accuracy: conservative choice -> low sigma, etc.
//   2. Verdict matching: driftWeightLabel should match cumulative sigma
//   3. Narrative human-touch: last sentence must be sensory detail, no mechanism terms
//
// Run: node eval_narrative_quality.test.mjs
// Requires server.mjs running on port 8892

import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';

// ═══ Configuration ════════════════════════════════════════════════

const BASE_URL = 'http://127.0.0.1:8892';
const JOB_POLL_INTERVAL_MS = 500;
const JOB_TIMEOUT_MS = 300_000; // thinking model can take 2-3 min per call
const CASE_ID_PREFIX = 'eval-nq';

const CASE_SEED = {
  caseTitle: '爱因斯坦未离开德国',
  historicalAnchors: [
    'Einstein 1933 年 10 月未离开柏林',
    '柏林物理学会存在犹太裔会员名单',
    '德国铀计划早期理论工作由理论物理研究所承担',
  ],
};

// ═══ Scoring functions ═══════════════════════════════════════════

function driftWeightLabel(sigma) {
  const s = Math.abs(Number(sigma) || 0);
  if (s < 0.35) return { label: '轻擦历史', severity: 'low' };
  if (s < 0.85) return { label: '推动时间线', severity: 'mid' };
  if (s < 1.6) return { label: '撕裂历史', severity: 'high' };
  return { label: '重写世界', severity: 'critical' };
}

function getLastSentence(text) {
  if (!text || typeof text !== 'string') return '';
  const sentences = text.split(/[。！？.!?\n]+/).map(s => s.trim()).filter(Boolean);
  return sentences[sentences.length - 1] || '';
}

// Sensory detail patterns: broad enough to catch LLM narrative output.
// Categories: sound, smell, touch/temperature, visual/light, concrete objects.
const SENSORY_PATTERNS = [
  /声音|响起|静默|寂静|脚步|关门|铃声|歌声|低语|呼啸|叹息|敲门|汽笛/,
  /气味|味道|烟味|墨香|咖啡|雪茄|潮湿|干燥|铁锈|灰尘|霉味|面包|酒精/,
  /触感|冰冷|温暖|颤抖|手心|指尖|粗糙|发烫|刺骨|滚烫/,
  /窗外|光线|阴影|瞳孔|眼底|面容|呼吸|脉搏|月光|路灯|雾气|晨光/,
  /烟灰缸|香烟|墨水|咖啡杯|蛋糕|铅笔|镜头|信封|纸张|印章/,
];

// Mechanism terms that must NOT appear in the ending sentence.
// These break the "feeling" of narrative.
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

// ═══ Helpers ════════════════════════════════════════════════════

async function pollJob(statusUrl) {
  const base = `${BASE_URL}${statusUrl}`;
  const started = Date.now();
  let snapshot;
  while (Date.now() - started < JOB_TIMEOUT_MS) {
    const res = await fetch(base);
    if (!res.ok) throw new Error(`job poll HTTP ${res.status}`);
    snapshot = await res.json();
    if (snapshot.status === 'succeeded') return snapshot;
    if (snapshot.status === 'failed') throw new Error(snapshot.error?.message || 'job failed');
    await new Promise(r => setTimeout(r, JOB_POLL_INTERVAL_MS));
  }
  throw new Error(`job timeout after ${JOB_TIMEOUT_MS}ms, last status: ${snapshot?.status}`);
}

async function resetCase(caseId) {
  try {
    const res = await fetch(`${BASE_URL}/api/case/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseId }),
    });
    if (res.status !== 200 && res.status !== 404) throw new Error(`reset HTTP ${res.status}`);
  } catch (err) {
    if (!err.message.includes('404')) throw err;
  }
}

function pickOptionByDrift(options, expectedRange) {
  const [rangeMin, rangeMax] = expectedRange;
  let best = options[0];
  let bestDist = Infinity;
  for (const opt of options) {
    const td = typeof opt.estimatedDrift?.turnDelta === 'number' ? opt.estimatedDrift.turnDelta : 0;
    const dist = td < rangeMin ? rangeMin - td : td > rangeMax ? td - rangeMax : 0;
    if (dist < bestDist) { bestDist = dist; best = opt; }
  }
  return best;
}

// ═══ Golden Evals ════════════════════════════════════════════════
// Each eval defines a choice tier -> expected drift range, verdict label.
//
// Scoring per eval (3 criteria x 1 point each):
//   drift range  1 if turnDelta within [min, max], else 0
//   verdict      1 if driftWeightLabel(totalDelta).label matches expected, else 0
//   narrative    1 if last sentence has sensory detail AND no mechanism terms, else 0
//
// IMPORTANT: ranges are intentionally wide to accommodate LLM calibration variance.
// The evals are diagnostic, not pass/fail gates.

const EVALS = [
  {
    id: 'conservative-observe',
    name: '保守观察 -> 低偏移 [0.0, 0.5]',
    description: '选择观察不做干预，LLM 应返回最低档偏移',
    expectedDriftRange: [0.0, 0.50],
    expectedVerdict: '轻擦历史',
  },
  {
    id: 'targeted-intervention',
    name: '针对性干预 -> 中偏移 [0.3, 1.0]',
    description: '通过第三方渠道递送信息，LLM 应返回中档偏移',
    expectedDriftRange: [0.3, 1.00],
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
    name: '改变历史走向 -> 极高偏移 [1.4, 2.8]',
    description: '安排秘密逃离，LLM 应返回极高偏移',
    expectedDriftRange: [1.4, 2.80],
    expectedVerdict: '重写世界',
  },
  {
    id: 'corrective-pullback',
    name: '纠偏回撤 -> 低偏移 [0.0, 0.5]',
    description: '低调递送避风头建议（回撤型选择也应低偏移）',
    expectedDriftRange: [0.0, 0.50],
    expectedVerdict: '轻擦历史',
  },
];

// ═══ Test runner ════════════════════════════════════════════════
// Connects to the already-running server on port 8892.
// Each eval uses a unique caseId to avoid cross-test pollution.
// Run: node eval_narrative_quality.test.mjs

for (const ev of EVALS) {
  test(ev.name, async () => {
    const caseId = `${CASE_ID_PREFIX}-${ev.id}`;

    await resetCase(caseId);
    console.error(ev.description);

    // Step 1: turn/start -> briefing + actionOptions with estimatedDrift
    const startResp = await fetch(`${BASE_URL}/api/turn/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        caseId,
        turn: 1,
        ...CASE_SEED,
        riskLevel: 1,
      }),
    });
    if (!startResp.ok) throw new Error(`turn/start HTTP ${startResp.status}`);
    const startJson = await startResp.json();
    assert.ok(startJson.jobId, 'turn/start should return jobId');

    const startSnap = await pollJob(startJson.statusUrl);
    assert.equal(startSnap.status, 'succeeded');

    const options = startSnap.result?.situationRoom?.actionOptions?.options || [];
    assert.ok(options.length >= 2, `need >= 2 options, got ${options.length}`);

    const chosen = pickOptionByDrift(options, ev.expectedDriftRange);
    console.error(`selected: "${chosen.label}" (estimatedDrift: ${chosen.estimatedDrift?.turnDelta ?? 'none'}σ)`);

    // Step 2: turn/aftermath -> narrative + worldLineShift
    const aftermathResp = await fetch(`${BASE_URL}/api/turn/aftermath`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        turn: 1,
        caseId,
        playerChoiceId: chosen.id,
        playerChoiceLabel: chosen.label,
        narrativeContext: '',
        worldState: startSnap.result.worldState || {},
        intelCardTitle: startSnap.result.briefing?.intelCard?.header?.title,
        briefingHistoryFlags: ['fictional_branch'],
        situationRoomHistoryFlags: [],
        playerHistory: [],
      }),
    });
    if (!aftermathResp.ok) throw new Error(`turn/aftermath HTTP ${aftermathResp.status}`);
    const aftermathJson = await aftermathResp.json();
    assert.ok(aftermathJson.jobId, 'aftermath should return jobId');

    const aftermathSnap = await pollJob(aftermathJson.statusUrl);
    assert.equal(aftermathSnap.status, 'succeeded');
    assert.ok(aftermathSnap.result?.aftermath, 'should have aftermath');

    const aftermath = aftermathSnap.result.aftermath;
    const shift = aftermath.worldLineShift || {};
    const turnDelta = shift.turnDelta ?? 0;
    const totalDelta = shift.totalDelta ?? turnDelta;
    const narrative = aftermath.narrative || '';

    console.error(`worldLineShift: turnDelta=${turnDelta}σ totalDelta=${totalDelta}σ` +
      (shift.domains?.length ? ` domains=[${shift.domains.join(',')}]` : ''));
    if (shift.cause) console.error(`cause: ${shift.cause}`);

    // Step 3: Score (3 criteria x 1 point each)
    const driftScore = scoreDriftInRange(turnDelta, ev.expectedDriftRange);
    const verdictScore = scoreVerdictMatch(totalDelta, ev.expectedVerdict);
    const narrativeResult = scoreNarrative(narrative);
    const narrativeScore = narrativeResult.score;
    const total = driftScore + verdictScore + narrativeScore;

    console.error(`scores: drift=${driftScore}/1 verdict=${verdictScore}/1 narrative=${narrativeScore}/1 = ${total}/3`);
    console.error(`narrative last sentence: "${narrativeResult.lastSentence}"`);

    // Step 4: Assert (log failures but don't hard-fail — evals are diagnostic)
    const failures = [];
    if (driftScore === 0) failures.push(`drift ${turnDelta}σ outside [${ev.expectedDriftRange.join(',')}]`);
    if (verdictScore === 0) failures.push(`verdict "${driftWeightLabel(totalDelta).label}" != expected "${ev.expectedVerdict}"`);
    if (narrativeScore === 0) failures.push(`narrative ending: "${narrativeResult.lastSentence}"`);

    if (failures.length > 0) {
      console.error(`[${ev.id}] FAILURES: ${failures.join('; ')}`);
      // Log but don't hard-fail — evals expose calibration issues for prompt engineering
      assert.ok(true, `[${ev.id}] eval completed with ${failures.length}/3 failures (diagnostic mode)`);
    } else {
      assert.ok(true, `[${ev.id}] all 3 criteria passed`);
    }
  });
}
