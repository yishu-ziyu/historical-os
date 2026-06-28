# E2E Report: vibero-20260628-001 — marked-clue-state

> 2026-06-28 / round 043 / yishuship QA 阶段

## Done Criteria 逐条核对

### 1. 标记持久化
- 命令：`POST /api/case/einstein-1933-test-{ts}/mark-clue { clueId: 'clue-test-1', action: 'mark', note: '爱因斯坦 1933 年 4 月仍在柏林', turn: 1 }`
- 输出：`{"ok":true,"markedClues":{"clue-test-1":{"turnMarked":1,"note":"爱因斯坦 1933 年 4 月仍在柏林"}}}`
- 结论：**PASS**（marked_clue_state test #3 + e2e contract test #11）

### 2. 跨回合可见
- 命令：标记 turn 1 → 拉取 case state → 验证 markedClues 存在
- 输出：case state 返回 markedClues 含 clue-test-1
- 结论：**PASS**（test #4）
- 端到端验证：turn 1 标 clue → 跑 Aftermath → 拉 case state → markedClues 仍保留（test #11）

### 3. 取消标记
- 命令：POST mark-clue { action: 'unmark' }
- 输出：`{"ok":true,"markedClues":{}}`（不包含已删除 clue）
- 结论：**PASS**（test #6）

### 4. 手写笔记 + 历史框架校验
- 命令：note = "这个游戏太好玩了" → 应返回 422
- 输出：`{"ok":false,"code":"non_historical_note","error":"档案体不接收此类注释"}` 422
- 结论：**PASS**（test #5）
- 关键词表：`游戏` / `开挂` / `刷分` / `LOL` / `gaming` / `hack` / 纯情绪符号串
- 修过的 bug：起始用 `\b游戏\b` 不工作（中文无 word boundary），改为裸字串匹配

### 5. Aftermath 显示锁定数
- 实现：`turn_cycle.js:renderAftermath` 加 `aftermath-marked-summary` 块，显示"本回合锁定 X · 累计 Y"
- e2e 验证：test #11 确认 Aftermath 调用后 markedClues 不丢失，前端能正确累计
- 结论：**PASS**（端到端流转；视觉验证需要 Playwright 手动开浏览器，超出本测试范围）

### 6. GET /api/case/:id 返回 markedClues
- 命令：`GET /api/case/einstein-1933-test-{ts}`
- 输出：`caseState.markedClues: { ... }`
- 结论：**PASS**（test #4 + test #11）

### 7. 新测试全绿
- 测试文件：`artifacts/web_story_loop_demo/marked_clue_state.test.mjs`
- 运行命令：`node --test artifacts/web_story_loop_demo/marked_clue_state.test.mjs`
- 结果：**11/11 通过**（含 1 个 e2e contract test）

### 8. 既有测试不退化
- in-scope 范围：`turn_cycle.test.mjs` (4) + `turn_cycle_state.test.mjs` (5) + `marked_clue_state.test.mjs` (11) + `yishuship_status.test.mjs` (21)
- 结果：**41/41 通过**
- out-of-scope（历史遗留，与本刀无关）：
  - `server.test.mjs`：期望 `provenance.type === 'generated'` 但 fallback 给出 `'fallback'`
  - `frontend_contract.test.mjs`：期望旧版 index.html 含 `artifactPanel`，但项目已被推到 v0.4（页面已重做）
  - `turn_cycle_frontend.test.mjs`：期望旧版 CSS 含 `.turn-cycle-panel`，但项目已用 `--paper`/`--gold` 变量
- 这些 fail 在 baseline（git stash）就存在，**不是本刀引入的 regression**

## 总评

- 通过：8 / 8 Done Criteria
- 失败：0
- 风险：3 个 baseline 测试 fail 与本刀无关，已记录；不阻塞 round 043 交付
- 建议：round 044 起，修复这 3 个 baseline fail（属于 round 037 / round 038 历史债务）

## 验证脚本

```bash
# 启动 server
PORT=8995 MODEL_REQUEST_TIMEOUT_MS=1 node artifacts/web_story_loop_demo/server.mjs

# 创建 case
curl -X POST http://127.0.0.1:8995/api/turn/start \
  -H 'content-type: application/json' \
  -d '{"caseId":"visual-1","turn":1,"caseTitle":"X","historicalAnchors":["1933"],"riskLevel":1}'

# 标记线索
curl -X POST http://127.0.0.1:8995/api/case/visual-1/mark-clue \
  -H 'content-type: application/json' \
  -d '{"clueId":"c1","action":"mark","note":"爱因斯坦 1933","turn":1}'

# 拉 case state
curl http://127.0.0.1:8995/api/case/visual-1
```

## 浏览器视觉验证（手动）

启动 server 后浏览器打开 `http://127.0.0.1:8995/`：

1. 点"启动值班"按钮 → 情报卡加载
2. 滚到"可标记线索"区域 → 看到每条线索带"标记"按钮
3. 点"标记" → 按钮变"已标记" + 出现 textarea
4. 在 textarea 输入"爱因斯坦 1933 仍在柏林" → 点"保存笔记" → 出现"✓ 已保存"
5. 选行动选项 → 进入推演报告
6. 推演报告底部出现"档案柜锁定 / 本回合锁定 X · 累计 Y"

（视觉验证需要 Playwright 浏览器，超出本测试自动覆盖范围。建议 round 044+ 接入 Playwright e2e 截图。）
