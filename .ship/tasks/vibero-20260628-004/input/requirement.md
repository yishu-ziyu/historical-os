# Round 047 — 实现需求

## 用户原话
> "给你全部的修改和思考权限，按照你的思路来打造这款游戏，我明天起床验收"

## AI 接管决策
基于 round 046 PM decision，本轮实现三件事：
1. 开场序列（opening cinematic）
2. 世界线漂移指示器（worldline drift indicator）
3. 回合后果可视化（stakes panel）

## 范围
**In**: `artifacts/web_story_loop_demo/{index.html, turn_cycle.js, style.css}` 三个前端文件
**Out**: `server.mjs` / schema / 现有测试不动

## 完成标准
1. `node --check turn_cycle.js` 通过
2. `node --test turn_cycle_state.test.mjs turn_cycle.test.mjs` 不退化（已知 3 个 baseline fail 不计入）
3. 启动 `PORT=8892 node server.mjs`，浏览器打开能看到开场序列
4. 现有标记线索、档案柜、三段回合仍工作
