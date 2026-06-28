# Plan: Round 044 — Playwright 视觉验证接入

## Goal

为 `artifacts/web_story_loop_demo/` 接 Playwright 视觉验证:6 个场景(回合三段 + 标记线索 + 档案柜 + 重置)用 mock + 像素 baseline 验证 UI 不退化,跑通 `pnpm test:visual` 一条命令。

## Done Criteria (must all pass)

1. `cd artifacts/web_story_loop_demo && pnpm install` 成功,`package.json` + `pnpm-lock.yaml` 生成
2. `pnpm test:visual` 启动 + 跑通 6 个 Playwright test,exit 0
3. `pnpm test:visual` 重跑 2 次,每次都 6/6 PASS(像素 diff < 0.5%)
4. 6 张 `e2e/fixtures/baseline/0[1-6]-*.png` 存在,每张 > 50KB
5. `e2e/diff/` 在 `.gitignore` 里,本地测试失败时生成的 diff.png 不进 git
6. 视觉目检:6 张 baseline 截图显示正确的 UI(情报卡/态势/Aftermath/线索/档案/重置)
7. 整个 task 不修改 `server.mjs` / `turn_cycle.js` / `index.html` / `style.css`(Playwright 是测试层)

## Scope

**In**:
- 新建 `artifacts/web_story_loop_demo/package.json` (Playwright + pixelmatch devDeps)
- 新建 `artifacts/web_story_loop_demo/e2e/playwright.config.mjs`
- 新建 `artifacts/web_story_loop_demo/e2e/visual.spec.mjs` (6 个 test)
- 新建 `artifacts/web_story_loop_demo/e2e/fixtures/cases/einstein-1933.json` (1 个固定 case)
- 新建 6 张 baseline.png
- 改 `.gitignore`(加 `e2e/diff/`)

**Out**:
- 不改 server.mjs / turn_cycle.js / index.html / style.css
- 不接入 GitHub Actions / CI(本机跑通即可)
- 不覆盖移动端 viewport
- 不覆盖动画中间态(只截最终态)
- 不做中英切换测试
- 不写新的白盒测试(已有 41 个 in-scope 覆盖)
- 不调真模型(MiniMax-M3),用 mock + fixtures(LLM 输出不可控 + 像素 diff 不可行)

## Files Touched

- `artifacts/web_story_loop_demo/package.json` — 新建,声明 dev deps + scripts
- `artifacts/web_story_loop_demo/e2e/playwright.config.mjs` — 新建,Playwright 配置
- `artifacts/web_story_loop_demo/e2e/visual.spec.mjs` — 新建,6 场景测试
- `artifacts/web_story_loop_demo/e2e/fixtures/cases/einstein-1933.json` — 新建,固定 case
- `artifacts/web_story_loop_demo/e2e/fixtures/baseline/0[1-6]-*.png` — 新建,6 张 baseline
- `.gitignore` — 加 `artifacts/web_story_loop_demo/e2e/diff/`
- `artifacts/web_story_loop_demo/pnpm-lock.yaml` — 自动生成,锁定依赖版本

## Stop Conditions

- Max iterations: 5
- Same failure 2x → stop and escalate(同一 test fail 2 次,排查 Playwright 接入或 mock 数据)
- Regression → stop and report(如果 baseline 截图本身不对,说明产品代码已退化,这是真信号)
- No progress 2x → split task(若 4/6 baseline 失败 → 拆"先 baseline 后脚本"两阶段)

## 备注:与 PM 决策的偏差

PM intake 时你说"用真模型(MiniMax-M3)",design 阶段调整为"用 mock + 固定 fixtures"。理由:

- 像素 baseline 对比在 LLM 输出变化下不成立(每次内容不同)
- Round 043 已用 mock 完成所有白盒测试,真模型验证不在本 round 范围
- 真模型输出稳定性是 round 045+ 的独立议题

这个偏差在 spec.md 里明确写了。如果你不接受,design 阶段我们可以反向走"先做真模型输出固化(few-shot + temperature 0)",但那会扩大 task 范围到 2-3 倍。建议接受 mock 方案。