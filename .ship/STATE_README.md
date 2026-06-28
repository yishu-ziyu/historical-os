# .ship 状态机说明

本目录是 yishuship 持久状态机的落地位置。协议定义在 `../CLAUDE.md` §14，本文件是协议落地的"字段含义 + 操作规则"参考。

## 目录结构

```
.ship/
├── state.yaml                # 全局状态：phase / activeTask / milestones
├── tasks/<task_id>/          # 每个 task 一个独立目录
│   ├── input/requirement.md  # 用户原话 + 来源（rounds 引用）
│   ├── pm/decision.md        # PM 决策（做不做 / 范围 / 优先级 / 风险）
│   ├── plan/spec.md          # 设计 spec（架构 / API / 数据流）
│   ├── plan/plan.md          # 可执行计划（给 loop 的输入）
│   ├── control/run_state.yaml# 任务级状态机（status / iteration / stop reason）
│   └── e2e/report.md         # QA 报告（loop 退出后自动落盘）
└── STATE_README.md           # 本文件
```

## 字段含义

| 字段 | 取值 | 何时变 |
|------|------|--------|
| `phase` | `idle` / `intake` / `design` / `loop` / `qa` / `handoff` | 见 CLAUDE.md §14.2 状态机图 |
| `activeTask` | task ID（目录名）或 `null` | intake 立项时设；handoff 完成时清空 |
| `blocked` | 字符串数组 | 用户决策 / 缺凭据 / 环境问题时填 |
| `lastStopReason` | `success` / `max_iterations` / `same_failure_2x` / `regression` / `no_progress_2x` / `capability_boundary` | loop 退出时由 /loop 命令写 |
| `completedMilestones` | 字符串数组 | 每个 round 完成时追加一条 |
| `lastSync` | `YYYY-MM-DD` | 任何字段变更时更新 |

## 何时读写

- **读**：每次新会话启动，session-startup 必读 `state.yaml`（CLAUDE.md §14.7）
- **写**：仅由 yishuship phase 命令（intake / design / dev / qa / handoff / auto）自动写
- **禁止**：人工手改 `state.yaml` 和 `run_state.yaml`——只读 + 工具写。如果发现状态不对，先 `node tools/yishuship_status.mjs` 排查，再用对应的 phase 命令修正

## 任务 ID 格式

`vibero-YYYYMMDD-NNN`（CLAUDE.md §14.8）。前 41 轮产物不在 task 目录里，从 round 042 起每个新 task 必须有完整目录。

## 阶段切换规则

```
idle → intake   用户说"做个 XX" / "加个 YY" → /yishuship:intake
intake → design PM 决策 = 值得做 → /yishuship:design
design → loop   plan.md 写完 + 立即 /loop（CLAUDE.md §14.3）
loop → qa       ALL GREEN → /yishuship:qa 自动跑 e2e
qa → handoff    QA 通过 → /yishuship:handoff 生成 PR
handoff → idle  PR merged → 自动回到 idle
```

## 失败升级协议

loop 退出的 5 种 stop reason（CLAUDE.md §15.4 + §15.5）：

| 停止原因 | 中枢动作 |
|----------|----------|
| `success` | 进 qa |
| `max_iterations` | 升级给用户，列失败项 + 已尝试方法 |
| `same_failure_2x` | 升级给用户，builder 在猜而不是修 |
| `regression` | 升级给用户，说明改了什么导致回归 |
| `no_progress_2x` | 升级给用户，scope 可能太大，建议拆分 |
| `capability_boundary` | 升级给用户，说明 builder 缺少外部依赖 |

升级信息模板见 `tools/yishuship_status.mjs` 输出。

## 工具

- `tools/yishuship_status.mjs` — 打印当前 phase / activeTask / 活跃 task 的 status
- `node --test tools/yishuship_status.test.mjs` — 状态解析逻辑测试
