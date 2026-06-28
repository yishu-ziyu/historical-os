# 历史档案素材 - 设计 Spec v0.1

> 2026-06-28 / round 41 / 方案 B「分层档案素材」

## 设计原则

1. **真实感 > 视觉密度**：只放拿得到的真实素材，宁缺毋滥
2. **CSS 优先**：能用 CSS 矢量 / 纹理解决的，不下载图片
3. **交互克制**：档案柜是轻量信息架构，不是图片画廊
4. **不破坏 MVP 节奏**：玩家点完情报卡 → 态势分析 → 行动 → 推演的流程不动，档案是装饰层

## 三层素材方案

### 第 1 层：真实公开素材（2-3 张）

**目标**：情报卡顶部 + 档案柜侧栏索引封面

| 素材 | 来源 | 格式 | 用途 |
|------|------|------|------|
| 爱因斯坦 1921 肖像（皇家科学院档案） | Wikimedia Commons `Albert_Einstein_Leopold_Geddes_1921.jpg` | JPG, ~200KB | 情报卡右上方肖像位 |
| 普朗克 1930s 肖像 | Wikimedia Commons `Max_Planck_1930s.jpg` | JPG, ~150KB | 档案柜侧栏人物卡 |
| 爱因斯坦-普朗克 1911 年合影 | Wikimedia Commons `Einstein_and_Planck_3.jpg` | JPG, ~300KB | 档案柜「关键人物」封面 |

**存放路径**：`artifacts/web_story_loop_demo/assets/portraits/`

**License**：CC-BY-SA 或 public domain，使用时在档案柜底部加 credits 行（"Wikimedia Commons / CC-BY-SA"）

### 第 2 层：CSS 矢量 / 纹理（零图片）

**目标**：印章、纹理、装饰边框

| 元素 | 实现方式 | 用途 |
|------|---------|------|
| 柏林物理学会印章 (DPG) | CSS `mask-image` 或 inline SVG（20 行内） | 情报卡右上角 / 推演报告落款 |
| 帝国物理技术局印章 (PTR) | inline SVG | 系统消息背景 |
| 「CLASSIFIED」红色印章 | CSS + 旋转 -3deg（已有） | 情报卡 / 推演 |
| 羊皮纸纹理 | CSS `background-image: linear-gradient` + SVG noise | 整页底色（替换现有 grain） |
| 打字机字体效果 | CSS `font-family: Courier New` + `letter-spacing` | 档案编号 / 元数据 |
| 墨水迹 / 污渍 | SVG filter 或 inline SVG | 随机装饰 |

**注意**：印章不能用「图片」，要用 inline SVG（保留矢量、可变色、易改）。SVG 嵌入到 CSS 或 HTML 即可，零额外请求。

### 第 3 层：档案柜侧栏（轻量信息架构）

**目标**：让玩家感受到「情报值班台有一柜子档案」的存在感，但**不堆砌图片**

#### 侧栏位置

嵌入情报卡 / 推演报告卡片的**右侧**（桌面视图）或**折叠抽屉**（移动视图）

#### 档案柜结构（4 个文件夹）

每个文件夹是 CSS 卡片，可点击展开内容列表。

```
┌─ 档案柜 ─────────────────┐
│ 📁 关键人物                  │
│   • 爱因斯坦 1921 肖像       │
│   • 普朗克 1930s 肖像       │
│   • 爱因斯坦-普朗克 1911 合影│
│                            │
│ 📁 学术机构                  │
│   • 普鲁士科学院 1933 章程    │
│   • 威廉皇帝物理研究所      │
│   • 帝国物理技术局 (PTR)    │
│                            │
│ 📁 时事报纸                  │
│   • 《新柏林日报》1933.04.01│
│   • 《Vossische Zeitung》   │
│   • 学术通讯样例             │
│                            │
│ 📁 内部文件                  │
│   • 值班台操作手册           │
│   • 情报分析模板             │
│   • 审计记录样例             │
└────────────────────────────┘
```

#### 点击行为

- 点击文件夹 → 展开文件列表（CSS-only，不跳转）
- 点击文件名 → 弹出「档案描述面板」（不是真的扫描件，是结构化描述）
  ```
  ┌─ 档案描述 ────────────┐
  │ 标题：普鲁士科学院 1933 章程 │
  │ 日期：1933.04.01         │
  │ 类型：组织文件             │
  │                         │
  │ 描述（模拟档案体文本）：  │
  │ "本章程于 1933 年 4 月   │
  │  1 日修订。明确要求..."  │
  │                         │
  │ [× 关闭]                  │
  └─────────────────────────┘
  ```
- 描述文本是**手写预定义**的（不是 LLM 生成，避免成本 + 一致性）

#### 视觉

- 档案柜本身是 CSS 卡片，`border-left: 3px solid var(--gold)` + 衬线字体
- 文件夹图标用 emoji 📁（避免图片依赖）
- 文件名用打字机字体（Courier New）
- 展开用 CSS `details/summary`（无 JS）

## 实现拆解

### Step 1: 下载真实素材（30 分钟）

用 curl 从 Wikimedia Commons 拉肖像，存到 `assets/portraits/`

### Step 2: 写 inline SVG 印章（20 分钟）

```html
<svg class="seal-dpg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="2"/>
  <text x="50" y="35" text-anchor="middle" font-size="8" fill="currentColor">DEUTSCHE PHYSIKALISCHE</text>
  <text x="50" y="50" text-anchor="middle" font-size="8" fill="currentColor">GESELLSCHAFT</text>
  <text x="50" y="68" text-anchor="middle" font-size="6" fill="currentColor">BERLIN · GEGR. 1845</text>
</svg>
```

### Step 3: CSS 纹理替换（30 分钟）

扩展现有 `.grain` 选择器，加入：
- 羊皮纸纹理（SVG noise data URL）
- 墨迹纹理（多个小 SVG 元素）
- 「打字机」字体加载（System mono fallback 已够）

### Step 4: 档案柜 HTML + CSS（1 小时）

- `index.html` 加 `<aside id="archiveCabinet">` 侧栏
- 4 个 `<details>` 折叠组，每个含 3-5 个文件项
- 档案描述面板用 modal dialog（HTML `<dialog>` 元素，零 JS）

### Step 5: 档案描述文案（30 分钟）

手写 12 条档案描述（每条 50-80 字），按真实档案体风格。

## 文件清单

| 文件 | 类型 | 状态 |
|------|------|------|
| `assets/portraits/einstein-1921.jpg` | JPG | 下载 |
| `assets/portraits/planck-1930s.jpg` | JPG | 下载 |
| `assets/portraits/einstein-planck-1911.jpg` | JPG | 下载 |
| `assets/seals/dpg.svg` | SVG | 新建 |
| `assets/seals/ptr.svg` | SVG | 新建 |
| `style.css` | 编辑 | 加纹理 + 档案柜样式 |
| `index.html` | 编辑 | 加档案柜侧栏 + 档案描述 modal |
| `turn_cycle.js` | 可选 | 弹窗打开/关闭逻辑（用 HTML dialog 元素可不需要） |
| 测试 | - | 视觉验证（不写单元测试，CSS 改动靠浏览器） |

## 不做的事

- ❌ AI 生图（CLI Proxy 默认禁用 + 违反「真实感」承诺）
- ❌ 真实扫描件（公开域找不到 1933 学会档案原件）
- ❌ 玩家上传 / 自定义（不在 MVP 范围）
- ❌ 拖拽 / 排序（不在 MVP 范围）

## 验收标准

PM 视角验收：

1. 打开 `http://127.0.0.1:8892/`，看到三段式回合循环主页面
2. 启动新回合，情报卡显示：
   - 右上角爱因斯坦肖像（真实照片，不是 AI 假图）
   - 「CLASSIFIED」红色印章（CSS）
   - 档案编号 + 日期用打字机字体
3. 页面右侧出现档案柜侧栏
4. 展开「关键人物」文件夹，看到 3 张肖像缩略图
5. 点击文件项，弹出档案描述 modal，含档案体风格的描述文本
6. 关闭 modal，关闭档案柜，回到主流程

## 风险

- Wikimedia 下载的图片可能是高清大图（1MB+），需要压缩到 200KB 以下保证页面加载速度
- 档案柜侧栏可能挤压主流程宽度 → 桌面视图用 flex，移动视图隐藏
- 玩家可能觉得档案柜是「额外的 UI 干扰」 → 默认折叠，玩家主动展开