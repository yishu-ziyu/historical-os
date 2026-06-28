# Round 044 — Playwright 视觉验证接入 Spec

> 2026-06-28 / vibero-20260628-002 / design 阶段产出

## 设计原则

1. **验证 ≠ 重写**:Playwright 是测试 runner,不修改产品代码
2. **可重跑 = 关键**:同一 case 状态重跑出相同截图(LLM 必变场景除外)
3. **白盒 + 像素双层**:白盒测 DOM 结构,像素 baseline 兜底视觉退化
4. **本机优先,CI 后续**:headless + macOS 优先,Linux CI 是 round 045+ 议题

## 架构

### 文件结构

```
artifacts/web_story_loop_demo/
  package.json                  ← 新建,声明 dev deps + scripts
  e2e/
    playwright.config.mjs       ← 新建,headless 配置 + baseURL + viewport
    visual.spec.mjs             ← 新建,6 个场景测试
    fixtures/
      cases/
        einstein-1933.json      ← 新建,固定 case 种子(避免 LLM 输出变化污染 baseline)
      baseline/
        01-briefing.png         ← 新建,baseline 截图
        02-situation.png        ← 新建
        03-aftermath.png        ← 新建
        04-marked-clue.png      ← 新建
        05-archive-cabinet.png  ← 新建
        06-reset.png            ← 新建
      diff/                     ← 跑测试时自动生成,失败 diff.png 落这里
```

### 数据流

```
pnpm test:visual
  ↓
playwright.config.mjs 启动 headless Chromium
  ↓
启动 dev server (port 8892, cd artifacts/web_story_loop_demo && node server.mjs)
  ↓
playwright 注入 scripts
  ↓
visual.spec.mjs 按顺序跑 6 个 test:
  test("01 情报卡"):   goto / → 等 .intel-card[hidden=false] → 截图
  test("02 态势面板"): POST /api/turn/start → 等 .situation-room → 截图
  test("03 Aftermath"): POST /api/turn/aftermath → 等 .aftermath[hidden=false] → 截图
  test("04 标记线索"): 模拟点击 .clue-item + input.note → 截图
  test("05 档案柜"):   click #archiveToggle → 等 .archive-panel[hidden=false] → 截图
  test("06 重置"):     POST /api/case/reset → 等 .intel-card 重渲染 → 截图
  ↓
每个 test 截图后调 pixelmatch 对比 baseline/
  ↓
pixel diff > 0.5% → test 失败,diff 落 diff/<name>.png
```

### 接口签名(visual.spec.mjs 暴露给 playwright)

```js
// 启动 + 截图 + baseline 比对,封装成一个 helper
async function captureAndCompare(page, name, baselinePath, opts = {})

// 固定 case 种子:从 fixtures/cases/einstein-1933.json 读取
// 注入到 window.__CASE_SEED__,避免 LLM 输出变化
async function injectCaseSeed(page, fixturePath)
```

### pixel diff 工具选型

- `pixelmatch` (16kb, npm) — 标准库,1.61+ Playwright 自带
- 不引入额外图像处理库
- diff 算法:CIE LAB 色彩空间(比 RGB 容差更接近人眼)

### LLM 输出不可控问题

**根因**:MiniMax-M3 真模型每次输出都不同,即使相同 prompt
**对策**:
1. 用 `MODEL_MOCK=1` env 走 mock 路径(server 已支持 fallback)
2. 6 个场景**全用 mock 数据**(fixtures/cases/einstein-1933.json 写死完整 case)
3. 视觉验证不等于模型验证,模型验证留给 turn_cycle.test.mjs(白盒)
4. 后续 round 045+ 再考虑"真模型 + 输出稳定"方案

> **调整原 PM 决策**:原本"用真模型",现在改为"mock + 固定 fixtures"。理由:像素 diff 在 mock 数据下才有意义。

## 实现拆解

### Step 1:基础设施
**完成标准**:`pnpm install` 能装上;`pnpm test:visual` 能启动

- 新建 `artifacts/web_story_loop_demo/package.json`:
  - devDependencies: `playwright@1.61.1` + `pixelmatch`
  - scripts: `test:visual` `test:visual:update`
- 新建 `artifacts/web_story_loop_demo/e2e/playwright.config.mjs`:
  - `headless: true`
  - `viewport: { width: 1440, height: 900 }` (桌面端,项目没做 mobile)
  - `baseURL: http://127.0.0.1:8892`
  - `webServer`: 自动启动 `node server.mjs`,env 注入 `MODEL_MOCK=1`
- 装 dev deps (用 pnpm,不是 npm——符合全局规则)

### Step 2:固定 case fixtures
**完成标准**:fixtures/cases/einstein-1933.json 包含 1 完整 case(含 6 状态变更点)

- 从现有 server.mjs 里提取一个真实跑通的 case state
- 写到 JSON,覆盖 6 个截图场景所需的状态

### Step 3:Playwright 截图脚本
**完成标准**:visual.spec.mjs 6 个 test 全部存在,每个能跑通并截图

- 写 captureAndCompare(page, name, baseline) helper
- 写 injectCaseSeed(page, fixture) helper
- 6 个 test case(每场景一个)

### Step 4:Baseline 截图
**完成标准**:6 张 baseline.png 存在 + 像素非 0

- 第一次跑 `pnpm test:visual:update` 自动生成 baseline
- 视觉目检:baseline 截图显示正确的 UI(情报卡 / 态势面板 / Aftermath / 标记线索 / 档案柜 / 重置)

### Step 5:跑通 + 验证
**完成标准**:`pnpm test:visual` 6 个全过,每个截图与 baseline diff < 0.5%

- 跑一次 `pnpm test:visual`,确认 6 个全过
- 如果 fail,看 diff.png,确认是 LLM 输出变化(本 round 已切 mock,理论上不会) 还是 baseline 不准

## 验收标准(可观察指标)

1. ✅ `pnpm test:visual` 命令在 30 秒内跑完 6 个场景
2. ✅ 6 个 baseline.png 文件存在,像素总和 > 0
3. ✅ 重跑 `pnpm test:visual`,6 个 test 全 PASS(无 diff 超阈值)
4. ✅ baseline/ 目录在 git 里,e2e/diff/ 在 .gitignore 里
5. ✅ pixelmatch 在 6 个测试中实际被调用(grep 验证)
6. ✅ 视觉目检:6 张 baseline 截图里能看到正确的 UI 元素
   - 01:情报卡有编号 / 日期 / 来源 / 正文 / 矛盾点
   - 02:态势面板有节点 + 行动选项
   - 03:Aftermath 有叙事文本 + 状态变更列表
   - 04:至少 1 条线索被标记(高亮)+ 笔记 textarea 有内容
   - 05:档案柜展开,4 个文件夹可见
   - 06:回到首屏,briefingSection 重新显示

## 风险 + 缓解

| 风险 | 缓解 |
|------|------|
| Playwright 系统依赖未装(Chromium 下载) | `pnpm exec playwright install chromium` 解决,失败时给明确报错 |
| mock 数据跟产品代码 schema 不同步 | 复用 turn_cycle.test.mjs 里的 fixtures(已经存在) |
| 像素 baseline 在不同 OS 显示差异 | 锁定 macOS,Linux CI 不在本 round 范围 |
| Playwright 装到全局污染 | 项目级 package.json + .gitignore 已设 |