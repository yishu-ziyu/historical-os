---
description: yishuship 路由脑 — 根据当前 phase 和用户请求判断下一步该进哪个 phase
allowed-tools: Read, Grep, Glob, Bash
model: sonnet
---

yishuship 路由中枢。本命令**不做事**，只读 `.ship/state.yaml` 判断下一步。

## 第 0 步：读状态

```bash
cat .ship/state.yaml
node tools/yishuship_status.mjs
```

## 路由表

| 当前 phase | 用户动作 | 路由到 |
|------------|----------|--------|
| `idle` | 用户没说话 / "继续" | 等用户输入新需求 |
| `idle` | "做个 XX" / "加个 YY" | `/yishuship-intake` |
| `intake` | PM 已问完 | `/yishuship-design` |
| `design` | plan.md 写完 | `/loop <plan 摘要>` 自动进 loop |
| `loop` | ALL GREEN | `/yishuship-qa` |
| `qa` | QA 通过 | `/yishuship-handoff` |
| `handoff` | PR merged | 写 `phase: idle` 回到等待 |
| 任意 | "看看 / 了解一下" | 不进 phase，留在对话调研 |
| 任意 | "帮我 review 这段代码" | 不进 phase，留 review |

## 自动入口

| 触发词 | 路由到 |
|--------|--------|
| `/yishuship-auto` / "做完整流程" | `/yishuship-intake` 启动（要求用户给完整需求） |

## 不要做的事

- 不要在路由阶段改任何文件
- 不要给"模糊请求"立刻进 loop —— 必须先 intake
- 不要在 `idle` 阶段自动开始"上次没做完的 task" —— 必须先问用户"上次有未完成的任务，要继续吗？"

## 汇报格式

```
[phase: <当前>]
[activeTask: <id 或 null>]
[next step: <建议>]

<reasoning 一句话>
```

例：
```
[phase: idle]
[activeTask: null]
[next step: 等用户输入新需求]

当前无活跃任务，可以开始新工作。
```
