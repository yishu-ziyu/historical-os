# Round 044 — Playwright 视觉验证接入

## 用户原话
> "直接开干 Playwright 视觉验证接入(我之前推荐的那个)"

## 来源
- 项目上一轮(round 043)DEVLOG.md 自留的风险:
  > "浏览器视觉验证需要 Playwright，留 round 044+ 接入"
- 上一轮做完 marked-clue-state 端到端测试全过(41 in-scope 全绿)，
  但纯白盒测试 + agent 自评，缺少真浏览器端到端视觉确认

## Grill me 答到的关键信息

| 问题 | 答案 | 影响 |
|------|------|------|
| 颗粒度 | 回合三段(情报卡 / 态势面板 / Aftermath)+ 核心交互(标记线索 + 档案柜) | 6 个截图场景 |
| 验收方式 | 像素 baseline 对比(严格) | 需生成 baseline.png，diff > 0.5% 报警 |
| 运行模式 | headless 自动跑 | 不开浏览器，CI 友好 |
| 模型状态 | 真模型(MiniMax-M3) | 复用 round 039 已接的 Anthropic-compatible 配置 |
| 像素容差 | 0.5% | 严苛但接 LLM 必变，会产生 diff 报告 |

## 当前路线阶段
PM Intake → Design → Dev(loop)→ QA → Handoff