# Godot Demo Prompt v0.1 - 架空历史模拟 OS / 爱因斯坦第一案

## 任务目标

请在 Godot 中实现一个最小可跑 2D UI Demo，用于展示“架空历史模拟 OS”的第一案第一屏。

这不是完整游戏，不需要真实世界模拟，也不需要联网。目标是做一个可以点击、拖拽、展示信息层级的交互原型。

## 产品背景

产品不是传统 Galgame，也不是单一调查游戏，而是一个“架空历史模拟 OS”。

第一案：

> 1933 年，爱因斯坦没有离开德国。

玩家打开系统后，不是看到 App 启动器，而是进入一个“历史异常值班工作台”。

第一屏范式：

> 情报工作台式为主，OS 式元素为辅。

## Demo 核心体验

玩家第一分钟应该感受到：

1. 我进入了一个正在运行的历史 OS。
2. Intel Desk 通知我：爱因斯坦没有离开德国。
3. 这和真实历史基准发生冲突。
4. 我可以通过 Timeline / Map / Archives / Source Verification / Command 五种动作介入。
5. 窗口可以拖拽，像 OS 工作台。

## 技术建议

使用 Godot 4.x。

建议场景结构：

```text
Main.tscn
└── CanvasLayer / Control Root
    ├── TopBar
    ├── WindowManager
    │   ├── IntelDeskWindow
    │   ├── TimelineWindow
    │   ├── MapWindow
    │   ├── ArchivesWindow
    │   └── RiskWindow
    └── NotificationArea
```

如果已有窗口系统，可以复用；否则实现一个简单可拖拽 Panel：

- 每个窗口有标题栏。
- 鼠标按住标题栏可拖动。
- 有最小化按钮即可，不必完整实现缩放。
- 默认布局固定，但用户可以自由拖拽。

## 默认布局

```text
┌────────────────────────────────────────────────────┐
│ Historical OS | 1933-03-XX | Baseline Drift: HIGH  │
├───────────────┬────────────────────────┬───────────┤
│ Timeline      │ Intel Desk              │ Map       │
│ 异常节点       │ 主情报卡                 │ 相关地点   │
│ 倒计时压力     │ 五个动作 + 弱推荐          │ 路线/标记  │
├───────────────┴────────────────────────┴───────────┤
│ Archives / Source Credibility / Risk Alerts        │
└────────────────────────────────────────────────────┘
```

具体窗口默认位置：

- TopBar：顶部，高 40px。
- Intel Desk：居中最大，宽约 42%，高约 55%。
- Timeline：左侧，宽约 25%，高约 55%。
- Map：右侧，宽约 25%，高约 55%。
- Archives：底部左侧，宽约 55%，高约 28%。
- Risk / Source Credibility：底部右侧，宽约 35%，高约 28%。

## 视觉风格

关键词：

- 历史 OS
- 情报工作台
- 深色界面
- 低饱和琥珀色 / 绿色状态灯
- 打字机/终端感，但不要太赛博朋克
- 文件夹、档案卡、未读情报、风险标签

建议颜色：

```text
Background: #101214
Panel: #181b1f
Panel Border: #2c333a
Text Primary: #e8e0cf
Text Muted: #9c9588
Amber Alert: #d6a94f
Green OK: #78a878
Red Risk: #b85c5c
Blue Link: #6f91b8
```

## TopBar 内容

顶部状态栏显示：

```text
HISTORICAL OS
Case: EINSTEIN-1933-A
System Date: 1933-03-27
Baseline Drift: HIGH
Unread: 1
```

## Intel Desk 主窗口

标题：

```text
Intel Desk / Urgent Dispatch
```

内容采用双层文案。

### 上层：沉浸式情报报告

```text
URGENT / BERLIN SOURCE B-17

Subject: Albert Einstein
Status: Still in Germany
Location Confidence: 0.72
Risk: Historical divergence detected

Message:
Subject E remains within German territory.
Expected departure window has closed.
Unknown party may have intervened.
```

### 下层：系统解释

```text
System Note:
In the baseline history, Albert Einstein did not return to Germany after Hitler's rise in 1933.
Current timeline indicators suggest he remains near Berlin / Caputh.

Please determine whether this is:
- source error
- archive inconsistency
- deliberate misinformation
- timeline divergence
```

### 弱推荐

```text
Suggestion:
Before taking direct action, verify both source credibility and baseline records.
```

### 五个动作按钮

按钮文案：

1. `Open Timeline`
2. `Open Map Trace`
3. `Search Archives`
4. `Verify Source B-17`
5. `Send Field Directive`

点击按钮后不需要复杂逻辑，只需要：

- 对应窗口闪烁或置顶。
- 在 NotificationArea 显示一条反馈。
- 可选：改变 Intel Desk 底部的“Current Focus”。

反馈示例：

```text
Timeline focus: March-April 1933 divergence window highlighted.
```

## Timeline 窗口

标题：

```text
Timeline / Baseline vs Current
```

显示 4-5 个节点：

```text
1933-01-30  Hitler appointed Chancellor
1933-03-XX  Einstein expected not to return to Germany
1933-03-27  [ANOMALY] Subject E still traced near Berlin
1933-04-07  Law for the Restoration of the Professional Civil Service
1933-10-XX  Baseline: Einstein joins Princeton IAS
```

呈现方式：

- 异常节点用 Amber 高亮。
- 显示一条小提示：`Baseline mismatch detected`。

## Map 窗口

标题：

```text
Map / Relevant Locations
```

可以先不用真实地图，用简化示意图或列表地图。

地点：

- Berlin
- Caputh
- Antwerp
- De Haan
- Princeton

显示关系：

```text
Baseline Route: Germany → Belgium → UK → USA
Current Trace: Berlin / Caputh unresolved
```

## Archives 窗口

标题：

```text
Archives / Records to Verify
```

显示待核验证据卡片：

1. `Prussian Academy resignation record`
2. `Caputh property search report`
3. `Passport / border crossing record`
4. `Newspaper clipping: anti-Einstein campaign`
5. `Institute for Advanced Study correspondence`

每张卡显示状态：

- `missing`
- `unverified`
- `baseline only`
- `current timeline conflict`

## Risk / Source Credibility 窗口

标题：

```text
Risk & Source Credibility
```

显示：

```text
Source B-17 Reliability: Medium
Signal Integrity: Unknown
Propaganda Risk: High
Police Surveillance Risk: High
International Rescue Network: Disrupted
Ethical Sensitivity: Severe
```

必须包含严肃提示：

```text
Historical sensitivity notice:
This case involves antisemitic persecution, state violence, exile, and academic purges. Treat all interventions as high-risk.
```

## 交互要求

最低要求：

- Demo 可以启动。
- 所有窗口可见。
- 至少 Intel Desk、Timeline、Map、Archives、Risk 五个窗口能拖拽。
- 五个按钮可点击，并触发简单反馈。
- 窗口有未读/高亮状态。
- 不需要保存状态。
- 不需要真实模拟。
- 不需要美术资源。

## 不要做

- 不要做完整游戏循环。
- 不要做复杂国家模拟。
- 不要做恋爱 Galgame UI。
- 不要把内容写成轻松名人八卦。
- 不要编造真实档案编号。
- 不要把纳粹迫害背景轻浮化。

## 成功标准

Demo 成功标准：

1. 玩家第一眼知道：这是一个历史 OS / 情报工作台。
2. 玩家第一眼知道：爱因斯坦没有离开德国，这是异常。
3. 玩家能看到四类上下文：时间、空间、证据、风险。
4. 玩家能点击五个动作。
5. 玩家能拖拽窗口，感到这是一个 OS 式工作台。

