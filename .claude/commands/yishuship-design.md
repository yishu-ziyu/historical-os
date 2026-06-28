---
description: yishuship design — 设计阶段。从 PM 决策产出 spec.md 和 plan.md
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

设计阶段。读取 task 目录里的 PM 决策，产出可执行的 `plan/spec.md` 和 `plan/plan.md`。

## 触发条件

- `state.yaml` 的 `phase` 是 `design`
- `activeTask` 不为 null
- `.ship/tasks/<activeTask>/pm/decision.md` 存在

## 第 0 步：检查 + 读决策

```bash
node tools/yishuship_status.mjs
cat .ship/tasks/$ACTIVE/pm/decision.md
cat .ship/tasks/$ACTIVE/input/requirement.md
```

## 第 1 步：写 spec.md

`plan/spec.md` 必填 4 节：

```markdown
# <Task Name> - Spec

## 设计原则
1. <one-liner>
2. <one-liner>

## 架构 / API / 数据流
<具体到文件名 + 接口签名>

## 实现拆解
<按 Step 拆，标完成标准>

## 验收标准
<可观察的指标，每条单独一行>
```

参考已有 spec：`.ship/tasks/historical-archives/plan/spec.md` 是 round 041 的好范例。

## 第 2 步：写 plan.md

`plan/plan.md` 是 /loop 的输入。格式：

```markdown
# Plan: <Task Name>

## Goal
<一句话>

## Done Criteria (must all pass)
1. <Testable criterion>
2. <Testable criterion>
3. <Testable criterion>

## Scope
- In: <what's included>
- Out: <what's explicitly excluded>

## Files Touched
- <path>: <why>

## Stop Conditions
- Max iterations: 5
- Same failure 2x → stop and escalate
- Regression → stop and report
- No progress 2x → split task
```

Vague goals like "improve the chat" or "fix the bugs" are not goals. They are topics for a PM intake conversation. （来自 CLAUDE.md §15.2）

## 第 3 步：写 decisions 记录

如果有架构决策，写到 `docs/decisions/DEC-NNNN-<slug>.md`（CLAUDE.md §14.10）：

```markdown
# DEC-NNNN: <title>
## Context
## Options Considered
## Decision
## Consequences
```

## 第 4 步：更新 state.yaml

```yaml
phase: loop
lastSync: <今天>
```

**不要碰** `completedMilestones` —— 那是 /handoff 的工作。

## 第 5 步：汇报 + 自动进 loop

```
[plan.md: <path>]
[decisions: <DEC-NNNN 列表或 none>]

下一步：/loop "<plan.md Goal 一句话>"
```

按 CLAUDE.md §14.3，design 完成时**自动进 loop**。但 /loop 命令本身要求显式触发，所以这里给出"建议命令"，不自动执行。

## 红线

- **绝不写实现代码** —— design 阶段产出文档
- **绝不在 spec 里出现"实现细节无关的扩展"** —— 5 个文件改 3 个，不要列 20 个
- **绝不让 scope 蔓延** —— PM 决策说 OUT 的，spec 里不出现
- **绝不调用 /loop** —— design 不直接跳 loop，必须让用户确认 plan
