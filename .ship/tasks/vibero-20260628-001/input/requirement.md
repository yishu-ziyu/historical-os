# Task: vibero-20260628-001 — marked-clue-state

> 来源：round 043 / 2026-06-28
> 用户原话："跑一次真实端到端——拿一个 round 43+ 的小 task，完整跑 intake → design → dev → qa → handoff，验证协议在 loop 阶段真能跑。在基础之上增加游戏可玩性和产品细节。合理地调用动态工作流。"

## 原始需求

用户在 PM 选型时答："C. 纯可玩性（不重排 TODO.md）"——即不在 round 43 改任何文档结构，而是用 5 phase 跑完一个真正提升可玩性的功能。

## PM 调研过程

1. 读 `artifacts/web_story_loop_demo/turn_cycle.js`（689 行）—— 三段式回合循环已完整
2. 读 `artifacts/web_story_loop_demo/index.html`（145 行）—— 档案柜 + 情报卡 + 态势分析 + 推演报告
3. 读 `turn_cycle.js:170-192` —— "可标记线索" 按钮存在但**只切换 DOM class，不持久化**
4. 读 `turn_cycle.js:393-` —— `onActionChosen` 进入下一回合时 turnState 重置，标记状态丢失
5. 读 `server.mjs` case state 部分（round 040 落地）—— 已累积 nodes/edges/risk/stateChangeHistory

## 可玩性差距

玩家在情报卡点"标记" → 视觉上变成"已标记" → 切到下一回合 → 标记消失。**玩家的"判断"在系统里没有重量**。

这违反 CLAUDE.md §28："操作有体感：标记/盖章/归档，参照 Papers Please 的物理感"。
也违反 §14 已确认产品判断："玩家是在边玩边生成自己的历史异常游戏"——但如果玩家的判断不沉淀，"自己的游戏"就立不住。

## 范围

### 包含
- 玩家在情报卡点"标记" → 状态写入后端 case state 的 `markedClues: { [clueId]: { turnMarked, note? } }`
- 下一回合情报卡加载时，**已标记的线索自动显示"已标记"状态**（视觉/状态保留）
- 玩家可以再次点击 → 取消标记（toggle 行为保留）
- 玩家可以在每个已标记的线索下加一行**手写笔记**（自由文本，受历史框架约束——非历史关键人物/非历史关键事件的笔记需给出"档案本不接受非历史语境的注释"反馈）
- case state 的 `/api/case/:caseId` 返回 `markedClues`
- 推演报告（Aftermath）显示"本回合锁定了 X 条线索，累计 Y 条"

### 不包含
- 自由行动文本框（已经在 product intent 里但 scope 太大，留 round 44+）
- 历史脉络对比视图（更深的 scope，留 round 45+）
- 标记线索之间的关联图（需要图论，留 round 46+）
- 跨设备同步（不需要）
- 玩家导入/导出 case state（不需要）

## 来源

- TODO.md 已确认产品判断 28（标记/盖章/归档物理感）
- TODO.md round 040 落地 case state 引擎
- `artifacts/web_story_loop_demo/turn_cycle.js` line 170-192（标记按钮现状）
- `artifacts/web_story_loop_demo/server.mjs` case state 模块
- `data/spec.md`（已定义 case state 的 schema）

## 风险

- **历史敏感性**：玩家手写笔记是自由文本，必须做"非历史语境拒绝"逻辑
- **性能**：每个回合加载情报卡时查询 case state 的 markedClues，不能引入明显延迟
- **持久化**：case state 在内存里（round 040 设计如此），玩家刷新页面会丢——但这是已知约束，不在 round 43 解决
- **状态机复杂度**：turn_cycle.js 的 turnState 已经有 8 个字段，加 markedClues 后会到 9-10 个，要避免失控
