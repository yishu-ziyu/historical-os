# HistoricalRuntime v0.3 Agent Runtime 实施方案

> 项目：`/Users/mahaoxuan/Desktop/黑客松/架空历史故事游戏`  
> 日期：2026-05-20  
> 阶段：v0.3 方案冻结稿  
> 目标：把当前 Web Demo 从“LLM 故事生成器”推进为“事件驱动的 Agent Runtime / Historical OS”。

---

## 1. 核心结论

v0.3 的目标不是继续扩大 prompt，而是引入真正的 **HistoricalRuntime Agent 架构**：

```text
PlayerAction
  -> HistoricalCase
  -> AgentRun
  -> CandidateNode
  -> HistoryGuard Review
  -> Brief / Artifacts
  -> Runtime Commit
  -> committed StoryNode
```

这个项目不能被做成 chatbot。玩家不是在和模型闲聊，而是在 Historical OS 中处理一个会生长、会记住、会反应的历史异常案例。

---

## 2. 产品定义

### 2.1 玩家到底在玩什么

玩家是在通过 Historical OS 行动，边体验边共同生成自己的历史异常游戏。

```text
不是：玩家直接编辑一个游戏。
也不是：玩家和 AI 聊天。

而是：
玩家查询档案、发送指令、选择介入方向、核验来源、观察世界线偏移；
Runtime 把这些行动转译为新的 StoryNode、Artifact、人物状态、线索、风险和开放问题。
```

### 2.2 玩家到底在“养”什么

养成对象不是单一角色，而是一个 `HistoricalCase` / 异常世界线本身。

```text
OpenClaw:
养的是逐渐产生个性、行为、记忆和互动习惯的生命体。

HistoricalRuntime:
养的是逐渐产生线索、人物状态、档案缺口、世界线偏移和历史后果的异常案例。
```

长期牵挂来自：

- 这个异常会往哪里长。
- 爱因斯坦还安全吗。
- 德国科学界会发生什么连锁反应。
- 国际救援网络是否暴露。
- 新出现的档案是真是假。
- 三轮前的指令是否开始产生延迟后果。

---

## 3. Agent 定义

### 3.1 Agent 的最小行动单位

Agent 的最小行动单位不是角色，也不是聊天窗口，而是一次可审计的 `AgentRun`。

```text
输入：当前节点 + 历史基准 + 玩家方向 + 已知 Artifact
目标：生成或处理一个故事节点
过程：StoryWeaver -> HistoryGuard -> IntelDesk -> Artifact
输出：CandidateNode / Brief / Artifacts / RuntimeEvents / HistoryReview
```

### 3.2 Agent 类型

v0.3 固定骨架：

- `StoryWeaverAgent`：生成候选故事节点和分支。
- `HistoryGuardAgent`：执行历史/伦理/真实人物风险门禁。
- `IntelDeskAgent`：整理情报简报、风险、建议行动。
- `ArtifactAgent`：生成或整理档案、电报、地图点、风险提示等媒介对象。
- `RuntimeOrchestrator`：创建任务、串联 Agent、汇总结果、决定 commit/block/fallback。

后续可插入：

- `ArchivistAgent`：当玩家查询档案或故事涉及档案缺口时插入。
- `TimelineAgent`：当世界线偏移明显时插入。
- `MapAgent`：当地点迁移、空间行动、救援路线出现时插入。
- `RepairAgent`：当模型输出不合格或 HistoryGuard 阻止提交时插入。

### 3.3 Agent 生命周期

v0.3 使用任务型 Agent Run，不做长期常驻 Agent。

```text
AgentDefinition:
  role
  inputSchema
  outputSchema
  promptTemplate
  allowedTools
  validationRules

AgentRun:
  runId
  agent
  input
  output
  status
  events
```

长期记忆不保存在 Agent 自己的聊天上下文里，而保存在 `HistoricalCase` 的结构化状态中。

---

## 4. Runtime 驱动模型

HistoricalRuntime 是事件驱动 + 任务图驱动的 Agent 编排器。

驱动力有四个：

1. `PlayerAction`：玩家选择、自然语言输入、点击 Artifact、查询档案、发送指令。
2. `WorldState`：当前 StoryGraph、人物状态、Artifact、风险、时间线偏移。
3. `AgentTaskGraph`：本次要执行哪些 Agent，以及执行顺序。
4. `HistoricalConstraints`：真实历史基准、敏感性规则、不可伪造档案、不可轻浮化真实迫害。

大模型服务不是 Runtime。MiniMax / 其他模型只是 Agent 的推理/生成内核。

---

## 5. Provider 边界

项目里的 Agent 概念由 HistoricalRuntime 自己定义。MiniMax 的 Agent/tool 能力只能作为可选 provider capability，不能成为核心依赖。

```text
HistoricalRuntime 定义：
  StoryWeaverAgent
  HistoryGuardAgent
  IntelDeskAgent
  ArtifactAgent
  AgentRun
  Commit semantics

ModelProvider 提供：
  generateStructured()
  maybeToolCall()
  maybeLongContext()
  maybeReasoning()
```

当前 MiniMax Token Plan 默认走官方 Anthropic-compatible 路径：

```text
https://api.minimaxi.com/anthropic/v1/messages
```

OpenAI-compatible `/chat/completions` 只能作为显式兼容模式：

```text
MINIMAX_API_FORMAT=openai
```

---

## 6. Agent Task Graph

v0.3 先采用固定骨架 + 局部动态插入，不做全动态 Planner。

### 6.1 v0.3 默认串行骨架

```text
PlayerAction
  -> create AgentRun
  -> StoryWeaverAgent
  -> HistoryGuardAgent
  -> IntelDeskAgent
  -> ArtifactAgent
  -> Runtime commit review
```

### 6.2 局部插入规则

- 涉及真实人物死亡/迫害：插入 HumanApproval / block。
- 涉及档案、电报、来源核验：插入 ArchivistAgent。
- 涉及地点迁移：插入 MapAgent。
- 涉及大时间线变化：插入 TimelineAgent。
- 模型输出不合格：插入 RepairAgent 或 fallback。

### 6.3 并发策略

v0.3 先串行跑通并测试清楚。

v0.4 之后可改为阶段并行：

```text
StoryWeaver
  -> HistoryGuard
  -> DraftBrief / DraftArtifact / TimelineDelta 并行
  -> Runtime commit
```

无论是否并行，最终 commit 必须由 Runtime 单点决定。

---

## 7. 数据模型

### 7.1 HistoricalCase

`HistoricalCase` 是玩家正在养成的历史异常游戏世界。

```ts
type HistoricalCase = {
  id: string;
  title: string;
  baseline: HistoricalBaseline;
  currentNodeId: string;
  storyGraph: StoryGraph;
  artifactIndex: Artifact[];
  characterStates: CharacterState[];
  timelineState: TimelineState;
  openQuestions: OpenQuestion[];
  delayedConsequences: DelayedConsequence[];
  auditLog: AuditLogEntry[];
  riskLog: RiskLogEntry[];
  createdAt: string;
  updatedAt: string;
};
```

v0.3 可以先保存在内存中，但 API 和 Runtime 应按这个结构设计。

### 7.2 PlayerAction

玩家不是只选故事分支，也可以给 Historical OS 下任务。两者统一为 `PlayerAction`。

```ts
type PlayerAction = {
  id: string;
  type:
    | 'branch_choice'
    | 'custom_direction'
    | 'verify_source'
    | 'query_archive'
    | 'compare_timeline'
    | 'send_instruction'
    | 'monitor';
  label: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
```

### 7.3 CandidateNode 与 StoryNode

模型不能直接创建正式 StoryNode。

```text
StoryWeaverAgent -> CandidateNode
Runtime commit -> StoryNode
```

状态：

- `draft`：StoryWeaver 生成候选内容，未审计。
- `reviewed`：已审计并产出 Brief/Artifact。
- `committed`：Runtime 已写入正式 StoryGraph。
- `blocked`：HistoryGuard 阻止提交。
- `fallback`：模型或 Agent 失败后的占位结果。

### 7.4 HistoryReview

HistoryGuard 是门禁，不是 UI 装饰。

```ts
type HistoryReview = {
  approved: boolean;
  decision: 'allow' | 'warn' | 'require_approval' | 'block';
  flags: string[];
  warnings: string[];
  requiresHumanApproval: boolean;
  reason?: string;
};
```

门禁规则：

- `allow`：可提交。
- `warn`：可提交，但前台必须拟态化提示风险。
- `require_approval`：进入人工确认或挂起态。
- `block`：不能进入正式世界线，必须 repair/fallback。

### 7.5 不确定性字段

不确定性不是胜负/失败机制，而是世界生长机制。

v0.3 优先字段：

```ts
type GrowthSignals = {
  confidence: number;
  sourceCompleteness: 'missing' | 'partial' | 'sufficient';
  timelineDrift: 'low' | 'medium' | 'high';
  delayedConsequences: DelayedConsequence[];
};
```

不要做传统失败率、扣资源、随机惩罚系统。

---

## 8. 必须产出的游戏对象

每次 committed StoryNode 至少必须带：

1. `StoryNode`：故事正文、标题、选择项。
2. `Brief`：发生了什么、关键变化、风险、建议行动。
3. `Artifact`：至少一个媒介产物。
4. `RuntimeEvents`：Agent 执行轨迹。
5. `HistoryReview`：历史审计结果。

如果只有一段故事和三个选项，只能算 draft/fallback，不能算正式节点。

---

## 9. 前台/后台展示边界

### 9.1 默认可见

- StoryNode.story
- StoryNode.choices
- 关键 Artifact
- 简化 Brief summary
- 可操作按钮 / 下一步行动

### 9.2 可展开 Historical OS 情报层

- 完整 Brief
- Artifact 列表
- Timeline delta
- Map marker
- Source credibility
- 风险提示

风险提示应拟态化为“审计频道/值班规程”，不是技术日志。

### 9.3 后台审计层

默认不直接给普通玩家看：

- 原始 RuntimeEvents
- Agent prompt
- raw model response
- HistoryReview 全量字段
- validation errors
- repair attempts
- provider latency/token/error

必要风险可以拟态化露出，例如：

```text
审计频道：该方向涉及真实人物生存状态变更，请确认后继续扩大干预。
```

---

## 10. Agent 进度可视化

v0.3 必须迁移组件库逻辑：

```text
/Users/mahaoxuan/Desktop/AI组件工作流库/components/agent-progress-visibility-panel/
```

参考文件：

- `README.md`
- `EVENT_SCHEMA.md`
- `FRONTEND_TEMPLATE.html`
- `MIGRATION_CHECKLIST.md`

### 10.1 API 改造

保留同步兼容入口：

```text
POST /api/generate
```

新增异步 Job：

```text
POST /api/generate/start
GET /api/jobs/{jobId}
```

`POST /api/generate/start` 立即返回：

```json
{
  "ok": true,
  "jobId": "job_xxx",
  "statusUrl": "/api/jobs/job_xxx"
}
```

`GET /api/jobs/{jobId}` 返回 Job Snapshot：

```json
{
  "ok": true,
  "jobId": "job_xxx",
  "status": "running",
  "stage": "history_review",
  "currentDeskMessage": "历史审计频道正在检查真实人物与敏感语境风险。",
  "events": [],
  "technicalEvents": [],
  "result": null,
  "error": null,
  "createdAt": "2026-05-20T10:00:00.000Z",
  "updatedAt": "2026-05-20T10:01:20.000Z"
}
```

### 10.2 Job stage

稳定阶段名固定为：

- `queued`
- `story_weaving`
- `history_review`
- `briefing`
- `artifact_generation`
- `commit_review`
- `complete`
- `failed`

不要把 `MODEL_REQUEST_START`、`JSON_PARSE`、`VALIDATION_ERROR` 这类细节做成 stage，它们属于 technicalEvents。

### 10.3 双层事件

前台事件使用 Historical OS 部门/频道语言。

后台事件保留真实 Agent / provider / validation 诊断。

```json
{
  "time": "2026-05-20T10:01:20.000Z",
  "stage": "history_review",
  "severity": "warn",
  "attempt": 1,
  "studentMessage": "历史审计频道发现该方向涉及真实人物生存状态变更。",
  "technicalMessage": "HistoryGuardAgent requiresHumanApproval=true flags=sensitive_context",
  "metadata": {
    "agent": "HistoryGuardAgent",
    "displayUnit": "历史审计频道",
    "model": "rule-based"
  }
}
```

### 10.4 Agent 显示映射

| Agent | 前台拟态显示 | 后台 technicalEvents |
|---|---|---|
| StoryWeaverAgent | 叙事分析组 | `StoryWeaverAgent MODEL_REQUEST_START` |
| HistoryGuardAgent | 历史审计频道 | `HistoryGuardAgent flags=sensitive_context` |
| IntelDeskAgent | 情报值班台 | `IntelDeskAgent BRIEF_CREATED` |
| ArtifactAgent | 档案组 | `ArtifactAgent artifact_count=2` |
| RuntimeOrchestrator | 值班系统 | `RuntimeOrchestrator COMMIT_REVIEW_START` |

---

## 11. v0.3 实施顺序

1. 写 BDD 行为用例，覆盖异步 Job、双层事件、commit 门禁、HistoricalCase 状态。
2. 新增 Job 状态模型和 `emitJobEvent()`。
3. 新增 `POST /api/generate/start` 和 `GET /api/jobs/{jobId}`。
4. 把现有 `runHistoricalRuntime()` 改造成可发事件的 AgentRun pipeline。
5. 引入 `CandidateNode` / `commitStoryNode()` 语义。
6. 引入最小 `HistoricalCase` 容器，先内存存储。
7. 前端生成故事改为 start + polling。
8. 前端新增 Agent progress panel：阶段条、拟态事件、折叠技术细节。
9. 保留 `/api/generate` 作为测试/兼容入口。
10. 更新文档和验收截图。

---

## 12. BDD 行为草案

### 行为 1：异步生成立即返回 jobId

Given 玩家选择一个故事分支  
When 前端调用 `POST /api/generate/start`  
Then 后端立即返回 `jobId` 和 `statusUrl`，不会阻塞等待模型完成。

业务意义：等待过程成为可观察的 Agent 工作流，而不是盲等。

### 行为 2：Job Snapshot 暴露稳定 stage

Given 一个故事生成 Job 正在运行  
When 前端轮询 `GET /api/jobs/{jobId}`  
Then 返回 `status`、`stage`、`currentDeskMessage`、`events`、`technicalEvents`。

业务意义：前端可以稳定渲染 Historical OS 进度条。

### 行为 3：前台事件不暴露 raw Agent 日志

Given HistoryGuard 正在审计  
When Job Snapshot 返回用户可见 events  
Then `studentMessage` 使用“历史审计频道”语言，而不是 raw Agent 名。

业务意义：玩家感知部门协作，不看开发者日志。

### 行为 4：技术事件保留真实诊断

Given 模型或审计阶段发生错误  
When 开发者展开技术细节  
Then 可以看到 `technicalMessage` 和 `metadata.agent`。

业务意义：不牺牲排障能力。

### 行为 5：CandidateNode 不会绕过 HistoryGuard

Given StoryWeaver 生成候选节点  
When HistoryGuard 返回 `block` 或 `require_approval`  
Then Runtime 不会把 CandidateNode 写入 committed StoryGraph。

业务意义：历史敏感内容有真实门禁。

### 行为 6：committed StoryNode 必须带完整产物

Given Runtime commit 一个节点  
When 前端收到结果  
Then 至少包含 StoryNode、Brief、Artifact、RuntimeEvents、HistoryReview。

业务意义：正式节点不是单段故事，而是 Historical OS 产物。

---

## 13. 手动验收脚本

1. 启动 Web Demo。
2. 点击一个故事分支。
3. 页面立刻出现进度面板，而不是空等。
4. 阶段条依次走过：生成候选分支、历史审计、情报简报、档案归档、世界线提交。
5. 用户事件流显示“叙事分析组 / 历史审计频道 / 情报值班台 / 档案组”等拟态文案。
6. 展开技术细节能看到真实 Agent 名、stage、attempt、provider 信息。
7. 成功后进度面板切换到结果态，故事节点、Brief、Artifact 显示正常。
8. 触发高风险方向，确认 HistoryGuard 能进入 warn/approval/block 路径。
9. 刷新或重新轮询 jobId，确认不会卡死在 running。

---

## 14. 不要做什么

- 不要把前台做成聊天 UI。
- 不要让模型直接写入正式 StoryGraph。
- 不要让 MiniMax 的 Agent/tool 能力定义本项目 Agent 架构。
- 不要把 raw RuntimeEvents 原样显示给普通玩家。
- 不要一开始做全动态 Planner。
- 不要把不确定性做成传统失败率/惩罚系统。
- 不要一次性引入复杂数据库；v0.3 可先内存状态，但模型边界要正确。

---

## 15. 交付要求

完成 v0.3 实施时，必须汇报：

- 修改文件。
- 新增 API。
- Job stage 和事件协议。
- HistoricalCase 状态范围。
- Candidate/commit 行为。
- 前台/后台事件展示截图或说明。
- 测试命令和结果。
- 未完成风险。
