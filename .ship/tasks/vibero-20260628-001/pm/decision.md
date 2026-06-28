# PM Decision: vibero-20260628-001 — marked-clue-state

> 2026-06-28 / yishuship intake 阶段决策

## 决策：做

理由：

1. **回应用户的核心问题**——round 43 端到端验证 + 可玩性增强。一刀解决两个目标。
2. **风险可控**——改动集中在 case state 一处 + 前端 turn_cycle.js 一处 + 一个新 API 端点。
3. **直接对应产品宪法**——CLAUDE.md §28 物理感、§14 "玩家是在边玩边生成自己的历史异常游戏"。
4. **测试明确**——Done Criteria 可以写成可观察的 4-5 条。

## 范围判断（做什么不做什么）

### 做什么（In）

| 改动 | 文件 | 类型 |
|------|------|------|
| case state 增加 `markedClues` | `server.mjs` | 改 |
| 新 API 端点 `POST /api/case/:caseId/mark-clue` | `server.mjs` | 改 |
| `GET /api/case/:caseId` 返回 markedClues（已实现的话只验证） | `server.mjs` | 验证 |
| 标记按钮 onClick 调用新 API | `turn_cycle.js` | 改 |
| 加载情报卡时检查 markedClues 自动渲染已标记 | `turn_cycle.js` | 改 |
| 已标记线索的手写笔记 textarea + 历史框架校验 | `turn_cycle.js` | 改 |
| 推演报告显示"锁定 X / 累计 Y" | `turn_cycle.js` | 改 |
| case state 模块的 unit test 覆盖 markedClues | `server.test.mjs` 或新文件 | 加 |
| e2e contract test：标记 → 切回合 → 仍然显示 | `frontend_contract.test.mjs` 或新文件 | 加 |

### 不做什么（Out）

| 不做 | 理由 |
|------|------|
| 跨回合"标记线索"列表侧栏 | 下一轮；本轮只做"在情报卡位置显示已标记" |
| 跨回合 case state 持久化到 localStorage / 文件 | round 040 已知约束；不在本轮解决 |
| 标记线索的关联图（X 影响 Y） | 需要图论；round 46+ |
| 历史脉络对比视图 | round 45+ |
| 自由行动文本框（CLAUDE.md §27） | round 44+ |
| 玩家导出 case state | 不在 MVP |

## 优先级

P1（yishuship 端到端验证的核心载体；同时直接增强产品可玩性）。

## 风险

- **历史敏感性**（最高）：玩家手写笔记受历史框架约束。规则：在 `/api/case/:caseId/mark-clue` 端点检查 note 文本是否包含明显非历史语境的关键词（如"游戏"/"开挂"/emoji 串）。**未通过则返回 422 + 给出"档案体不接收此类注释"反馈，标记仍然生效（不阻止游戏进程）**。这是 CLAUDE.md §27 "自由文本输入受历史框架约束，不符合的选项给出条件反馈而非直接拒绝"的体现。
- **状态机复杂度**：turnState 加 1-2 字段但保持现有数据流不变。
- **测试覆盖**：必须 5 个新测试（unit + contract），不能低于。

## 状态

`pending` → `/yishuship-design` 进入设计阶段。
