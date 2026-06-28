# 架空历史故事游戏 - HANDOFF

## 项目一句话
一个以架空历史为核心的故事类游戏 / Galgame 变体：它不是固定剧情分支，而是一个会自动演化的历史世界；用户可以从某段历史进入、观察、理解，必要时介入，推动世界线偏转。

## 当前阶段
产品共创早期。目标是在开发前进行至少 80 轮讨论，把产品机制、历史资料系统、叙事形态、媒介体验和技术路线想清楚。

## 2026-05-20 当前恢复入口

下次继续时先读：

- `TODO.md`
- `logs/round_031_2026-05-19.md`
- `logs/round_032_2026-05-20.md`
- `logs/round_033_2026-05-20.md`
- `tasks/historical_runtime_v0.3_agent_runtime_spec.md`

当前有两条清晰开发线：

1. Godot 线：`artifacts/godot_walking_branch/` 已是正式 Godot 项目壳，下一步在 Godot Editor 中验收移动和触发手感，再把四个地点分叉后续做成具体 UI。
2. Runtime 线：`HistoricalRuntime v0.3` 已冻结 AgentRun / async job pipeline 规格，下一步按 BDD/TDD 实现 `POST /api/generate/start` 与 `GET /api/jobs/{jobId}`。

当前不要再回到“只做网页 CSS demo”的状态。网页原型只保留为机制验证和截图记录；正式游戏实现从 Godot 项目壳推进。

## 2026-05-19 Godot 正式项目壳

用户确认下一步进入正式 Godot 开发，不再只在网页原型中试。

已新建 Godot 项目：

- Project：`artifacts/godot_walking_branch/`
- Main scene：`artifacts/godot_walking_branch/scenes/Main.tscn`
- Main script：`artifacts/godot_walking_branch/scripts/Main.gd`
- Branch data：`artifacts/godot_walking_branch/data/branches.json`
- README：`artifacts/godot_walking_branch/README.md`

实现内容：

- Godot 4.6.2 项目，Compatibility renderer。
- `CharacterBody2D` 玩家，方向键移动。
- 4 个 `Area2D` 历史分叉地点。
- 空格触发当前地点分叉。
- 右侧 `CanvasLayer` 档案 UI 更新标题、结果、世界线稳定度、公开风险和下一步形态。
- 数据从 JSON 读取，避免把分叉文本写死在场景节点里。

验证：

- `godot --headless --path artifacts/godot_walking_branch --check-only --script res://scripts/Main.gd` 通过。
- `godot --headless --path artifacts/godot_walking_branch --quit-after 2` 通过。
- 第一次 headless 因沙盒阻止 Godot 写 `~/Library/Application Support/Godot` 失败；放行 `godot --headless` 后正常。
- 字体 `.ttc` 在未导入状态下不能直接 `load()`，已移除硬依赖，先使用 Godot 默认字体/fallback。

下一步：

- 在 Godot Editor 中人工验收移动和触发手感。
- 把触发后的后续 UI 做成四套具体界面：港口电报、科学院档案、风险审计、报纸舆论。
- 生成独立角色 sprite sheet 与地点素材，不再从概念资产表裁剪玩家。

## 2026-05-19 行走式历史分叉原型

用户提出新想法：参考 Godot 农场/顶视角教程，不再只做 Web/CSS 面板，而是让玩家操控一个爱因斯坦样貌的小人物，在场景中走到不同地点触发历史分叉。

已完成一个独立 Canvas 2D 原型：

- Demo：`artifacts/walking_branch_demo/`
- 预览：`http://127.0.0.1:8894/artifacts/walking_branch_demo/index.html`
- 初始截图：`artifacts/walking-branch-demo-initial.png`
- 触发截图：`artifacts/walking-branch-demo-triggered.png`
- 生成资产表：`artifacts/walking_branch_demo/assets/berlin_asset_sheet_v1.png`
- 美术接入截图：`artifacts/walking-branch-demo-art-v1.png`

机制：

- WASD / 方向键移动。
- 走到发光地点后按空格触发分叉。
- 当前地点包括：汉堡港撤离线、普鲁士科学院、秘密警察档案室、柏林报社。
- 触发后右侧档案卡更新世界线稳定度、公开风险和下一步 UI 形态。

判断：

- 这个方向可行，但应定义为“空间化历史选择入口”，不是完整像素 RPG。
- 走路层只负责让抽象历史分叉变得可感、可探索；后续仍应进入档案卡、报纸、电报、地图反馈和历史审计。
- 涉及真实人物迫害/死亡的分支必须进入严肃风险审计，不做猎奇动画或奖励式演出。
- Godot 版本建议用 `CharacterBody2D` 玩家、`Area2D` 触发区、`Control` 档案弹层、JSON 分叉数据和轻量 scene/UI transition。
- 第一版 imagegen 资产已接入 Canvas：背景叠加柏林视觉、小人优先从资产表取帧、地点热区改为带标记的交互点。当前资产仍是整张概念表切片复用，后续应生成更规范的独立 sprite sheet、地点图标和结果插图。

## 2026-05-19 视觉方向可行性纠偏

本轮用子 Agent 分别探索了三种方向，并做了一个静态可视化对比 demo：

- `artifacts/style_feasibility_demo/`
- 当前预览：`http://127.0.0.1:8893/index.html`
- 已验证截图：`artifacts/style-feasibility-archive.png`

结论：

- 主方向采用“档案馆式架空历史模拟游戏”：纸上地图、素描人物、报纸/电报/年鉴 UI、少量像素图标。
- 三种方案不是平级候选。档案素描风 / 情报档案 OS 是主屏和主体验。
- 极简像素战略地图、纸上兵棋/历史地图只能作为局部组件语言：地图标记、箭头、事件热区、状态符号、少量像素图标。
- 不要把 MVP 做成角色在地图上跑来跑去的像素 RPG；内容压力会从历史事件和人物资料管理转移到不可控的角色动画、地图和资产量。
- 后续如果进入 Godot，应建立具体游戏项目壳，而不是修改 Godot 引擎源码；技术路线为 Godot 4.x + 2D + Compatibility renderer + GDScript + Control UI + JSON 数据驱动。

## 2026-05-19 HistoricalRuntime v0.1-v0.2 实现

Web story loop demo 已升级为最小 Historical OS Agent Runtime：

- `artifacts/web_story_loop_demo/server.mjs` 保留 `POST /api/generate`，返回 `story/choices/task/events/brief/artifacts/historyReview/historyFlags`。
- 服务端新增规则型 `HistoryGuardAgent`，对纳粹德国、反犹迫害、国家暴力、真实人物死亡、高风险指令、伪真实档案编号、过早结局做标记；高风险方向会产生 `human_approval_required` 事件。
- fallback 仍返回 200，并保留 task/events/brief/artifact/historyReview，避免前端玩法中断。
- `index.html` / `script.js` / `style.css` 新增 Artifact 展示区和 Historical OS 审计提示，不改成聊天 UI。
- 前端已将 Brief、事件、分支按钮、节点卡等模型文本渲染改为 DOM API / `textContent`，避免直接插入模型 HTML。
- 新增测试：`artifacts/web_story_loop_demo/server.test.mjs`、`artifacts/web_story_loop_demo/frontend_contract.test.mjs`。

验证：

- `node --check artifacts/web_story_loop_demo/server.mjs`
- `node --check artifacts/web_story_loop_demo/script.js`
- `node --test artifacts/web_story_loop_demo/server.test.mjs artifacts/web_story_loop_demo/frontend_contract.test.mjs`
- `PORT=8893 node server.mjs` 后用 Python 调 `/api/generate` 验证返回结构。
- Chrome 打开 `http://127.0.0.1:8893/`，点击“爱因斯坦被纳粹杀害”：确认任务、事件流、Brief、Artifact、审计卡、故事地图新增节点和地图跳转可用。

注意：

- 验收时 `8892` 被占用，因此使用 `8893`。
- 当前本机模型代理返回 400 `Instructions are required`，因此浏览器验收实际走 fallback；fallback 是本阶段明确要求覆盖的路径。

## 记录协议
采用“Agent 记忆外化与跨 Session 状态继承”：
- `TODO.md` 是当前状态入口。
- `HANDOFF.md` 是新会话交接摘要。
- `manifest.json` 记录产物路径。
- `logs/` 保存每轮讨论记录。
- `agents/` 保存子 Agent 调研结果。
- `artifacts/` 保存原型和中间产物。

## 第 1 轮确认
用户确认了四个关键方向：

1. 世界模拟差异：架空历史世界应该持续演化，而且默认自动演化；除非用户想介入，否则世界自己前进。
2. 玩家身份差异：不分男女，不限定传统 Galgame 主角身份；用户可以从任何历史片段开始。
3. 叙事生成差异：剧情不能完全写死，最有意思的是自然演化机制。
4. 媒介体验差异：应由档案、地图、报纸、电报、年鉴、特定画面、人物关系网络等组成。

## 已识别的核心难点
如何获得真实历史信息，并将历史书、实时搜索、资料编译转化为可用于世界模拟和叙事生成的结构化输入。

## 第 2 轮确认
用户确认：介入方式可以同时保留两种玩法：

1. 上帝视角 / 变量修改模式：适合沙盒推演、因果观察和高级玩法。
2. 行动者视角 / 历史角色模式：玩家作为历史中的具体行动者，通过有限身份、有限信息和具体行动影响历史。用户个人更偏好这一模式，应作为主玩法优先设计。

## 第 3 轮确认
用户的主身份偏好：

第一优先级：
- 历史调查者
- 外交官 / 信使
- 情报人员

第二优先级：
- 舆论操盘者 / 报社编辑：用户觉得有点恐怖，但对真实机制感兴趣，需要伦理处理。

保留给其他玩家或后续扩展：
- 商人 / 银行家
- 史官 / 小说家

降低优先级：
- 地方官 / 总督：用户不感兴趣。

## 第 4 轮确认
重要纠偏：产品本体不是单一调查游戏，而是“架空历史模拟 OS”。

用户更偏好神秘历史调查气质，也对真实政治惊悚感兴趣；但明确提醒讨论不能歪，核心仍然是架空历史模拟器 / OS。

因此：历史调查者、外交官、情报人员、舆论操盘者等身份，应被看作进入历史 OS 的不同身份接口，而不是锁死产品类型。

## 第 5 轮确认
第一版 OS 第一屏不是 App 图标启动器，而是“态势感知面板”。玩家打开第一分钟必须理解：

1. 这个世界正在发生什么？
2. 我手里掌握了什么信息？
3. 我现在能做什么干预？

第一屏四个核心区域：
- Timeline：世界正在如何演化。
- Map：世界在哪里发生变化。
- Archives：我能查到什么证据。
- Intel Desk / Dispatch：我收到什么情报，我能做什么行动。

Newspaper、Network、Almanac 先作为嵌入视图；事件模拟器和世界线管理器作为后续高级功能。

## 第 6 轮确认
默认开局采用“两段式入口”：

```text
选择历史时期 / 随机匹配时期
          ↓
生成或分配一个历史异常事件
          ↓
进入 Timeline + Map + Archives + Intel Desk 第一屏
```

两个入口：
1. 有历史经验的用户：选择自己关注的历史时期，例如二战。
2. 轻量用户：使用随机窗口，由系统匹配一个大众容易进入的历史异常事件。

主设计仍以 C 为主：先选择历史时期，再给异常事件。

## 第 7 轮确认
MVP 第一批异常事件模板优先级：

第一优先级：
- 档案异常：档案与真实历史不一致，适合历史调查和证据感。
- 电报异常：电报不该存在/提前出现/延迟送达/被篡改，适合外交、信使、情报入口。
- 人物异常：关键人物提前死亡、失踪、倒戈或活过原本死亡时间，适合调查和政治惊悚。

扩展优先级：
- 技术异常：更宏大，适合世界线长期演化，可能吸引宏观模拟用户。

暂不作为 MVP 核心：战役异常、地图异常、舆论异常。

## 第 8 轮确认
新手第一案应优先从人物异常或技术异常切入。

原因：
- 电报和档案虽然适合 OS 机制，但对普通用户有距离感。
- 普通用户不一定会被“Number 999467 的报告”吸引。
- 如果以用户熟悉的人物作为缺口，例如爱因斯坦，用户会更想继续玩。

产品原则：新手第一案不能以档案编号开场，应以用户能识别、能关心、能好奇的人物或技术开场。

电报异常和档案异常仍然重要，但更适合作为进入后的证据与行动系统。

## 第 9 轮确认
新手第一案的人物方向选择“科学家”。

原因：
- 同时连接人物异常与技术异常。
- 比政治领袖更有神秘历史调查感。
- 不会过早把产品带向战争推演或纯政治架空。
- 普通用户更容易通过知名科学家进入复杂历史。

候选科学家：爱因斯坦、图灵、奥本海默、牛顿、达芬奇、居里夫人、特斯拉。

## 第 10 轮确认
新手第一案科学家确定为：爱因斯坦。

原因：
- 大众熟悉度最高，普通用户一眼知道他是谁。
- 能连接科学、战争、移民、犹太人身份、德国、美国、核时代、信件与政治责任。
- 既可以走技术异常，也可以走人物异常。

风险：不要把爱因斯坦处理成泛泛的“天才科学家符号”；不要滑向伪科学；架空点必须清楚标出。

## 第 11 轮确认
爱因斯坦第一案的具体异常确定为：

> 1933 年，爱因斯坦没有离开德国。

这是一个会撬动世界线的大分叉点，牵动德国、美国、纳粹政权、学术机构、犹太知识分子流亡、核时代和情报系统。

风险：历史变化会非常大，第一案需要控制范围；必须区分真实历史锚点与架空分叉；严肃处理纳粹德国、犹太人迫害和流亡知识分子的历史。

## 第 12 轮确认
第一分钟主入口选择 Intel Desk。

流程：

```text
Intel Desk 紧急情报
      ↓
用户知道“爱因斯坦出事了 / 不对劲”
      ↓
再回到 Timeline 理解历史偏移
      ↓
用 Map 和 Archives 查证
```

理由：普通用户不是来先读年表的；“爱因斯坦怎么了”比“1933 年时间线节点异常”更直观。

## 第 13 轮确认
Intel Desk 第一条情报采用双层文案：

1. 上层：沉浸式情报报告。
2. 下层：新手可理解的系统解释。

示例：

```text
URGENT / BERLIN SOURCE B-17

Subject: Albert Einstein
Status: Still in Germany
Risk: Historical divergence detected

系统解释：
在真实历史基准中，爱因斯坦于 1933 年离开德国。
但当前世界线显示：他仍在柏林。
请确认这是情报误报、档案错误，还是世界线偏移。
```

## 第 14 轮确认
第一条 Intel Desk 情报之后，保留五个可执行动作：

1. 查看 Timeline：理解历史偏移。
2. 查看 Map：理解空间与行动位置。
3. 打开 Archives：查找证据。
4. 验证情报来源：判断 Berlin Source B-17 是否可信。
5. 发送指令：开始介入，例如继续监控、接触目标、撤离目标或保持观察。

产品原则：第一案不是单一路径谜题，而是开放式调查入口；五个动作符合“架空历史模拟 OS”的定位。

## 第 15 轮确认
五个动作采用弱推荐策略：

```text
建议：在采取干预前，先确认情报来源与历史基准。
```

但系统不强制路线，不把某个按钮高亮成唯一正确动作。这样既保留新手引导，也保留 OS 的开放性和专业感。

新增原则：后续游戏/玩法设计要引入开发社区、玩家社区和类似案例研究，不只依赖内部直觉。

## 第 16 轮确认
已启动 Agent team 并完成第一批外部调研。有效产物：

- `agents/os_interface_case_research_2026-05-18.md`
- `agents/historical_situation_decision_research_2026-05-18.md`
- `agents/einstein_1933_historical_anchor_2026-05-18.md`

证据调查玩法 Agent 因 socket connection closed 失败，后续需要重跑。

核心判断：优先研究历史态势决策型，但不能做成政策 Excel 或硬核国家模拟器。更准确表述：玩家不是在优化国家指标，而是在危机指挥室里处理一个会撬动历史大势的异常事件。

第一屏应像“已经在运转的危机指挥室”，而不是功能菜单。

## 第 17 轮确认
用户纠偏：比起呈现哪些具体信息，更应该关注信息呈现方式。

第一屏不是把 Intel Desk、Timeline、Map、Archives、Risk Panel 的信息全部摊开，而是要设计一种渐进式、任务驱动、拟态内嵌的信息呈现。

核心原则：
- 先给身份和压力，不先给全量系统。
- 信息以任务流呈现，而不是资料库呈现。
- 四个模块不同时抢注意力，Intel Desk 是主焦点，其他模块被情报点亮。
- 用值班规程、上级批注、系统审计提醒、来源可信度警告代替教程弹窗。
- 用矛盾标记驱动玩家：Baseline History vs Current Timeline、Official Report vs Unverified Source、Archive Present vs Archive Missing。

第一屏目标：不是“给玩家很多信息”，而是“让玩家看到一个正在崩开的历史矛盾”。

## 第 18 轮确认
第一案第一屏采用“情报工作台式为主，OS 式元素为辅”。

这不是完整桌面启动器，也不是纯粹单案调查板，而是一个“历史异常值班工作台”。

情报工作台特征：中心案情/情报卡，周围 Timeline、Map、Archives、Risk 面板，围绕一个异常事件做判断。

OS 式元素：顶部状态栏、系统时间、世界线状态、多窗口/可展开面板、未读通知、文件夹/档案夹隐喻、系统审计提醒。

## 第 19 轮确认
第一屏采用“默认情报工作台布局 + OS 式自由拖拽窗口”。

默认布局基本成立：
- Intel Desk 居中最大。
- Timeline 左侧。
- Map 右侧。
- Archives / Source Credibility / Risk 底部或附属面板。

但用户希望窗口可以自由拖拽、调整、展开、最小化。也就是：系统默认排好危机工作台，但用户可以像操作 OS 一样重排窗口。

新增需求：更上层 `黑客松` 文件夹里有游戏开发相关项目和游戏引擎，现在可以尝试跑简单 Demo，需要给引擎侧一个具体 prompt 来对接。

## 第 20 轮确认 / 实现
已基于 `artifacts/godot_demo_prompt_v0.1.md` 实现一个独立 Godot Demo：

```text
artifacts/godot_demo/
```

Web 导出位置：

```text
artifacts/godot_demo_web/index.html
```

本地预览服务：

```text
http://127.0.0.1:8890/index.html
```

实现内容：
- 顶部 Historical OS 状态栏。
- 默认情报工作台布局。
- Intel Desk 主窗口。
- Timeline / Map / Archives / Risk 面板。
- 五个动作按钮。
- 点击按钮后的 Current Focus 和 NotificationArea 反馈。
- 标题栏拖拽代码与最小化按钮。
- 严肃历史敏感性提示。

验证：
- Godot 脚本检查通过。
- Web 导出成功。
- 浏览器控制台无错误。
- 按钮反馈已通过浏览器 canvas 点击验证。
- 人工拖拽窗口仍需用户侧确认；Chrome DevTools 合成拖拽未能在截图中证明窗口移动。

## 第 22 轮确认 / 实现
用户验收反馈：
- 第一眼还不够像 Historical OS / 历史情报系统。
- 全英文界面对中文开发者不友好。
- 五个动作按钮应默认中文；可以保留中英切换。
- 用户手动拖拽窗口表现正常。

已完成 Godot Demo v0.2：
- 默认语言改为中文。
- 顶部身份改为“历史异常值班台”，保留 Historical OS 副标题。
- 增加异常警报横幅，第一屏明确显示“第一案：爱因斯坦仍在德国”。
- 五个动作按钮改为中文，并压缩成 3 列布局，避免第五个按钮被下方窗口遮挡。
- 顶部增加 `EN` / `中文` 切换按钮。
- 英文界面仍可切换回来。
- 将这次 UI 纠偏写入 `tasks/lessons.md`。

验证：
- `python3 -m json.tool artifacts/godot_demo/data/workbench.json` 通过。
- `godot --headless --log-file /private/tmp/historical-os-check.log --path artifacts/godot_demo --check-only --script res://scripts/Main.gd` 通过。
- Web 导出成功，预览地址仍为 `http://127.0.0.1:8890/index.html`。
- Chrome DevTools 截图确认中文默认页、五个中文按钮可见：`artifacts/historical-os-demo-v0.2-zh-verified.png`。
- Chrome DevTools 点击 `EN` 后确认英文界面可切换：`artifacts/historical-os-demo-v0.2-en-toggle.png`。
- Chrome DevTools 点击动作按钮后确认反馈区更新：`artifacts/historical-os-demo-v0.2-action-feedback.png`。

## 下次继续
## 第 27 轮确认 / 实现
已完成 Web Demo HistoricalRuntime v0.1-v0.2：

```text
artifacts/web_story_loop_demo/
```

实现内容：
- `POST /api/generate` 返回 Story / Choices / Task / Events / Brief / Artifact / HistoryReview / HistoryFlags。
- Fallback 保持 HTTP 200，并保留完整 runtime 结构。
- HistoryGuardAgent 规则检查敏感历史语境、高风险死亡/迫害方向、伪档案编号和过早结局。
- 前端增加 Artifact 面板与审计提示，不改成聊天 UI。
- 模型文本渲染从 `innerHTML` 改为 DOM / `textContent`。

验证：
- `node --check artifacts/web_story_loop_demo/server.mjs` 通过。
- `node --check artifacts/web_story_loop_demo/script.js` 通过。
- `node --test artifacts/web_story_loop_demo/server.test.mjs artifacts/web_story_loop_demo/frontend_contract.test.mjs` 通过。
- `PORT=8893` 本地 API shape 验证通过。
- Chrome 手动验收确认 fallback、Task、Events、Brief、Artifact、Audit、Map node / root jump 正常。

## 第 28 轮确认 / 实现
已先接入 MiniMax Token Plan 模型调用路径。

运行方式：

```bash
cd /Users/mahaoxuan/Desktop/黑客松/架空历史故事游戏/artifacts/web_story_loop_demo
HISTORICAL_RUNTIME_MODEL_PROVIDER=minimax \
MINIMAX_API_KEY='<your-token-plan-key>' \
MINIMAX_BASE_URL='https://api.minimaxi.com/anthropic' \
MINIMAX_MODEL='MiniMax-M2.7' \
PORT=8892 \
node server.mjs
```

支持的环境变量：
- MiniMax：`MINIMAX_API_KEY`、`MINIMAX_BASE_URL`、`MINIMAX_MODEL`。
- Token Plan aliases：`TOKEN_PLAN_API_KEY`、`TOKEN_PLAN_BASE_URL`、`TOKEN_PLAN_MODEL`。
- Provider 开关：`HISTORICAL_RUNTIME_MODEL_PROVIDER=minimax` 或 `MODEL_PROVIDER=minimax`。
- 可选兼容开关：`MINIMAX_API_FORMAT=openai` 时走 OpenAI-compatible chat completions。

实现说明：
- MiniMax 默认路径按官方快速接入文档走 Anthropic-compatible `POST /v1/messages`。
- Token Plan 默认 base URL 为 `https://api.minimaxi.com/anthropic`。
- Anthropic Messages API 路径保留为默认路径。
- `process.env` 覆盖 `~/.claude/settings.json`，空字符串按缺失处理。

验证：
- 新增测试用本地 fake Token Plan server 验证 Anthropic-compatible 请求路径、`x-api-key`、模型名和返回 JSON 解析。
- OpenAI-compatible 请求路径作为显式兼容模式保留，并有单独测试覆盖。
- 未使用真实 Token Plan key 做 live call。

## 第 32 轮确认 / 方案冻结
已完成 HistoricalRuntime v0.3 Agent Runtime 方案冻结稿：

```text
tasks/historical_runtime_v0.3_agent_runtime_spec.md
```

核心共识：
- Agent 的最小单位是可审计 `AgentRun`，不是角色，也不是聊天窗口。
- Runtime 是事件驱动的 Agent 编排器；玩家动作触发，但流程由 World State 和 Agent Task Graph 决定。
- v0.3 先采用固定串行骨架：StoryWeaverAgent -> HistoryGuardAgent -> IntelDeskAgent -> ArtifactAgent -> Runtime commit。
- Agent 之间通过结构化对象通信，完整状态由 Runtime / HistoricalCase 管理。
- HistoryGuardAgent 是门禁，有权阻止节点进入正式世界线；重写由 RepairAgent 或 StoryWeaverAgent 再跑。
- StoryWeaver 只能产出 CandidateNode；只有 Runtime 完成审计和汇总后才能 commit 为正式 StoryNode。
- MiniMax 只是 provider capability，不定义本项目的 Agent 架构。
- 养成对象是 `HistoricalCase` / 异常世界线本身，玩家是在边玩边生成自己的历史异常游戏。
- 不确定性是世界生长机制，不是失败惩罚机制。
- v0.3 要迁移 `agent-progress-visibility-panel` 组件逻辑：异步 Job、真实后端事件、前台拟态事件、后台技术事件。

v0.3 API 方向：

```text
POST /api/generate/start
GET /api/jobs/{jobId}
```

稳定 Job stage：

```text
queued
story_weaving
history_review
briefing
artifact_generation
commit_review
complete
failed
```

前台事件显示“叙事分析组 / 历史审计频道 / 情报值班台 / 档案组 / 值班系统”；真实 Agent 名只放在 `technicalEvents` / metadata。

## 下次继续
## 第 34 轮确认 / 实现
已完成 HistoricalRuntime v0.3 第一刀：异步 Job + Agent Runtime 进度面板。

核心路径：

```text
artifacts/web_story_loop_demo/server.mjs
artifacts/web_story_loop_demo/script.js
artifacts/web_story_loop_demo/index.html
artifacts/web_story_loop_demo/style.css
artifacts/web_story_loop_demo/server.test.mjs
artifacts/web_story_loop_demo/frontend_contract.test.mjs
```

新增 API：

```text
POST /api/generate/start
GET /api/jobs/{jobId}
```

实现内容：
- 后端维护内存 Job，返回 `jobId` / `statusUrl`，并持续暴露 `status`、`stage`、`events`、`technicalEvents` 和最终 `result`。
- Runtime pipeline 发出稳定阶段：`story_weaving`、`history_review`、`briefing`、`artifact_generation`、`commit_review`、`complete`。
- 前端新增 `Agent Runtime` 面板：学生/玩家看到“叙事分析组、历史审计频道、情报值班台、档案组、值班系统”；真实 Agent 名保留在可折叠技术事件里。
- 增加 `MODEL_REQUEST_TIMEOUT_MS`，默认 `12000`；模型慢或不可达时转 fallback，不再让页面卡在生成中。

验证：
- `node --check artifacts/web_story_loop_demo/server.mjs` 通过。
- `node --check artifacts/web_story_loop_demo/script.js` 通过。
- `node --test artifacts/web_story_loop_demo/server.test.mjs artifacts/web_story_loop_demo/frontend_contract.test.mjs` 通过，6 个测试全过。
- Chrome 手动点击 `http://127.0.0.1:8895/` 的“爱因斯坦自杀了”后确认：fallback 节点生成、审计提示出现、进度面板走到 `succeeded · 完成`，技术事件可展开。

## 下次继续
优先验收 Web Demo HistoricalRuntime + v0.3 进度面板手感；如果成立，下一步在两个方向中择一：

1. 增强 OS 窗口系统：真实调整大小、展开、最小化、置顶、布局重置。
2. 深化 Intel Desk 任务流：来源核验、档案查询、发送指令 modal，使第一分钟更像危机值班流程。
3. 继续 v0.3 第二刀：把 `HistoricalCase` / `CandidateNode` / commit 语义从当前兼容结构中正式拆出来。

## 重要约束
- 不要把产品简化成传统 Galgame 或聊天机器人。
- 每轮有实质判断后，应写入 `logs/` 并更新 `TODO.md` / `HANDOFF.md`。
