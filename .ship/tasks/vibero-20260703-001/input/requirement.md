# vibero-20260703-001: P0/P1 改进迭代

## 原始需求

基于三玩家模拟 + narrative quality evals 的发现，进入下一轮 loop 迭代。

## Issue List

### P0-1: 预估偏移与实际偏移不一致
- **问题**: situationRoom 的 estimatedDrift 和 aftermath 的 worldLineShift.turnDelta 严重不符（差距 2-3 倍）。激进选项预估 1.2σ 实际 0.4σ，保守选项预估 -0.1σ 实际 +0.4σ。
- **根因**: situationRoom prompt 和 aftermath prompt 用了不同的偏移评估标准。situationRoom 让 LLM "预估"，aftermath 让 LLM "推演"，但两个 prompt 的偏移档位定义不一致。
- **修复方向**: 在 aftermath prompt 中，要求 LLM 比较"预估偏移 vs 实际偏移"，如果不一致需要说明原因。或者让两个阶段使用同一套偏移评估 prompt。
- **验收**: 5 组 evals 中 drift 维度至少 3/5 通过。

### P0-2: 模型调用失败导致体验断裂
- **问题**: Player B 回合 2 遭遇 fetch failed，fallback 只剩 1 个选项，叙事断裂。9 回合中 1 回合失败（11% 失败率）。
- **根因**: retry 只覆盖 LLM 调用层（超时/5xx），不覆盖网络层（ECONNRESET/fetch failed）。
- **修复方向**: 在 `callModelWithPrompt` 和 `callAnthropicMessages` 的 fetch 层加 retry，对 ECONNRESET 和 fetch failed 也触发 retryWithBackoff。
- **验收**: 模拟 3 回合，无 fetch failed 导致的 fallback。

### P1-1: 偏移累积没有叙事升级
- **问题**: 偏移条在涨，但 narrative 语气没有递进。缺少"因为你之前做了什么，现在更糟了"的累积感。
- **根因**: aftermath prompt 的累积感知规则写在 prompt 里但不够强，LLM 经常忽略。
- **修复方向**: 在 buildAftermathPrompt 中，把累积偏移量直接注入 narrative 要求的第 1 条（前 100 字），用更强的措辞要求 narrative 体现局势严重程度。
- **验收**: 3 回合玩家的 narrative 语气有可感知的递进。

### P1-2: Narrative 截断风险
- **问题**: max_tokens 8000 不够稳定。人味尾行有时被截断。
- **根因**: JSON 结构中 narrative 在最后，如果 LLM 在前面字段上花太多 token，narrative 可能被截断。
- **修复方向**: 在 JSON 格式要求中，明确标注 narrative 必须放在最后且完整输出。或者在 extractJson 的 repairTruncatedJson 中，优先保留 narrative 字段。
- **验收**: 5 组 evals 中 narrative 维度全部通过。

### P2-1: Fallback 模式只有 1 个选项
- **问题**: fallback 的 actionOptions 只有 1 个选项（"继续观察"），失去了策略选择的本质。
- **修复方向**: 在 createFallbackRuntimeResult 中，actionOptions 至少生成 2-3 个选项，即使是从预定义的 fallback 选项中选。
- **验收**: 模拟模型失败场景，fallback 有 >= 2 个选项。

## 优先级排序

1. P0-1（预估偏移不一致）
2. P0-2（模型调用失败）
3. P1-1（叙事升级）
4. P1-2（narrative 截断）
5. P2-1（fallback 选项）

## 验收标准

1. 5 组 evals 中 drift 维度至少 3/5 通过
2. 3 玩家模拟无 fetch failed 导致的 fallback
3. 3 回合 narrative 语气有可感知的递进
4. 5 组 evals 中 narrative 维度全部通过
5. Fallback 模式有 >= 2 个选项

## 范围

- In: server.mjs 的 prompt 工程 + retry 层 + fallback 选项
- Out: 前端 UI 改动、新功能开发
