# PM Decision: historical-archives

> 2026-06-28 / 由 yishuship 协议层在 round 042 接入时回填

## 决策：做

理由：用户已经在 TODO.md round 041 记录任务完成（即 4 张肖像 + 3 印章 + 档案柜 + dialog modal 全部落地）；现在只是把这个已完成的设计 spec 升级为正式 yishuship 任务目录，让后续引用能查到。

## 范围判断

PM 视角的取舍：
- **做**：把 spec.md 升级为完整 task 目录（input / pm / control / e2e）
- **不做**：重写 spec.md（已经写好了，不要为 protocol 而 protocol 改设计稿）
- **不做**：补 e2e 报告（设计 spec 阶段没有 e2e 报告，强行补会失真；写一个"spec-only，无 e2e"的占位说明即可）

## 优先级

P2（已完成任务，不阻塞 round 042 的 yishuship 接入工作）。

## 风险

- **历史敏感性**：本任务涉及的真实历史人物（爱因斯坦 / 普朗克）必须按 CLAUDE.md 档案体处理；任何"伪造档案描述"或"AI 生图替代肖像"都违反产品承诺
- **scope drift**：本目录的回填不应触发任何代码改动，只补协议层文件
- **milestone 命名**：用 `round_041_archive_vault_shipped` 而不是 `round_041_archive_vault`，因为这是已完成任务

## 状态

`done` —— 不再进入 loop，仅作为已完成 task 留存。
