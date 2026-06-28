# 架空历史故事游戏 - TODO

## 当前目标
围绕一个“自动演化的架空历史故事游戏 / Galgame 变体”进行至少 80 轮产品共创，在充分想清楚世界观、叙事机制、玩法、历史资料系统、媒介体验与技术路线后，再进入开发。

## 当前进度
- [x] 第 0 轮：确认项目放在桌面 `黑客松` 文件夹内。
- [x] 第 0 轮：确认采用 Agent 记忆外化方式管理长程任务状态。
- [x] 第 1 轮：确认产品核心不是传统固定剧情 Galgame，而是“可自动演化的架空历史世界”。
- [x] 第 2 轮：确认用户介入可同时保留“上帝变量修改”和“历史中具体行动者”两种模式，但主玩法优先偏向后者。
- [x] 第 3 轮：确认玩家身份偏好优先为历史调查者、外交官/信使、情报人员；舆论操盘者有吸引力但需要伦理处理；地方官优先级低。
- [x] 第 4 轮：关键纠偏——产品本体不是单一调查游戏，而是“架空历史模拟 OS”；各种身份是进入 OS 的接口。
- [x] 第 5 轮：确认第一版 OS 第一屏不是 App 图标启动器，而是由 Timeline、Map、Archives、Intel Desk 组成的态势感知面板。
- [x] 第 6 轮：确认默认开局以“两段式入口”为主：先选历史时期，再生成异常事件；同时保留懂历史用户自选时期与轻量用户随机异常窗口。
- [x] 第 7 轮：确认 MVP 异常事件模板优先为档案异常、电报异常、人物异常；技术异常作为宏大向扩展模板。
- [x] 第 8 轮：纠偏新手第一案应优先从人物或技术切入；电报/档案适合机制和深度玩家，但对普通用户第一分钟有距离感。
- [x] 第 9 轮：确认新手第一案人物方向选择“科学家”，因为能同时连接人物异常、技术异常和神秘历史调查。
- [x] 第 10 轮：确认新手第一案科学家选择爱因斯坦。
- [x] 第 11 轮：确认爱因斯坦第一案异常为“1933 年他没有离开德国”，这是会撬动世界线的大分叉点。
- [x] 第 12 轮：确认第一分钟主入口应从 Intel Desk 紧急情报开始，让用户先知道“爱因斯坦怎么了”，再回到 Timeline 理解历史偏移。
- [x] 第 13 轮：确认 Intel Desk 第一条情报采用双层文案：上层沉浸式情报报告，下层新手可理解的系统解释。
- [x] 第 14 轮：确认第一条情报后保留五个可执行动作：Timeline、Map、Archives、验证情报来源、发送指令。
- [x] 第 15 轮：确认五个动作采用弱推荐策略；后续设计要引入开发社区、玩家社区和类似案例研究。
- [x] 第 16 轮：启动 Agent team 并完成第一批外部调研；确认优先研究历史态势决策型，第一屏应像危机指挥室而非功能菜单。
- [x] 第 17 轮：纠偏第一屏设计重点不是信息清单，而是信息呈现方式；应以任务流、矛盾标记和拟态内嵌引导呈现。
- [x] 第 18 轮：确认第一案第一屏采用“情报工作台式”为主，同时保留顶部状态栏、多窗口、未读通知、系统审计等 OS 式元素。
- [x] 第 19 轮：确认第一屏采用默认情报工作台布局，同时支持 OS 式自由拖拽窗口；下一步给游戏引擎侧 Demo Prompt。
- [x] 第 20 轮：基于 `artifacts/godot_demo_prompt_v0.1.md` 实现 Godot Demo v0.1，不修改 Godot 引擎源码。
- [x] 第 21 轮：启用 Superpower-style 交互规划板，在 cmux 侧边栏打开 HTML，用“看一幕、改一幕”降低抽象度。
- [x] 第 22 轮：根据验收反馈完成 Godot Demo v0.2：中文默认界面、五个中文动作按钮、中英切换、异常警报横幅，并确认用户侧手动拖拽可用。
- [x] 第 23 轮：核心转向——产品不是固定代码驱动的事件系统，而是 LLM 驱动、历史框架约束、可随机自由生长的网状历史故事书。
- [x] 第 27 轮：完成 Web Demo HistoricalRuntime v0.1-v0.2；`/api/generate` 稳定返回 Task / Events / Brief / Artifact / HistoryReview，前端显示 Artifact 与审计提示，并完成 fallback、API shape 和 Chrome 手动验收。
- [x] 第 28 轮：先接入 MiniMax Token Plan；按官方快速接入文档，默认走 Anthropic-compatible `https://api.minimaxi.com/anthropic/v1/messages`，并保留 `MINIMAX_API_FORMAT=openai` 的显式兼容路径。
- [x] 第 29 轮：完成三种视觉方向可行性对比 demo；确认“档案素描 / 情报档案 OS”是主方向，极简像素战略地图与纸上兵棋地图只作为地图标记、事件符号、局部组件语言，不作为主风格。
- [x] 第 30 轮：完成行走式历史分叉原型；验证“操控爱因斯坦在柏林场景中走到地点并触发分叉”的机制可行，但限定为档案 OS 的空间入口层，不转向完整像素 RPG。
- [x] 第 31 轮：迁移到正式 Godot 项目壳；完成 `CharacterBody2D` 玩家、`Area2D` 地点触发、`CanvasLayer` 档案 UI、JSON 分叉数据，并通过 Godot headless 检查。
- [x] 第 32 轮：冻结 HistoricalRuntime v0.3 Agent Runtime 规格；确认 `AgentRun`、固定串行任务图、异步 Job API 和前台/技术事件分层。
- [x] 第 33 轮：补齐开发进展总览、项目恢复入口、奕枢开发日志与今天日记，确保下次开发可恢复上下文。
- [x] 第 32 轮：完成 HistoricalRuntime v0.3 Agent Runtime 方案冻结稿；确认 AgentRun、HistoricalCase、Candidate/Commit、异步 Job、双层进度事件和 agent-progress-visibility-panel 迁移边界。
- [x] 第 34 轮：完成 HistoricalRuntime v0.3 第一刀；实现异步 Job API、双层进度事件、前端 Agent Runtime 面板，并加入模型请求超时 fallback。
- [x] 第 35 轮：完成竞品调研（TNO / Kaiserreich / Papers Please / Disco Elysium），冻结「混合式三段展开」回合循环设计，产出 `docs/turn_cycle_design.md`，确认「档案体」文案标准为用户喜欢的风格。
- [x] 第 36 轮：完成回合循环的数据层设计，产出 4 个 JSON schema（intel-card / situation-room / action-options / state-changes）和 `data/spec.md`，并通过交叉引用验证。
- [x] 第 37 轮：完成三段式回合循环的后端实现，产出 3 个 prompt builder（Briefing / Situation Room / Aftermath）+ 3 个解析器 + `runTurn`/`runTurnAftermath` 编排器 + 2 个新端点（`/api/turn/start`、`/api/turn/aftermath`），保留旧端点向后兼容，4 个新测试全绿。
- [x] 第 38 轮：完成三段式回合循环的前端实现，产出 `turn_cycle.js`（`renderIntelCard` + `renderSituationRoom` + `renderAftermath` + 状态机 + DOM 安全渲染）+ `index.html` turn cycle 面板 + `style.css` 档案体/态势图/Aftermath 样式。9 个前端测试全绿，含 1 个 e2e 数据契约测试。
- [x] 第 39 轮：完成真实模型接入测试。修复了 `callAnthropicMessages` 把 turn cycle JSON 提前解析掉的 bug（现在返回 raw text，由 stage parser 处理）。加严了 schema 验证：缺关键字段时抛错触发 fallback。max_tokens 从 1200 → 2000，temperature 从 0.9 → 0.5 让模型更稳定按 schema 输出。MiniMax-M3 端到端验证：情报卡（柏林物理学会会员名录变动报告 / B-DPG-1933-0417 / 德文档案原文 / 5 线索 2 矛盾点）+ 态势面板（5 节点 / 4 行动选项含「通过普朗克渠道递送离境建议」等历史合理项）+ Aftermath（277 字叙事 / 2 状态变更 / 下一张情报卡「盖世太保内部备忘」）。
- [x] 第 40 轮：完成 case state 引擎（累积 nodes/edges/risk/stateChangeHistory）+ 多回合压力测试。新增 `/api/case/:caseId` 查询端点和 `/api/case/reset` 重置端点，5 回合压力测试全绿。真实模型多回合验证：T1 后 nodes 从 1 → 6，stateChangeHistory 累积 3 条有历史合理性的状态变更（爱因斯坦从公共活跃到隐退、普朗克从中立到积极斡旋）。
- [x] 第 41 轮：完成历史档案素材功能（方案 B 分层）。下载 4 张 Wikimedia 公开域肖像（爱因斯坦 1921、普朗克 c1910、1911 索尔维会议合影、普朗克晚年版）。3 个 inline SVG 印章（DPG、PTR、普鲁士科学院）。HTML 档案柜侧栏（4 个文件夹，11 个文件项）。HTML dialog modal 显示档案描述。视觉风格保持情报档案 OS（深木色 + 金色 + 等宽字体）。所有数据由档案体手写描述，零 AI 生图，零虚假历史感。
- [x] 第 42 轮：完成 yishuship 协议全面接入。`.ship/state.yaml` + STATE_README；7 个 `/yishuship-*` 命令；项目级 builder/checker/session-startup agent；自写 YAML 子集解析器 + 21 个状态测试。CLAUDE.md §14.12 加 Operational binding 表。
- [x] 第 43 轮：完成 marked-clue-state 端到端。case state 加 markedClues 字段；新 API `POST /api/case/:id/mark-clue`；前端 turnState 同步 + 笔记 textarea + Aftermath 锁定数显示；note 历史框架校验拒绝"游戏/开挂"等（422）。11 个新测试全过；in-scope 41/41 全过；yishuship 5 phase 真实跑通（intake → design → dev → qa → handoff）。

## 已确认的产品判断
1. 架空历史世界应该持续演化。
2. 演化默认自动发生，除非用户选择人为介入。
3. 玩家不限定性别，也不必绑定传统 Galgame 主角身份；用户可以从任意历史片段进入。
4. 产品的难点之一是如何获得、校验、编译真实历史信息。
5. 历史书、实时搜索、资料编译会成为项目的重要输入。
6. 剧情不能完全写死，应由设定、角色、事件和历史机制自然生成。
7. 媒介体验应包含档案、地图、报纸、电报、年鉴、特定画面、人物关系网络等。
8. 玩家介入可以有两种玩法：上帝视角修改变量，以及作为历史中的具体行动者介入；当前优先偏向具体行动者玩法。
9. 产品本体应被理解为“架空历史模拟 OS”：历史调查者、外交官、情报人员等身份是进入 OS 的不同接口，而不是产品本体。
10. 第一版 OS 第一屏应让玩家同时理解“世界正在发生什么、我掌握什么信息、我能做什么干预”；核心区域为 Timeline、Map、Archives、Intel Desk。
11. 默认开局采用“两段式入口”：用户先选择历史时期，系统再给出异常事件；同时提供随机异常窗口给轻量用户。
12. 第一批异常事件模板优先为档案异常、电报异常、人物异常；技术异常更宏大，可作为后续吸引宏观模拟用户的扩展。
13. 新手第一案应优先从人物异常或技术异常切入，因为普通用户更容易被熟悉人物或宏大技术变化吸引；电报/档案更适合作为进入后的证据与行动系统。
14. 新手第一案的人物方向选择科学家型人物异常，核心人物确定为爱因斯坦；具体异常为“1933 年爱因斯坦没有离开德国”；第一分钟从 Intel Desk 双层情报进入，并提供五个可执行动作；动作区采用弱推荐，不强制路线。
15. 第一案要以“危机指挥室”方式呈现历史态势决策：玩家不是优化国家指标，而是在有限信息下处理会撬动历史大势的异常事件。
16. 第一屏呈现重点不是堆信息，而是让玩家看到一个正在崩开的历史矛盾：Intel Desk 作为主焦点，Timeline/Map/Archives/Risk 以被情报点亮的方式渐进展开。
17. 第一案第一屏范式为“情报工作台为主、OS 元素为辅”：中心案情卡 + 周边上下文面板 + 顶部 OS 状态栏/通知/审计提示。
18. 第一屏布局应有默认秩序，但窗口支持自由拖拽、调整、展开、最小化，以强化 OS 感。
19. Demo 实现应放在具体游戏项目产物目录中，而不是修改 Godot 引擎源码；当前实现落点为 `artifacts/godot_demo/`。
20. 产品核心应转向“LLM 驱动的网状历史故事书”：系统弹出历史事件，给出分支选项和自然语言输入，LLM 在历史框架约束下生成后续故事线；核心标准是好玩、好看。
21. 美术和交互主方向应采用“档案馆式架空历史模拟游戏”：纸上地图、素描人物、报纸/电报/年鉴 UI、少量像素图标。不要把 MVP 做成角色在地图上跑来跑去的像素 RPG。
22. 三个视觉方案不是平级候选：档案素描风作为主屏和主体验；纸上兵棋/历史地图作为地图层；极简像素战略地图只作为低成本标记、图标或局部态势表达。
23. 可以探索”可行走的历史选择空间”：玩家操控历史人物或代理角色走到地点触发历史分叉；但它应服务于档案卡、情报卡、报纸、地图反馈和历史状态更新，不应替代主叙事系统。
24. 一回合 = 一次决策，三段展开（情报卡 → 沙盘推演 → LLM 叙事推演），参照 TNO / Papers Please / Disco Elysium 的共同模式。
25. 情报卡文案标准 = “档案体”：有编号、日期、来源、正文、手写注释、矛盾点；不直接告诉玩家”发生了什么”，让玩家从文本拼出来；中英混杂（档案原文保留原文，玩家界面中文）。
26. LLM 每次叙事输出必须附带可执行的状态声明，不是自由文本续写。
27. 自由文本输入受历史框架约束，不符合的选项给出条件反馈而非直接拒绝。
28. 操作有体感：标记/盖章/归档，参照 Papers Please 的物理感。
29. 时限压力是叙事性的（报纸出刊/电报到达/会议召开），不是倒计时条。

## 下一步讨论问题
Godot Demo v0.2 验收与下一轮产品/交互取舍：
- 中文默认的“历史异常值班台”是否比英文 Historical OS 更接近目标第一印象？
- 是否继续增强 OS 窗口系统，还是先进入 Intel Desk 的任务流深化？
- 下一轮美术是否进入真实人物立绘 / 背景图生成，而不是继续依赖纯 UI 占位？

候选下一步：
- 在 Godot Editor 中验收 `artifacts/godot_walking_branch/` 的移动和触发手感。
- 下一步优先做地点触发后的 UI 深化：港口电报、科学院档案、风险审计、报纸舆论。
- 再下一步补独立 sprite sheet 和地图资产，不再从概念资产表硬切角色。

## 不要重复探索
- 不要把它直接做成传统 Galgame。
- 不要把剧情完全预写死。
- 不要只做聊天机器人；核心应是“世界演化 + 多媒介叙事”。

## 关键路径
- `HANDOFF.md`：跨 Session 交接入口。
- `manifest.json`：项目产物索引。
- `logs/`：每轮讨论记录。
- `agents/`：未来子 Agent 的调研和分析结果。
- `artifacts/`：原型、草图、设定文档、技术实验产物。
- Godot Demo：`artifacts/godot_demo/`
- Web 预览导出：`artifacts/godot_demo_web/index.html`
- 当前中文验收截图：`artifacts/historical-os-demo-v0.2-zh-verified.png`
- HistoricalRuntime Web Demo：`artifacts/web_story_loop_demo/`
- HistoricalRuntime 实施日志：`logs/round_027_2026-05-19.md`
- MiniMax Token Plan 接入日志：`logs/round_028_2026-05-19.md`
- 视觉方案可行性 Demo：`artifacts/style_feasibility_demo/`
- 视觉方案验收截图：`artifacts/style-feasibility-archive.png`
- 视觉方案日志：`logs/round_029_2026-05-19.md`
- 行走式历史分叉 Demo：`artifacts/walking_branch_demo/`
- 行走式历史分叉预览：`http://127.0.0.1:8894/artifacts/walking_branch_demo/index.html`
- 行走式历史分叉截图：`artifacts/walking-branch-demo-initial.png`、`artifacts/walking-branch-demo-triggered.png`
- 行走式历史分叉美术资产：`artifacts/walking_branch_demo/assets/berlin_asset_sheet_v1.png`
- 行走式历史分叉美术接入截图：`artifacts/walking-branch-demo-art-v1.png`
- 行走式历史分叉站立修复截图：`artifacts/walking-branch-demo-art-v1-still-fixed.png`
- 行走式历史分叉角色修复截图：`artifacts/walking-branch-demo-player-fixed.png`
- 行走式历史分叉日志：`logs/round_030_2026-05-19.md`
- Godot 行走式历史分叉项目：`artifacts/godot_walking_branch/`
- Godot 行走式历史分叉 README：`artifacts/godot_walking_branch/README.md`
- Godot 行走式历史分叉日志：`logs/round_031_2026-05-19.md`
- HistoricalRuntime v0.3 规格日志：`logs/round_032_2026-05-20.md`
- 开发进展总览日志：`logs/round_033_2026-05-20.md`
- HistoricalRuntime v0.3 异步 Job/进度面板日志：`logs/round_034_2026-05-20.md`
- v0.3 Agent Runtime 规格：`tasks/historical_runtime_v0.3_agent_runtime_spec.md`
- HistoricalRuntime v0.3 Agent Runtime 方案：`tasks/historical_runtime_v0.3_agent_runtime_spec.md`
- HistoricalRuntime v0.3 方案日志：`logs/round_032_2026-05-20.md`
