---
description: yishuship intake — PM 阶段。从用户模糊需求里提取 5 个关键问题，做 / 不做 / 边界
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
model: sonnet
---

PM intake 阶段。把用户的口头/模糊需求转化为可审查的 task 定义。

## 触发条件

- 用户说"做个 XX"、"加个 YY"、"能不能改 Z"
- `state.yaml` 的 `phase` 是 `idle` 或上一个 phase 已完成
- **不要在用户说"看看"、"了解一下"时触发** —— 那是调研，不是执行

## 第 0 步：检查状态

```bash
node tools/yishuship_status.mjs
```

如果 `activeTask` 不为 null，**先问用户**：上次有未完成的任务（<taskId>），要继续还是开新？

## 第 1 步：读背景

- `TODO.md` — 已有产品判断的"宪法"
- `HANDOFF.md` — 上次会话的最新状态
- `manifest.json` — 现有产物索引
- `.ship/tasks/<上一个 task>/`（如有）— 上一轮的工作目录

## 第 2 步：Grill me — 一次一个问题

不要一次性甩 7 个问题。**一次问 1 个**，等用户答完再下一个。最高 5 个问题就够。

问题模板（按场景选）：

| 场景 | 问题 |
|------|------|
| 需求模糊 | "你看到的是哪个痛点？举一个具体场景" |
| 范围不清 | "MVP 应该包含哪些？哪些明确不做？" |
| 优先级 | "如果只能保留一个功能，是哪个？" |
| 风险 | "最担心做出来什么样子？" |
| 验收 | "怎么算'做好了'？给一个可观察的指标" |

工具：`AskUserQuestion`（一次问一个，按用户节奏来）。

## 第 3 步：写 task 目录

```bash
TASK_ID="vibero-$(date +%Y%m%d)-001"  # 或 slug，如 historical-archives
mkdir -p .ship/tasks/$TASK_ID/{input,pm,plan,control,e2e}
```

写入：
- `input/requirement.md` — 用户原话 + 来源 + Grill me 答到的关键信息
- `pm/decision.md` — PM 决策（**做 / 不做 / 待定** + 范围 + 优先级 + 风险）
- `control/run_state.yaml` — `status: pending / iteration: 0 / stopReason: null`

## 第 4 步：更新 state.yaml

只改三个字段：

```yaml
phase: design
activeTask: <TASK_ID>
lastSync: <今天>
```

其他字段不动。

## 第 5 步：汇报 + 引导到 design

```
[task: <TASK_ID>]
[phase: design]
[decision: <做 / 不做 / 待定>]

PM 决策摘要：
- 范围：<in / out>
- 优先级：<P0 / P1 / P2>
- 风险：<一句话>

下一步：/yishuship-design <TASK_ID>
```

## 红线

- **绝不在 PM 阶段写实现代码** —— 即使用户催
- **绝不"补设定"** —— 模糊就问，不要帮用户脑补
- **绝不让 builder 进 loop** —— 那是 design 阶段之后的事
- **绝不修改已有的 `state.yaml` `completedMilestones`** —— 那是 /handoff 的工作
