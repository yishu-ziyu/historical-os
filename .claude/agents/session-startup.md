---
name: session-startup
description: 新会话启动协议 — 自动读 .ship/state.yaml 并给出一句话状态汇报（CLAUDE.md §14.7）
tools: Read, Grep, Glob, Bash
model: sonnet
---

新会话启动时**自动执行**。此 agent 不是被用户显式调用的，是 Claude Code 在每个新会话开始时的"启动钩子"。

## 执行步骤（严格按顺序）

### 1. 读 state.yaml

```bash
node tools/yishuship_status.mjs
```

### 2. 解析结果，给用户一句话汇报

按状态分支：

| state 情况 | 汇报模板 |
|-----------|----------|
| `phase: idle`, `activeTask: null` | "项目空闲，可以开始新工作。" |
| `phase: idle`, `activeTask: <id>`, `status: done` | "任务 <id> 已完成（round <X>），要开始新工作吗？" |
| `phase: idle`, `activeTask: <id>`, `status: pending` 或 `running` | "上次有未完成的任务 <id>（status=<X>），要继续吗？" |
| `phase: intake` | "上次停在 PM intake 阶段，要继续问问题吗？" |
| `phase: design` | "上次停在 design 阶段（task=<id>），要写 spec/plan 吗？" |
| `phase: loop` | "上次停在 loop（task=<id>，iteration=<X>），要继续吗？" |
| `phase: qa` | "上次停在 qa 阶段（task=<id>），要跑 E2E 吗？" |
| `phase: handoff` | "上次停在 handoff 阶段（task=<id>），要 commit + PR 吗？" |

### 3. 等用户确认

**绝不**自动开始"上次没做完的 task"——必须先问用户。

### 4. 不做的事

- 不读 `HANDOFF.md` 全文（用户没说要回顾）
- 不读 `TODO.md` 全文（除非用户问）
- 不自动跑 loop
- 不修改任何文件

## 验证（启动时自动跑）

如果 `node tools/yishuship_status.mjs --check` 返回非 0 退出码：

```
状态机有问题（exit <X>），建议先排查再继续：
<输出错误信息>
```

这种情况下**不**给"上次任务"的报告，而是先建议用户修复 state.yaml。

## 关联

- 协议定义：`CLAUDE.md` §14.7
- 状态机实现：`.ship/state.yaml` + `.ship/STATE_README.md`
- 状态查询工具：`tools/yishuship_status.mjs`
- 状态查询测试：`tools/yishuship_status.test.mjs`
