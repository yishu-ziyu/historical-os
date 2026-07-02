import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 8892);
const jobs = new Map();
const caseStates = new Map();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim();
}

function readPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function loadSettingsEnv() {
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  try {
    const raw = await readFile(settingsPath, 'utf8');
    const settings = JSON.parse(raw);
    return settings.env || {};
  } catch {
    return {};
  }
}

function isMiniMaxProvider(env) {
  const provider = firstNonEmpty(env.HISTORICAL_RUNTIME_MODEL_PROVIDER, env.MODEL_PROVIDER)?.toLowerCase();
  return ['minimax', 'minimax-token-plan', 'token-plan'].includes(provider) || Boolean(firstNonEmpty(env.MINIMAX_API_KEY, env.TOKEN_PLAN_API_KEY));
}

// 模型候选池：按优先级降级。第一个能用的就用。
// 这是 AI 产品的基础设施——任何一个模型都可能随时不可用（plan 变更、限流、宕机），
// 所以必须有多级 fallback 而不是依赖单一模型。
//
// 这些模型来自 cli-proxy-api 的真实模型清单（router-for-me/models 仓库），
// 对应当前登录的 auths：antigravity / codex-pro / kimi。
// 优先用 JSON schema 能力强 + 响应稳定的模型。
const MODEL_FALLBACK_CHAIN = [
  'claude-opus-4-8',             // 当前本机会话模型，实测能返回 text JSON
  'gpt-5.4',                     // codex-pro，实测能稳定返回 text JSON
  'gpt-5.4-mini',                // codex-pro，轻量备用
  'gpt-5.5',                     // codex-pro，质量高但可能慢
  'claude-sonnet-4-6',           // antigravity，可能只返回 thinking
  'claude-haiku-4-5-20251001',   // antigravity 后端 GLM，可能只返回 thinking
  'gemini-3-flash',              // antigravity，可能只返回 thinking
  'kimi-k2',                     // kimi
];

// 运行时缓存：已经验证可用的模型，避免每次请求都重新探测
let cachedWorkingModel = null;
let lastProbeAt = 0;
const PROBE_COOLDOWN_MS = 60_000;  // 失败后 60 秒才重新探测

const MAX_RETRIES = 2;             // 每次 LLM 调用最多 2 次重试
const RETRY_BASE_DELAY_MS = 1500;  // 第一次重试等待 1.5 秒，第二次 3 秒

async function probeModel(baseUrl, token, model, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 8000));
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': token,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    const data = await response.json();
    if (data.error) return { ok: false, reason: data.error };
    if (data.Message) return { ok: false, reason: data.Message };
    // round 052: thinking 模型（如 step-3.7-flash）小 max_tokens 时 thinking 占满预算，
    // text 为空。thinking block 也证明模型活着，真实调用用更大 max_tokens 能拿到 text。
    const hasText = data.content?.some((p) => p.type === 'text' && p.text);
    const hasThinking = data.content?.some((p) => p.type === 'thinking');
    return { ok: !!(hasText || hasThinking), reason: (hasText || hasThinking) ? null : 'empty content' };
  } catch (error) {
    return { ok: false, reason: error?.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function pickWorkingModel(config) {
  // 优先用环境变量显式指定的模型（如果指定了且能用）
  const envModel = config.model;
  if (envModel && envModel !== 'gpt-5.5[1m]') {
    const probe = await probeModel(config.baseUrl, config.token, envModel, config.timeoutMs);
    if (probe.ok) {
      cachedWorkingModel = envModel;
      return envModel;
    }
  }

  // 用缓存的可用模型（在冷却期内）
  const now = Date.now();
  if (cachedWorkingModel && now < lastProbeAt + PROBE_COOLDOWN_MS) {
    return cachedWorkingModel;
  }

  // 遍历 fallback chain
  for (const model of MODEL_FALLBACK_CHAIN) {
    const probe = await probeModel(config.baseUrl, config.token, model, config.timeoutMs);
    if (probe.ok) {
      cachedWorkingModel = model;
      lastProbeAt = now;
      return model;
    }
  }

  // 全部失败，返回第一个候选（让请求带着真实错误信息失败）
  return MODEL_FALLBACK_CHAIN[0];
}

async function loadModelConfig() {
  const settingsEnv = await loadSettingsEnv();
  const env = { ...settingsEnv, ...process.env };

  if (isMiniMaxProvider(env)) {
    const apiFormat = firstNonEmpty(env.MINIMAX_API_FORMAT, env.TOKEN_PLAN_API_FORMAT)?.toLowerCase();
    return {
      provider: 'minimax',
      apiFormat: apiFormat === 'openai' ? 'openai' : 'anthropic',
      baseUrl: firstNonEmpty(env.MINIMAX_BASE_URL, env.TOKEN_PLAN_BASE_URL) || 'https://api.minimaxi.com/anthropic',
      token: firstNonEmpty(env.MINIMAX_API_KEY, env.TOKEN_PLAN_API_KEY),
      model: firstNonEmpty(env.MINIMAX_MODEL, env.TOKEN_PLAN_MODEL) || 'MiniMax-M2.7',
      timeoutMs: readPositiveNumber(firstNonEmpty(env.MODEL_REQUEST_TIMEOUT_MS, env.MINIMAX_REQUEST_TIMEOUT_MS), 90000),
    };
  }

  return {
    provider: 'anthropic',
    baseUrl: firstNonEmpty(env.ANTHROPIC_BASE_URL),
    token: firstNonEmpty(env.ANTHROPIC_AUTH_TOKEN, env.ANTHROPIC_API_KEY),
    model: firstNonEmpty(
      env.ANTHROPIC_MODEL,
      env.HISTORICAL_RUNTIME_MODEL
    ) || 'claude-opus-4-8',
    timeoutMs: readPositiveNumber(firstNonEmpty(env.MODEL_REQUEST_TIMEOUT_MS, env.ANTHROPIC_REQUEST_TIMEOUT_MS), 90000),
  };
}

function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('模型返回空内容');
  }
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1) {
    throw new Error('模型没有返回 JSON 对象');
  }
  if (end === -1 || end <= start) {
    // JSON 被截断（没有闭合 }）：尝试补全到能解析
    const partial = candidate.slice(start);
    throw new Error('模型 JSON 被截断，无闭合括号');
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (e) {
    // round 049: LLM 常见错误——字符串值漏了开引号（如 "label": 《授权法案》）
    // 多级修复：先修裸引号，再修截断，最后组合修
    const slice = candidate.slice(start, end + 1);
    const repairs = [
      () => repairMissingQuotes(slice),
      () => repairTruncatedJson(slice),
      () => repairMissingQuotes(repairTruncatedJson(slice)),
    ];
    for (let i = 0; i < repairs.length; i++) {
      try {
        return JSON.parse(repairs[i]());
      } catch (_) { /* 尝试下一种修复 */ }
    }
    // 全部修复失败，打印诊断信息（仅 TURN_CYCLE_DEBUG 时打印原始返回，避免日志噪音）
    if (process.env.TURN_CYCLE_DEBUG) {
      console.error('[extractJson FAILED]', e.message);
      console.error('[extractJson RAW (first 800 chars)]', candidate.slice(start, start + 800));
    }
    throw new Error(`JSON 解析失败: ${e.message}`);
  }
}

function repairMissingQuotes(text) {
  // round 049: 修复 LLM 漏了字符串值开引号的常见错误
  // 如 "label": 《授权法案》通过 → "label": "《授权法案》通过"
  // 策略：匹配 : 或 [ 或 , 后紧跟非合法 JSON 值开头的裸值
  // 用 lookahead 不消费分隔符，避免连续裸值被跳过
  // 合法开头："  数字  t(rue)  f(alse)  n(ull)  {  [
  return text.replace(
    /(:\s*|[\[,]\s*)([^\s"',}\]\[\{\n][^,}\]\n]*?)(?=\s*[,}\]])/g,
    (match, prefix, value) => {
      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) return match;
      if (value === 'true' || value === 'false' || value === 'null') return match;
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `${prefix}"${escaped}"`;
    }
  );
}

function repairTruncatedJson(text) {
  // 去掉尾随逗号
  let s = text.replace(/,\s*([}\]])/g, '$1');
  // 如果还是不完整，尝试逐步补全括号
  let opens = 0, openB = 0, inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') opens++;
    else if (c === '}') opens--;
    else if (c === '[') openB++;
    else if (c === ']') openB--;
  }
  // 截断在字符串中间，先闭合字符串
  if (inStr) s += '"';
  // 如果最后是不完整的 key/value，尝试闭合
  // 找最后一个完整的 } 或 ,
  const lastBrace = Math.max(s.lastIndexOf('}'), s.lastIndexOf(','));
  if (lastBrace > 0) {
    s = s.slice(0, lastBrace + 1);
  }
  // 重新计算并补全外层括号
  opens = 0; openB = 0; inStr = false; esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') opens++;
    else if (c === '}') opens--;
    else if (c === '[') openB++;
    else if (c === ']') openB--;
  }
  while (openB > 0) { s += ']'; openB--; }
  while (opens > 0) { s += '}'; opens--; }
  return s;
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createJob(payload) {
  const now = new Date().toISOString();
  const job = {
    ok: true,
    jobId: createId('job'),
    requestId: createId('req'),
    status: 'queued',
    stage: 'queued',
    currentDeskMessage: '值班系统已接入本次历史分叉任务。',
    payload,
    events: [],
    technicalEvents: [],
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(job.jobId, job);
  return job;
}

function jobSnapshot(job) {
  return {
    ok: true,
    jobId: job.jobId,
    requestId: job.requestId,
    status: job.status,
    stage: job.stage,
    currentDeskMessage: job.currentDeskMessage,
    events: job.events,
    technicalEvents: job.technicalEvents,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function emitJobEvent(job, {
  stage,
  severity = 'info',
  attempt = 1,
  studentMessage,
  technicalMessage,
  agent,
  displayUnit,
  model,
  metadata = {},
}) {
  const event = {
    time: new Date().toISOString(),
    stage,
    severity,
    attempt,
    studentMessage,
    technicalMessage,
    metadata: {
      ...metadata,
      ...(agent ? { agent } : {}),
      ...(displayUnit ? { displayUnit } : {}),
      ...(model ? { model } : {}),
    },
  };
  job.status = job.status === 'queued' ? 'running' : job.status;
  job.stage = stage;
  job.currentDeskMessage = studentMessage;
  job.events.push(event);
  job.technicalEvents.push(event);
  job.updatedAt = event.time;
  return event;
}

function finishJob(job, result) {
  job.status = 'succeeded';
  job.stage = 'complete';
  job.currentDeskMessage = result.status === 'fallback'
    ? '值班系统已生成占位分支，并保留审计记录。'
    : '值班系统已完成世界线提交。';
  job.result = result;
  job.error = null;
  job.updatedAt = new Date().toISOString();
  emitJobEvent(job, {
    stage: 'complete',
    studentMessage: job.currentDeskMessage,
    technicalMessage: `RuntimeOrchestrator JOB_COMPLETE result_status=${result.status}`,
    agent: 'RuntimeOrchestrator',
    displayUnit: '值班系统',
  });
}

function failJob(job, error) {
  const message = error instanceof Error ? error.message : String(error);
  job.status = 'failed';
  job.stage = 'failed';
  job.currentDeskMessage = '值班系统无法完成本次任务，已保留诊断记录。';
  job.error = {
    message,
    recoverable: true,
    suggestion: '请重试生成，或缩小玩家指令范围。',
  };
  job.updatedAt = new Date().toISOString();
  emitJobEvent(job, {
    stage: 'failed',
    severity: 'error',
    studentMessage: job.currentDeskMessage,
    technicalMessage: `RuntimeOrchestrator JOB_FAILED error=${message}`,
    agent: 'RuntimeOrchestrator',
    displayUnit: '值班系统',
  });
}

function createRuntimeEvent(taskId, type, message, payload = {}) {
  return {
    id: createId('event'),
    message,
    payload,
    taskId,
    type,
    createdAt: new Date().toISOString(),
  };
}

function createStoryTask({ direction }) {
  const now = new Date().toISOString();
  return {
    id: createId('task'),
    title: `生成故事分支：${direction}`,
    type: 'story_branch',
    status: 'running',
    createdBy: 'human',
    assignedAgent: 'StoryWeaverAgent',
    createdAt: now,
    updatedAt: now,
  };
}

const artifactTypes = new Set([
  'archive_record',
  'telegram',
  'newspaper',
  'map_marker',
  'timeline_delta',
  'character_profile',
  'risk_notice',
]);

const provenanceTypes = new Set(['baseline', 'generated', 'unverified', 'player_created']);
const sensitiveTerms = ['纳粹', '反犹', '迫害', '国家暴力', '犹太', '集中营', '盖世太保'];
const highRiskTerms = ['杀害', '自杀', '处决', '刺杀', '灭绝', '集中营'];
const forgedArchivePattern = /(档案|archive|record)\s*([A-Z]{1,6}[- ]?)?\d{4,}/i;
const finalityTerms = ['最终结局', '彻底终结', '一切结束', '历史就此定型'];

// ─── 三段式回合 Prompt ───────────────────────────────────────────

function buildBriefingPrompt({ caseId, turn, caseTitle, historicalAnchors, previousState, playerHistory }) {
  return `你是情报值班台的档案编辑。请基于以下历史框架，生成一张「情报卡」——一份会落到玩家 Intel Desk 的真实感档案。

核心世界线：1933 年，爱因斯坦没有离开德国。
当前回合：${turn}
案件标题：${caseTitle}

历史锚点（必须忠实于此）：${historicalAnchors.map(a => '- ' + a).join('\n')}

${previousState ? `当前世界线状态：\n${JSON.stringify(previousState, null, 2)}` : '这是第一回合，无先前状态。'}

${playerHistory && playerHistory.length > 0 ? `玩家已走过的路径：${playerHistory.join(' → ')}` : ''}

档案体写作要求：
1. 以真实档案格式呈现：有编号、日期、来源机构、密级。
2. 正文像真实档案记录——陈述事实，不直接告诉玩家"这很危险"或"发生了什么"。
3. 埋入至少 1 个矛盾点或异常信号，让玩家从文本中拼出线索。
4. 可包含手写注释（保留原文语言 + 中文翻译）。
5. 中英混杂：档案正文用中文，保留关键原文（德语/英语术语）。
6. 严肃处理纳粹德国、反犹迫害语境，不轻浮化。

【JSON 格式 - 极重要】
- 所有字符串值必须用双引号 "..." 包围
- 错误示例：title: 档案标题 （值漏了双引号）
- 正确示例：title: "档案标题"
- 中文书名号《》不是引号，不能替代双引号

只返回 JSON，不要解释：

{
  "intelCard": {
    "classification": "绝密",
    "header": {
      "title": "档案标题",
      "documentId": "B-XX-1933-XXXX",
      "date": "1933-XX-XX",
      "source": "来源机构",
      "language": "de-zh"
    },
    "body": {
      "text": "档案正文",
      "originalSnippet": "原文片段（如有）",
      "translation": "翻译",
      "handwrittenNotes": [{"location": "注释位置", "text": "原文", "translation": "翻译", "inkColor": "blue"}]
    },
    "contradictions": [{"id": "c1", "type": "类型", "description": "矛盾描述", "significance": "high"}],
    "clues": [{"id": "clue-1", "text": "线索文本", "category": "分类", "confidence": "verified|unverified|inferred"}],
    "nextTimeNode": "1933-XX-XX",
    "provenance": {"type": "generated", "confidence": 0.8, "historicalAnchors": ["锚点"], "note": "说明"}
  },
  "historyFlags": ["fictional_branch"]
}`;
}

function buildSituationRoomPrompt({ caseId, turn, worldState, currentNodeLabels, previousChoice, riskLevel }) {
  const ws = worldState || {};
  const nodeDescriptions = (Array.isArray(ws.nodes) ? ws.nodes : []).slice(0, 12).map(n =>
    `- ${n.id}: ${n.label} (类型: ${n.type}, 状态: ${n.status}, 标签: ${n.statusLabel})`
  ).join('\n');

  const edgeDescriptions = (Array.isArray(ws.edges) ? ws.edges : []).slice(0, 8).map(e =>
    `- ${e.from} → ${e.to}: ${e.label} (强度: ${e.strength})`
  ).join('\n');

  // round 048: 让 LLM 看见当前世界线偏移，作为预估的基准
  const currentDrift = ws.worldLineShift
    ? `当前累计偏移 ${ws.worldLineShift.totalDelta}σ（领域：${(ws.worldLineShift.domains || []).join('、') || '尚未分叉'}）`
    : '当前累计偏移 0σ（尚未分叉）';
  const recentChanges = Array.isArray(ws.stateChangeHistory) && ws.stateChangeHistory.length > 0
    ? ws.stateChangeHistory.slice(-5).map(sc => `  - ${sc.target}.${sc.field}: ${sc.from} → ${sc.to}`).join('\n')
    : '  (无)';
  const markedCluesDesc = ws.markedClues && Object.keys(ws.markedClues).length > 0
    ? Object.entries(ws.markedClues).slice(0, 5).map(([cid, note]) => `  - ${cid}: ${note || '(无笔记)'}`).join('\n')
    : '  (玩家未标记)';

  return `你是态势分析系统。请基于当前世界线状态，生成 3-4 个有历史框架内合理性的行动选项。

核心世界线：1933 年，爱因斯坦没有离开德国。
当前回合：${turn}

【世界线状态】
- 风险指数：${riskLevel}/5
- ${currentDrift}
- 节点：
${nodeDescriptions || '- (无)'}
- 连线：
${edgeDescriptions || '- (暂无)'}
- 近期变更：
${recentChanges}
- 玩家标记的线索（玩家关心的方向，至少一个选项应顺承或回应）：
${markedCluesDesc}

${previousChoice ? `上一回合选择：${previousChoice.label} — ${previousChoice.consequencePreview}` : ''}
${ws.nextDeadline ? `下一个截止线：${ws.nextDeadline.label}（${ws.nextDeadline.date}）` : ''}

行动选项设计要求：
1. 每个选项必须有历史框架内的合理性依据。
2. 标注风险成本（0-2）和情报回报（low/medium/high）。
3. 给出后果预览——不是详细叙事，而是状态标签。
4. 如果上一回合的选择产生了连锁效应，某些选项应该被移除或标记为"不可用"。
5. 如果有截止线，至少一个选项应该标注"时间敏感"。
6. 【关键】每个选项必须预估 worldLineShift（如果玩家选了这个，世界线会偏移多少）。预估偏移的评估标准必须和后续推演实际偏移使用同一套标准：
   - 观察/等待/不干预 → -0.2~+0.3σ（新增偏移接近零，可能略微回正）
   - 有针对性间接干预（传递情报、私人通信、渠道搭建）→ +0.3~+0.9σ
   - 高风险直接行动（保护、转移、公开对抗）→ +1.0~+1.8σ
   - 改变历史走向（阻止关键事件、大规模组织）→ +1.9~+3.0σ
   - estimatedDrift.turnDelta = 本选项预估新增偏移（-0.5 到 +2.5，允许负值表示回正）
   - estimatedDrift.totalDelta = 选项执行后的预估累计偏移 = 当前 ${ws.worldLineShift ? ws.worldLineShift.totalDelta : 0}σ + estimatedDrift.turnDelta
   - estimatedDrift.domains = 受影响领域（如 physics/jewish_safety/diplomacy）
   - estimatedDrift.reason = 一句话说明为什么这个选择会导致这个偏移（给玩家看的因果解释）
7. 至少一个选项应保守（低偏移），至少一个应激进（高偏移）——让玩家在风险和回报间权衡。

【JSON 格式 - 极重要】所有字符串值必须用双引号 "..." 包围。中文书名号《》不是引号。错误示例：label: 选项名。正确示例：label: "选项名"。

只返回 JSON：

{
  "situationRoom": {
    "anchor": {"id": "anchor", "label": "异常锚点", "type": "anomaly_origin", "status": "active"},
    "nodes": [{"id": "node-x", "label": "名称", "type": "类型", "status": "状态", "statusLabel": "状态标签", "depth": 1}],
    "edges": [{"from": "node-a", "to": "node-b", "label": "关系", "strength": "weak|medium|strong"}],
    "riskIndicators": {"overall": 2, "max": 5, "components": [{"label": "操作风险", "value": 1}]},
    "nextDeadline": {"type": "newspaper_publication", "label": "柏林日报出刊", "date": "1933-10-20"}
  },
  "actionOptions": [
    {"id": "action-x", "label": "选项名", "icon": "图标", "historicalPlausibility": "high|medium|low", "description": "描述", "riskCost": 1, "intelReturn": "high", "unlocksNodes": [], "consequencePreview": "预览", "estimatedDrift": {"turnDelta": 0.4, "totalDelta": 0.4, "domains": ["physics"], "reason": "一句话因果说明"}}
  ],
  "previousChoiceImpact": {"description": "上一回合选择的影响描述", "removedOptions": []},
  "historyFlags": ["fictional_branch"]
}`;
}

function buildAftermathPrompt({ playerChoiceId, playerChoiceLabel, narrativeContext, worldState, intelCardTitle, playerHistory }) {
  // round 048: 真的让 LLM 看见当前世界线状态、上一张情报卡、历史变更、玩家标记的线索
  // round 049: 补 playerHistory——aftermath 必须知道玩家之前选过什么，才能判断"连续激进"vs"首次激进"
  const ws = worldState || {};
  const nodesDesc = Array.isArray(ws.nodes) && ws.nodes.length > 0
    ? ws.nodes.slice(0, 12).map(n => `  - ${n.id}: ${n.label} (状态: ${n.statusLabel || n.status})`).join('\n')
    : '  (第一回合，无先前节点)';
  const edgesDesc = Array.isArray(ws.edges) && ws.edges.length > 0
    ? ws.edges.slice(0, 8).map(e => `  - ${e.from} → ${e.to}: ${e.label || '(无标签)'}`).join('\n')
    : '  (暂无关系连线)';
  const riskDesc = ws.riskIndicators
    ? `总体风险 ${ws.riskIndicators.overall}/5，分项：${(ws.riskIndicators.components || []).map(c => `${c.label}=${c.value}`).join(', ')}`
    : '风险未评估';
  const deadlineDesc = ws.nextDeadline ? `下一截止线：${ws.nextDeadline.label}（${ws.nextDeadline.date}）` : '无截止线';
  // round 049: 展示完整因果链历史，不只是最近一次——让玩家感到每个选择都在塑造世界
  const wls = ws.worldLineShift || {};
  const causeHistoryDesc = Array.isArray(wls.causeHistory) && wls.causeHistory.length > 0
    ? wls.causeHistory.map((c, i) => `回合${i + 1}: ${c}`).join(' | ')
    : (wls.lastCause || '无');
  const driftDesc = `当前累计偏移 ${wls.totalDelta || 0}σ（领域：${(wls.domains || []).join('、') || '尚未分叉'}），历史成因：${causeHistoryDesc}`;
  const playerHistoryDesc = Array.isArray(playerHistory) && playerHistory.length > 0
    ? playerHistory.join(' → ')
    : '(第一回合，玩家尚无选择历史)';
  const historyDesc = Array.isArray(ws.stateChangeHistory) && ws.stateChangeHistory.length > 0
    ? ws.stateChangeHistory.slice(-8).map(sc => `  - ${sc.target}.${sc.field}: ${sc.from} → ${sc.to}${sc.evidence ? '（证据：' + String(sc.evidence).slice(0, 60) + '）' : ''}`).join('\n')
    : '  (无历史变更)';
  const markedDesc = ws.markedClues && Object.keys(ws.markedClues).length > 0
    ? Object.entries(ws.markedClues).slice(0, 6).map(([cid, note]) => `  - ${cid}: ${note || '(无笔记)'}`).join('\n')
    : '  (玩家未标记任何线索)';

  return `你是叙事分析组。基于玩家选择推演这一回合对世界线的真实影响。核心世界线：1933 年爱因斯坦未离开德国。

玩家选择：${playerChoiceLabel}（${playerChoiceId}）
${intelCardTitle ? `触发情报卡：${intelCardTitle}` : ''}
${narrativeContext ? `前情（玩家决策上下文）：${narrativeContext.slice(0, 200)}` : ''}
玩家已走过的选择路径：${playerHistoryDesc}

【当前世界线状态 — 必须基于此推演，不能凭空捏造】
- ${riskDesc}
- ${deadlineDesc}
- ${driftDesc}
- 节点：
${nodesDesc}
- 关系：
${edgesDesc}
- 近期变更历史：
${historyDesc}
- 玩家标记的线索（玩家关心的方向，应在 narrative 或 stateChanges 中体现）：
${markedDesc}

推演要求：
1. narrative 控制在 120-180 字。前 100-150 字为值班台内部报告风格（客观、克制、严肃处理纳粹/反犹语境）；最后一句必须是具体的人味细节--一个画面、一个声音、一个私人的瞬间（如"窗外传来一首安息日歌谣，无人唱和"），不带分析、不带机制术语、不出现"世界线""σ""偏移"等词。让玩家从一个具体画面感到这回合的代价。**关键：根据当前累计偏移 totalDelta 调整 narrative 语气**。把 ${wls.totalDelta || 0}σ 映射为具体局势：
   - 低于 0.5σ：克制，"一切还在可控范围内"——细节描写一个看似平静但隐约不安的日常片段
   - 0.5-1.0σ：紧张，"事情开始偏离"——出现具体的异常信号，如多了一份不该出现的文件、电话被打断
   - 1.0-1.6σ：紧迫，"局势在加速恶化"——多个信号同时出现，角色之间的交流出现明显的间隔和犹豫
   - 1.6σ 以上：沉重，"已经回不去了"——某个确定性的坏消息落地，无人能逆转。用具体的人、具体的事、具体的画面传达这些感受，不要写"世界正在偏离"这类抽象总结
2. 每个 stateChange 必须有证据（evidence），且和玩家选择有直接因果--不能凭空发生与选择无关的变更。
3. 偏移评估标准（与态势室预估完全一致，玩家看到预估与实际后应能理解差异原因）：
   - 观察/等待/不干预 → -0.2~+0.3σ（新增偏移接近零，可能略微回正）
   - 有针对性间接干预（传递情报、私人通信、渠道搭建）→ +0.3~+0.9σ
   - 高风险直接行动（保护、转移、公开对抗）→ +1.0~+1.8σ
   - 改变历史走向（阻止关键事件、大规模组织）→ +1.9~+3.0σ
4. worldLineShift.turnDelta 是本回合新增的偏移（-0.5 到 +2.5），可能为负（玩家选择反而拉回真实历史）。
5. worldLineShift.domains 列出受影响的历史领域，如 physics/jewish_safety/nazi_ideology/diplomacy/academia。
6. worldLineShift.cause 用一句话说明为什么这个选择导致了这个偏移--这是给玩家看的因果解释。
7. 累积感知规则：参考玩家已走过的选择路径--如果玩家连续多回合选择同方向激进（如第 2、3 次都是高风险），turnDelta 应取该档位上限，且 narrative 必须体现"局势因持续干预而加速恶化"的累积感；如果玩家中途转向保守，turnDelta 应明显回落。让玩家感到他的每一步都在累积塑造世界线，不是孤立选择。

【JSON 格式 - 极重要】所有字符串值必须用双引号 "..." 包围。中文书名号《》不是引号。错误示例：cause: 直接干预。正确示例：cause: "直接干预"。

**narrative 字段必须放在 JSON 的最后且完整输出**。如果前面的 stateChanges / newClues / newNodes 内容太多导致接近 token 上限，优先缩减前面的数组长度，保证 narrative 完整。narrative 是玩家直接阅读的体验核心，宁可少给一个 stateChange，不可截断 narrative。

只返回 JSON（structured fields 在前，narrative 在最后，确保 narrative 完整不截断）：

{
  "stateChanges": [
    {"id": "sc-001", "target": "character.einstein", "field": "status", "from": "hesitating", "to": "protected", "evidence": "证据", "visibility": "player_visible"}
  ],
  "newClues": [{"id": "clue-x", "text": "线索", "category": "分类", "confidence": "inferred"}],
  "newNodes": [{"id": "node-x", "label": "节点", "type": "类型", "status": "new", "statusLabel": "标签"}],
  "newEdges": [{"from": "node-a", "to": "node-b", "label": "关系", "strength": "strong"}],
  "nextIntelCard": {"title": "下张情报卡", "documentId": "B-XX-1933-XXXX", "date": "1933-XX-XX", "provenance": "generated", "confidence": 0.8},
  "historyFlags": ["fictional_branch"],
  "requiresHumanApproval": false,
  "worldLineShift": {
    "turnDelta": 0.4,
    "totalDelta": 0.4,
    "domains": ["physics", "jewish_safety"],
    "cause": "一句话说明玩家选择为什么导致这个偏移——这是给玩家看的因果解释"
  },
  "narrative": "前段值班台报告风格，最后一句人味细节画面"
}`;
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function createHistoryReview({ direction = '', story = '', historyFlags = [] }) {
  const text = `${direction}\n${story}`;
  const flags = new Set(['fictional_branch', ...historyFlags]);
  const warnings = [];

  if (includesAny(text, sensitiveTerms)) {
    flags.add('sensitive_context');
    warnings.push('当前分支涉及纳粹德国、反犹迫害或国家暴力语境，必须保持严肃表达。');
  }

  if (includesAny(text, highRiskTerms)) {
    flags.add('sensitive_context');
    warnings.push('玩家方向可能改变真实人物生存状态，已进入审计关注。');
  }

  if (forgedArchivePattern.test(text)) {
    flags.add('archive_provenance_risk');
    warnings.push('文本疑似出现伪真实档案编号，后续材料不得伪装成真实档案。');
  }

  if (finalityTerms.some((term) => text.includes(term))) {
    flags.add('premature_finality');
    warnings.push('故事疑似一次性写到结局，应保持为可继续分叉的节点。');
  }

  return {
    approved: true,
    warnings,
    requiresHumanApproval: includesAny(direction, highRiskTerms),
    flags: [...flags],
  };
}

function buildPrompt({ currentTitle, currentStory, direction, pathTitles }) {
  return `你是一个架空历史故事引擎。请基于真实历史框架，续写一个好玩、好看、可继续分叉的网状历史故事节点。

核心世界线：1933 年，爱因斯坦没有离开德国。
当前节点标题：${currentTitle}
当前故事：
${currentStory}

玩家选择/输入的新方向：${direction}
已走过路径：${pathTitles.join(' -> ')}

要求：
1. 用中文输出。
2. 写 180-260 字的下一段故事，不要一次写到结局。
3. 让故事自然生长，允许细节有随机性，但不要脱离历史压力。
4. 严肃处理纳粹德国、反犹迫害、流亡、国家暴力，不要轻浮化。
5. 不要编造真实档案编号。
6. 给出 3 个新的可跟进故事线，每个包含 title 和 hint。
7. 生成一份情报简报 brief：summary、keyChanges、risks、suggestedNextActions。
8. 生成 1 个轻量 artifact，类型从 risk_notice、timeline_delta、archive_record、telegram 中选择；provenance 必须是 generated 或 unverified。
9. 给出 historyFlags，至少包含 fictional_branch；如涉及迫害、死亡、国家暴力，加入 sensitive_context。
10. 只返回 JSON，不要解释。

JSON 格式：
{
  "story": "...",
  "choices": [
    {"title": "...", "hint": "..."},
    {"title": "...", "hint": "..."},
    {"title": "...", "hint": "..."}
  ],
  "brief": {
    "summary": "...",
    "keyChanges": ["..."],
    "risks": ["..."],
    "suggestedNextActions": ["..."]
  },
  "artifacts": [
    {"type": "risk_notice", "title": "...", "content": "...", "provenance": "generated", "confidence": 0.6}
  ],
	  "historyFlags": ["fictional_branch"]
	}`;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`模型请求超时：${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function retryWithBackoff(fn, maxRetries = MAX_RETRIES, baseDelayMs = RETRY_BASE_DELAY_MS) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // 只对可恢复错误重试（超时 / 并发错误 / 网络抖动）
      // 不可恢复错误（认证失败 / 模型不支持）直接放弃
      const isRecoverable = /超时|concurrency|rate.limit|529|502|503|504|ECONNRESET|ETIMEDOUT|fetch.failed|ENOTFOUND|EAI_AGAIN/.test(lastError.message);
      if (!isRecoverable || attempt >= maxRetries) break;
      const delay = baseDelayMs * (attempt + 1);
      if (process.env.TURN_CYCLE_DEBUG) {
        console.error(`[retry] attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message.slice(0, 100)}, retry in ${delay}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function callAnthropicMessages(config, prompt, overrides = {}) {
  if (!config.baseUrl || !config.token) {
    throw new Error(config.provider === 'minimax'
      ? '缺少 MINIMAX_API_KEY 或 MiniMax Anthropic-compatible base URL'
      : '缺少 ANTHROPIC_BASE_URL 或 ANTHROPIC_AUTH_TOKEN');
  }

  const response = await fetchWithTimeout(`${config.baseUrl.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.token,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: overrides.maxTokens ?? 8000,
      temperature: overrides.temperature ?? 0.9,
      messages: [{ role: 'user', content: prompt }],
    }),
  }, config.timeoutMs);

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`模型请求失败：${response.status} ${body.slice(0, 300)}`);
  }

  const data = JSON.parse(body);
  const text = (data.content || [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();

  if (!text) {
    // round 052: thinking 模型若 max_tokens 不足会被 thinking 占满预算，
    // 可能返回 end_turn 但无 text block。给诊断信息帮助定位。
    const contentTypes = (data.content || [])
      .map((part) => part?.type)
      .filter(Boolean)
      .join(',') || 'none';
    const stopReason = data.stop_reason || 'unknown';
    throw new Error(`模型返回空内容：${config.model} content_types=${contentTypes} stop=${stopReason}`);
  }

  return text;
}

function normalizeOpenAIContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        return part?.text || '';
      })
      .join('\n');
  }
  return '';
}

async function callOpenAICompatibleChat(config, prompt, overrides = {}) {
  if (!config.baseUrl || !config.token) {
    throw new Error('缺少 MINIMAX_API_KEY 或 MiniMax Token Plan base URL');
  }

  const response = await fetchWithTimeout(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: overrides.maxTokens ?? 4000,
      temperature: overrides.temperature ?? 0.9,
      messages: [{ role: 'user', content: prompt }],
    }),
  }, config.timeoutMs);

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`模型请求失败：${response.status} ${body.slice(0, 300)}`);
  }

  const data = JSON.parse(body);
  const text = normalizeOpenAIContent(data.choices?.[0]?.message?.content).trim();
  if (!text) {
    throw new Error(`模型返回空内容：${config.model} choices_empty`);
  }

  return text;
}

async function callModel(payload) {
  const config = await loadModelConfig();
  const prompt = buildPrompt(payload);

  if (config.provider === 'minimax') {
    return config.apiFormat === 'openai'
      ? callOpenAICompatibleChat(config, prompt)
      : callAnthropicMessages(config, prompt);
  }

  return callAnthropicMessages(config, prompt);
}

function parseModelText(text) {
  const parsed = extractJson(text);
  if (!parsed.story || !Array.isArray(parsed.choices)) {
    throw new Error('模型 JSON 缺少 story 或 choices');
  }

  return normalizeModelResult(parsed);
}

function normalizeStringArray(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const items = value.map((item) => String(item || '').trim()).filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function normalizeArtifact(artifact, fallback = {}) {
  const type = artifactTypes.has(artifact?.type) ? artifact.type : (fallback.type || 'risk_notice');
  const provenance = provenanceTypes.has(artifact?.provenance) ? artifact.provenance : (fallback.provenance || 'generated');
  const confidence = Number(artifact?.confidence);

  return {
    id: createId('artifact'),
    type,
    title: String(artifact?.title || fallback.title || '世界线风险提示'),
    content: String(artifact?.content || fallback.content || '当前分支已被标记为需要继续观察。'),
    provenance,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : (fallback.confidence ?? 0.6),
    createdAt: new Date().toISOString(),
  };
}

function normalizeModelResult(parsed) {
  const brief = parsed.brief || {};
  const artifacts = Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
  const normalizedArtifacts = artifacts.slice(0, 2).map((artifact) => normalizeArtifact(artifact));

  return {
    story: String(parsed.story),
    choices: parsed.choices.slice(0, 3).map((choice) => ({
      title: String(choice.title || '继续跟进这条线'),
      hint: String(choice.hint || '查看这条历史分支如何继续生长。'),
    })),
    brief: {
      id: createId('brief'),
      summary: String(brief.summary || '本轮故事生成了新的历史分支。'),
      keyChanges: normalizeStringArray(brief.keyChanges, ['当前故事线出现新的行动方向。']),
      risks: normalizeStringArray(brief.risks, ['该分支仍需在后续节点中继续核验。']),
      suggestedNextActions: normalizeStringArray(brief.suggestedNextActions, ['继续跟进当前分支', '核验关键来源', '暂缓高风险干预']),
      authorAgent: 'IntelDeskAgent',
      createdAt: new Date().toISOString(),
    },
    artifacts: normalizedArtifacts.length > 0
      ? normalizedArtifacts
      : [normalizeArtifact(null)],
    historyFlags: normalizeStringArray(parsed.historyFlags, ['fictional_branch']),
  };
}

function createFallbackRuntimeResult(task, direction, message, previousEvents = [], historyReview) {
  const review = historyReview || createHistoryReview({ direction });
  return {
    story: `这个方向已经被系统识别为新的历史分叉。由于模型暂时不可用，故事先以占位方式继续：这条线会影响德国科学界、国际救援网络和爱因斯坦本人的处境。\n\n故事没有结束。它分裂成了新的几条线。\n\n[模型错误：${message}]`,
    choices: [
      { title: '跟进德国科学界', hint: '看学者们如何选择沉默、逃亡或合作。' },
      { title: '跟进国际救援网络', hint: '看海外世界如何尝试救出仍在欧洲的人。' },
      { title: '跟进爱因斯坦本人', hint: '看他如何在恐惧、责任与求生之间选择。' },
    ],
    status: 'fallback',
    task: { ...task, status: 'failed', updatedAt: new Date().toISOString() },
    events: [
      ...previousEvents,
      createRuntimeEvent(task.id, 'history_review_completed', 'HistoryGuardAgent 已完成历史敏感性检查', {
        historyFlags: review.flags,
        warnings: review.warnings,
      }),
      ...(review.requiresHumanApproval
        ? [createRuntimeEvent(task.id, 'human_approval_required', '审计频道提醒：该方向需要人工确认后再扩大干预', {
          reason: '高风险方向可能改变真实人物生存状态或扩大历史伤害语境。',
        })]
        : []),
      createRuntimeEvent(task.id, 'task_failed', 'StoryWeaverAgent 生成失败，已转入占位分支', { error: message }),
    ],
    brief: {
      id: createId('brief'),
      summary: '模型生成失败，但系统保留了可继续探索的占位分支。',
      keyChanges: ['当前玩家方向已被记录为新的故事节点。'],
      risks: [
        '该节点内容为占位生成，不能视为历史约束内的正式分支。',
        ...review.warnings,
        ...(review.requiresHumanApproval ? ['该方向触发高风险审计提示。'] : []),
      ],
      suggestedNextActions: ['重试生成', '改写玩家输入', '回到上一步'],
      authorAgent: 'IntelDeskAgent',
      createdAt: new Date().toISOString(),
    },
    artifacts: [normalizeArtifact({
      type: 'risk_notice',
      title: '模型生成失败',
      content: message,
      provenance: 'unverified',
      confidence: 0.2,
    })],
    historyReview: review,
    historyFlags: [...new Set(['fallback_branch', ...review.flags])],
  };
}

async function runHistoricalRuntime(payload, progressJob = null) {
  const task = createStoryTask(payload);
  const initialReview = createHistoryReview({ direction: payload.direction });
  if (progressJob) {
    emitJobEvent(progressJob, {
      stage: 'story_weaving',
      studentMessage: '叙事分析组正在生成候选历史分支。',
      technicalMessage: `StoryWeaverAgent MODEL_REQUEST_START task=${task.id}`,
      agent: 'StoryWeaverAgent',
      displayUnit: '叙事分析组',
    });
  }
  const events = [
    createRuntimeEvent(task.id, 'task_started', '值班任务已启动', { assignedAgent: task.assignedAgent }),
    createRuntimeEvent(task.id, 'llm_requested', 'StoryWeaverAgent 正在生成候选故事节点'),
    createRuntimeEvent(task.id, 'history_review_started', 'HistoryGuardAgent 已开始检查历史边界'),
  ];

  try {
    const raw = await retryWithBackoff(() => callModel(payload));
    const generated = parseModelText(raw);
    if (progressJob) {
      emitJobEvent(progressJob, {
        stage: 'history_review',
        studentMessage: '历史审计频道正在检查真实人物与敏感语境风险。',
        technicalMessage: `HistoryGuardAgent REVIEW_START task=${task.id}`,
        agent: 'HistoryGuardAgent',
        displayUnit: '历史审计频道',
      });
    }
    const historyReview = createHistoryReview({
      direction: payload.direction,
      story: generated.story,
      historyFlags: generated.historyFlags,
    });
    if (progressJob) {
      emitJobEvent(progressJob, {
        stage: 'briefing',
        severity: historyReview.requiresHumanApproval ? 'warn' : 'info',
        studentMessage: historyReview.requiresHumanApproval
          ? '历史审计频道发现高风险方向，情报值班台正在整理审计提示。'
          : '情报值班台正在整理本轮简报和建议行动。',
        technicalMessage: `IntelDeskAgent BRIEF_START task=${task.id} requiresHumanApproval=${historyReview.requiresHumanApproval}`,
        agent: 'IntelDeskAgent',
        displayUnit: '情报值班台',
        metadata: { flags: historyReview.flags },
      });
    }
    const risks = [
      ...generated.brief.risks,
      ...historyReview.warnings,
      ...(historyReview.requiresHumanApproval ? ['该方向触发高风险审计提示。'] : []),
    ];
    if (progressJob) {
      emitJobEvent(progressJob, {
        stage: 'artifact_generation',
        studentMessage: '档案组正在归档本轮新增材料。',
        technicalMessage: `ArtifactAgent ARTIFACTS_READY task=${task.id} count=${generated.artifacts.length}`,
        agent: 'ArtifactAgent',
        displayUnit: '档案组',
      });
      emitJobEvent(progressJob, {
        stage: 'commit_review',
        studentMessage: '值班系统正在确认世界线提交状态。',
        technicalMessage: `RuntimeOrchestrator COMMIT_REVIEW_START task=${task.id}`,
        agent: 'RuntimeOrchestrator',
        displayUnit: '值班系统',
      });
    }
    const completedTask = { ...task, status: 'completed', updatedAt: new Date().toISOString() };
    return {
      ...generated,
      brief: { ...generated.brief, taskId: task.id, risks: [...new Set(risks)] },
      historyReview,
      historyFlags: historyReview.flags,
      status: 'generated',
      task: completedTask,
      events: [
        ...events,
        createRuntimeEvent(task.id, 'llm_completed', 'StoryWeaverAgent 已生成候选节点'),
        createRuntimeEvent(task.id, 'history_review_completed', 'HistoryGuardAgent 已完成历史敏感性检查', {
          historyFlags: historyReview.flags,
          warnings: historyReview.warnings,
        }),
        ...(historyReview.requiresHumanApproval
          ? [createRuntimeEvent(task.id, 'human_approval_required', '审计频道提醒：该方向需要人工确认后再扩大干预', {
            reason: '高风险方向可能改变真实人物生存状态或扩大历史伤害语境。',
          })]
          : []),
        createRuntimeEvent(task.id, 'brief_created', 'IntelDeskAgent 已生成本轮情报简报'),
        createRuntimeEvent(task.id, 'task_completed', '故事分支任务已完成'),
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (progressJob) {
      emitJobEvent(progressJob, {
        stage: 'history_review',
        severity: initialReview.requiresHumanApproval ? 'warn' : 'info',
        studentMessage: '历史审计频道正在检查失败分支的风险边界。',
        technicalMessage: `HistoryGuardAgent FALLBACK_REVIEW task=${task.id} error=${message}`,
        agent: 'HistoryGuardAgent',
        displayUnit: '历史审计频道',
        metadata: { flags: initialReview.flags },
      });
      emitJobEvent(progressJob, {
        stage: 'briefing',
        severity: 'warn',
        studentMessage: '情报值班台正在把模型失败整理为可继续探索的占位分支。',
        technicalMessage: `IntelDeskAgent FALLBACK_BRIEF task=${task.id}`,
        agent: 'IntelDeskAgent',
        displayUnit: '情报值班台',
      });
      emitJobEvent(progressJob, {
        stage: 'artifact_generation',
        severity: 'warn',
        studentMessage: '档案组正在记录模型失败与占位材料来源。',
        technicalMessage: `ArtifactAgent FALLBACK_ARTIFACT task=${task.id}`,
        agent: 'ArtifactAgent',
        displayUnit: '档案组',
      });
      emitJobEvent(progressJob, {
        stage: 'commit_review',
        severity: 'warn',
        studentMessage: '值班系统正在确认占位分支，不把它标记为高可信正式材料。',
        technicalMessage: `RuntimeOrchestrator FALLBACK_COMMIT_REVIEW task=${task.id}`,
        agent: 'RuntimeOrchestrator',
        displayUnit: '值班系统',
      });
    }
    return createFallbackRuntimeResult(task, payload.direction, message, events, initialReview);
  }
}

async function runGenerateJob(job) {
  try {
    const result = await runHistoricalRuntime(job.payload, job);
    finishJob(job, result);
  } catch (error) {
    failJob(job, error);
  }
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function serveStatic(urlPath, response) {
  const safePath = normalize(urlPath === '/' ? '/index.html' : urlPath).replace(/^\.\.(\/|\\|$)/, '');
  const filePath = join(root, safePath);
  const content = await readFile(filePath);
  response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
  response.end(content);
}


// ─── Case State 持久化与状态变更引擎 ─────────────────────────────

function createInitialCaseState(caseId, payload) {
  return {
    caseId,
    turn: 0,
    caseTitle: payload.caseTitle || '历史异常事件',
    historicalAnchors: payload.historicalAnchors || [],
    nodes: new Map(),
    edges: new Map(),
    riskComponents: {
      '操作风险': 0,
      '暴露风险': 0,
      '历史偏移': 0,
      '不可控变量': 0,
      '时间压力': 0,
    },
    riskOverall: 0,
    flags: new Set(),
    clues: [],
    artifacts: [],
    historyFlags: new Set(['fictional_branch']),
    nextDeadline: null,
    previousChoice: null,
    stateChangeHistory: [],
    markedClues: {},
    // round 048: 真实世界线偏移，由 LLM aftermath 根据 playerChoice 推演，不再用公式造假
    // round 049: 加 causeHistory——累积每回合因果，让玩家看到完整塑造链而非只最近一次
    worldLineShift: {
      totalDelta: 0,        // 累计偏移 σ
      turnDelta: 0,         // 本回合偏移 σ
      domains: [],          // 受影响领域，如 ['physics', 'jewish_safety', 'nazi_ideology']
      lastCause: null,      // 最近一次偏移的因果说明（向后兼容）
      causeHistory: [],     // 每回合的因果说明累积，保留最近 5 次
      turnDeltaHistory: [], // 每回合 turnDelta 累积，供前端折线图使用
    },
    updatedAt: new Date().toISOString(),
  };
}

function getOrCreateCaseState(caseId, payload) {
  let state = caseStates.get(caseId);
  if (!state) {
    state = createInitialCaseState(caseId, payload);
    // 种入异常锚点节点，让任何回合（即使 fallback）都有至少 1 个节点
    const anchorId = `node-anchor-${caseId}`;
    state.nodes.set(anchorId, {
      id: anchorId,
      label: payload.caseTitle || '异常锚点',
      type: 'anomaly_origin',
      status: 'active',
      statusLabel: '激活',
      statusHistory: [],
      addedAt: new Date().toISOString(),
    });
    caseStates.set(caseId, state);
  }
  return state;
}

function applyStateChange(state, sc) {
  const { target, field, from, to, evidence } = sc;
  const prefix = target.split('.')[0];

  if (prefix === 'character' || prefix === 'organization' || prefix === 'node') {
    const nodeId = target;
    const existing = state.nodes.get(nodeId) || {
      id: nodeId,
      label: target.split('.').slice(1).join('.') || nodeId,
      type: prefix,
      status: 'unknown',
      statusLabel: '未知',
      statusHistory: [],
    };
    if (field === 'status') {
      existing.statusHistory.push({
        from: existing.status,
        to,
        evidence,
        at: new Date().toISOString(),
      });
      existing.status = to;
      existing.statusLabel = describeStatus(to);
    } else if (field === 'label') {
      existing.label = to;
    } else {
      existing[field] = to;
    }
    state.nodes.set(nodeId, existing);
  } else if (prefix === 'risk') {
    if (field === 'overall') {
      state.riskOverall = Number(to) || state.riskOverall;
    } else {
      state.riskComponents[field] = Number(to) || 0;
      state.riskOverall = computeRiskOverall(state.riskComponents);
    }
  } else if (prefix === 'clue') {
    state.clues.push({
      id: target,
      text: sc.evidence || `${from} → ${to}`,
      confidence: to || 'inferred',
      addedAt: new Date().toISOString(),
    });
  } else if (prefix === 'flags') {
    if (to === true || to === 'true') {
      state.flags.add(field);
    } else if (to === false || to === 'false') {
      state.flags.delete(field);
    }
  }

  state.stateChangeHistory.push({ ...sc, appliedAt: new Date().toISOString() });
  state.updatedAt = new Date().toISOString();
}

function describeStatus(status) {
  if (typeof status !== 'string') return String(status || '未知');
  const map = {
    monitored: '已监控',
    trusted: '已信任',
    protected: '已保护',
    sheltered: '已庇护',
    acting: '已行动',
    new: '新出现',
    latent: '待观察',
    hesitating: '犹豫中',
    unknown: '未知',
    failed: '失败',
  };
  return map[status] || status;
}

function computeRiskOverall(components) {
  return Math.min(5, Object.values(components).reduce((sum, v) => sum + (Number(v) || 0), 0));
}

function applyAftermath(state, aftermath) {
  // 累积节点（去重）
  if (Array.isArray(aftermath.newNodes)) {
    aftermath.newNodes.forEach((node) => {
      const existing = state.nodes.get(node.id);
      if (existing) {
        // 更新现有节点
        Object.assign(existing, {
          label: node.label || existing.label,
          type: node.type || existing.type,
          status: node.status || existing.status,
          statusLabel: node.statusLabel || existing.statusLabel,
        });
      } else {
        state.nodes.set(node.id, {
          id: node.id,
          label: node.label || node.id,
          type: node.type || 'unknown',
          status: node.status || 'new',
          statusLabel: node.statusLabel || '新出现',
          statusHistory: [],
          addedAt: new Date().toISOString(),
        });
      }
    });
  }

  // 累积连线（去重）
  if (Array.isArray(aftermath.newEdges)) {
    aftermath.newEdges.forEach((edge) => {
      const edgeId = `${edge.from}->${edge.to}`;
      state.edges.set(edgeId, {
        from: edge.from,
        to: edge.to,
        label: edge.label || '',
        strength: edge.strength || 'medium',
      });
    });
  }

  // 累积线索（去重）
  if (Array.isArray(aftermath.newClues)) {
    aftermath.newClues.forEach((clue) => {
      if (!state.clues.find((c) => c.id === clue.id)) {
        state.clues.push(clue);
      }
    });
  }

  // 应用状态变更
  if (Array.isArray(aftermath.stateChanges)) {
    aftermath.stateChanges.forEach((sc) => {
      try {
        applyStateChange(state, sc);
      } catch (err) {
        // 单个 stateChange 失败不影响整体
      }
    });
  }

  // 累积 history flags
  if (Array.isArray(aftermath.historyFlags)) {
    aftermath.historyFlags.forEach((flag) => state.historyFlags.add(flag));
  }

  // round 048: 累积 LLM 推演的世界线偏移到 caseState
  // round 049: 累积 causeHistory——让玩家看到每回合的因果，不止最近一次
  if (aftermath.worldLineShift && typeof aftermath.worldLineShift.turnDelta === 'number') {
    const shift = aftermath.worldLineShift;
    const current = state.worldLineShift || { totalDelta: 0, turnDelta: 0, domains: [], lastCause: null, causeHistory: [] };
    // 累计偏移 = 历史累计 + 本回合新增（允许负值——玩家可能拉回真实历史）
    const newTotal = Math.max(0, Math.round((current.totalDelta + shift.turnDelta) * 10) / 10);
    // 合并领域（去重，保留最近 8 个）
    const mergedDomains = [...new Set([...(current.domains || []), ...(shift.domains || [])])].slice(-8);
    // 累积因果说明（保留最近 5 次），让玩家看到完整塑造链
    const newCause = shift.cause || null;
    const causeHistory = Array.isArray(current.causeHistory) ? [...current.causeHistory] : [];
    if (newCause) causeHistory.push(newCause);
    const turnDeltaHistory = Array.isArray(current.turnDeltaHistory) ? [...current.turnDeltaHistory] : [];
    turnDeltaHistory.push(shift.turnDelta);
    state.worldLineShift = {
      totalDelta: newTotal,
      turnDelta: shift.turnDelta,
      domains: mergedDomains,
      lastCause: newCause || current.lastCause,
      causeHistory: causeHistory.slice(-5),
      turnDeltaHistory: turnDeltaHistory.slice(-12),
    };
  }

  // 记录下一张情报卡
  if (aftermath.nextIntelCard) {
    state.nextIntelCard = aftermath.nextIntelCard;
  }
}

function compileWorldStateFromCase(state) {
  return {
    caseId: state.caseId,
    turn: state.turn,
    caseTitle: state.caseTitle,
    historicalAnchors: state.historicalAnchors || [],
    anchor: { id: 'anchor', label: state.caseTitle, type: 'anomaly_origin', status: 'active' },
    nodes: Array.from(state.nodes.values()),
    edges: Array.from(state.edges.values()),
    riskIndicators: {
      overall: state.riskOverall,
      max: 5,
      components: Object.entries(state.riskComponents).map(([label, value]) => ({ label, value })),
    },
    nextDeadline: state.nextDeadline,
    flags: Array.from(state.flags),
    clues: state.clues,
    markedClues: state.markedClues || {},
    // round 048: 导出真实世界线偏移 + 变更历史摘要，让 prompt 看得见因果
    // round 049: 导出 causeHistory，前端可渲染完整塑造链
    worldLineShift: state.worldLineShift || { totalDelta: 0, turnDelta: 0, domains: [], lastCause: null, causeHistory: [] },
    stateChangeHistory: (state.stateChangeHistory || []).slice(-12).map((sc) => ({
      target: sc.target,
      field: sc.field,
      from: sc.from,
      to: sc.to,
      evidence: sc.evidence ? String(sc.evidence).slice(0, 80) : '',
    })),
    previousChoice: state.previousChoice || null,
  };
}

// ─── marked clue 引擎（round 043）────────────────────────────────

// 历史框架拒绝词：玩家手写笔记不能包含明显非历史语境的词
// 注意：中文没有 word boundary，所以用裸字串而非 \b
const MARKED_CLUE_REJECTED_PATTERNS = [
  /游戏/,
  /开挂/,
  /刷分/,
  /LOL/i,
  /gaming/i,
  /hack/i,
  /^[!！?？]{3,}$/,  // 纯情绪符号串
];

function isHistoricalContextNote(text) {
  if (!text || typeof text !== 'string') return true;
  return !MARKED_CLUE_REJECTED_PATTERNS.some((p) => p.test(text));
}

function markClue(caseId, clueId, action, note, currentTurn) {
  if (!caseId || !clueId) {
    return { ok: false, code: 'bad_request', error: '缺少 caseId 或 clueId' };
  }
  const state = caseStates.get(caseId);
  if (!state) {
    return { ok: false, code: 'not_found', error: 'Case not found' };
  }
  if (!state.markedClues) state.markedClues = {};

  if (action === 'unmark') {
    delete state.markedClues[clueId];
    state.updatedAt = new Date().toISOString();
    return { ok: true, markedClues: state.markedClues };
  }

  if (action === 'mark') {
    if (note !== undefined && note !== null && note !== '' && !isHistoricalContextNote(note)) {
      return {
        ok: false,
        code: 'non_historical_note',
        error: '档案体不接收此类注释',
      };
    }
    const trimmedNote = typeof note === 'string' ? note.slice(0, 200) : '';
    state.markedClues[clueId] = {
      turnMarked: Number(currentTurn) || state.turn || 1,
      note: trimmedNote,
    };
    state.updatedAt = new Date().toISOString();
    return { ok: true, markedClues: state.markedClues };
  }

  return { ok: false, code: 'bad_action', error: `未知 action: ${action}` };
}


// ─── 三段式解析器 ────────────────────────────────────────────────

function assertFields(obj, fields, stageName) {
  for (const f of fields) {
    if (!obj[f] || (typeof obj[f] === 'string' && !obj[f].trim())) {
      throw new Error(`${stageName} 缺少必填字段: ${f}`);
    }
  }
}

function parseBriefingResult(parsed) {
  const card = parsed.intelCard;
  if (!card || typeof card !== 'object') {
    throw new Error('briefing: 缺少 intelCard 字段');
  }
  const header = card.header || {};
  assertFields(header, ['title', 'documentId', 'date', 'source'], 'briefing.header');
  if (!card.body || typeof card.body.text !== 'string' || !card.body.text.trim()) {
    throw new Error('briefing: 缺少 intelCard.body.text');
  }

  return {
    stage: 'briefing',
    intelCard: {
      id: createId('ic'),
      caseId: 'einstein-1933',
      classification: card.classification || '绝密',
      header: {
        title: String(header.title),
        documentId: String(header.documentId),
        date: String(header.date),
        source: String(header.source),
        classification: String(header.classification || card.classification || '机密'),
        language: String(header.language || 'de-zh'),
      },
      body: {
        text: String(card.body.text),
        originalSnippet: String(card.body.originalSnippet || ''),
        translation: String(card.body.translation || ''),
        handwrittenNotes: Array.isArray(card.body.handwrittenNotes)
          ? card.body.handwrittenNotes.map((n) => ({
              location: String(n.location || ''),
              text: String(n.text || ''),
              translation: String(n.translation || ''),
              inkColor: String(n.inkColor || 'blue'),
              legibility: String(n.legibility || 'clear'),
            }))
          : [],
      },
      contradictions: Array.isArray(card.contradictions) ? card.contradictions : [],
      clues: Array.isArray(card.clues) ? card.clues : [],
      actions: [
        { id: 'verify-source', label: '验证来源', icon: 'magnifying-glass' },
        { id: 'mark-clues', label: '标记线索', icon: 'highlighter' },
        { id: 'send-directive', label: '发送指令', icon: 'telegraph' },
      ],
      nextTimeNode: String(card.nextTimeNode || '1933-10-20'),
      provenance: card.provenance || { type: 'generated', confidence: 0.7 },
      historyFlags: normalizeStringArray(card.historyFlags, ['fictional_branch']),
    },
  };
}

function parseSituationRoomResult(parsed) {
  const sr = parsed.situationRoom;
  if (!sr || typeof sr !== 'object') {
    throw new Error('situation_room: 缺少 situationRoom 字段');
  }
  if (!Array.isArray(sr.nodes) || sr.nodes.length === 0) {
    throw new Error('situation_room: nodes 必须是非空数组');
  }
  if (!Array.isArray(parsed.actionOptions) || parsed.actionOptions.length === 0) {
    throw new Error('situation_room: actionOptions 必须是非空数组');
  }

  return {
    stage: 'situation_room',
    anchor: sr.anchor || { id: 'anchor', label: '异常锚点', type: 'anomaly_origin', status: 'active' },
    nodes: sr.nodes,
    edges: Array.isArray(sr.edges) ? sr.edges : [],
    worldLineShift: sr.worldLineShift || { totalDelta: 0, domains: [] },
    riskIndicators: sr.riskIndicators || { overall: 1, max: 5, components: [] },
    nextDeadline: sr.nextDeadline || null,
    actionOptions: {
      options: parsed.actionOptions.map((o) => {
        assertFields(o, ['label'], 'actionOptions');
        // round 048: 解析预估偏移，让玩家选择前就看到因果
        const rawDrift = o.estimatedDrift || {};
        const estimatedDrift = {
          turnDelta: typeof rawDrift.turnDelta === 'number'
            ? Math.max(-0.3, Math.min(2.0, rawDrift.turnDelta))
            : 0,
          totalDelta: typeof rawDrift.totalDelta === 'number' ? Math.max(0, rawDrift.totalDelta) : 0,
          domains: Array.isArray(rawDrift.domains)
            ? rawDrift.domains.map((d) => String(d)).filter(Boolean).slice(0, 5)
            : [],
          reason: rawDrift.reason ? String(rawDrift.reason).slice(0, 200) : null,
        };
        return {
          id: String(o.id || createId('action')),
          label: String(o.label),
          icon: String(o.icon || 'circle'),
          historicalPlausibility: String(o.historicalPlausibility || 'medium'),
          description: String(o.description || ''),
          riskCost: Number(o.riskCost) || 0,
          intelReturn: String(o.intelReturn || 'low'),
          unlocksNodes: Array.isArray(o.unlocksNodes) ? o.unlocksNodes : [],
          consequencePreview: String(o.consequencePreview || ''),
          estimatedDrift,
        };
      }),
      previousChoiceImpact: parsed.previousChoiceImpact || null,
      deadline: sr.nextDeadline || null,
    },
    historyFlags: normalizeStringArray(parsed.historyFlags, ['fictional_branch']),
  };
}

function parseAftermathResult(parsed) {
  // narrative 可能因为 max_tokens 截断丢失，但结构化数据已保住了——用占位 narrative 不抛错
  const narrative = (parsed.narrative && typeof parsed.narrative === 'string' && parsed.narrative.trim())
    ? String(parsed.narrative)
    : '本轮推演报告已归档（叙事文本因生成上限截断，详情见下方状态变更与新增线索）。';

  // round 048: 解析 LLM 推演的世界线偏移，不再用公式造假
  const rawShift = parsed.worldLineShift || {};
  const turnDelta = typeof rawShift.turnDelta === 'number'
    ? Math.max(-0.5, Math.min(2.5, rawShift.turnDelta))
    : (typeof rawShift.totalDelta === 'number' ? Math.max(0, Math.min(2.5, rawShift.totalDelta)) : 0);
  const domains = Array.isArray(rawShift.domains)
    ? rawShift.domains.map((d) => String(d)).filter(Boolean).slice(0, 6)
    : [];

  return {
    stage: 'aftermath',
    narrative,
    stateChanges: Array.isArray(parsed.stateChanges)
      ? parsed.stateChanges.map((sc) => {
          assertFields(sc, ['target', 'field'], 'stateChange');
          return {
            id: String(sc.id || createId('sc')),
            target: String(sc.target),
            field: String(sc.field),
            from: sc.from,
            to: sc.to,
            evidence: String(sc.evidence || ''),
            visibility: String(sc.visibility || 'player_visible'),
          };
        })
      : [],
    newClues: Array.isArray(parsed.newClues)
      ? parsed.newClues.map((c) => ({
          id: String(c.id || createId('clue')),
          text: String(c.text || ''),
          category: String(c.category || ''),
          confidence: String(c.confidence || 'inferred'),
          sourceDocumentId: c.sourceDocumentId || null,
        }))
      : [],
    newNodes: Array.isArray(parsed.newNodes) ? parsed.newNodes : [],
    newEdges: Array.isArray(parsed.newEdges) ? parsed.newEdges : [],
    nextIntelCard: parsed.nextIntelCard || null,
    historyFlags: normalizeStringArray(parsed.historyFlags, ['fictional_branch']),
    requiresHumanApproval: Boolean(parsed.requiresHumanApproval),
    // round 048: LLM 推演的真实世界线偏移
    worldLineShift: {
      turnDelta,
      domains,
      cause: rawShift.cause ? String(rawShift.cause).slice(0, 200) : null,
    },
  };
}

// ─── 三段式回合编排器 ────────────────────────────────────────────

async function callModelWithPrompt(prompt, progressJob) {
  const config = await loadModelConfig();
  const overrides = { maxTokens: 8000, temperature: 0.5 };

  // MiniMax provider 走自己的路径
  if (config.provider === 'minimax') {
    if (config.apiFormat === 'openai') {
      return await callOpenAICompatibleChat(config, prompt, overrides);
    }
    return await callAnthropicMessages(config, prompt, overrides);
  }

  const fallbackModels = MODEL_FALLBACK_CHAIN;
  // Anthropic provider：直接尝试候选模型，失败自动降级。
  // 不做主动探测——探测请求本身会消耗并发额度，反而让真正请求更难成功。
  // 优先级：环境变量指定模型 > 缓存的可用模型 > fallback chain 其余成员。
  const envModel = (config.model && config.model !== 'gpt-5.5[1m]') ? config.model : null;
  const orderedCandidates = [
    ...(envModel ? [envModel] : []),
    ...(cachedWorkingModel && cachedWorkingModel !== envModel ? [cachedWorkingModel] : []),
    ...fallbackModels.filter((m) => m !== envModel && m !== cachedWorkingModel),
  ];

  let lastError = null;
  for (let i = 0; i < orderedCandidates.length; i++) {
    const modelToTry = orderedCandidates[i];
    const configWithModel = { ...config, model: modelToTry };
    try {
      const result = await callAnthropicMessages(configWithModel, prompt, overrides);
      cachedWorkingModel = modelToTry;
      if (progressJob && i > 0) {
        emitJobEvent(progressJob, {
          stage: 'briefing',
          severity: 'info',
          studentMessage: `模型降级到 ${modelToTry} 后成功。`,
          technicalMessage: `ModelFallback RECOVERED via ${modelToTry}`,
          agent: 'RuntimeOrchestrator',
          displayUnit: '值班系统',
        });
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message;
      // 不可恢复的错误（model not allowed / plan 不支持）直接跳过，不浪费重试
      // 可恢复的错误（concurrency / timeout）也跳过到下一个模型
      if (modelToTry === cachedWorkingModel) {
        cachedWorkingModel = null;
      }
      // 只在前几次降级时打日志，避免刷屏
      if (progressJob && i < 3) {
        emitJobEvent(progressJob, {
          stage: 'briefing',
          severity: 'warn',
          studentMessage: `${modelToTry} 不可用，尝试备用模型…`,
          technicalMessage: `ModelFallback ${modelToTry}_FAILED: ${msg.slice(0, 100)}`,
          agent: 'RuntimeOrchestrator',
          displayUnit: '值班系统',
        });
      }
    }
  }

  throw lastError || new Error('所有候选模型均不可用');
}

async function runTurnStage(prompt, parser, stageName, displayName, progressJob) {
  if (progressJob) {
    emitJobEvent(progressJob, {
      stage: stageName,
      severity: 'info',
      studentMessage: `${displayName}正在处理。`,
      technicalMessage: `${displayName} ${stageName.toUpperCase()}_START`,
      agent: displayName,
      displayUnit: displayName,
    });
  }

  try {
    const raw = await retryWithBackoff(() => callModelWithPrompt(prompt, progressJob));
    if (process.env.TURN_CYCLE_DEBUG) {
      console.error(`[DEBUG ${stageName}] raw model response (first 3000 chars):`, String(raw).slice(0, 3000));
    }
    const parsed = extractJson(raw);
    const result = parser(parsed);

    if (progressJob) {
      emitJobEvent(progressJob, {
        stage: stageName,
        severity: 'info',
        studentMessage: `${displayName}完成。`,
        technicalMessage: `${displayName} ${stageName.toUpperCase()}_COMPLETE`,
        agent: displayName,
        displayUnit: displayName,
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (progressJob) {
      emitJobEvent(progressJob, {
        stage: stageName,
        severity: 'warn',
        studentMessage: `${displayName}遇到问题，正在使用占位数据。`,
        technicalMessage: `${displayName} ${stageName.toUpperCase()}_FALLBACK error=${message}`,
        agent: displayName,
        displayUnit: displayName,
      });
    }
    throw error;
  }
}

async function runTurn(payload, progressJob) {
  try {
    const {
      caseId = 'einstein-1933',
      turn = 1,
      caseTitle = '爱因斯坦未离开德国',
      historicalAnchors = ['Einstein 1933 年 10 月未离开柏林', '柏林物理学会存在犹太裔会员名单'],
      worldState = null,
      previousChoice = null,
      playerHistory = [],
      riskLevel = 1,
    } = payload;

    // 读取累积 case state（如果客户端没传 worldState，则从 case state 编译）
    const caseState = getOrCreateCaseState(caseId, payload);
    caseState.turn = turn;
    caseState.previousChoice = previousChoice || caseState.previousChoice;

    const compiledWorldState = worldState || compileWorldStateFromCase(caseState);

    // Stage 1: Briefing
    const briefingResult = await runTurnStage(
      buildBriefingPrompt({ caseId, turn, caseTitle, historicalAnchors, previousState: compiledWorldState, playerHistory }),
      parseBriefingResult,
      'briefing',
      '情报值班台',
      progressJob
    );

    // Stage 2: Situation Room（基于累积 case state）
    const situationResult = await runTurnStage(
      buildSituationRoomPrompt({ caseId, turn, worldState: compiledWorldState, currentNodeLabels: [], previousChoice, riskLevel }),
      parseSituationRoomResult,
      'situation_room',
      '态势分析系统',
      progressJob
    );

    // 把这一回合产生的节点也并入 case state
    if (Array.isArray(situationResult.nodes)) {
      situationResult.nodes.forEach((node) => {
        if (!caseState.nodes.has(node.id)) {
          caseState.nodes.set(node.id, {
            id: node.id,
            label: node.label || node.id,
            type: node.type || 'unknown',
            status: node.status || 'latent',
            statusLabel: node.statusLabel || '待观察',
            statusHistory: [],
            addedAt: new Date().toISOString(),
          });
        }
      });
    }
    if (Array.isArray(situationResult.edges)) {
      situationResult.edges.forEach((edge) => {
        const edgeId = `${edge.from}->${edge.to}`;
        caseState.edges.set(edgeId, {
          from: edge.from,
          to: edge.to,
          label: edge.label || '',
          strength: edge.strength || 'medium',
        });
      });
    }
    if (situationResult.nextDeadline) {
      caseState.nextDeadline = situationResult.nextDeadline;
    }
    if (Array.isArray(situationResult.riskIndicators?.components)) {
      situationResult.riskIndicators.components.forEach((comp) => {
        caseState.riskComponents[comp.label] = Number(comp.value) || 0;
      });
      caseState.riskOverall = computeRiskOverall(caseState.riskComponents);
    }
    if (Array.isArray(situationResult.historyFlags)) {
      situationResult.historyFlags.forEach((f) => caseState.historyFlags.add(f));
    }

    // 返回时附上完整的累积 case state，方便前端跨回合呈现
    const accumulatedWorldState = compileWorldStateFromCase(caseState);

    return {
      ok: true,
      turn,
      stage: 'awaiting_player_choice',
      briefing: briefingResult,
      situationRoom: situationResult,
      worldState: accumulatedWorldState,
      historyFlags: [...new Set([
        ...(briefingResult.historyFlags || []),
        ...(situationResult.historyFlags || []),
      ])],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (progressJob) {
      emitJobEvent(progressJob, {
        stage: 'briefing',
        severity: 'warn',
        studentMessage: '情报值班台遇到问题，正在使用占位数据。',
        technicalMessage: `runTurn FALLBACK error=${message}`,
        agent: '情报值班台',
        displayUnit: '情报值班台',
      });
    }
    return {
      ok: true,
      turn: payload.turn || 1,
      stage: 'awaiting_player_choice',
      briefing: {
        stage: 'briefing',
        intelCard: {
          id: createId('ic'),
          caseId: payload.caseId || 'einstein-1933',
          classification: '绝密',
          header: {
            title: '占位情报卡（模型不可用）',
            documentId: createId('doc'),
            date: '1933-10-15',
            source: '系统占位',
            classification: '绝密',
            language: 'de-zh',
          },
          body: {
            text: '模型暂时不可用，情报卡内容将使用占位数据。请检查模型配置后重试。',
            originalSnippet: '',
            translation: '',
            handwrittenNotes: [],
          },
          contradictions: [],
          clues: [{ id: 'clue-fallback', text: '等待模型恢复后重新生成', category: '系统', confidence: 'unverified' }],
          actions: [
            { id: 'verify-source', label: '验证来源', icon: 'magnifying-glass' },
            { id: 'mark-clues', label: '标记线索', icon: 'highlighter' },
            { id: 'send-directive', label: '发送指令', icon: 'telegraph' },
          ],
          nextTimeNode: '1933-10-20',
          provenance: { type: 'generated', confidence: 0.1 },
          historyFlags: ['fictional_branch'],
        },
      },
      situationRoom: {
        stage: 'situation_room',
        anchor: { id: 'anchor', label: '异常锚点', type: 'anomaly_origin', status: 'active' },
        nodes: [{ id: 'node-unknown', label: '待观察', type: 'unknown', status: 'latent', statusLabel: '待观察', depth: 1 }],
        edges: [],
        worldLineShift: { totalDelta: 0, turnDelta: 0, domains: [], lastCause: null },
        riskIndicators: { overall: 1, max: 5, components: [{ label: '操作风险', value: 1 }] },
        nextDeadline: { type: 'newspaper_publication', label: '柏林日报出刊', date: '1933-10-20' },
        actionOptions: {
          options: [
            { id: 'action-observe', label: '继续观察', icon: 'eye', historicalPlausibility: 'high', description: '等待更多信息', riskCost: 0, intelReturn: 'low', unlocksNodes: [], consequencePreview: '安全但异常在自行演化' },
          ],
          previousChoiceImpact: null,
          deadline: { type: 'newspaper_publication', label: '柏林日报出刊', date: '1933-10-20' },
        },
        historyFlags: ['fictional_branch'],
      },
      historyFlags: ['fictional_branch'],
      worldState: compileWorldStateFromCase(getOrCreateCaseState(payload.caseId || 'einstein-1933', payload)),
    };
  }
}

async function runTurnAftermath(payload, progressJob) {
  try {
    const {
      turn = 1,
      playerChoiceId,
      playerChoiceLabel,
      narrativeContext,
      worldState: payloadWorldState,
      intelCardTitle,
      caseId: payloadCaseId,
      playerHistory = [],
      briefingHistoryFlags = [],
      situationRoomHistoryFlags = [],
    } = payload;

    // round 048: 不信任前端传的 worldState，用累积 caseState 重编译作为权威
    // 前端可能传 undefined、旧状态、或不完整的快照——只有 caseState 是真相来源
    const caseState = payloadCaseId
      ? getOrCreateCaseState(payloadCaseId, { caseTitle: intelCardTitle || '历史异常事件' })
      : null;
    const authoritativeWorldState = caseState
      ? compileWorldStateFromCase(caseState)
      : payloadWorldState || {};

    const aftermathResult = await runTurnStage(
      buildAftermathPrompt({
        playerChoiceId,
        playerChoiceLabel,
        narrativeContext,
        worldState: authoritativeWorldState,
        intelCardTitle,
        playerHistory,
      }),
      parseAftermathResult,
      'aftermath',
      '叙事分析组',
      progressJob
    );

    // 把 state changes + worldLineShift 应用到累积 case state
    const appliedStateChanges = [];
    if (caseState) {
      applyAftermath(caseState, aftermathResult);
      caseState.turn = turn;
      caseState.previousChoice = { id: playerChoiceId, label: playerChoiceLabel };

      // 收集实际被应用的状态变更（player_visible 部分）
      appliedStateChanges.push(...aftermathResult.stateChanges.filter((sc) => sc.visibility !== 'system_only'));
    }

    // round 048: 重新编译 worldState，确保前端拿到的是 applyAftermath 后的最新状态（含 worldLineShift）
    const finalWorldState = caseState ? compileWorldStateFromCase(caseState) : null;

    return {
      ok: true,
      turn,
      stage: 'complete',
      aftermath: aftermathResult,
      worldState: finalWorldState,
      appliedStateChanges,
      historyFlags: [...new Set([
        ...briefingHistoryFlags,
        ...situationRoomHistoryFlags,
        ...aftermathResult.historyFlags,
      ])],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.TURN_CYCLE_DEBUG) {
      console.error(`[DEBUG runTurnAftermath CAUGHT] ${message}`);
    }
    if (progressJob) {
      emitJobEvent(progressJob, {
        stage: 'aftermath',
        severity: 'warn',
        studentMessage: '叙事分析组遇到问题，使用占位数据。',
        technicalMessage: `runTurnAftermath FALLBACK error=${message.slice(0, 150)}`,
        agent: '叙事分析组',
        displayUnit: '叙事分析组',
      });
    }
    // round 048: fallback 也带 worldLineShift 字段，避免前端 undefined
    const fallbackCaseState = payload.caseId ? getOrCreateCaseState(payload.caseId, payload) : null;
    const fallbackWorldState = fallbackCaseState ? compileWorldStateFromCase(fallbackCaseState) : null;
    return {
      ok: true,
      turn: payload.turn || 1,
      stage: 'complete',
      aftermath: {
        narrative: '模型暂时不可用，叙事推演结果将使用占位数据。',
        stateChanges: [],
        newClues: [],
        newNodes: [],
        newEdges: [],
        nextIntelCard: null,
        historyFlags: [...new Set([
          ...(payload.briefingHistoryFlags || []),
          ...(payload.situationRoomHistoryFlags || []),
          'fictional_branch',
        ])],
        requiresHumanApproval: false,
        worldLineShift: { turnDelta: 0, domains: [], cause: '模型不可用，无法推演偏移' },
      },
      worldState: fallbackWorldState,
      historyFlags: [...new Set([
        ...(payload.briefingHistoryFlags || []),
        ...(payload.situationRoomHistoryFlags || []),
        'fictional_branch',
      ])],
    };
  }
}

// ─── 旧端点兼容包装 ───────────────────────────────────────────────

async function runGenerateJobLegacy(job) {
  try {
    // 旧端点：把单次请求包装为完整回合的前三段
    const payload = job.payload;
    payload.turn = payload.turn || 1;
    payload.caseTitle = payload.direction || '历史异常事件';

    // 直接跳到 Aftermath（单次 LLM 调用模式，兼容旧前端）
    const result = await runHistoricalRuntime(payload, job);
    finishJob(job, result);
  } catch (error) {
    failJob(job, error);
  }
}
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);

    if (request.method === 'POST' && url.pathname === '/api/generate') {
      const raw = await readRequestBody(request);
      const payload = JSON.parse(raw);
      const result = await runHistoricalRuntime(payload);
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(result));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/generate/start') {
      const raw = await readRequestBody(request);
      const payload = JSON.parse(raw);
      const job = createJob(payload);
      setTimeout(() => runGenerateJobLegacy(job), 0);
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: true,
        jobId: job.jobId,
        statusUrl: `/api/jobs/${job.jobId}`,
      }));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/turn/start') {
      const raw = await readRequestBody(request);
      const payload = JSON.parse(raw);
      const job = createJob(payload);
      job.currentDeskMessage = '情报值班台正在准备本轮情报卡。';
      setTimeout(async () => {
        try {
          const turnResult = await runTurn(payload, job);
          job.result = turnResult;
          finishJob(job, turnResult);
        } catch (error) {
          failJob(job, error);
        }
      }, 0);
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: true,
        jobId: job.jobId,
        statusUrl: `/api/jobs/${job.jobId}`,
      }));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/turn/aftermath') {
      const raw = await readRequestBody(request);
      const payload = JSON.parse(raw);
      const job = createJob(payload);
      job.currentDeskMessage = '叙事分析组正在推演玩家选择的后果。';
      setTimeout(async () => {
        try {
          const aftermathResult = await runTurnAftermath(payload, job);
          job.result = aftermathResult;
          finishJob(job, aftermathResult);
        } catch (error) {
          failJob(job, error);
        }
      }, 0);
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: true,
        jobId: job.jobId,
        statusUrl: `/api/jobs/${job.jobId}`,
      }));
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/jobs/')) {
      const jobId = decodeURIComponent(url.pathname.slice('/api/jobs/'.length));
      const job = jobs.get(jobId);
      if (!job) {
        response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, error: 'Job not found' }));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(jobSnapshot(job)));
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/case/')) {
      const caseId = decodeURIComponent(url.pathname.slice('/api/case/'.length));
      const state = caseStates.get(caseId);
      if (!state) {
        response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, error: 'Case not found' }));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: true,
        caseState: compileWorldStateFromCase(state),
        stateChangeHistory: state.stateChangeHistory,
        updatedAt: state.updatedAt,
      }));
      return;
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/case/') && url.pathname.endsWith('/mark-clue')) {
      const caseId = decodeURIComponent(url.pathname.slice('/api/case/'.length, -'/mark-clue'.length));
      let payload;
      try {
        payload = JSON.parse(await readRequestBody(request));
      } catch {
        response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, code: 'bad_json', error: 'Body 必须为合法 JSON' }));
        return;
      }
      const result = markClue(caseId, payload.clueId, payload.action, payload.note, payload.turn);
      const status = result.ok ? 200
        : result.code === 'not_found' ? 404
        : result.code === 'non_historical_note' ? 422
        : 400;
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(result));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/case/reset') {
      const raw = await readRequestBody(request);
      const payload = JSON.parse(raw);
      const caseId = payload.caseId;
      if (caseId) caseStates.delete(caseId);
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, reset: !!caseId }));
      return;
    }

    if (request.method === 'GET') {
      await serveStatic(url.pathname, response);
      return;
    }

    response.writeHead(405);
    response.end('Method Not Allowed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response.writeHead(request.url?.startsWith('/api/') ? 500 : 404, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: message }));
  }
});

server.listen(Number(process.env.PORT || 8892), '127.0.0.1', () => {
  console.log(`Web story loop demo listening at http://127.0.0.1:8892/`);
});
