---
description: yishuship auto — 完整流程自动化。要求用户给完整需求，从 intake 一路跑到 handoff
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
model: sonnet
---

完整 yishuship 流程。从 intake 一路跑到 handoff。**仅在用户明确说"做完整流程"/"完整跑一遍"/"/yishuship-auto"时触发**。

## 触发条件

- 用户显式说"auto"、"完整跑"、"全流程"
- 用户给了**完整需求**（不需要再问问题）
- 不满足 → 退到 `/yishuship-intake`

## 第 0 步：警告

告诉用户：

```
/yishuship-auto 会自动跑完整 5 个 phase（intake → design → dev → qa → handoff）。
一旦进入 loop，外部请求（除了 stop 条件）不会被处理。
建议把任务拆到 "明确范围 + 明确 Done Criteria" 再用 auto。
```

用户确认后才继续。

## 第 1 步：intake（自己）

跳过 AskUserQuestion（用户已经给了完整需求），直接写 task 目录：

```bash
TASK_ID="vibero-$(date +%Y%m%d)-001"
mkdir -p .ship/tasks/$TASK_ID/{input,pm,plan,control,e2e}
```

把需求写到 `input/requirement.md`，决策写到 `pm/decision.md`（decision: 做 / scope: in+out / priority / risk）。

更新 `state.yaml`：
```yaml
phase: design
activeTask: $TASK_ID
```

## 第 2 步：design（自己）

写 `plan/spec.md`（4 节：设计原则 / 架构 / 拆解 / 验收）+ `plan/plan.md`（Goal / Done Criteria / Scope / Files / Stop Conditions）。

更新 `state.yaml`：
```yaml
phase: loop
```

## 第 3 步：dev（调用 /loop）

`/loop "<Goal 一句话>"`，让全局 loop 命令接管。

**注意**：auto 阶段本身不实现代码，是编排。/loop 派 builder / checker。

监控 stop conditions，循环 5 轮用尽或失败时升级给用户（auto 阶段不擅自重试）。

## 第 4 步：qa（自己）

按 `/yishuship-qa` 的方式跑 E2E，写 `e2e/report.md`。

更新 `state.yaml`：
```yaml
phase: handoff
```

## 第 5 步：handoff（自己）

按 `/yishuship-handoff` 的方式 commit + 更新里程碑 + 清空 activeTask。

更新 `state.yaml`：
```yaml
phase: idle
activeTask: null
```

## 第 6 步：汇报

```
[auto: complete]
[task: $TASK_ID]
[commits: <hash 列表>]
[milestone: <slug>]

完整流程结束。idle 状态，等下一个任务。
```

## 红线（auto 阶段最重要）

- **绝不**在 5 轮 loop 失败后自动重试 —— 必须升级
- **绝不在 qa 失败时进 handoff** —— 回到 loop
- **绝不在 commit 阶段用模糊 message** —— 必须符合 CLAUDE.md §12 格式
- **绝不在 auto 中接新需求** —— 新需求开新 task
- **绝不在用户没显式说 auto 时自启** —— auto 是"用户主动 opt-in"的强模式
