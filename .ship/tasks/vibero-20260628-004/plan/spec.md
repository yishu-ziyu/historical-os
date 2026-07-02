# Round 047 设计 Spec

## 三件补强

### 1. 开场序列（Opening Cinematic）

替换当前 `#turnEmptyState` 的静态文案。新流程：

```
[页面加载]
  ↓ (检测 sessionStorage 'htd_seen_intro')
  ├─ 已看过 → 直接显示 desk + "启动值班" 按钮
  └─ 没看过 → 播放开场序列
       ↓
       Stage A: 黑屏 + 打字机声（CSS 动画模拟，无音频）
                "柏林 · 1933年10月17日 · 23:47"
       Stage B: 一行红字渐入
                "异常已检出 — 历史档案 #B-XX-1933-0417"
       Stage C: 电报体渐入（打字机效果）
                "ALBERT EINSTEIN
                 STATUS: NOT DEPARTED
                 LAST SEEN: BERLIN
                 BASELINE: SHOULD HAVE LEFT 1933-09"
       Stage D: 一句话钩子
                "他本该已离开。他没有。世界线开始漂移。"
       Stage E: 世界线漂移条首次动画 — 0σ → +0.5σ（绿色 → 琥珀色）
       Stage F: desk UI 渐入 + "启动值班" 按钮
                sessionStorage 标记已看过
```

**实现**：在 `index.html` 加 `#openingCinematic` overlay；在 `turn_cycle.js` 加 `playOpeningIfNeeded()` 函数；在 `style.css` 加 keyframes。

**控制**：右下角"跳过"按钮（小，不抢戏）。

### 2. 世界线漂移指示器（Worldline Drift Indicator）

顶部常驻一条横向条，位于 `.desk-header` 下方。

```
┌──────────────────────────────────────────────────────────┐
│  WORLDLINE DRIFT                                          │
│  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●  │
│  0σ                  +1σ        [+2.3σ]      +3σ      +5σ │
│  ← 真实历史              当前位置 →                       │
│                          ↑ 累计偏移 +2.3σ                 │
└──────────────────────────────────────────────────────────┘
```

**计算**：从 case state 读取 `stateChangeHistory.length` 和 `riskOverall`：
```js
driftSigma = (stateChangeHistory.length * 0.4) + (riskOverall * 0.3)
```
- 0σ = 绿色（接近真实历史）
- 1-2σ = 琥珀色（轻度分叉）
- 3-4σ = 红色（重大分叉）
- 5σ+ = 深红（世界线已不可逆）

**触发**：每回合 `renderAftermath` 后更新；首次开场序列动画到 0.5σ。

**前端**：独立 DOM 元素 `#worldlineDrift`，独立渲染函数 `renderWorldlineDrift()`。不依赖 turn cycle 内部 state，只读 case state API。

### 3. 回合后果可视化（Stakes Panel）

Aftermath 段顶部增加一个 stakes summary：

```
┌──────────────────────────────────────────────────────────┐
│  本回合后果                                               │
│  ─────────────────────────────────────────────────────── │
│  世界线偏移   +0.4σ      累计 +2.3σ                       │
│  风险等级     中          ↑ 上升 1 级                      │
│  下一回合     柏林日报出刊 · 1933-10-20                   │
│  ─────────────────────────────────────────────────────── │
│  你撬动了：爱因斯坦从「公共活跃」→「犹豫中」                │
└──────────────────────────────────────────────────────────┘
```

**计算**：
- 本回合偏移 = 本回合新增 stateChanges 数 × 0.4
- 累计偏移 = stateChangeHistory.length × 0.4 + riskOverall × 0.3
- 风险等级 = riskOverall 的中文映射
- 撬动 = 从 stateChanges 里取 `visibility === 'player_visible'` 的第一条

**位置**：`renderAftermath` 函数顶部插入，在 narrative 之前。

## 文件改动清单

### `index.html`
- 加 `#openingCinematic` overlay（黑屏容器）
- 加 `#worldlineDrift` 顶部漂移条
- 保留所有现有结构

### `turn_cycle.js`
- 加 `playOpeningIfNeeded()`
- 加 `renderWorldlineDrift(driftSigma)`
- 加 `renderStakesPanel(aftermath, caseState)`
- 修改 `renderAftermath()` 在顶部插入 stakes panel
- 修改 `startNewTurn()` 完成后调用 `renderWorldlineDrift()`
- 修改 `toggleMarkClue()` 等不破坏现有逻辑
- `DOMContentLoaded` 启动时调 `playOpeningIfNeeded()`

### `style.css`
- 加 `.opening-cinematic` 全屏覆盖样式
- 加 `.worldline-drift` 顶部条样式（横条 + 渐变色 + 刻度）
- 加 `.stakes-panel` 后果面板样式
- 加 `@keyframes` 打字机、渐入、漂移动画

## 不动的东西

- `server.mjs` — 后端零改动
- `marked_clue_state.test.mjs` / `server.test.mjs` / `frontend_contract.test.mjs` — 测试零改动
- 现有 `intel-card` / `situation-room` / `aftermath` 渲染逻辑 — 只在 aftermath 顶部插入，不改原结构
- LLM prompt — 完全不动
- 档案柜 — 完全不动

## 验证

1. `node --check turn_cycle.js` — 语法
2. `node --test` 现有测试不退化
3. 启动服务器，浏览器打开，看开场序列播放
4. 完成一回合，看漂移条移动 + stakes panel 显示
5. 刷新页面，确认开场不重播（sessionStorage）
6. 检查档案柜、标记线索仍工作
