# Plan: marked-clue-state

## Goal

让玩家在情报卡上的"标记"判断沉淀到 case state，跨回合可见、可加笔记——把 CLAUDE.md §28 "操作有体感"从 DOM 视觉层穿透到数据层。

## Done Criteria (must all pass)

1. **标记持久化**：玩家在 turn 1 点情报卡某条线索"标记"按钮 → 后端 case state 写入 `markedClues[clueId] = { turnMarked: 1, note: '' }`。
2. **跨回合可见**：turn 2 加载新情报卡时，如果新情报卡含 turn 1 标记过的 clueId，**该线索的"标记"按钮自动显示"已标记"状态**（无论该 clueId 在新卡片上叫什么 label——因为可能改写）。
3. **取消标记**：再次点击"已标记"按钮 → 取消 → case state 删除该条。
4. **手写笔记**：每个已标记线索下出现 textarea（≤200 字），提交到后端并持久化。提交时如果 note 含明显非历史语境词（"游戏"/"开挂"/"刷分"等），返回 422 + "档案体不接收此类注释"反馈，标记保留。
5. **Aftermath 显示锁定数**：推演报告（aftermath）显示"本回合锁定 X 条线索 · 累计 Y 条"。
6. **GET /api/case/:caseId 返回 markedClues**：返回值包含 `markedClues` 字段，类型 `{ [clueId: string]: { turnMarked: number, note: string } }`。
7. **新测试全绿**：5 个新测试（unit + contract）全过。
8. **既有测试不退化**：所有现有 server.test.mjs / turn_cycle_*.test.mjs / frontend_contract.test.mjs 仍全过。

## Scope

### In
- `server.mjs` case state 模块加 `markedClues` 字段
- 新端点 `POST /api/case/:caseId/mark-clue`（body: `{ clueId, action: 'mark' | 'unmark', note? }`）
- 新端点 `POST /api/case/:caseId/mark-clue/note`（body: `{ clueId, note }`）—— 或合并到 mark-clue
- `turn_cycle.js` 标记按钮接 API + 笔记 textarea + Aftermath 显示
- 5 个新测试
- `data/spec.md`（如存在）加 `markedClues` schema 描述

### Out
- 跨回合已标记线索侧栏（round 44+）
- localStorage 持久化（已知约束，round 40 已记）
- 标记线索的关联图（round 46+）
- 自由行动文本框（round 44+）
- 历史脉络对比（round 45+）
- 玩家导出 case state

## Files Touched

| 文件 | 为什么 |
|------|--------|
| `artifacts/web_story_loop_demo/server.mjs` | 加 markedClues 字段 + 新端点 + note 校验 |
| `artifacts/web_story_loop_demo/turn_cycle.js` | 标记按钮接 API + textarea + Aftermath 显示 |
| `artifacts/web_story_loop_demo/turn_cycle_state.test.mjs` 或新文件 | unit test：case state 写读 markClue |
| `artifacts/web_story_loop_demo/server.test.mjs` 或新文件 | unit test：新端点 + note 校验 |
| `artifacts/web_story_loop_demo/frontend_contract.test.mjs` 或新文件 | contract test：标记 → 切回合 → 仍显示 |
| `data/spec.md`（如存在） | 加 schema 段 |
| `.ship/state.yaml` | phase / activeTask / milestone |
| `TODO.md` | round 043 条目 |
| `HANDOFF.md` | round 043 节 |
| `DEVLOG.md` | round 043 条目（如果存在） |

## Architecture

### 后端 case state 增量

```js
// 在 case state 对象里加：
markedClues: {
  [clueId]: {
    turnMarked: number,  // 第几回合标记的
    note: string         // 玩家手写笔记（≤200 字）
  }
}
```

### API 端点

```
POST /api/case/:caseId/mark-clue
Body: { clueId: string, action: 'mark' | 'unmark', note?: string }
Response 200: { ok: true, markedClues: {...} }
Response 422: { ok: false, error: '档案体不接收此类注释' }  // note 不通过历史框架
Response 404: { ok: false, error: 'case not found' }
```

### 历史框架校验

```js
const REJECTED_PATTERNS = [
  /\b游戏\b/, /\b开挂\b/, /\b刷分\b/, /\bLOL\b/i, /\bgaming\b/i,
  // 后续可加；不引入 emoji 检测（避免编码复杂度）
];

function isHistoricalContextNote(text) {
  if (!text) return true;
  return !REJECTED_PATTERNS.some(p => p.test(text));
}
```

### 前端改动

1. `renderBriefing` 加载时从 case state 取 markedClues，对每条 clue 渲染对应状态
2. 标记按钮 onClick：
   ```js
   await fetch(`/api/case/${caseId}/mark-clue`, {
     method: 'POST', body: JSON.stringify({ clueId, action: 'mark' })
   })
   ```
3. 笔记 textarea：已标记线索下显示，提交时 POST 同端点带 `note` 字段
4. Aftermath 渲染：取 `turnState.markedClues` 计数，显示"本回合锁定 X · 累计 Y"

### 状态机

turnState 加 2 个字段：
- `caseId: string | null` —— 当前 case ID
- `markedClues: object` —— 从 case state 同步过来

## Stop Conditions

- Max iterations: 5
- Same failure 2x → stop and escalate
- Regression → stop and report
- No progress 2x → split task

## Test Plan (具体)

1. **unit**: `markClue(caseId, clueId)` → `getCase(caseId).markedClues[clueId]` 存在
2. **unit**: `unmarkClue(caseId, clueId)` → 字段被删
3. **unit**: `note 含"游戏" → 422`
4. **contract**: POST /api/case/X/mark-clue `{clueId:'c1', action:'mark'}` → 200 + state 写入
5. **contract**: 标记 c1 → 重置 case → 再走一次 turn cycle → 加载 c1 时显示已标记

## 风险预案

- **note 校验过严** → 起始用 5 个关键词；用户可建议补充
- **后端 case state 没暴露 caseId** → 查 server.mjs case 模块；如果用全局 caseState（单 case），前端需要 server 暴露当前 caseId
- **既有测试断** → 严格按 contract test 写，不改既有 API shape
