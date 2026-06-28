# Task: historical-archives

> 来源：TODO.md round 041 / 2026-06-28
> Task ID：historical-archives（round 041 升级为正式 yishuship 任务时用 slug 而非 vibero-YYYYMMDD-NNN，因为这是回填 41 轮历史决策；新任务从 round 042 起使用完整 ID）

## 原始需求

用户原话（TODO.md round 041 摘要）：
> 完成历史档案素材功能（方案 B 分层）。下载 4 张 Wikimedia 公开域肖像（爱因斯坦 1921、普朗克 c1910、1911 索尔维会议合影、普朗克晚年版）。3 个 inline SVG 印章（DPG、PTR、普鲁士科学院）。HTML 档案柜侧栏（4 个文件夹，11 个文件项）。HTML dialog modal 显示档案描述。视觉风格保持情报档案 OS（深木色 + 金色 + 等宽字体）。所有数据由档案体手写描述，零 AI 生图，零虚假历史感。

## 范围

### 包含
- 真实公开域肖像 4 张：爱因斯坦 1921、普朗克 c1910、1911 索尔维会议合影、普朗克晚年版
- inline SVG 印章 3 个：DPG（柏林物理学会）、PTR（帝国物理技术局）、普鲁士科学院
- HTML 档案柜侧栏：4 个文件夹 / 11 个文件项 / CSS details+summary
- HTML `<dialog>` modal 显示档案描述（手写预定义，非 LLM 生成）
- 视觉风格沿用情报档案 OS：深木色 + 金色 + Courier 等宽
- 零 AI 生图，零虚假历史感

### 不包含
- 真实档案扫描件（公开域找不到 1933 学会档案原件）
- 玩家上传 / 自定义档案
- 档案柜拖拽 / 排序
- LLM 生成档案描述（避免成本 + 一致性风险）

## 来源

- `../TODO.md` round 041 条目
- `../logs/` 中 round 041 笔记（如存在）
- `../agents/` 2026-05-18 调研：einstein_1933_historical_anchor / os_interface_case_research

## PM 决策

见 `pm/decision.md`。

## 设计 spec

见 `plan/spec.md`（已存在，round 041 写的设计稿）。

## 计划

见 `plan/plan.md`（实施步骤可从 spec.md 推导，本目录保留此引用即可，不需要单独 plan.md）。
