# Spec: marked-clue-state v0.1

> 2026-06-28 / round 043 / yishuship design 阶段

## 设计原则

1. **真实感 > 视觉密度**（继承 CLAUDE.md 全局原则）
2. **最小后端改动**：只加一个端点 + 一个 case state 字段
3. **DOM 优先**：标记状态用 `.marked` class 表达，状态来源是 case state
4. **历史框架约束**：note 不接收非历史语境，反馈而非拒绝

## 数据流

```
Player click "标记" button
       ↓
turn_cycle.js: postMarkClue(clueId, action)
       ↓
POST /api/case/:caseId/mark-clue
       ↓
server.mjs: 验证 note → 写入 caseState.markedClues → 返回
       ↓
turn_cycle.js: 更新 turnState.markedClues + DOM
       ↓
Next turn: renderBriefing 读 turnState.markedClues → 对应 clue 显示"已标记"
```

## API 契约

### POST /api/case/:caseId/mark-clue

Request:
```json
{
  "clueId": "clue-001",
  "action": "mark" | "unmark",
  "note": "可选，≤200 字"
}
```

Response 200:
```json
{
  "ok": true,
  "markedClues": {
    "clue-001": { "turnMarked": 1, "note": "" }
  }
}
```

Response 422 (note 不通过历史框架):
```json
{
  "ok": false,
  "error": "档案体不接收此类注释",
  "code": "non_historical_note"
}
```

Response 404: `{ "ok": false, "error": "case not found" }`

## case state 增量

```js
caseState = {
  ...existing fields,
  markedClues: {
    [clueId]: {
      turnMarked: number,
      note: string  // ≤200 字
    }
  }
}
```

## 历史框架校验

```js
const REJECTED_PATTERNS = [
  /\b游戏\b/, /\b开挂\b/, /\b刷分\b/, /\bLOL\b/i, /\bgaming\b/i,
];

function isHistoricalContextNote(text) {
  if (!text) return true;
  return !REJECTED_PATTERNS.some(p => p.test(text));
}
```

## 前端组件改动

### renderBriefing

- 取 `turnState.markedClues`（从 `caseId` 查询时已 sync）
- 对每条 clue：if `markedClues[clue.id]` → 加 `.marked` class + 按钮文字"已标记"
- 已标记线索下显示 `<textarea class="clue-note" maxlength="200">`，值 = `markedClues[clue.id].note`
- textarea 旁边小字提示："档案体注释 · 最多 200 字"
- 提交笔记：blur 或 button "保存笔记" → POST 同端点

### renderAftermath

- 累计：遍历 `turnState.markedClues` 计数
- 本回合：取 `turnState.currentTurnMarkedCount`（提交时累加）

### turnState 增量

```js
turnState = {
  ...existing,
  caseId: null,        // server startTurn 返回时填入
  markedClues: {},      // server 同步过来
  currentTurnMarkedCount: 0,  // 本回合锁定数
}
```

## 验收标准

详见 `plan/plan.md` Done Criteria 1-8。

## 文件改动清单

详见 `plan/plan.md` Files Touched。

## 不做的事

- 跨回合已标记线索侧栏（round 44+）
- 关联图（round 46+）
- localStorage 持久化
- 导出 case state
- 自由行动文本框

## 风险

- 既有 case state 暴露 caseId 的方式未知——dev 阶段第一刀要先确认
- note 校验过严会让玩家困惑——起始用 5 个关键词，文档化在 e2e 报告里
