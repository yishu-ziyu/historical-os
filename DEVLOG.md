# DEVLOG

> 项目级交付日志。每次 handoff 追加一条。CLAUDE.md §14.9 规定。

### 2026-06-28 — feat(turn): marked-clue-state 让玩家判断沉淀到 case state
- **What**: 实现"标记线索"从 DOM 视觉到 case state 的穿透。新增 case state.markedClues 字段、新 API 端点 `POST /api/case/:id/mark-clue`、前端 turnState 同步 + 笔记 textarea + Aftermath 锁定数显示。历史框架校验拒绝非历史语境注释（422）。
- **Files**:
  - `artifacts/web_story_loop_demo/server.mjs`（加 markedClues 字段 + markClue 函数 + 路由 + note 校验）
  - `artifacts/web_story_loop_demo/turn_cycle.js`（turnState 增量 + 标记按钮接 API + 笔记 textarea + Aftermath 总结）
  - `artifacts/web_story_loop_demo/marked_clue_state.test.mjs`（新建，11 个测试）
  - `.ship/tasks/vibero-20260628-001/`（完整 task 目录：input/pm/plan/control/e2e）
  - `.ship/state.yaml`（phase=qa → handoff 后清空）
  - `docs/yishuship_integration_report.md`（round 042 验收报告）
  - `docs/decisions/DEC-0001-yishuship-onboarding.md`（决策记录）
- **Risk**:
  - 3 个 baseline 测试 fail 与本刀无关（server.test / frontend_contract.test / turn_cycle_frontend.test 历史债务）
  - 中文 `\b` 不工作——note 校验不能用 word boundary，已修
  - 模型调用超时未触发 fallback——测试需设 MODEL_REQUEST_TIMEOUT_MS=1

### 2026-06-28 — chore(protocol): yishuship 状态机 + 7 个 phase 命令 + 21 个状态测试
- **What**: 完整接入 yishuship 协议（CLAUDE.md §14-15）。`.ship/state.yaml` 状态机；`.ship/STATE_README.md` 字段说明；`.ship/tasks/` task 目录结构；7 个 `/yishuship-*` 命令（intake/design/dev/qa/handoff/auto/router）；3 个项目级 agent（builder/checker/session-startup）；自写 YAML 子集解析 + 21 个测试。
- **Files**:
  - `.ship/state.yaml` / `.ship/STATE_README.md` / `.ship/tasks/historical-archives/`
  - `.claude/commands/yishuship*.md` × 7
  - `.claude/agents/builder.md` / `checker.md` / `session-startup.md`
  - `tools/yishuship_status.mjs` + `tools/yishuship_status.test.mjs`
  - `CLAUDE.md` §14.12（Operational binding）
  - `docs/decisions/DEC-0001-yishuship-onboarding.md`
  - `docs/yishuship_integration_report.md`
- **Risk**: 项目级 builder/checker 与全局同名 agent 可能的歧义；端到端未跑过（21 测试是白盒）

### 2026-07-02 — feat(demo): round 047 开场序列 + 世界线漂移指示器 + 后果面板
- **What**: AI 接管 round 046 产品决策（用户授权全权处理）。不重做机制，补强三件事让 demo 有情感钩子和可见后果。① Opening Cinematic：6 阶段开场（黑屏→日期→红字异常→电报体→钩子句→漂移条动画→desk 渐入），sessionStorage 防重播，右下角跳过按钮。② Worldline Drift Indicator：顶部常驻横向条，0σ→+5σ 刻度，颜色绿→琥珀→红→深红，公式 `driftSigma = (stateChangeHistory.length * 0.4) + (riskOverall * 0.3)`。③ Stakes Panel：Aftermath 段顶部插入，显示本回合偏移/累计偏移/风险等级/下一回合/撬动对象。
- **Files**:
  - `artifacts/web_story_loop_demo/index.html`（加 `#openingCinematic` overlay + `#worldlineDrift` 顶部条，保留所有现有结构）
  - `artifacts/web_story_loop_demo/turn_cycle.js`（加 `playOpeningIfNeeded()` / `renderWorldlineDrift(driftSigma)` / `renderStakesPanel(aftermath, caseState)`，修改 `renderAftermath()` 顶部插入 / `startNewTurn()` 末尾调用 / `fetchCaseState()` 缓存 body / DOMContentLoaded 调用）
  - `artifacts/web_story_loop_demo/style.css`（加 `.opening-cinematic` / `.worldline-drift` / `.stakes-panel` + 4 个 keyframes，末尾追加 345 行）
  - `.ship/tasks/vibero-20260628-004/`（pm/decision.md + plan/spec.md + control/run_state.yaml）
- **Risk**:
  - 8 个 baseline 测试 fail（断言的是不存在的旧 API：window.TurnCycle / renderIntelCard / toggleClueMark / id=turnCyclePanel / .turn-cycle-panel），与本刀无关；本刀让测试净减少 2 个失败
  - case state 实际结构是 `{ok, caseState{riskIndicators.overall, nextDeadline}, stateChangeHistory(顶层), updatedAt}`，renderStakesPanel 做了 3 路径防御性回退覆盖
  - 用 `make()+appendChild` 而非 innerHTML，遵循现有 DOM-safe 风格
  - 浏览器实际渲染验收（开场动画播放、漂移条移动）留给用户起床后做
