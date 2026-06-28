---
description: yishuship qa — QA 阶段。loop ALL GREEN 后跑 E2E 验收
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

QA 阶段。loop 退出 `success` 后跑端到端验收。

## 触发条件

- `state.yaml` 的 `phase` 是 `loop`
- `run_state.yaml` 的 `status` 是 `done`，`stopReason` 是 `success`
- 或用户说"测一下"、"QA"、"验收"

## 第 0 步：检查

```bash
node tools/yishuship_status.mjs
cat .ship/tasks/$ACTIVE/plan/plan.md   # 读 Done Criteria
```

## 第 1 步：决定 E2E 方式

| 项目类型 | E2E 方式 |
|----------|----------|
| Node.js 后端 | `node --test <e2e 测试文件>` + 真实启动 server 跑 curl |
| 浏览器前端 | `npx playwright` 跑关键流程 + 截图存档 |
| Godot | `godot --headless --path <proj> --check-only` + 必要时 `godot --headless --quit-after N` |
| 静态资源 / 文档 | `node --check <files>` + 视觉 / 文本 grep 检查 |

本项目当前是 Node.js Web Demo（`artifacts/web_story_loop_demo/`） + Godot 行走分支原型，QA 主要走 Node 测试 + 浏览器手动验收。

## 第 2 步：跑检查

按"决定的方式"跑。把每条 Done Criteria 的结果写到 `e2e/report.md`：

```markdown
# E2E Report: <Task>

## Done Criteria 逐条核对

### 1. <criterion>
- 命令：<实际跑的命令>
- 输出：<关键行>
- 结论：PASS / FAIL

### 2. <criterion>
...

## 总评
- 通过：N / M
- 失败：<列出>
- 风险：<列出>
```

## 第 3 步：判断通过 / 失败

| 结果 | 动作 |
|------|------|
| 全部通过 | 自动转 `/yishuship-handoff` |
| 部分失败 | 写 `run_state.yaml status: failed`、升级给用户 |
| 环境问题 | `blocked: ["<具体环境问题>"]`、升级给用户 |

更新 `state.yaml`：

```yaml
phase: handoff    # 全部通过
phase: loop       # 失败，回到 loop 修
lastSync: <今天>
```

## 第 4 步：汇报

```
[QA: PASS/FAIL]
[Done Criteria: N/M]

<Done Criteria 逐条结果>
<失败项 / 风险 / 建议>

下一步：/yishuship-handoff
```

## 红线

- **绝不**"差不多就行" —— Done Criteria 没全过就是没过
- **绝不**修改 plan/plan.md 的 Done Criteria
- **绝不**直接 commit / push —— QA 只是验收，不动 git
- **绝不**跳过 E2E 报告 —— 即便是空跑也要有 e2e/report.md 占位
