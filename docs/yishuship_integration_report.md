# yishuship 协议接入验收报告

> round 042 / 2026-06-28 / yishuship 协议层首次落地

## 验收结果

| 检查 | 命令 | 结果 |
|------|------|------|
| 状态机解析 | `node tools/yishuship_status.mjs` | ✓ 打印 41 条里程碑 + 当前活跃 task |
| 状态机校验 | `node tools/yishuship_status.mjs --check` | ✓ exit 0 / 校验通过 |
| JSON 输出 | `node tools/yishuship_status.mjs --json` | ✓ 含 phase / activeTask / milestones / validation |
| 测试套件 | `node --test tools/yishuship_status.test.mjs` | ✓ 21/21 通过 |
| 语法 | `node --check tools/yishuship_status.mjs` | ✓ |

## 接入清单

### 状态机层

| 文件 | 内容 | 状态 |
|------|------|------|
| `.ship/state.yaml` | phase=idle, activeTask=historical-archives, 42 条里程碑 | ✓ |
| `.ship/STATE_README.md` | 字段含义 + 阶段切换规则 + 工具说明 | ✓ |
| `.ship/tasks/historical-archives/` | 完整 task 目录（input/pm/plan/control/e2e） | ✓ |
| `.claude/agents/session-startup.md` | 启动协议 agent | ✓ |

### 命令层（7 个 phase 入口）

| 命令 | 作用 | 触发条件 |
|------|------|----------|
| `/yishuship` | 路由脑 | 用户问"下一步做什么" |
| `/yishuship-intake` | PM 阶段 | 用户说"做个 XX" |
| `/yishuship-design` | 设计阶段 | phase=intake 完成后 |
| `/yishuship-dev` | 开发包装 | phase=loop + plan.md 存在 |
| `/yishuship-qa` | QA 阶段 | loop ALL GREEN 后 |
| `/yishuship-handoff` | 交付 | QA 通过后 |
| `/yishuship-auto` | 完整流程 | 用户显式说 auto |

### Agent 层

| Agent | 角色 | 硬约束 |
|-------|------|--------|
| `.claude/agents/builder.md` | 写代码 | tools=Read/Write/Edit/Glob/Grep/Bash |
| `.claude/agents/checker.md` | 检查 | tools=Read/Grep/Glob/Bash（**无 Write/Edit** 硬隔离） |
| `.claude/agents/session-startup.md` | 启动 | tools=Read/Grep/Glob/Bash |

### 工具层

| 工具 | 作用 |
|------|------|
| `tools/yishuship_status.mjs` | 状态查询 + 校验（自写 YAML 子集解析，零依赖） |
| `tools/yishuship_status.test.mjs` | 21 个测试（3 个 suite：real project / YAML parser / 集成） |

### 决策层

| 决策 | 内容 |
|------|------|
| `docs/decisions/DEC-0001-yishuship-onboarding.md` | 接入理由 + Option 对比 + 后果评估 |
| `CLAUDE.md` §14.12 | Operational binding 表（声明协议层文件位置） |

## 验证脚本（端到端）

新会话启动后能跑：

```bash
# 1. 看状态
node tools/yishuship_status.mjs

# 2. 校验状态
node tools/yishuship_status.mjs --check

# 3. 跑测试
node --test tools/yishuship_status.test.mjs
```

## 剩余风险

1. **真实端到端没跑过** —— 21 个测试是白盒（解析 + 校验），不是"完整跑完一个 task 后看 state 是否正确更新"。等 round 043+ 真实跑过一次 loop 才能验证整个 yishuship 状态机的端到端。
2. **项目级 builder / checker 与全局同名 agent 可能的歧义** —— 某些 Claude Code 版本里同时存在全局和项目级同名 agent 时，行为未明确。round 043+ 要观察是否需要改名为 `galos-builder` / `galos-checker`。
3. **7 个 phase 命令的 discoverability** —— 用户不一定知道每个命令的全名。已在命令名里用 yishuship-{phase} 模式方便补全，但仍未在 README 中列出来。
4. **CLAUDE.md §14.7 启动协议依赖 agent 自动执行** —— session-startup.md 是 agent 但 Claude Code 不一定在每次启动时自动调用它。等真实启动一次后观察行为。

## 后续要做的事

- round 043 起任何新 task 必须建 `.ship/tasks/<id>/` 完整目录
- 任何 /loop 跑完必须更新 `run_state.yaml` + `state.yaml`
- 任何 handoff 必须写 `DEVLOG.md` + 更新 `completedMilestones`
- 真实跑过一次 task 后回头复盘协议层是否有需要调整的地方
