const seed = {
  id: "node-0",
  title: "爱因斯坦仍在德国",
  story: "柏林的夜雨敲在窗上。系统推送了一条异常：爱因斯坦没有离开德国。\n\n这不是一条普通传闻。真实历史里，他本该避开纳粹德国；但当前世界线里，最后的目击记录仍停在柏林附近。\n\n现在，你要决定这条历史裂缝往哪里生长。",
  choices: [
    { title: "爱因斯坦自杀了", hint: "一位科学家的死亡如何震动欧洲学术界？" },
    { title: "爱因斯坦被纳粹杀害", hint: "国家暴力变成了世界线的第一块多米诺骨牌。" },
    { title: "爱因斯坦被迫进入德国研究机构", hint: "合作、拖延、欺骗，还是暗中破坏？" },
    { title: "爱因斯坦通过秘密渠道逃离", hint: "逃亡路线会牵动哪些人和国家？" }
  ],
  parentId: null,
  childIds: [],
  status: "seed",
  artifactIds: [],
  historyFlags: ["baseline"]
};

let nextNodeId = 1;
let nodes = [seed];
let current = seed;
let isGenerating = false;
let currentTask = null;
let runtimeEvents = [];
let currentBrief = null;
let artifacts = [];
let approvalRequest = null;
let currentJob = null;

const storyText = document.getElementById("storyText");
const choices = document.getElementById("choices");
const nodeList = document.getElementById("nodeList");
const backBtn = document.getElementById("backBtn");
const customInput = document.getElementById("customInput");
const customBtn = document.getElementById("customBtn");
const modelStatus = document.getElementById("modelStatus");
const pathTrail = document.getElementById("pathTrail");
const nodeMeta = document.getElementById("nodeMeta");
const taskPanel = document.getElementById("taskPanel");
const eventLog = document.getElementById("eventLog");
const briefPanel = document.getElementById("briefPanel");
const artifactPanel = document.getElementById("artifactPanel");
const auditPanel = document.getElementById("auditPanel");
const progressPanel = document.getElementById("progressPanel");
const progressStatus = document.getElementById("progressStatus");
const stageTrack = document.getElementById("stageTrack");
const currentDeskMessage = document.getElementById("currentDeskMessage");
const progressEvents = document.getElementById("progressEvents");
const technicalEvents = document.getElementById("technicalEvents");

const stageLabels = {
  queued: "接入",
  story_weaving: "候选分支",
  history_review: "历史审计",
  briefing: "情报简报",
  artifact_generation: "档案归档",
  commit_review: "世界线提交",
  complete: "完成",
  failed: "失败",
};

const stageOrder = [
  "queued",
  "story_weaving",
  "history_review",
  "briefing",
  "artifact_generation",
  "commit_review",
  "complete",
];

const artifactTypeLabels = {
  archive_record: "档案记录",
  telegram: "电报",
  newspaper: "报纸",
  map_marker: "地图标记",
  timeline_delta: "时间线变化",
  character_profile: "人物卡",
  risk_notice: "风险提示",
};

const provenanceLabels = {
  baseline: "历史基准",
  generated: "当前世界线生成",
  unverified: "未核验情报",
  player_created: "玩家输入",
};

function fallbackChoices() {
  return [
    { title: "跟进德国科学界", hint: "看学者们如何选择沉默、逃亡或合作。" },
    { title: "跟进国际救援网络", hint: "看海外世界如何尝试救出仍在欧洲的人。" },
    { title: "跟进爱因斯坦本人", hint: "看他如何在恐惧、责任与求生之间选择。" }
  ];
}

function fallbackStory(direction) {
  return `你选择了：${direction}\n\n这个方向已经被系统识别为新的历史分叉。由于模型暂时不可用，故事先以占位方式继续：这条线会影响德国科学界、国际救援网络和爱因斯坦本人的处境。\n\n故事没有结束。它分裂成了新的几条线。`;
}

function createLocalEvent(type, message) {
  return {
    id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    taskId: currentTask?.id || "local-task",
    type,
    message,
    createdAt: new Date().toISOString(),
  };
}

function createLocalArtifact(type, title, content) {
  return {
    id: `local-artifact-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title,
    content,
    provenance: "unverified",
    confidence: 0.2,
    createdAt: new Date().toISOString(),
  };
}

function clearElement(element) {
  element.replaceChildren();
}

function appendSmall(parent, text) {
  const small = document.createElement("small");
  small.textContent = text;
  parent.appendChild(small);
  return small;
}

function appendList(parent, items) {
  const ul = document.createElement("ul");
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  });
  parent.appendChild(ul);
}

function appendEmptyState(parent, text) {
  clearElement(parent);
  parent.textContent = text;
}

function getPathTitles(node) {
  const titles = [];
  let cursor = node;
  while (cursor) {
    titles.unshift(cursor.title);
    cursor = nodes.find(item => item.id === cursor.parentId);
  }
  return titles;
}

async function startGeneratedNode(direction, parent) {
  const response = await fetch('/api/generate/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      currentTitle: parent.title,
      currentStory: parent.story,
      direction,
      pathTitles: getPathTitles(parent),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '任务启动失败');
  }
  return data;
}

async function getJobSnapshot(statusUrl) {
  const response = await fetch(statusUrl);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '任务状态读取失败');
  }
  return data;
}

async function pollJob(statusUrl) {
  while (true) {
    const snapshot = await getJobSnapshot(statusUrl);
    currentJob = snapshot;
    renderProgressPanel();
    if (snapshot.status === "succeeded") return snapshot.result;
    if (snapshot.status === "failed") {
      throw new Error(snapshot.error?.message || "任务失败");
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
}

function createNode(direction, parent, generated) {
  return {
    id: `node-${nextNodeId++}`,
    title: direction,
    story: `你选择了：${direction}\n\n${generated.story}`,
    choices: generated.choices,
    parentId: parent.id,
    childIds: [],
    status: generated.status || "generated",
    taskId: generated.task?.id,
    briefId: generated.brief?.id,
    artifactIds: (generated.artifacts || []).map(artifact => artifact.id),
    historyFlags: generated.historyFlags || []
  };
}

function appendChildNode(parent, child) {
  return [...nodes.map(node => (
    node.id === parent.id
      ? { ...node, childIds: [...node.childIds, child.id] }
      : node
  )), child];
}

function getDepth(node) {
  let depth = 0;
  let cursor = node;
  while (cursor.parentId) {
    depth += 1;
    cursor = nodes.find(item => item.id === cursor.parentId);
    if (!cursor) break;
  }
  return depth;
}

function getCardPosition(node, index) {
  const depth = getDepth(node);
  const siblingsBefore = nodes
    .slice(0, index)
    .filter(item => getDepth(item) === depth).length;
  return {
    left: 24 + depth * 250,
    top: 24 + siblingsBefore * 132,
  };
}

function setBusy(nextBusy) {
  isGenerating = nextBusy;
  modelStatus.textContent = nextBusy ? '模型：生成中…请勿重复点击' : '模型：待命';
  [...document.querySelectorAll('button')].forEach(button => {
    if (button.id !== 'backBtn') button.disabled = nextBusy;
  });
  customInput.disabled = nextBusy;
  backBtn.disabled = nextBusy || !current.parentId;
}

function finishGeneration(statusText) {
  isGenerating = false;
  setBusy(false);
  modelStatus.textContent = statusText;
  render();
}

function getStatusLabel(status) {
  if (status === "seed") return "起点";
  if (status === "fallback") return "占位生成";
  return "模型生成";
}

function renderPathTrail() {
  clearElement(pathTrail);
  getPathTitles(current).forEach((title, index, titles) => {
    const span = document.createElement("span");
    span.textContent = title;
    pathTrail.appendChild(span);
    if (index < titles.length - 1) {
      const arrow = document.createElement("b");
      arrow.textContent = "→";
      pathTrail.appendChild(arrow);
    }
  });
}

function renderTaskPanel() {
  if (!currentTask) {
    appendEmptyState(taskPanel, "尚未启动任务");
    return;
  }
  clearElement(taskPanel);
  const title = document.createElement("strong");
  title.textContent = currentTask.title;
  taskPanel.appendChild(title);
  appendSmall(taskPanel, `状态：${currentTask.status} · 执行：${currentTask.assignedAgent}`);
}

function renderEventLog() {
  if (runtimeEvents.length === 0) {
    appendEmptyState(eventLog, "等待玩家选择故事方向");
    return;
  }
  clearElement(eventLog);
  runtimeEvents.slice(-8).forEach((event) => {
    const item = document.createElement("div");
    item.className = "event-item";
    const time = document.createElement("time");
    time.textContent = new Date(event.createdAt).toLocaleTimeString("zh-CN", { hour12: false });
    const message = document.createElement("span");
    message.textContent = event.message;
    item.append(time, message);
    eventLog.appendChild(item);
  });
}

function renderBriefPanel() {
  if (!currentBrief) {
    appendEmptyState(briefPanel, "生成新节点后显示简报");
    return;
  }
  clearElement(briefPanel);
  const summary = document.createElement("p");
  summary.textContent = currentBrief.summary;
  briefPanel.appendChild(summary);

  [
    ["关键变化", currentBrief.keyChanges || []],
    ["风险", currentBrief.risks || []],
    ["建议下一步", currentBrief.suggestedNextActions || []],
  ].forEach(([title, items]) => {
    const heading = document.createElement("h3");
    heading.textContent = title;
    briefPanel.appendChild(heading);
    appendList(briefPanel, items);
  });
}

function getCurrentArtifacts() {
  const ids = new Set(current.artifactIds || []);
  if (ids.size === 0) return [];
  return artifacts.filter((artifact) => ids.has(artifact.id));
}

function renderArtifactPanel() {
  const currentArtifacts = getCurrentArtifacts();
  if (currentArtifacts.length === 0) {
    appendEmptyState(artifactPanel, "当前节点暂无新增材料");
    return;
  }

  clearElement(artifactPanel);
  currentArtifacts.forEach((artifact) => {
    const card = document.createElement("article");
    card.className = `artifact-card artifact-${artifact.type || "risk_notice"}`;

    const label = document.createElement("span");
    label.className = "artifact-type";
    label.textContent = artifactTypeLabels[artifact.type] || artifact.type || "材料";

    const title = document.createElement("strong");
    title.textContent = artifact.title || "未命名材料";

    const meta = document.createElement("small");
    const provenance = provenanceLabels[artifact.provenance] || artifact.provenance || "未知来源";
    const confidence = Number.isFinite(Number(artifact.confidence))
      ? Number(artifact.confidence).toFixed(2)
      : "未知";
    meta.textContent = `来源：${provenance} · 可信度：${confidence}`;

    const content = document.createElement("p");
    content.textContent = artifact.content || "暂无内容";

    card.append(label, title, meta, content);
    artifactPanel.appendChild(card);
  });
}

function createApprovalRequest(direction, historyReview) {
  return {
    id: `approval-${Date.now().toString(36)}`,
    reason: historyReview?.warnings?.[0] || "该方向可能改变目标人物生存状态，并扩大历史伤害语境。",
    options: ["继续干预", "先核验来源", "取消"],
    pendingDirection: direction,
  };
}

function renderAuditPanel() {
  if (!approvalRequest) {
    auditPanel.hidden = true;
    clearElement(auditPanel);
    return;
  }

  auditPanel.hidden = false;
  clearElement(auditPanel);
  const label = document.createElement("span");
  label.className = "audit-label";
  label.textContent = "审计频道提醒";
  const title = document.createElement("strong");
  title.textContent = "该指令需要人工确认";
  const reason = document.createElement("p");
  reason.textContent = approvalRequest.reason;
  const direction = document.createElement("small");
  direction.textContent = `待确认方向：${approvalRequest.pendingDirection}`;
  const actions = document.createElement("div");
  actions.className = "audit-actions";
  approvalRequest.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option;
    button.onclick = () => {
      approvalRequest = null;
      renderAuditPanel();
    };
    actions.appendChild(button);
  });
  auditPanel.append(label, title, reason, direction, actions);
}

function renderProgressPanel() {
  if (!currentJob) {
    progressPanel.hidden = true;
    return;
  }

  progressPanel.hidden = false;
  progressStatus.textContent = `${currentJob.status} · ${stageLabels[currentJob.stage] || currentJob.stage}`;
  currentDeskMessage.textContent = currentJob.currentDeskMessage || "值班系统正在处理。";

  clearElement(stageTrack);
  const currentIndex = stageOrder.indexOf(currentJob.stage);
  stageOrder.forEach((stage, index) => {
    const item = document.createElement("span");
    item.className = "stage-pill";
    if (stage === currentJob.stage) item.classList.add("active");
    if (currentJob.status === "succeeded" || (currentIndex >= 0 && index < currentIndex)) item.classList.add("done");
    item.textContent = stageLabels[stage] || stage;
    stageTrack.appendChild(item);
  });

  clearElement(progressEvents);
  (currentJob.events || []).slice(-6).forEach((event) => {
    const item = document.createElement("div");
    item.className = `progress-event event-${event.severity || "info"}`;
    const unit = document.createElement("strong");
    unit.textContent = event.metadata?.displayUnit || stageLabels[event.stage] || "值班系统";
    const message = document.createElement("span");
    message.textContent = event.studentMessage || "系统正在处理。";
    item.append(unit, message);
    progressEvents.appendChild(item);
  });

  clearElement(technicalEvents);
  (currentJob.technicalEvents || []).slice(-8).forEach((event) => {
    const item = document.createElement("div");
    item.className = "technical-event";
    const agent = document.createElement("code");
    agent.textContent = event.metadata?.agent || "Runtime";
    const message = document.createElement("span");
    message.textContent = event.technicalMessage || event.studentMessage || "NO_MESSAGE";
    item.append(agent, message);
    technicalEvents.appendChild(item);
  });
}

function renderRuntimePanels() {
  renderTaskPanel();
  renderEventLog();
  renderBriefPanel();
  renderArtifactPanel();
  renderAuditPanel();
  renderProgressPanel();
}

function render() {
  storyText.textContent = current.story;
  renderRuntimePanels();
  renderPathTrail();
  const flagText = (current.historyFlags || []).join(" / ");
  nodeMeta.textContent = `${getStatusLabel(current.status)} · 深度 ${getDepth(current)} · ${current.childIds.length} 条后续分支${flagText ? ` · ${flagText}` : ""}`;
  clearElement(choices);
  current.choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choice";
    const title = document.createElement("span");
    title.textContent = choice.title;
    const hint = document.createElement("small");
    hint.textContent = choice.hint;
    btn.append(title, hint);
    btn.onclick = () => move(choice.title);
    choices.appendChild(btn);
  });

  clearElement(nodeList);
  nodes.forEach((node, index) => {
    const item = document.createElement("button");
    const position = getCardPosition(node, index);
    item.className = `node-card ${node === current ? "current" : ""}`;
    item.style.left = `${position.left}px`;
    item.style.top = `${position.top}px`;
    const title = document.createElement("strong");
    title.textContent = node.title;
    const meta = document.createElement("small");
    meta.textContent = `${getStatusLabel(node.status)} · 深度 ${getDepth(node)} · ${node.childIds.length} 条后续`;
    item.append(title, meta);
    item.onclick = () => jumpTo(node.id);
    nodeList.appendChild(item);
  });

  backBtn.disabled = isGenerating || !current.parentId;
}

async function move(direction) {
  if (isGenerating) return;
  runtimeEvents = [...runtimeEvents, createLocalEvent('task_created', `玩家选择方向：${direction}`)];
  currentTask = {
    title: `生成故事分支：${direction}`,
    status: 'running',
    assignedAgent: 'StoryWeaverAgent',
  };
  currentBrief = null;
  currentJob = {
    status: "queued",
    stage: "queued",
    currentDeskMessage: "值班系统已接入本次历史分叉任务。",
    events: [{
      stage: "queued",
      severity: "info",
      studentMessage: "值班系统已接入本次历史分叉任务。",
      metadata: { displayUnit: "值班系统" },
    }],
    technicalEvents: [],
  };
  setBusy(true);
  render();
  try {
    const parent = current;
    const started = await startGeneratedNode(direction, parent);
    currentJob = {
      ...currentJob,
      jobId: started.jobId,
      statusUrl: started.statusUrl,
      currentDeskMessage: "值班系统正在分配叙事分析任务。",
    };
    renderProgressPanel();
    const generated = await pollJob(started.statusUrl);
    const newNode = createNode(direction, parent, generated);
    nodes = appendChildNode(parent, newNode);
    current = newNode;
    currentTask = generated.task || currentTask;
    runtimeEvents = [...runtimeEvents, ...(generated.events || [])];
    currentBrief = generated.brief || null;
    artifacts = [...artifacts, ...(generated.artifacts || [])];
    approvalRequest = generated.historyReview?.requiresHumanApproval
      ? createApprovalRequest(direction, generated.historyReview)
      : null;
    customInput.value = "";
  } catch (error) {
    const parent = current;
    const message = error instanceof Error ? error.message : String(error);
    const localArtifact = createLocalArtifact("risk_notice", "模型生成失败", message);
    const newNode = createNode(direction, parent, {
      story: `这个方向已经被系统识别为新的历史分叉。由于模型暂时不可用，故事先以占位方式继续：这条线会影响德国科学界、国际救援网络和爱因斯坦本人的处境。\n\n故事没有结束。它分裂成了新的几条线。\n\n[模型错误：${message}]`,
      choices: fallbackChoices(),
      status: "fallback",
      artifacts: [localArtifact],
      historyFlags: ["fallback_branch", "fictional_branch"],
    });
    nodes = appendChildNode(parent, newNode);
    current = newNode;
    currentTask = { ...currentTask, status: 'failed' };
    runtimeEvents = [...runtimeEvents, createLocalEvent('task_failed', `模型生成失败：${message}`)];
    currentBrief = {
      summary: '模型生成失败，但系统保留了可继续探索的占位分支。',
      keyChanges: ['当前玩家方向已被记录为新的故事节点。'],
      risks: ['该节点内容为占位生成，不能视为历史约束内的正式分支。'],
      suggestedNextActions: ['重试生成', '改写玩家输入', '回到上一步'],
    };
    artifacts = [...artifacts, localArtifact];
    approvalRequest = null;
    customInput.value = "";
    finishGeneration('模型：失败，已用占位生成');
    return;
  }
  finishGeneration(current.status === "fallback" ? '模型：失败，已用占位生成' : '模型：已生成');
}

function jumpTo(nodeId) {
  const target = nodes.find(node => node.id === nodeId);
  if (!target || isGenerating) return;
  current = target;
  render();
}

backBtn.onclick = () => {
  if (!current.parentId || isGenerating) return;
  const parent = nodes.find(node => node.id === current.parentId);
  if (!parent) return;
  current = parent;
  render();
};

customBtn.onclick = () => {
  const text = customInput.value.trim();
  if (!text || isGenerating) return;
  move(text);
};

const startTurnBtn = document.getElementById('startTurnBtn');
if (startTurnBtn) {
  startTurnBtn.onclick = () => {
    if (window.TurnCycle) window.TurnCycle.start();
  };
}

render();
