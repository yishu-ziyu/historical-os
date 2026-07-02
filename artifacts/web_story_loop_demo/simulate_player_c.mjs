#!/usr/bin/env node
// 仅运行线索追踪者（Player C）
// 前面的玩家数据已从前一次运行中收集

const BASE = 'http://127.0.0.1:8892';
const POLL_INTERVAL = 600;
const POLL_TIMEOUT = 600_000;

const CASE_ID = 'einstein-1933';
const CASE_TITLE = '爱因斯坦未离开德国';
const HISTORICAL_ANCHORS = [
  'Einstein 1933 年 10 月未离开柏林',
  '柏林物理学会存在犹太裔会员名单',
  '德国铀计划早期理论工作由理论物理研究所承担',
];

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}
async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}
async function pollJob(jobId) {
  const deadline = Date.now() + POLL_TIMEOUT;
  while (Date.now() < deadline) {
    const data = await get(`/api/jobs/${jobId}`);
    if (data.status === 'succeeded' || data.status === 'failed') return data;
    await sleep(POLL_INTERVAL);
  }
  throw new Error(`Job ${jobId} timed out`);
}
async function resetCase() {
  try { await post('/api/case/reset', { caseId: CASE_ID }); await sleep(200); } catch (e) { /* ignore */ }
}

function pickOption(options, strategy) {
  if (!options || options.length === 0) return null;
  const scored = options.map((o) => {
    const risk = o.riskCost || 0;
    const drift = o.estimatedDrift?.turnDelta || 0;
    const intel = o.intelReturn === 'high' ? 2 : o.intelReturn === 'medium' ? 1 : 0;
    let score;
    if (strategy === 'conservative') score = -(risk * 3 + Math.abs(drift) * 2);
    else if (strategy === 'aggressive') score = risk * 2 + Math.abs(drift) * 3;
    else score = intel * 3 - risk * 1 + Math.abs(drift) * 0.5;
    return { option: o, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].option;
}

async function runPlayer(playerName, strategy) {
  await resetCase();
  const playerHistory = [];
  const turnResults = [];
  let lastWorldState = null;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`玩家「${playerName}」开始模拟（策略：${strategy}）`);
  console.log('='.repeat(60));

  for (let turn = 1; turn <= 3; turn++) {
    console.log(`\n--- ${playerName} 回合 ${turn} ---`);
    const startBody = {
      caseId: CASE_ID, turn, caseTitle: CASE_TITLE,
      historicalAnchors: HISTORICAL_ANCHORS, playerHistory,
      riskLevel: lastWorldState?.riskIndicators?.overall || 1,
    };
    if (lastWorldState) { startBody.worldState = lastWorldState; startBody.previousChoice = lastWorldState.previousChoice || null; }

    const startJob = await post('/api/turn/start', startBody);
    console.log(`  启动 job: ${startJob.jobId}`);
    const startResult = await pollJob(startJob.jobId);
    if (startResult.status === 'failed') { console.error(`  回合 ${turn} 启动失败:`, startResult.error); continue; }

    const turnData = startResult.result;
    const briefing = turnData.briefing?.intelCard;
    const situation = turnData.situationRoom;
    const options = situation?.actionOptions?.options || [];

    if (briefing) {
      console.log(`  情报卡: ${briefing.header?.title || '(无标题)'}`);
      console.log(`  线索数: ${briefing.clues?.length || 0}`);
      if (briefing.contradictions?.length > 0) {
        console.log(`  矛盾点: ${briefing.contradictions.map(c => c.description).join('; ')}`);
      }
    }
    console.log(`  行动选项 (${options.length}):`);
    options.forEach((o, i) => {
      console.log(`    [${i}] ${o.label} | 风险=${o.riskCost} | 偏移=${o.estimatedDrift?.turnDelta ?? '?'}σ | 情报=${o.intelReturn}`);
    });

    const chosen = pickOption(options, strategy);
    if (!chosen) { console.error('  没有可选选项!'); continue; }
    console.log(`  → 选择: ${chosen.label} (偏移预估 ${chosen.estimatedDrift?.turnDelta ?? '?'}σ)`);
    playerHistory.push(chosen.label);

    const aftermathJob = await post('/api/turn/aftermath', {
      turn, caseId: CASE_ID,
      playerChoiceId: chosen.id, playerChoiceLabel: chosen.label,
      narrativeContext: briefing?.body?.text?.slice(0, 300) || '',
      worldState: turnData.worldState,
      intelCardTitle: briefing?.header?.title || CASE_TITLE,
      playerHistory,
      briefingHistoryFlags: turnData.historyFlags || [],
      situationRoomHistoryFlags: situation?.historyFlags || [],
    });
    const aftermathResult = await pollJob(aftermathJob.jobId);
    if (aftermathResult.status === 'failed') { console.error(`  回合 ${turn} aftermath 失败:`, aftermathResult.error); continue; }

    const a = aftermathResult.result.aftermath;
    lastWorldState = aftermathResult.result.worldState;

    const turnRecord = {
      turn, choice: chosen.label, choiceId: chosen.id,
      riskCost: chosen.riskCost, estimatedDrift: chosen.estimatedDrift,
      narrative: a.narrative || '(无 narrative)',
      worldLineShift: a.worldLineShift,
      stateChanges: a.stateChanges || [], newClues: a.newClues || [],
      newNodes: a.newNodes || [], newEdges: a.newEdges || [],
      totalDelta: lastWorldState?.worldLineShift?.totalDelta || 0,
    };
    turnResults.push(turnRecord);

    const wls = a.worldLineShift;
    console.log(`  偏移: +${wls?.turnDelta ?? 0}σ (累计 ${turnRecord.totalDelta}σ)`);
    console.log(`  因果: ${wls?.cause || '(无)'}`);
    console.log(`  narrative: ${a.narrative?.slice(0, 120) || '(无)'}...`);
    if (a.newClues?.length > 0) console.log(`  新线索: ${a.newClues.map(c => c.text?.slice(0, 50)).join('; ')}`);
    if (a.newNodes?.length > 0) console.log(`  新节点: ${a.newNodes.map(n => n.label).join(', ')}`);
  }

  return { playerName, strategy, turnResults };
}

(async () => {
  const result = await runPlayer('线索追踪者', 'clue-driven');
  console.log('\n\n=== 线索追踪者完整数据 ===');
  console.log(JSON.stringify(result, null, 2));
})().catch((e) => { console.error('模拟失败:', e); process.exit(1); });
