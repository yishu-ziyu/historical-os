# HistoricalRuntime v0.1 → v0.3 Codec 实施指导文档

> 面向对象：Codec / 专业代码实现 Agent  
> 项目目录：`/Users/mahaoxuan/Desktop/黑客松/架空历史故事游戏`  
> 当前重点：把 LobeHub 风格的 Agent Runtime / Task / Brief 架构，落地到“架空历史故事游戏 / 历史模拟 OS”的真实产品原型中。  
> 重要原则：不要把产品做成聊天机器人；Agent 应该驱动世界线、任务、情报简报和历史材料生成。

---

## 0. 给 Codec 的执行摘要

当前项目已经有一个可运行的 Web Demo：

```text
artifacts/web_story_loop_demo/
├── index.html
├── script.js
├── style.css
└── server.mjs
```

它的产品形态是：

```text
1933 年，爱因斯坦没有离开德国。
玩家点击分支或输入方向。
系统生成新的故事节点。
节点构成一个可回溯、可跳转的网状历史故事书。
```

现在要把它升级成一个轻量的 **Historical OS Agent Runtime**：

```text
玩家操作
  → 创建 Story Task
  → HistoricalRuntime 执行
  → StoryWeaverAgent 生成故事
  → HistoryGuardAgent 审查历史与伦理边界
  → IntelDeskAgent 生成 Brief
  → 产出 StoryNode / RuntimeEvents / Brief / Artifact
  → 前端展示为历史 OS 工作台
```

你要做的不是重写整个项目，而是在当前 Demo 上分阶段增强。

---

## 1. 项目背景

### 1.1 产品定位

本项目不是传统 Galgame，也不是普通 AI 聊天应用。

它的目标是：

> 一个自动演化的架空历史故事游戏 / 历史模拟 OS。玩家从某段真实历史进入，看到一个异常事件，并通过观察、调查、核验、发送指令等方式影响世界线。

当前第一案：

```text
1933 年，爱因斯坦没有离开德国。
```

真实历史基准：

```text
爱因斯坦在 1933 年离开德国，没有回到纳粹德国。
```

当前架空分叉：

```text
当前世界线显示：爱因斯坦仍然留在柏林附近。
```

### 1.2 当前已确认的产品判断

请实现时遵守：

1. 核心不是固定剧情树，而是 LLM 驱动、历史框架约束、可随机自由生长的网状故事书。
2. 玩家看到的不应是 Agent 聊天气泡，而是 Historical OS 中的任务、事件流、简报、档案、电报、风险提示。
3. 第一案要严肃处理纳粹德国、反犹迫害、流亡知识分子、国家暴力等历史语境。
4. 不能编造真实档案编号。
5. 必须区分：真实历史基准、架空生成内容、未核验情报、玩家输入。
6. 当前 Demo 是原型，不需要一次性引入数据库、复杂多 Agent 并发或完整 RAG。

---

## 2. LobeHub 架构启发与本项目映射

我们之前研究了 LobeHub / LobeChat 的源码，重点借鉴三块：

1. `AgentRuntime`
2. `Task / TopicRun / Brief` 数据模型
3. Agent 工作台式 UI

### 2.1 LobeHub AgentRuntime 抽象

LobeHub 的运行抽象可以简化为：

```text
Agent.runner(context, state)
  → AgentInstruction
  → Runtime executor
  → events + newState + nextContext
```

其核心价值不是“多模型聊天”，而是把 Agent 的行为变成可追踪、可恢复、可展示的执行流。

### 2.2 映射到本项目

| LobeHub 概念 | 本项目概念 | 说明 |
|---|---|---|
| Agent | StoryWeaverAgent / HistoryGuardAgent / IntelDeskAgent | 不同职责的历史 OS Agent |
| AgentRuntime | HistoricalRuntime | 负责执行任务、生成事件、汇总结果 |
| AgentInstruction | call_llm / validate_history / emit_artifact / request_human_approval | Runtime 内部动作协议 |
| Task | StoryTask / SourceVerificationTask / WorldTickTask | 玩家或系统触发的工作单元 |
| TopicRun | HistoricalCaseRun | 一个历史异常案件，例如 EINSTEIN-1933-A |
| Brief | Intel Brief / 情报简报 | 每轮生成后的摘要、风险、建议 |
| Artifact | 档案、电报、报纸、时间线变化、风险提示 | 故事之外的 OS 媒介对象 |
| HumanApproval | 审计确认 / 高风险干预确认 | 玩家批准或取消高风险行动 |

---

## 3. 当前代码状态

### 3.1 主要目录

```text
/Users/mahaoxuan/Desktop/黑客松/架空历史故事游戏
```

关键文件：

```text
HANDOFF.md
TODO.md
artifacts/web_story_loop_demo/index.html
artifacts/web_story_loop_demo/script.js
artifacts/web_story_loop_demo/style.css
artifacts/web_story_loop_demo/server.mjs
artifacts/godot_demo/data/workbench.json
artifacts/godot_demo/scripts/Main.gd
```

### 3.2 Web Demo 当前职责

`index.html`：页面结构。  
`style.css`：历史故事书 + 工作台视觉。  
`script.js`：浏览器端状态，包括故事节点、当前节点、地图、任务面板、事件流、Brief 展示。  
`server.mjs`：本地 Node 服务，负责静态文件和 `/api/generate`。

### 3.3 当前已有能力

已有：

- 根节点：`爱因斯坦仍在德国`
- 预设分支选择
- 自定义输入生成
- 新节点创建
- 父节点回溯
- 卡片地图跳转
- fallback 占位生成
- 路径面包屑
- 节点元信息
- 当前任务面板
- 值班台事件流
- 本轮情报简报
- `/api/generate` 初步包装为 Runtime 返回结构

---

## 4. 总体目标

### 4.1 工程目标

把当前 Demo 从：

```text
点击分支 → 请求模型 → 返回故事
```

升级为：

```text
点击分支 / 输入方向
  → 创建 Task
  → HistoricalRuntime 执行
  → RuntimeEvent 记录过程
  → StoryWeaverAgent 生成故事
  → HistoryGuardAgent 审查历史约束
  → IntelDeskAgent 生成 Brief
  → 生成 Artifact
  → 前端展示 StoryNode + Task + Events + Brief + Artifacts
```

### 4.2 产品目标

玩家应该感到：

```text
我不是在和 AI 聊天。
我是在一个历史异常值班台中处理一个正在扩散的世界线事件。
每次选择都会被 OS 记录为任务，并产生情报、风险、档案或时间线变化。
```

---

## 5. 架构原则

### 5.1 故事节点是结果，任务运行是过程

不要让前端只保存故事文本。每次故事生成都应有对应任务和运行轨迹。

```text
StoryNode = 玩家看见的故事结果
Task = 系统内部处理的工作单元
RuntimeEvent = Agent 执行轨迹
Brief = 本轮结果解释
Artifact = OS 中出现的新材料
```

### 5.2 LLM 只生成候选内容，Runtime 负责结构化

不要让 LLM 直接决定整个 App 状态。

正确流程：

```text
LLM output
  → parse JSON
  → normalize
  → validate
  → create StoryNode / Brief / Artifact / Events
  → update frontend state
```

### 5.3 历史边界必须显性化

所有生成材料都要标注来源性质：

```text
baseline       真实历史基准
fictional      架空分支
unverified     未核验情报
generated      模型生成材料
player_created 玩家输入
```

### 5.4 UI 展示 Agent 工作，不展示 Agent 聊天

禁止把本项目变成普通 Chat UI。

Agent 的存在感来自：

- 当前任务
- 值班台事件流
- 情报简报
- 审计提醒
- 新增材料
- 世界线状态变化

---

## 6. 数据模型设计

以下数据结构可以先写在 `server.mjs` 和 `script.js` 中。后续如代码增长，再拆分模块。

### 6.1 StoryNode

```ts
type StoryNode = {
  id: string;
  title: string;
  story: string;
  choices: Choice[];
  parentId: string | null;
  childIds: string[];
  status: 'seed' | 'generated' | 'fallback' | 'reviewed' | 'blocked';
  taskId?: string;
  briefId?: string;
  artifactIds?: string[];
  historyFlags?: string[];
};
```

字段说明：

- `id`：前端节点 id。
- `title`：玩家选择的方向或节点标题。
- `story`：故事正文。
- `choices`：下一步可跟进分支。
- `parentId`：父节点。
- `childIds`：子节点列表。
- `status`：节点来源状态。
- `taskId`：生成该节点的任务。
- `briefId`：本轮简报。
- `artifactIds`：本轮生成材料。
- `historyFlags`：历史/伦理标记。

### 6.2 Choice

```ts
type Choice = {
  title: string;
  hint: string;
};
```

### 6.3 Task

```ts
type Task = {
  id: string;
  title: string;
  type:
    | 'story_branch'
    | 'source_verification'
    | 'archive_search'
    | 'field_directive'
    | 'world_tick'
    | 'history_review';
  status: 'pending' | 'running' | 'blocked' | 'completed' | 'failed';
  createdBy: 'human' | 'agent' | 'system';
  assignedAgent: string;
  parentTaskId?: string;
  relatedNodeId?: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
```

v0.1 只需要实现：

```text
type = story_branch
assignedAgent = StoryWeaverAgent
```

后续再扩展 `source_verification`、`archive_search`、`world_tick`。

### 6.4 RuntimeEvent

```ts
type RuntimeEvent = {
  id: string;
  taskId: string;
  type:
    | 'task_started'
    | 'llm_requested'
    | 'llm_completed'
    | 'history_review_started'
    | 'history_review_completed'
    | 'artifact_created'
    | 'brief_created'
    | 'human_approval_required'
    | 'task_completed'
    | 'task_failed';
  message: string;
  payload?: Record<string, unknown>;
  createdAt: string;
};
```

UI 文案要使用 Historical OS 语气，例如：

```text
值班任务已启动
StoryWeaverAgent 正在生成候选故事节点
HistoryGuardAgent 已完成历史敏感性检查
IntelDeskAgent 已生成本轮情报简报
```

### 6.5 Brief

```ts
type Brief = {
  id: string;
  taskId?: string;
  nodeId?: string;
  authorAgent: 'IntelDeskAgent' | string;
  summary: string;
  keyChanges: string[];
  risks: string[];
  suggestedNextActions: string[];
  createdAt: string;
};
```

Brief 的作用：

- 解释本轮故事发生了什么。
- 标记关键变化。
- 提醒历史/伦理/世界线风险。
- 给出弱推荐下一步。

### 6.6 Artifact

```ts
type Artifact = {
  id: string;
  type:
    | 'archive_record'
    | 'telegram'
    | 'newspaper'
    | 'map_marker'
    | 'timeline_delta'
    | 'character_profile'
    | 'risk_notice';
  title: string;
  content: string;
  provenance: 'baseline' | 'generated' | 'unverified' | 'player_created';
  confidence: number;
  relatedNodeId?: string;
  createdAt: string;
};
```

v0.2 起必须展示 Artifact，不能只返回不显示。

### 6.7 TopicRun / HistoricalCaseRun

v0.3 再实现。

```ts
type HistoricalCaseRun = {
  id: string;
  title: string;
  caseCode: 'EINSTEIN-1933-A' | string;
  rootNodeId: string;
  currentNodeId: string;
  status: 'active' | 'paused' | 'completed';
  taskIds: string[];
  eventIds: string[];
  briefIds: string[];
  artifactIds: string[];
  worldlineRisk: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
};
```

---

## 7. API 设计

### 7.1 当前保留接口

继续保留：

```text
POST /api/generate
```

原因：当前前端已经使用该接口。不要在第一阶段破坏兼容性。

### 7.2 请求格式

```json
{
  "currentTitle": "爱因斯坦仍在德国",
  "currentStory": "当前节点故事正文",
  "direction": "爱因斯坦被迫进入德国研究机构",
  "pathTitles": ["爱因斯坦仍在德国"]
}
```

### 7.3 返回格式 v0.1

```json
{
  "story": "下一段故事正文",
  "choices": [
    {"title": "继续跟进德国研究机构", "hint": "查看科学家如何被制度吸纳或反抗"},
    {"title": "核验柏林情报来源", "hint": "判断消息是否来自宣传系统"},
    {"title": "观察国际救援网络", "hint": "查看海外学术界如何反应"}
  ],
  "status": "generated",
  "task": {
    "id": "task-xxx",
    "title": "生成故事分支：爱因斯坦被迫进入德国研究机构",
    "type": "story_branch",
    "status": "completed",
    "createdBy": "human",
    "assignedAgent": "StoryWeaverAgent",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "events": [
    {
      "id": "event-xxx",
      "taskId": "task-xxx",
      "type": "task_started",
      "message": "值班任务已启动",
      "createdAt": "..."
    }
  ],
  "brief": {
    "id": "brief-xxx",
    "summary": "本轮故事将焦点转向德国研究机构。",
    "keyChanges": ["爱因斯坦的处境从滞留转向制度性控制。"],
    "risks": ["国家暴力风险上升。"],
    "suggestedNextActions": ["核验来源", "搜索档案", "暂缓高风险干预"],
    "authorAgent": "IntelDeskAgent",
    "createdAt": "..."
  },
  "artifacts": [
    {
      "id": "artifact-xxx",
      "type": "risk_notice",
      "title": "制度性控制风险",
      "content": "当前分支显示目标可能被迫进入研究机构。",
      "provenance": "generated",
      "confidence": 0.62,
      "createdAt": "..."
    }
  ],
  "historyFlags": ["fictional_branch", "sensitive_context"]
}
```

### 7.4 fallback 返回格式

模型失败时仍返回 200，并返回：

```json
{
  "status": "fallback",
  "task": {"status": "failed"},
  "events": [
    {"type": "task_started"},
    {"type": "llm_requested"},
    {"type": "task_failed"}
  ],
  "brief": {
    "summary": "模型生成失败，但系统保留了可继续探索的占位分支。"
  },
  "artifacts": [
    {"type": "risk_notice", "title": "模型生成失败", "provenance": "unverified"}
  ],
  "choices": []
}
```

注意：fallback 不应中断前端玩法。

---

## 8. Runtime 设计

### 8.1 推荐函数结构

在 `server.mjs` 中先实现轻量函数：

```ts
createId(prefix)
createRuntimeEvent(taskId, type, message, payload?)
createStoryTask(payload)
buildPrompt(payload)
callModel(payload)
normalizeModelResult(parsed)
createFallbackRuntimeResult(task, direction, message, previousEvents)
runHistoricalRuntime(payload)
```

### 8.2 `runHistoricalRuntime` 流程

```text
1. 创建 Task
2. 创建 task_started event
3. 创建 llm_requested event
4. 调用 callModel
5. normalize 返回 story / choices / brief / artifacts / flags
6. 创建 llm_completed event
7. 创建 history_review_completed event
8. 创建 brief_created event
9. 创建 task_completed event
10. 返回完整结构
```

失败路径：

```text
1. 保留 task_started / llm_requested
2. 创建 task_failed event
3. 返回 fallback story / choices / brief / artifact
```

### 8.3 `callModel` 注意事项

当前服务从 `~/.claude/settings.json` 读取：

```text
ANTHROPIC_BASE_URL
ANTHROPIC_AUTH_TOKEN
ANTHROPIC_MODEL
```

如果缺失，应进入 fallback，而不是让前端崩溃。

### 8.4 Prompt 要求

Prompt 必须要求模型返回 JSON，且至少包含：

```text
story
choices
brief
artifacts
historyFlags
```

必须包含约束：

1. 用中文输出。
2. 续写 180-260 字，不要一次写到结局。
3. 不脱离真实历史压力。
4. 严肃处理纳粹德国、反犹迫害、流亡、国家暴力。
5. 不编造真实档案编号。
6. 明确这是一条架空分支。
7. 给出 3 个后续分支。
8. 产出 Brief 和 Artifact。

---

## 9. 前端设计

### 9.1 当前前端状态

`script.js` 应维护：

```ts
let nodes = [seed];
let current = seed;
let isGenerating = false;
let currentTask = null;
let runtimeEvents = [];
let currentBrief = null;
let artifacts = [];
```

如果 v0.1 尚未展示 artifacts，可以先维护状态；v0.2 必须展示。

### 9.2 前端必须保留的行为

不能破坏：

1. 点击预设分支生成新节点。
2. 自定义输入生成新节点。
3. 回到上一步。
4. 点击故事地图跳转节点。
5. 模型失败时生成 fallback 节点。
6. 生成中禁用按钮，防重复点击。

### 9.3 新增 UI 区域

在 `index.html` 中新增：

```text
当前任务
值班台事件流
本轮情报简报
```

建议结构：

```html
<section class="runtime-grid">
  <article class="runtime-panel">
    <h2>当前任务</h2>
    <div id="taskPanel"></div>
  </article>
  <article class="runtime-panel">
    <h2>值班台事件流</h2>
    <div id="eventLog"></div>
  </article>
  <article class="runtime-panel brief-panel">
    <h2>本轮情报简报</h2>
    <div id="briefPanel"></div>
  </article>
</section>
```

### 9.4 前端渲染函数

建议拆分：

```ts
renderTaskPanel()
renderEventLog()
renderBriefPanel()
renderRuntimePanels()
renderPathTrail()
render()
```

### 9.5 生成流程

`move(direction)` 应该：

```text
1. 防重复点击
2. 写入本地 task_created event
3. 设置 currentTask running
4. 清空 currentBrief
5. setBusy(true)
6. 请求 /api/generate
7. 创建新 StoryNode
8. appendChildNode
9. 更新 currentTask / runtimeEvents / currentBrief / artifacts
10. 清空输入框
11. finishGeneration
```

失败时：

```text
1. 创建 fallback node
2. currentTask.status = failed
3. runtimeEvents 追加 task_failed
4. currentBrief 写入失败简报
5. finishGeneration
```

### 9.6 安全注意：避免 innerHTML 注入

当前 Demo 使用 `innerHTML` 渲染模型返回内容中的 brief 列表。Codec 应尽量改成 DOM API，避免模型输出 HTML 注入。

推荐：

```ts
function appendList(parent, items) {
  const ul = document.createElement('ul');
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  });
  parent.appendChild(ul);
}
```

如果继续使用 `innerHTML`，必须保证只插入经过转义的文本。建议实现 `escapeHtml`。

---

## 10. Artifact 展示设计 v0.2

v0.2 需要把 Artifact 从返回结构变成真实 UI。

### 10.1 新增 UI

建议新增区域：

```text
新增材料 / OS Artifacts
```

显示：

```text
[风险提示] 制度性控制风险
来源：generated · 可信度：0.62
当前分支显示目标可能被迫进入研究机构。
```

### 10.2 Artifact 样式

不同类型应有不同标签：

| type | 中文标签 |
|---|---|
| risk_notice | 风险提示 |
| timeline_delta | 时间线变化 |
| archive_record | 档案记录 |
| telegram | 电报 |
| newspaper | 报纸 |
| map_marker | 地图标记 |
| character_profile | 人物卡 |

### 10.3 provenance 必须展示

必须让玩家知道材料性质：

```text
baseline = 历史基准
generated = 当前世界线生成
unverified = 未核验情报
player_created = 玩家输入
```

---

## 11. HistoryGuardAgent v0.2

### 11.1 目标

让故事不是纯续写，而是在历史边界里生长。

### 11.2 最小实现方式

不需要另调一个模型。v0.2 可以先用规则 + prompt 输出：

```ts
type HistoryReview = {
  approved: boolean;
  warnings: string[];
  requiresHumanApproval: boolean;
  flags: string[];
};
```

### 11.3 检查规则

至少检查：

1. 是否涉及纳粹德国、反犹迫害、国家暴力。
2. 是否涉及真实人物死亡。
3. 是否出现伪造真实档案编号倾向。
4. 是否把架空内容当作真实历史陈述。
5. 是否一次性写到结局。

### 11.4 高风险路径

如果玩家方向包含：

```text
杀害
自杀
处决
刺杀
灭绝
集中营
```

应标记：

```text
requiresHumanApproval = true
historyFlags includes sensitive_context
```

v0.2 可以只显示审计提示，不必真的阻断流程。

---

## 12. HumanApproval / 审计确认 v0.2-v0.3

### 12.1 产品表达

不要做成普通浏览器 confirm。

应做成 Historical OS 审计提示：

```text
审计频道提醒
该指令可能改变目标人物生存状态，并扩大对犹太知识分子网络的风险。
是否继续？
[继续干预] [先核验来源] [取消]
```

### 12.2 技术实现 v0.2

先做前端状态：

```ts
type ApprovalRequest = {
  id: string;
  reason: string;
  options: string[];
  pendingDirection: string;
};
```

如果 `requiresHumanApproval` 为 true，则显示审计卡。

### 12.3 v0.3 再做真正中断恢复

后续可以映射 LobeHub 的：

```text
request_human_approval
waiting_for_human
resume
```

但不要在 v0.1 里做。

---

## 13. TopicRun / 案件运行 v0.3

v0.3 目标：把单轮故事节点升级为“正在运行的历史案件”。

第一案：

```text
EINSTEIN-1933-A
```

UI 应显示：

```text
当前案件：爱因斯坦仍在德国
世界线风险：低 / 中 / 高
当前节点数
已生成任务数
未处理 Brief 数
高风险 Artifact 数
```

新增按钮：

```text
继续故事线
核验来源
搜索档案
发送指令
等待 24 小时
```

其中 `等待 24 小时` 对应：

```text
Task type = world_tick
```

---

## 14. 分阶段实施计划

## 阶段 1：HistoricalRuntime v0.1 稳定化

### 目标

让当前 Web Demo 具备稳定的 Task → Runtime → Events → Brief → StoryNode 闭环。

### 文件

```text
artifacts/web_story_loop_demo/server.mjs
artifacts/web_story_loop_demo/script.js
artifacts/web_story_loop_demo/index.html
artifacts/web_story_loop_demo/style.css
```

### 任务清单

1. 确保 `server.mjs` 存在并纳入项目。
2. 保留 `/api/generate`。
3. 服务端返回 `task/events/brief/artifacts/historyFlags`。
4. 前端显示当前任务。
5. 前端显示事件流。
6. 前端显示 Brief。
7. fallback 也返回 Runtime 结构。
8. 生成中禁用按钮。
9. 节点中保存 `taskId/briefId/artifactIds/historyFlags`。

### 验收标准

运行：

```bash
cd /Users/mahaoxuan/Desktop/黑客松/架空历史故事游戏/artifacts/web_story_loop_demo
PORT=8892 node server.mjs
```

访问：

```text
http://127.0.0.1:8892/
```

检查：

1. 页面能打开。
2. 点击分支后生成新节点。
3. 故事地图新增节点。
4. 当前任务面板更新。
5. 值班台事件流更新。
6. 本轮情报简报更新。
7. 模型失败时仍能生成 fallback 节点。
8. API 返回结构包含：
   - `story`
   - `choices`
   - `task`
   - `events`
   - `brief`
   - `artifacts`
   - `historyFlags`

### 验证命令

```bash
node --check artifacts/web_story_loop_demo/server.mjs
node --check artifacts/web_story_loop_demo/script.js
```

API shape 验证：

```bash
python3 - <<'PY'
import json
from urllib.request import Request, urlopen
payload = {
    'currentTitle': '爱因斯坦仍在德国',
    'currentStory': '测试故事',
    'direction': '测试一条 Agent Runtime 分支',
    'pathTitles': ['爱因斯坦仍在德国']
}
req = Request(
    'http://127.0.0.1:8892/api/generate',
    data=json.dumps(payload).encode(),
    headers={'content-type':'application/json'},
    method='POST'
)
with urlopen(req, timeout=30) as r:
    data = json.loads(r.read().decode())
print(data.keys())
print(data.get('status'))
print(data.get('task', {}).get('status'))
print(len(data.get('events', [])))
print(bool(data.get('brief')))
print(len(data.get('artifacts', [])))
PY
```

---

## 阶段 2：Artifact + HistoryGuard v0.2

### 目标

让故事节点开始产出结构化历史 OS 材料，并显式标注历史边界。

### 任务清单

1. 服务端稳定产出至少 1 个 Artifact。
2. 前端新增 Artifact 展示区。
3. 实现 provenance 显示。
4. 实现 historyFlags 显示。
5. 增加 HistoryGuardAgent 规则检查。
6. 高风险方向显示审计提示。
7. Brief 中加入 HistoryGuard 的 warnings。

### 验收标准

1. 每次生成后 Artifact 区域至少出现一张材料卡。
2. 材料卡显示：类型、标题、内容、来源性质、可信度。
3. 涉及死亡/国家暴力/迫害的方向会出现 `sensitive_context`。
4. 不出现“伪真实档案编号”。
5. 玩家能看出哪些内容是架空生成，哪些是未核验。

---

## 阶段 3：TopicRun / Historical OS v0.3

### 目标

把故事循环升级为案件运行系统。

### 任务清单

1. 新增 `HistoricalCaseRun` 状态。
2. 显示当前案件：`EINSTEIN-1933-A`。
3. 显示世界线风险等级。
4. 显示累计任务数、节点数、Brief 数、Artifact 数。
5. 新增 `world_tick`：等待 24 小时。
6. 新增任务类型入口：核验来源、搜索档案、发送指令。
7. 将 Godot Demo 的 `workbench.json` 与 Web Runtime 输出结构对齐。

### 验收标准

1. 用户看到的是 Historical OS 工作台，而不是简单故事树。
2. “等待 24 小时”可以生成非玩家主动选择的世界变化。
3. 当前案件状态会随节点增长更新。
4. Godot Demo 未来可读取同构 JSON。

---

## 15. 不要做的事

在当前阶段不要做：

1. 不要重写整个前端。
2. 不要把 UI 改成聊天窗口。
3. 不要引入数据库。
4. 不要实现复杂多 Agent 并发。
5. 不要接 RAG 或联网搜索。
6. 不要自动后台无限演化。
7. 不要修改 Godot 引擎源码。
8. 不要删除现有故事循环、卡片地图、回溯、跳转能力。

---

## 16. 代码质量要求

### 16.1 JavaScript 规范

- 不要引入构建系统。
- 继续使用原生 HTML/CSS/JS + Node server。
- 保持文件可直接运行。
- 函数命名清晰。
- 避免过度抽象。

### 16.2 状态更新

尽量使用不可变更新：

```js
nodes = nodes.map(...)
runtimeEvents = [...runtimeEvents, newEvent]
```

不要直接修改复杂对象，除非是局部临时变量。

### 16.3 错误处理

- API 错误不能让前端崩溃。
- 模型失败必须进入 fallback。
- fallback 也必须产出 task/events/brief/artifact。

### 16.4 安全

- 不要把 API token 写进代码。
- 不要把模型返回内容直接无转义插入 HTML。
- 优先使用 `textContent` 和 DOM API。
- 如必须使用 `innerHTML`，实现并使用 `escapeHtml`。

---

## 17. 手动验收脚本

### 17.1 启动

```bash
cd /Users/mahaoxuan/Desktop/黑客松/架空历史故事游戏/artifacts/web_story_loop_demo
PORT=8892 node server.mjs
```

### 17.2 打开

```text
http://127.0.0.1:8892/
```

### 17.3 验收路径

1. 打开页面。
2. 确认根故事显示。
3. 点击“爱因斯坦被迫进入德国研究机构”。
4. 等待生成完成。
5. 检查：
   - 当前故事节点改变。
   - 右侧分支改变。
   - 卡片地图新增节点。
   - 当前任务显示 completed 或 failed。
   - 事件流至少 3 条。
   - Brief 显示 summary/keyChanges/risks/suggestedNextActions。
6. 点击故事地图根节点。
7. 确认能跳回根节点。
8. 点击回到上一步。
9. 确认回溯可用。
10. 输入自定义方向生成新节点。
11. 确认输入框清空。
12. 临时移除环境变量或使用错误模型，确认 fallback 不崩溃。

---

## 18. 完成定义

阶段 1 完成时，应满足：

```text
当前 web_story_loop_demo 已经不是单纯 LLM 续写 Demo，
而是一个最小 HistoricalRuntime Demo。
玩家每次操作都会形成任务、事件流、简报和故事节点。
```

阶段 2 完成时，应满足：

```text
系统开始稳定产出 Historical OS 材料，
每个故事节点都有可解释的历史边界和来源标记。
```

阶段 3 完成时，应满足：

```text
Demo 成为一个轻量历史异常工作台，
玩家围绕 EINSTEIN-1933-A 案件进行持续运行、调查、等待和干预。
```

---

## 19. 对 Codec 的推荐执行顺序

如果你是 Codec，请按这个顺序执行：

1. 读取 `TODO.md` 和 `HANDOFF.md`，理解产品上下文。
2. 读取 `artifacts/web_story_loop_demo/*`。
3. 不要重写，先跑通当前 Demo。
4. 完成阶段 1 的稳定化与安全修补。
5. 用 `node --check` 和 API shape 验证。
6. 再做阶段 2 Artifact 展示。
7. 每完成一阶段，更新：
   - `TODO.md`
   - `HANDOFF.md`
   - 新增一条 `logs/round_XXX_YYYY-MM-DD.md`

---

## 20. 交付时必须汇报

Codec 完成后，请汇报：

```text
1. 修改了哪些文件。
2. 每个文件为什么改。
3. 如何启动。
4. 如何验证。
5. 哪些行为已覆盖。
6. 哪些风险仍未解决。
7. 下一阶段建议。
```

---

## 21. 附：当前最重要的产品原则

> 剧情不是写死的，而是世界状态在历史约束和 Agent 任务流中持续生长后浮现出来的。

因此代码实现必须服务于：

```text
世界线演化
历史异常处理
任务化 Agent 运行
多媒介叙事
玩家有限介入
```

而不是服务于：

```text
普通聊天
普通故事生成器
固定 Galgame 分支树
后台管理看板
```
