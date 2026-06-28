---
description: yishuship dev — 派 builder 实现 plan.md。包装全局 /loop
allowed-tools: Read, Grep, Glob, Bash, Task
model: sonnet
---

开发阶段。**包装全局 /loop**，不重新实现循环逻辑。

## 触发条件

- `state.yaml` 的 `phase` 是 `loop`
- `.ship/tasks/<activeTask>/plan/plan.md` 存在
- 用户说"开始 / 跑起来 / 接着做"

## 第 0 步：检查

```bash
node tools/yishuship_status.mjs
cat .ship/tasks/$ACTIVE/plan/plan.md
cat .ship/tasks/$ACTIVE/control/run_state.yaml
```

如果 `status` 已是 `done` → 报"任务已完成，要进 qa 吗？"，**不要**自动跑 loop。

## 第 1 步：更新 run_state.yaml

```yaml
status: running
iteration: <上一轮 + 1>
startedAt: <now>
```

## 第 2 步：调用全局 /loop

读取 `plan/plan.md` 的 Goal，构造 /loop 的入参：

```
/loop "实现 .ship/tasks/$ACTIVE/plan/plan.md。Done Criteria 必须全部通过。"
```

**注意**：入参里只放 Goal，不放全部 plan.md 内容（避免重复 prompt）。/loop 内部会让 builder 读 plan.md。

## 第 3 步：循环监控

/loop 会自动跑 builder / checker。监控要点：
- **绝不**自己解读 checker 报告 —— 原样转发给 builder
- 同一失败连续 2 轮 → 升级
- regression → 升级
- 5 轮用尽 → 升级

## 第 4 步：loop 退出后

| 退出原因 | 动作 |
|----------|------|
| `success` | 自动转 `/yishuship-qa` |
| `max_iterations` / `same_failure_2x` / `regression` / `no_progress_2x` | **升级给用户**，列失败项 + 已尝试方法（不自动 retry） |
| `capability_boundary` | 升级，说明 builder 缺少什么外部依赖 |

更新 `run_state.yaml`：

```yaml
status: done | failed
iteration: <final>
stopReason: <success | max_iterations | ...>
completedAt: <now>
```

## 红线

- **绝不**自己改代码或测试 —— loop 阶段是 builder 的工作
- **绝不**超过 5 轮
- **绝不**在 loop 跑的时候接新需求 —— 让用户开新 task
- **绝不**修改 `plan/plan.md` —— 改了等于改协议
