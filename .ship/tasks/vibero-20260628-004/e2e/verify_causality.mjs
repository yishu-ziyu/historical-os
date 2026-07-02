// Round 048 因果链验证脚本：reset → turn1 → aftermath(激进选择) → turn2 → 看因果传导
const BASE = 'http://127.0.0.1:8892';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

async function pollJob(jobId, label, maxWait = 240) {
  for (let i = 0; i < maxWait / 2; i++) {
    const job = await get(`/api/jobs/${jobId}`);
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'done') return job;
    process.stdout.write('.');
    await sleep(2000);
  }
  throw new Error(`${label} timeout`);
}

function dump(label, obj) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

async function main() {
  console.log('=== 1. reset case ===');
  const reset = await post('/api/case/reset', { caseId: 'einstein-1933' });
  console.log(JSON.stringify(reset).slice(0, 120));

  console.log('\n=== 2. start turn 1 (briefing + situation room) ===');
  const start1 = await post('/api/turn/start', {
    caseId: 'einstein-1933',
    turn: 1,
    playerHistory: [],
    markedClues: {},
  });
  const job1 = start1.jobId;
  console.log('job1:', job1);
  const done1 = await pollJob(job1, 'turn1');
  if (done1.status !== 'succeeded' && done1.status !== 'done') {
    console.log('TURN1 FAILED:', JSON.stringify(done1).slice(0, 500));
    return;
  }
  const r1 = done1.result;
  const brief1 = r1?.briefing?.intelCard;
  console.log('\n--- T1 briefing title:', brief1?.header?.title);
  console.log('--- T1 briefing text:', (brief1?.body?.text || '').slice(0, 250));
  console.log('--- T1 contradictions:', brief1?.contradictions?.length || 0);
  console.log('--- T1 clues:', brief1?.clues?.length || 0);

  const sr1 = r1?.situationRoom;
  console.log('\n--- T1 situation anchor:', sr1?.anchor?.label);
  const opts1 = sr1?.actionOptions?.options || [];
  console.log('--- T1 action options:', opts1.length);
  for (const o of opts1) {
    const ed = o.estimatedDrift || {};
    console.log(`   * ${o.id} | ${o.label} | riskCost=${o.riskCost} intelReturn=${o.intelReturn} | estDrift.turnDelta=${ed.turnDelta} | reason=${(ed.reason || '').slice(0, 80)}`);
  }
  console.log('--- T1 worldState.worldLineShift:', r1?.worldState?.worldLineShift);
  console.log('--- T1 previousChoice:', r1?.worldState?.previousChoice);

  // 选最激进的选项
  const aggressive = opts1
    .slice()
    .sort((a, b) => (b.estimatedDrift?.turnDelta || 0) - (a.estimatedDrift?.turnDelta || 0))[0];
  if (!aggressive) {
    console.log('NO AGGRESSIVE OPTION FOUND');
    return;
  }
  console.log(`\n=== 3. submit aftermath: pick "${aggressive.label}" (turnDelta=${aggressive.estimatedDrift?.turnDelta}) ===`);

  const aftermath1 = await post('/api/turn/aftermath', {
    caseId: 'einstein-1933',
    turn: 1,
    playerChoiceId: aggressive.id,
    playerChoiceLabel: aggressive.label,
    playerHistory: [aggressive.label],
    markedClues: {},
    intelCardTitle: brief1?.header?.title,
    narrativeContext: aggressive.consequencePreview || '',
    briefingHistoryFlags: r1?.briefing?.historyFlags || [],
    situationRoomHistoryFlags: sr1?.historyFlags || [],
  });
  const ajob1 = aftermath1.jobId;
  console.log('aftermath job:', ajob1);
  const adone1 = await pollJob(ajob1, 'aftermath1');
  if (adone1.status !== 'succeeded' && adone1.status !== 'done') {
    console.log('AFTERMATH1 FAILED:', JSON.stringify(adone1).slice(0, 500));
    return;
  }
  const am1 = adone1.result;
  const wls1 = am1?.aftermath?.worldLineShift;
  console.log('\n--- aftermath1 narrative:', (am1?.aftermath?.narrative || '').slice(0, 300));
  console.log('--- aftermath1 stateChanges:', (am1?.aftermath?.stateChanges || []).length);
  for (const sc of (am1?.aftermath?.stateChanges || []).slice(0, 4)) {
    console.log(`   * ${sc.target}.${sc.field}: ${sc.from} → ${sc.to} | evidence=${(sc.evidence || '').slice(0, 60)}`);
  }
  console.log('--- aftermath1 worldLineShift:', wls1);
  console.log('--- aftermath1 newNodes:', (am1?.aftermath?.newNodes || []).length);
  console.log('--- aftermath1 requiresHumanApproval:', am1?.aftermath?.requiresHumanApproval);
  console.log('--- aftermath1 finalWorldState.worldLineShift:', am1?.worldState?.worldLineShift);

  // 启动第二回合，看因果是否传导
  console.log('\n=== 4. start turn 2 (看 previousChoice + worldLineShift 是否进入 prompt) ===');
  const start2 = await post('/api/turn/start', {
    caseId: 'einstein-1933',
    turn: 2,
    playerHistory: [aggressive.label],
    markedClues: {},
  });
  const job2 = start2.jobId;
  console.log('job2:', job2);
  const done2 = await pollJob(job2, 'turn2');
  if (done2.status !== 'succeeded' && done2.status !== 'done') {
    console.log('TURN2 FAILED:', JSON.stringify(done2).slice(0, 500));
    return;
  }
  const r2 = done2.result;
  console.log('\n--- T2 briefing title:', r2?.briefing?.intelCard?.header?.title);
  console.log('--- T2 briefing text:', (r2?.briefing?.intelCard?.body?.text || '').slice(0, 250));
  console.log('--- T2 worldState.worldLineShift:', r2?.worldState?.worldLineShift);
  console.log('--- T2 previousChoice:', r2?.worldState?.previousChoice);
  console.log('--- T2 stateChangeHistory count:', r2?.worldState?.stateChangeHistory?.length);

  const sr2 = r2?.situationRoom;
  const opts2 = sr2?.actionOptions?.options || [];
  console.log('\n--- T2 situation anchor:', sr2?.anchor?.label);
  console.log('--- T2 action options:', opts2.length);
  for (const o of opts2) {
    const ed = o.estimatedDrift || {};
    console.log(`   * ${o.id} | ${o.label} | estDrift.turnDelta=${ed.turnDelta} totalDelta=${ed.totalDelta} | reason=${(ed.reason || '').slice(0, 80)}`);
  }
  if (sr2?.actionOptions?.previousChoiceImpact) {
    console.log('--- T2 previousChoiceImpact:', sr2.actionOptions.previousChoiceImpact.description);
  }

  console.log('\n=== 5. 因果链判定 ===');
  const t1Drift = wls1?.turnDelta;
  const t2Cumulative = r2?.worldState?.worldLineShift?.totalDelta;
  const t2PrevChoice = r2?.worldState?.previousChoice?.label;
  console.log(`回合1 aftermath turnDelta: ${t1Drift}`);
  console.log(`回合2 累计 totalDelta: ${t2Cumulative} (应 > 0 且包含回合1贡献)`);
  console.log(`回合2 previousChoice: ${t2PrevChoice} (应为 "${aggressive.label}")`);
  const causalityClosed =
    typeof t1Drift === 'number' && t1Drift !== 0 &&
    typeof t2Cumulative === 'number' && t2Cumulative >= t1Drift - 0.1 &&
    t2PrevChoice === aggressive.label;
  console.log(`因果链闭合: ${causalityClosed ? 'YES ✓' : 'NO ✗'}`);
}

main().catch((e) => {
  console.error('VERIFY ERROR:', e);
  process.exit(1);
});
