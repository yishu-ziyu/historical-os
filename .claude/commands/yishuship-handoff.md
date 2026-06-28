---
description: yishuship handoff — 交付阶段。QA 通过后生成 PR / commit / 更新里程碑
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

交付阶段。QA 通过后整理产物、生成 PR、回填里程碑。

## 触发条件

- `state.yaml` 的 `phase` 是 `qa`
- `e2e/report.md` 存在且全部 Done Criteria 通过
- 或用户说"提交"、"ship"、"PR"

## 第 0 步：检查

```bash
node tools/yishuship_status.mjs
cat .ship/tasks/$ACTIVE/e2e/report.md
git status
git diff --stat
```

## 第 1 步：生成 DEVLOG 条目

按 CLAUDE.md §14.9，每次合并都要写一条 `DEVLOG.md`：

```markdown
### <YYYY-MM-DD> — <type>(<scope>): <description>
- What: <做了什么>
- Files: <改了什么文件>
- Risk: <风险 / 已验证项>
```

**写入**：`DEVLOG.md` 追加在文件末尾（不重写历史）。

## 第 2 步：生成 commit

按 CLAUDE.md §12 的 commit message 格式：

```bash
git add <具体文件，不用 git add .>
git commit -m "<type>(<scope>): <description under 50 chars>

<optional body — explain WHY, not what>"
```

常用 scope（CLAUDE.md §12）：
- `(turn)` — 三段式回合循环
- `(runtime)` — HistoricalRuntime
- `(archive)` — 档案素材
- `(model)` — 模型接入
- `(state)` — 状态机
- `(protocol)` — yishuship 协议

**红线**：
- **绝不**用 `git add .` —— 手动列文件，避免误提交 .env / secrets
- **绝不**带 `Co-Authored-By: Claude` trailer（项目偏好，参考全局 feedback）
- **绝不** `--no-verify` 绕过 hook

## 第 3 步：更新里程碑

追加到 `state.yaml`：

```yaml
completedMilestones:
  - <既有>
  - round_0XX_<new_milestone_slug>
```

更新 `TODO.md`：把对应 round 条目标记 `[x]`（如已存在）或新增一行。

## 第 4 步：清空活跃 task

```yaml
phase: idle
activeTask: null
blocked: []
lastStopReason: success
lastSync: <今天>
```

## 第 5 步：汇报

```
[delivered: <commit hash>]
[milestone: <slug>]
[devlog: <DEVLOG.md 行号或内容预览>]

下一步：等用户给新需求
```

## 红线

- **绝不** force push
- **绝不** push 到 main（除非用户显式说）
- **绝不**改 `plan/` 或 `control/` 文件 —— 那是 task 的考古记录
- **绝不**改 `input/requirement.md` / `pm/decision.md` —— 历史决策不可改
