# DEC-0001: yishuship 协议全面接入（round 042）

## Context

项目 CLAUDE.md §14-15 详细描述了 yishuship 状态机和 Loop Engineering 协议，但**协议只活在文档里，没有运行层落地**。具体表现：

- `.ship/state.yaml` 不存在（只有空 `.ship/tasks/` 目录）
- `.claude/commands/` 不存在（`/yishuship-*` 7 个命令无法调用）
- `.claude/agents/builder.md` 和 `checker.md` 不存在（项目级 builder/checker 没注册）
- 历史 41 轮工作产物直接落 `artifacts/` + `logs/`，没有 task 目录结构
- `tools/yishuship_status.mjs` 不存在（无法一键看 phase / activeTask / 校验）
- 启动协议 §14.7 只在文档里描述，Claude 不会自动执行

导致：

- 新会话启动时 Claude 不读 state、没有协议感
- 用户说"继续"时 Claude 不知道当前 phase 在哪
- Loop 退出的 5 种 stop reason 没有自动写回 state.yaml
- Builder / Checker 没有项目级约束（如历史敏感性、不动活跃进程、不带 Co-Authored-By）

## Options Considered

### Option A: 仅写文档不动运行层（被否决）

继续维护 CLAUDE.md，但**不**创建任何 `.ship/` / `.claude/commands/` / `tools/` 文件。理由：协议仍只是"人读的约定"，机器执行时还是凭感觉。

### Option B: 全面接通（采纳）

按 CLAUDE.md §14-15 描述，把协议落地到运行层：
- `.ship/state.yaml` + STATE_README
- `.ship/tasks/<id>/` 完整目录结构
- 7 个 `/yishuship-*` 命令
- 项目级 builder / checker agents
- `tools/yishuship_status.mjs` + 测试
- session-startup agent
- 1 个回填 task（historical-archives）

### Option C: 部分接通（被否决）

只建 state.yaml 和 status 工具，不建 commands 和 agents。理由：状态机能查询但不能驱动，没有自动化收益。

## Decision

**采纳 Option B**。一次性把协议层建齐，让"协议"从文档变成可调用的状态机。

具体范围：

1. `.ship/state.yaml`（phase=idle, activeTask=historical-archives, 41 条里程碑）
2. `.ship/STATE_README.md`（字段含义 + 操作规则）
3. `.ship/tasks/historical-archives/`（回填 round 41 工作为完整 task）
4. `.claude/commands/yishuship{,-intake,-design,-dev,-qa,-handoff,-auto}.md`（7 个）
5. `.claude/agents/builder.md` + `checker.md`（项目级，硬约束历史敏感性）
6. `.claude/agents/session-startup.md`（启动协议 agent）
7. `tools/yishuship_status.mjs` + `tools/yishuship_status.test.mjs`（21 测试）
8. `CLAUDE.md` §14.12（Operational binding 表）
9. `docs/decisions/DEC-0001-yishuship-onboarding.md`（本文件）

**不**做的事：

- 不重写已有 spec.md（spec-only 任务，e2e 报告不强补）
- 不补 round 1-40 的 task 目录（历史回填过度；只在 round 41+ 启用 task 结构）
- 不创建 Godot / 浏览器等其它 agent（不在本刀范围）
- 不动 `artifacts/` 下任何已有代码

## Consequences

### 正面

- 新会话启动能自动读 state、给状态汇报
- "继续" / "接着做" / "做完整流程" 三个用户动作有明确的 phase 入口
- 7 个 phase 命令每个都写明触发条件、必读文件、汇报格式、红线
- Builder / Checker 加载项目级硬约束（历史敏感性、不动活跃进程、commit 规范）
- 21 个测试覆盖 YAML 解析 + state 校验，启动时 `--check` 就能发现状态机错误
- 历史 41 轮工作有 task 目录可查（虽然 e2e 报告是 spec-only 占位）

### 负面 / 风险

- 协议层复杂度增加，新会话启动慢一点（多读 6 个文件）
- 7 个 phase 命令本身有"协议膨胀"风险——如果以后只跑其中 1-2 个，命令可能不被发现
- 项目级 builder / checker 与全局 /Users/mahaoxuan/.claude/agents/builder.md / checker.md 命名相同，**可能**在某些 Claude Code 版本里出现歧义
- 21 个测试是白盒测试（验证自己的实现），不是端到端（跑完一个 task 验证 state 是否更新）；后者要等 round 043+ 真实跑过 loop 才能验证

### 后续要做的事（next round 起）

- 任何新 task 必须建 `.ship/tasks/<id>/` 完整目录
- 任何 /loop 跑完必须更新 `run_state.yaml` + `state.yaml`
- 任何 handoff 必须写 `DEVLOG.md` + 更新 `completedMilestones`
- round 042 是 yishuship 协议首次跑通测试；round 043+ 必须用真实 task 验证端到端
