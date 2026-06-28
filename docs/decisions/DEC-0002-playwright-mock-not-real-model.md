# DEC-0002: Round 044 Playwright 视觉验证用 mock + 固定 fixtures 而非真模型

## Context

Round 044(Playwright 视觉验证接入)PM intake 时,用户对 Done Criteria 选了
**「像素 baseline 对比(严格)」**,且选了**「用真模型(接 MiniMax-M3)」**。

design 阶段发现两个选择互相矛盾:
- 真模型(MiniMax-M3)在 Anthropic-compatible 接口下,即使是相同 prompt,
  每次输出也有 5-15% 的 token 差异(round 039 实测)
- 像素 baseline 对比要求截图字节级别一致

让真模型生成的内容进入像素 baseline 等于**第一次跑通的截图被锁定**,
后续每次跑都触发 diff 报警,失去验证意义。

## Options Considered

### A. mock + 固定 fixtures(本 round 选这个)
- 6 个场景用 server.mjs 已支持的 fallback 路径 + JSON 写死的 case state
- baseline.png 锁定的是产品 UI,而非模型输出
- 缺点:不验证模型,只验证 UI

### B. 真模型 + 第一次跑固化 baseline
- 跑一次 Playwright,真实模型生成的截图作为 baseline.png
- 后续跑接受 0.5% 容差,大概率 100% 误报
- 缺点:验证无效,等于没有验证

### C. 真模型 + 输出稳定化
- 接入 few-shot + temperature=0 + seed 锁定
- 范围扩大到 2-3 倍,且需要 round 039 之外的 LLM 配置调研
- 缺点:本 round 范围爆炸

### D. DOM 断言而非像素对比
- 用 selector 断言关键 DOM 元素存在
- 用户在 PM intake 时明确拒绝了此选项(选了"严格")

## Decision

**选 A**。理由:
1. 用户首选"严格",但严格在真模型下不成立,需要在两个偏好里权衡
2. mock + 固定 fixtures 仍能验证"产品代码改了之后 UI 是否退化"(核心目标)
3. 真模型验证由 turn_cycle.test.mjs 已有 mock + 偶尔真模型回归覆盖
4. 接受 spec.md 里明确写的偏差

## Consequences

- spec.md 和 plan.md 明确写明"用 mock"
- 用户审 plan.md 时需要接受这个调整
- 后续 round 045+ 若用户想要"真模型视觉验证",需要先解决 LLM 输出稳定性(round 039 之外的议题)
- 白盒测试(turn_cycle.test.mjs 等 41 个)继续覆盖真模型路径,无需重复

## Related

- spec: `.ship/tasks/vibero-20260628-002/plan/spec.md`
- plan: `.ship/tasks/vibero-20260628-002/plan/plan.md`
- 风险:round 044 done criteria #6 的"视觉目检"要求产品 UI 在 mock 数据下完整渲染