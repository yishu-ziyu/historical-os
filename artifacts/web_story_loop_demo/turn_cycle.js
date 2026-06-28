// ─── 历史异常值班台 · 三段式回合循环 ───────────────────────────

const clueConfidenceLabels = {
  verified: '已核验',
  partially_verified: '部分核验',
  unverified: '未核验',
  inferred: '推断',
};

const riskComponentLabels = {
  '操作风险': '操作风险',
  '暴露风险': '暴露风险',
  '历史偏移': '历史偏移',
  '不可控变量': '不可控变量',
  '时间压力': '时间压力',
};

const stateChangeTargetLabels = {
  'character.einstein': '爱因斯坦',
  'character.planck': '普朗克',
  'organization.berlin-academy': '柏林科学院',
  'organization.berlin-university-physics': '柏林大学物理系',
  'risk.overall': '整体风险',
};

let turnState = {
  turn: 0,
  stage: 'idle',
  briefing: null,
  situationRoom: null,
  actionOptions: [],
  chosenOption: null,
  aftermath: null,
  historyFlags: [],
  jobId: null,
  caseId: 'einstein-1933',
  markedClues: {},
  currentTurnMarkedCount: 0,
};

const MARKED_CLUE_API_PATH = '/api/case';

const dom = {};

function $(id) {
  return document.getElementById(id);
}

function initDom() {
  dom.shell = $('briefingSection')?.parentElement || document.querySelector('.desk');
  dom.stageBadge = $('turnStageBadge');
  dom.turnCounter = $('turnCounter');
  dom.stageTrack = $('stageTrack');
  dom.briefingSection = $('briefingSection');
  dom.situationSection = $('situationSection');
  dom.aftermathSection = $('aftermathSection');
  dom.emptyState = $('turnEmptyState');
  dom.startBtn = $('startTurnBtn');
  dom.footerStatus = $('footerStatus');
}

function clearEl(el) {
  if (el) el.replaceChildren();
}

function make(tag, text, cls) {
  const el = document.createElement(tag);
  if (text !== undefined && text !== null) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}

function setStageBadge(text, severity = 'info') {
  if (!dom.stageBadge) return;
  dom.stageBadge.textContent = text;
  dom.stageBadge.dataset.severity = severity;
}

function setTurnCounter(n) {
  if (dom.turnCounter) dom.turnCounter.textContent = String(n);
}

function setFooterStatus(text) {
  if (dom.footerStatus) dom.footerStatus.textContent = text;
}

function updateStageTrack(activeStage) {
  if (!dom.stageTrack) return;
  const steps = dom.stageTrack.querySelectorAll('.stage-step');
  const order = ['briefing', 'situation', 'aftermath'];
  const activeIdx = activeStage ? order.indexOf(activeStage) : -1;
  steps.forEach((step, i) => {
    step.classList.remove('active', 'done');
    if (activeIdx >= 0) {
      if (i < activeIdx) step.classList.add('done');
      else if (i === activeIdx) step.classList.add('active');
    }
  });
}

function showOnly(section) {
  [dom.briefingSection, dom.situationSection, dom.aftermathSection].forEach((el) => {
    if (el) el.hidden = el !== section;
  });
  if (dom.emptyState) dom.emptyState.hidden = !!section;
}

function showLoading(message) {
  showOnly(null);
  if (dom.emptyState) {
    dom.emptyState.hidden = false;
    clearEl(dom.emptyState);
    dom.emptyState.appendChild(make('div', null, 'loading-stamp'));
    dom.emptyState.querySelector('.loading-stamp').textContent = 'PROCESSING';
    dom.emptyState.appendChild(make('p', message, 'loading-msg'));
  }
}

// ─── Briefing ───

function renderBriefing(briefing) {
  if (!dom.briefingSection) return;
  showOnly(dom.briefingSection);
  updateStageTrack('briefing');
  clearEl(dom.briefingSection);

  const card = briefing?.intelCard;
  if (!card) {
    dom.briefingSection.appendChild(make('p', '情报卡数据缺失。'));
    return;
  }

  const header = make('div', null, 'intel-header');
  const headerLeft = make('div');
  headerLeft.appendChild(make('span', card.classification || '绝密', 'intel-classification'));
  headerLeft.appendChild(make('strong', card.header?.title || '未命名档案', 'intel-title'));
  headerLeft.appendChild(make('small',
    `${card.header?.documentId || '无编号'} · ${card.header?.date || '未知日期'} · ${card.header?.source || '未知来源'}`,
    'intel-meta'));
  const headerRight = make('div', null, 'intel-stamp-side');
  headerRight.textContent = card.header?.date || '';
  header.append(headerLeft, headerRight);
  dom.briefingSection.appendChild(header);

  const body = make('div', null, 'intel-body');
  if (card.body?.text) {
    body.appendChild(make('p', card.body.text, 'intel-text'));
  }
  if (Array.isArray(card.body?.handwrittenNotes) && card.body.handwrittenNotes.length > 0) {
    const notes = make('div', null, 'intel-notes');
    card.body.handwrittenNotes.forEach((note) => {
      const noteEl = make('div', null, 'intel-note');
      const p = make('p');
      p.textContent = `「${note.text}」`;
      if (note.translation) p.textContent += `（${note.translation}）`;
      noteEl.appendChild(p);
      noteEl.appendChild(make('small', `${note.location || '注释'} · ${note.inkColor || 'blue'}墨水`));
      notes.appendChild(noteEl);
    });
    body.appendChild(notes);
  }
  dom.briefingSection.appendChild(body);

  if (Array.isArray(card.contradictions) && card.contradictions.length > 0) {
    const section = make('div', null, 'intel-section');
    section.appendChild(make('div', '矛盾信号', 'intel-section-title'));
    card.contradictions.forEach((c) => {
      const item = make('div', null, `intel-contradiction significance-${c.significance || 'low'}`);
      item.textContent = c.description || c.type || '矛盾点';
      section.appendChild(item);
    });
    dom.briefingSection.appendChild(section);
  }

  if (Array.isArray(card.clues) && card.clues.length > 0) {
    const section = make('div', null, 'intel-section');
    section.appendChild(make('div', '可标记线索', 'intel-section-title'));
    const list = make('ul', null, 'clue-list');
    card.clues.forEach((clue) => {
      const li = make('li', null, 'clue-item');
      const isMarked = Boolean(turnState.markedClues[clue.id]);
      if (isMarked) li.classList.add('marked');
      li.appendChild(make('span', clue.text || '', 'clue-text'));
      li.appendChild(make('span',
        `${clue.category || ''} · ${clueConfidenceLabels[clue.confidence] || clue.confidence || '推断'}`,
        'clue-meta'));
      const markBtn = make('button', isMarked ? '已标记' : '标记', 'clue-mark');
      markBtn.type = 'button';
      markBtn.dataset.clueId = clue.id || '';
      markBtn.onclick = () => toggleMarkClue(clue, li, markBtn);
      li.appendChild(markBtn);

      if (isMarked) {
        const noteWrap = make('div', null, 'clue-note-wrap');
        const noteArea = make('textarea', null, 'clue-note');
        noteArea.value = turnState.markedClues[clue.id]?.note || '';
        noteArea.maxLength = 200;
        noteArea.rows = 2;
        noteArea.placeholder = '档案体注释（最多 200 字）';
        const saveNote = make('button', '保存笔记', 'clue-note-save');
        saveNote.type = 'button';
        const status = make('span', '', 'clue-note-status');
        saveNote.onclick = async () => {
          saveNote.disabled = true;
          const result = await saveMarkedClueNote(clue, noteArea.value);
          saveNote.disabled = false;
          status.textContent = result.ok
            ? '✓ 已保存'
            : (result.error || '保存失败');
          status.dataset.severity = result.ok ? 'ok' : 'error';
        };
        noteArea.onkeydown = (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            saveNote.click();
          }
        };
        noteWrap.append(noteArea, saveNote, status);
        li.appendChild(noteWrap);
      }
      list.appendChild(li);
    });
    section.appendChild(list);
    dom.briefingSection.appendChild(section);
  }

  const footer = make('div', null, 'intel-footer');
  footer.appendChild(make('span', `下一个时间节点：${card.nextTimeNode || '未知'}`));
  const conf = card.provenance?.confidence;
  footer.appendChild(make('span',
    `来源：${card.provenance?.type || 'generated'} · 可信度 ${Number.isFinite(Number(conf)) ? Number(conf).toFixed(2) : '?'}`));
  dom.briefingSection.appendChild(footer);
}

// ─── Situation Room ───

function renderSituationRoom(sr) {
  if (!dom.situationSection) return;
  showOnly(dom.situationSection);
  updateStageTrack('situation');
  clearEl(dom.situationSection);

  dom.situationSection.appendChild(make('div', 'SITUATION ROOM', 'section-eyebrow'));
  dom.situationSection.appendChild(make('h2', '态势分析'));

  if (sr?.anchor) {
    const anchor = make('div', null, 'situation-anchor');
    anchor.appendChild(make('span', '异常锚点', 'anchor-label'));
    anchor.appendChild(make('strong', sr.anchor.label || '未命名锚点', 'anchor-title'));
    dom.situationSection.appendChild(anchor);
  }

  const grid = make('div', null, 'situation-grid');

  // 节点
  const nodeBlock = make('div', null, 'situation-block');
  nodeBlock.appendChild(make('h3', '态势节点'));
  const nodeGrid = make('div', null, 'node-grid');
  if (Array.isArray(sr?.nodes) && sr.nodes.length > 0) {
    sr.nodes.forEach((node) => {
      const el = make('div', null, `situation-node status-${node.status || 'unknown'}`);
      el.appendChild(make('strong', node.label || node.id));
      if (node.statusLabel) el.appendChild(make('small', node.statusLabel));
      nodeGrid.appendChild(el);
    });
  } else {
    nodeGrid.appendChild(make('div', '暂无节点'));
  }
  nodeBlock.appendChild(nodeGrid);
  grid.appendChild(nodeBlock);

  // 风险
  const riskBlock = make('div', null, 'situation-block');
  riskBlock.appendChild(make('h3', '风险指标'));
  if (sr?.riskIndicators) {
    const meter = make('div', null, 'risk-meter');
    const bar = make('div', null, 'risk-bar');
    const overall = Number(sr.riskIndicators.overall) || 0;
    const max = Number(sr.riskIndicators.max) || 5;
    const fill = make('div', null, 'risk-fill');
    fill.style.width = `${Math.min(100, (overall / max) * 100)}%`;
    bar.appendChild(fill);
    meter.appendChild(bar);
    meter.appendChild(make('div', `整体风险 ${overall}/${max}`, 'risk-value'));
    riskBlock.appendChild(meter);

    if (Array.isArray(sr.riskIndicators.components) && sr.riskIndicators.components.length > 0) {
      const list = make('ul', null, 'risk-components');
      sr.riskIndicators.components.forEach((comp) => {
        const li = make('li');
        li.appendChild(make('span', riskComponentLabels[comp.label] || comp.label || '风险'));
        li.appendChild(make('small', String(comp.value ?? 0)));
        list.appendChild(li);
      });
      riskBlock.appendChild(list);
    }
  }
  grid.appendChild(riskBlock);

  dom.situationSection.appendChild(grid);

  if (sr?.nextDeadline) {
    const dl = make('div', null, 'situation-deadline');
    dl.appendChild(make('strong', `期限 · ${sr.nextDeadline.label || '截止线'}`));
    dl.appendChild(document.createTextNode(` ${sr.nextDeadline.date || ''}`));
    dom.situationSection.appendChild(dl);
  }

  if (sr?.actionOptions?.previousChoiceImpact) {
    const impact = make('div', null, 'previous-impact');
    impact.appendChild(make('strong', '上一回合影响'));
    impact.appendChild(make('div', sr.actionOptions.previousChoiceImpact.description || ''));
    dom.situationSection.appendChild(impact);
  }

  // 行动选项
  const options = sr?.actionOptions?.options || [];
  if (options.length > 0) {
    dom.situationSection.appendChild(make('div', '可执行行动', 'intel-section-title'));
    const list = make('div', null, 'action-options');
    options.forEach((option) => {
      const btn = make('button', null, 'action-option');
      btn.type = 'button';
      btn.disabled = turnState.stage !== 'awaiting_choice';
      btn.dataset.actionId = option.id;

      const header = make('div', null, 'action-header');
      header.appendChild(make('strong', option.label));
      header.appendChild(make('span',
        `历史合理性 · ${option.historicalPlausibility || 'medium'}`,
        `action-plausibility plausibility-${option.historicalPlausibility || 'medium'}`));
      btn.appendChild(header);

      if (option.description) btn.appendChild(make('p', option.description, 'action-description'));

      const metrics = make('div', null, 'action-metrics');
      metrics.appendChild(make('span', `风险成本 ${option.riskCost ?? 0}`));
      metrics.appendChild(make('span', `情报回报 ${option.intelReturn || 'low'}`));
      btn.appendChild(metrics);

      if (option.consequencePreview) {
        btn.appendChild(make('p', `后果预览：${option.consequencePreview}`, 'action-consequence'));
      }

      btn.onclick = () => onActionChosen(option);
      list.appendChild(btn);
    });
    dom.situationSection.appendChild(list);
  }
}

// ─── Aftermath ───

function renderAftermath(aftermath) {
  if (!dom.aftermathSection) return;
  showOnly(dom.aftermathSection);
  updateStageTrack('aftermath');
  clearEl(dom.aftermathSection);

  dom.aftermathSection.appendChild(make('div', 'AFTERMATH REPORT', 'section-eyebrow'));
  dom.aftermathSection.appendChild(make('h2', `回合 ${turnState.turn} · 推演结果`));
  if (turnState.chosenOption) {
    const choice = make('p', null, 'aftermath-choice');
    choice.textContent = `你选择了：${turnState.chosenOption.label}`;
    dom.aftermathSection.appendChild(choice);
  }

  const totalMarked = Object.keys(turnState.markedClues).length;
  if (totalMarked > 0 || turnState.currentTurnMarkedCount > 0) {
    const summary = make('div', null, 'aftermath-marked-summary');
    summary.appendChild(make('strong', '档案柜锁定'));
    summary.appendChild(make('span',
      `本回合锁定 ${turnState.currentTurnMarkedCount} 条 · 累计 ${totalMarked} 条`));
    dom.aftermathSection.appendChild(summary);
  }

  if (aftermath?.narrative) {
    const narr = make('div', null, 'aftermath-narrative');
    narr.appendChild(make('p', aftermath.narrative));
    dom.aftermathSection.appendChild(narr);
  }

  if (Array.isArray(aftermath?.stateChanges) && aftermath.stateChanges.length > 0) {
    dom.aftermathSection.appendChild(make('div', '世界线偏移', 'intel-section-title'));
    const list = make('ul', null, 'shifts-list');
    aftermath.stateChanges
      .filter((sc) => sc.visibility !== 'system_only')
      .forEach((sc) => {
        const li = make('li');
        li.appendChild(make('strong', stateChangeTargetLabels[sc.target] || sc.target));
        const change = make('span', null, 'shift-change');
        const fromStr = typeof sc.from === 'object' ? JSON.stringify(sc.from) : String(sc.from ?? '');
        const toStr = typeof sc.to === 'object' ? JSON.stringify(sc.to) : String(sc.to ?? '');
        change.innerHTML = '';
        change.appendChild(document.createTextNode(`${sc.field}: `));
        const fromEl = make('em', fromStr);
        change.appendChild(fromEl);
        change.appendChild(document.createTextNode(' → '));
        const toEl = make('em', toStr);
        change.appendChild(toEl);
        li.appendChild(change);
        if (sc.evidence) li.appendChild(make('small', `证据：${sc.evidence}`));
        list.appendChild(li);
      });
    dom.aftermathSection.appendChild(list);
  }

  if (Array.isArray(aftermath?.newClues) && aftermath.newClues.length > 0) {
    dom.aftermathSection.appendChild(make('div', '新增线索', 'intel-section-title'));
    const list = make('ul', null, 'new-clues-list');
    aftermath.newClues.forEach((clue) => {
      const li = make('li');
      li.appendChild(make('span', clue.text || ''));
      li.appendChild(make('small',
        `${clue.category || ''} · ${clueConfidenceLabels[clue.confidence] || clue.confidence || '推断'}`));
      list.appendChild(li);
    });
    dom.aftermathSection.appendChild(list);
  }

  if (aftermath?.nextIntelCard) {
    const next = make('div', null, 'aftermath-next');
    next.appendChild(make('h3', '下一回合情报卡预告'));
    next.appendChild(make('p', `${aftermath.nextIntelCard.title || '未命名'} · ${aftermath.nextIntelCard.date || ''}`));
    const btn = make('button', '继续下一回合', 'continue-btn');
    btn.type = 'button';
    btn.onclick = () => startNewTurn();
    next.appendChild(btn);
    dom.aftermathSection.appendChild(next);
  }
}

// ─── 标记线索 API 集成（round 043）────────────────────

async function fetchCaseState() {
  if (!turnState.caseId) return null;
  try {
    const res = await fetch(`${MARKED_CLUE_API_PATH}/${encodeURIComponent(turnState.caseId)}`);
    if (!res.ok) return null;
    const body = await res.json();
    if (body && body.caseState) {
      turnState.markedClues = body.caseState.markedClues || {};
    }
    return body;
  } catch {
    return null;
  }
}

async function postMarkClue(clueId, action, note = '') {
  try {
    const res = await fetch(`${MARKED_CLUE_API_PATH}/${encodeURIComponent(turnState.caseId)}/mark-clue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clueId,
        action,
        note,
        turn: turnState.turn,
      }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: '网络错误' };
  }
}

async function toggleMarkClue(clue, li, markBtn) {
  if (!clue.id) return;
  const wasMarked = Boolean(turnState.markedClues[clue.id]);
  const action = wasMarked ? 'unmark' : 'mark';
  markBtn.disabled = true;
  setFooterStatus(wasMarked ? '正在取消标记…' : '正在写入档案柜…');
  const result = await postMarkClue(clue.id, action);
  markBtn.disabled = false;
  if (!result.ok) {
    setFooterStatus(`失败：${result.error || '标记失败'}`);
    return;
  }
  if (action === 'mark') {
    turnState.markedClues[clue.id] = {
      turnMarked: turnState.turn,
      note: '',
    };
    turnState.currentTurnMarkedCount += 1;
    setFooterStatus('已锁定到档案柜');
  } else {
    delete turnState.markedClues[clue.id];
    setFooterStatus('已取消标记');
  }
  // 重渲染本段
  if (dom.briefingSection) renderBriefing(turnState.briefing);
}

async function saveMarkedClueNote(clue, noteText) {
  const result = await postMarkClue(clue.id, 'mark', noteText);
  if (result.ok && turnState.markedClues[clue.id]) {
    turnState.markedClues[clue.id].note = String(noteText || '').slice(0, 200);
  }
  return result;
}

// ─── 流程 ───

async function onActionChosen(option) {
  if (turnState.stage !== 'awaiting_choice') return;
  turnState.stage = 'committing';
  turnState.chosenOption = option;
  setStageBadge('推演中', 'info');
  setFooterStatus('叙事分析组推演后果中…');
  showLoading('叙事分析组正在推演你选择的后果…');

  try {
    const response = await fetch('/api/turn/aftermath', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        turn: turnState.turn,
        caseId: 'einstein-1933',
        playerChoiceId: option.id,
        playerChoiceLabel: option.label,
        narrativeContext: turnState.briefing?.intelCard?.body?.text || '',
        worldState: turnState.situationRoom,
        intelCardTitle: turnState.briefing?.intelCard?.header?.title,
        briefingHistoryFlags: turnState.briefing?.historyFlags || [],
        situationRoomHistoryFlags: turnState.situationRoom?.historyFlags || [],
      }),
    });
    const started = await response.json();
    if (!response.ok) throw new Error(started.error || 'Aftermath 启动失败');

    const snapshot = await pollJob(started.statusUrl);
    if (snapshot.status !== 'succeeded') throw new Error(snapshot.error?.message || 'Aftermath 失败');

    turnState.aftermath = snapshot.result.aftermath;
    turnState.stage = 'complete';
    renderAftermath(turnState.aftermath);
    setStageBadge(`回合 ${turnState.turn} 完成`, 'success');
    setFooterStatus('推演完成，可继续下一回合');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStageBadge('推演失败', 'warn');
    setFooterStatus(`失败：${message}`);
    showOnly(null);
    if (dom.emptyState) {
      dom.emptyState.hidden = false;
      clearEl(dom.emptyState);
      dom.emptyState.appendChild(make('h2', '推演失败'));
      dom.emptyState.appendChild(make('p', message));
      const btn = make('button', '重试', 'primary-btn');
      btn.onclick = () => startNewTurn();
      dom.emptyState.appendChild(btn);
    }
  }
}

async function pollJob(statusUrl) {
  while (true) {
    const response = await fetch(statusUrl);
    const snapshot = await response.json();
    if (!response.ok) throw new Error(snapshot.error || '任务状态读取失败');
    if (snapshot.status === 'succeeded') return snapshot;
    if (snapshot.status === 'failed') throw new Error(snapshot.error?.message || '任务失败');
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

async function startNewTurn() {
  setStageBadge('生成中', 'info');
  setFooterStatus('情报值班台生成情报卡中…');
  showLoading('情报值班台正在准备本轮情报卡…');

  const nextTurn = turnState.turn + 1;

  try {
    const response = await fetch('/api/turn/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        caseId: 'einstein-1933',
        turn: nextTurn,
        caseTitle: '爱因斯坦未离开德国',
        historicalAnchors: [
          'Einstein 1933 年 10 月未离开柏林',
          '柏林物理学会存在犹太裔会员名单',
          '德国铀计划早期理论工作由理论物理研究所承担',
        ],
        worldState: turnState.situationRoom,
        previousChoice: turnState.chosenOption
          ? { label: turnState.chosenOption.label, consequencePreview: turnState.chosenOption.consequencePreview }
          : null,
        riskLevel: turnState.aftermath?.stateChanges?.some((sc) => sc.target === 'risk.overall') ? 2 : 1,
      }),
    });
    const started = await response.json();
    if (!response.ok) throw new Error(started.error || '回合启动失败');

    const snapshot = await pollJob(started.statusUrl);
    if (snapshot.status !== 'succeeded') throw new Error(snapshot.error?.message || '回合生成失败');

    turnState = {
      turn: snapshot.result.turn,
      stage: 'awaiting_choice',
      briefing: snapshot.result.briefing,
      situationRoom: snapshot.result.situationRoom,
      actionOptions: snapshot.result.situationRoom?.actionOptions || [],
      chosenOption: null,
      aftermath: null,
      historyFlags: snapshot.result.historyFlags || [],
      jobId: snapshot.jobId,
      caseId: turnState.caseId || 'einstein-1933',
      markedClues: {},
      currentTurnMarkedCount: 0,
    };

    // 同步已标记线索（round 043）：从后端拉取 case state
    await fetchCaseState();

    setTurnCounter(turnState.turn);
    renderBriefing(turnState.briefing);

    // 自动滚到态势面板入口（玩家看完情报卡后点"进入态势分析"）
    const enterBtn = make('button', '进入态势分析 ▸', 'continue-btn');
    enterBtn.type = 'button';
    enterBtn.style.marginTop = '24px';
    enterBtn.onclick = () => renderSituationRoom(turnState.situationRoom);
    dom.briefingSection.appendChild(enterBtn);

    setStageBadge('情报卡已就位', 'success');
    setFooterStatus('请阅读情报卡，标记线索后进入态势分析');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStageBadge('生成失败', 'warn');
    setFooterStatus(`失败：${message}`);
    showOnly(null);
    if (dom.emptyState) {
      dom.emptyState.hidden = false;
      clearEl(dom.emptyState);
      dom.emptyState.appendChild(make('h2', '回合生成失败'));
      dom.emptyState.appendChild(make('p', message));
      const btn = make('button', '重试', 'primary-btn');
      btn.onclick = () => startNewTurn();
      dom.emptyState.appendChild(btn);
    }
  }
}

// ─── 档案柜 ────────────────────────────────────────────────

const ARCHIVE_DATA = {
  'einstein-1921': {
    title: '阿尔伯特·爱因斯坦 · 1921 年访问伦敦',
    meta: '类型：人物肖像 · 时期：1921 · 授权：Public Domain (Wikimedia Commons)',
    image: '<img src="./assets/portraits/einstein-head.jpg" alt="爱因斯坦 1921 年肖像" />',
    description: '爱因斯坦于 1921 年访问伦敦皇家学会期间留影。此时他已获得 1921 年诺贝尔物理学奖。照片由 Leopold Geddes 拍摄。柏林物理学会档案处使用此影像作为学会通讯录封面及来宾登记册内的标准肖像。',
    provenance: 'Wikimedia Commons · Public Domain',
  },
  'planck-1910': {
    title: '马克斯·普朗克 · c.1910 肖像',
    meta: '类型：人物肖像 · 时期：约 1910 · 授权：Public Domain',
    image: '<img src="./assets/portraits/planck-1910.jpg" alt="普朗克 c.1910 肖像" />',
    description: '马克斯·普朗克（1858–1947），柏林大学理论物理教授，量子论奠基人。1910 年前后任柏林物理学会主席，对爱因斯坦早期相对论论文给予关键支持。1930 年任威廉皇帝学会会长，二战期间留在柏林。',
    provenance: 'Wikimedia Commons · Public Domain',
  },
  'solvay-1911': {
    title: '第一届索尔维会议 · 1911 年布鲁塞尔',
    meta: '类型：集体合影 · 时期：1911 年 10 月 30 日 – 11 月 3 日 · 授权：Public Domain',
    image: '<img src="./assets/portraits/solvay-1911.jpg" alt="1911 年索尔维会议合影" />',
    description: '首届索尔维会议主题为「辐射与量子理论」。前排左四为爱因斯坦（32 岁），右三为普朗克。其余与会者包括洛伦兹、居里夫人、卢瑟福、维恩、昂内斯等。这是 20 世纪物理学精英罕见的同框记录。',
    provenance: 'Wikimedia Commons · Public Domain · Benjamin Couprie 摄影',
  },
  'dpg-charter': {
    title: '柏林物理学会章程 · 1933 修订草案',
    meta: '类型：组织文件 · 时期：1933 年 4 月（修订中） · 密级：内部',
    image: '<img src="./assets/seals/dpg.svg" alt="印章" class="seal-svg" />',
    description: '本草案于 1933 年 4 月会议讨论。明确要求依据同年颁布之《Gesetz zur Wiederherstellung des Berufsbeamtentums》对学会会员名册进行身份复核。凡属「非雅利安血统」或政治立场不合者之会员资格将被冻结，所属期刊投递权限中止。草案第 12 条规定会员义务部分新增「向帝国效忠」誓词。',
    provenance: '虚构档案 · Deutsche Physikalische Gesellschaft 风格仿写',
  },
  'kaiser-wilhelm': {
    title: '威廉皇帝物理研究所 · 1933 年组织架构',
    meta: '类型：机构档案 · 时期：1933 · 密级：内部',
    image: '<img src="./assets/seals/ptr.svg" alt="印章" class="seal-svg" />',
    description: '威廉皇帝物理研究所（Kaiser-Wilhelm-Institut für Physik）于 1917 年设立。所长安德烈·普朗克于 1933 年退休。爱因斯坦于 1914 年起任所长，并保留此名誉职位至 1933 年。本档案记录研究所与普鲁士科学院、爱因斯坦个人研究项目的三层关系。',
    provenance: '虚构档案 · Kaiser Wilhelm Society 风格仿写',
  },
  'ptr-record': {
    title: '帝国物理技术局 · 1933 年业务记录',
    meta: '类型：机构档案 · 时期：1933 · 密级：STRENG VERTRAULICH',
    image: '<img src="./assets/seals/ptr.svg" alt="印章" class="seal-svg" />',
    description: '帝国物理技术局（PTR）位于布伦瑞克-柏林两地。1933 年起，研究经费分配向「德意志物理学」派系倾斜。所长老斯塔克博士发表《德意志物理学的白色犹太人》一文，公开反对相对论及理论物理。本档案包含 PTR 与帝国教育部关于「相对论之犹太来源调查」的往来信函节录。',
    provenance: '虚构档案 · Physikalisch-Technische Reichsanstalt 风格仿写',
  },
  'newspaper-april1': {
    title: '《新柏林日报》头版 · 1933.04.01',
    meta: '类型：报纸 · 时期：1933 年 4 月 1 日 · 密级：公开',
    image: '<img src="./assets/seals/akademie.svg" alt="印章" class="seal-svg" />',
    description: '头版主要新闻：全国抵制犹太人商铺运动正式实施。DAF（德国劳动阵线）主导之抵制行动波及柏林、波茨坦、莱比锡等大城市。次版刊登「雅利安法案」对公共部门职员之新规定。本期社论题为《德意志科学的未来》，其中点名批评相对论为「犹太人投机思想的产物」。',
    provenance: '虚构档案 · NS 时期德国报纸风格仿写',
  },
  'newspaper-reichstag': {
    title: '《Vossische Zeitung》国会纵火案报道',
    meta: '类型：报纸 · 时期：1933 年 2 月 28 日 · 密级：公开',
    image: '<img src="./assets/seals/akademie.svg" alt="印章" class="seal-svg" />',
    description: '报道国会大厦纵火案紧急号外。范德吕伯（荷兰共产党人）被捕后，希特勒于次日签署《国会纵火案紧急法令》，取消公民基本权利。次日起，共产党议员被捕，社民党议员遭监视。本期同时刊登柏林大学校长宣布「暂停犹太裔教授教职」之声明。',
    provenance: '虚构档案 · 魏玛共和国末期报纸风格仿写',
  },
  'ops-manual': {
    title: '值班台操作手册 · 第 3 版',
    meta: '类型：内部规范 · 密级：内部参考',
    image: '',
    description: '本手册规定值班台标准操作流程：1) 异常事件优先级（红色/黄色/蓝色）；2) 情报分类编码规则（A 人物 / B 机构 / C 事件 / D 文件）；3) 推演报告三段式（事实-推断-风险）；4) 与历史审计频道交互协议。值班员须遵守「严肃处理纳粹语境」「禁止轻浮化」两项基本原则。',
    provenance: '系统内部 · 虚构规范',
  },
  'intel-template': {
    title: '情报分析模板 · v2.1',
    meta: '类型：内部模板 · 密级：内部参考',
    image: '',
    description: '模板字段：编号 / 来源 / 日期 / 密级 / 正文 / 矛盾点 / 可标记线索 / 风险评估 / 下一步建议。模板强制要求每份情报至少包含 1 个可验证的事实锚点（日期/编号/人名/机构），确保不被空洞叙事稀释。',
    provenance: '系统内部 · 虚构模板',
  },
  'audit-log': {
    title: '审计记录样例 · 1933 年 10 月',
    meta: '类型：审计记录 · 密级：内部',
    image: '',
    description: '样例记录：值班员 1001 在第 N 回合生成了涉及「高风险人物生存状态」之推演。系统自动触发 HistoryGuardAgent 检查，识别到方向可能改变真实人物生存状态，已要求人工审批。建议值班员改写方向或暂停推演。本记录证明系统审计机制有效运行。',
    provenance: '系统内部 · 虚构样例',
  },
};

function openArchive(archiveId) {
  const modal = document.getElementById('archiveModal');
  const data = ARCHIVE_DATA[archiveId];
  if (!modal || !data) return;

  const titleEl = document.getElementById('modalTitle');
  const metaEl = document.getElementById('modalMeta');
  const imageEl = document.getElementById('modalImage');
  const descEl = document.getElementById('modalDescription');
  const provEl = document.getElementById('modalProvenance');

  if (titleEl) titleEl.textContent = data.title;
  if (metaEl) metaEl.textContent = data.meta;
  if (imageEl) imageEl.innerHTML = data.image || '';
  if (descEl) descEl.textContent = data.description;
  if (provEl) provEl.textContent = data.provenance;

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', '');
  }
}

function closeArchive() {
  const modal = document.getElementById('archiveModal');
  if (!modal) return;
  if (typeof modal.close === 'function') {
    modal.close();
  } else {
    modal.removeAttribute('open');
  }
}

function initArchiveCabinet() {
  const toggle = document.getElementById('archiveToggle');
  const panel = document.getElementById('archivePanel');
  if (!toggle || !panel) return;

  toggle.onclick = () => {
    const isOpen = !panel.hidden;
    panel.hidden = isOpen;
    toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  };

  document.querySelectorAll('.archive-file').forEach((btn) => {
    btn.onclick = () => {
      const archiveId = btn.dataset.archive;
      openArchive(archiveId);
    };
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.onclick = () => {
      const modalId = btn.dataset.close;
      if (modalId === 'archiveModal') closeArchive();
    };
  });

  const modal = document.getElementById('archiveModal');
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeArchive();
    });
  }
}

// ─── 启动 ───

document.addEventListener('DOMContentLoaded', () => {
  initDom();
  if (dom.startBtn) {
    dom.startBtn.onclick = () => startNewTurn();
  }
  initArchiveCabinet();
  setStageBadge('待命', 'idle');
  setFooterStatus('系统就绪');
});
