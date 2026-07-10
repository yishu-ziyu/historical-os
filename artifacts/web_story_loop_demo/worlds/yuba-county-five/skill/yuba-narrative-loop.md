# Yuba Narrative Loop

## 这是尤巴县五人世界的 Loop 系统。

它定义了"叙述者 + 调查员 + 目击者"三个 Agent 如何协作，
通过多轮循环，将一个档案文件"生长"成一个可交互的叙事帧序列。

---

## 核心概念

Loop 的核心是"反馈循环"。不是单次输出，而是反复迭代：

```
输入: 档案文件 (world-config.yaml + evidence_catalog)
  ↓
Round 1: Narrator 生成初始叙述帧
  ↓
Round 2: Investigator 提取矛盾，设计决策点
  ↓
Round 3: Witness 生成目击者证词片段
  ↓
Round 4: Investigator 校准 sigma 值与物证对应关系
  ↓
Round 5: Narrator 整合所有输出，生成最终帧序列
  ↓
输出: 可渲染的叙事帧 (JSON)
```

每一轮的输出都是下一轮的输入。每一轮都有明确的"验收标准"。
如果某轮的输出未通过验收，该轮的输出被标记为"需要修正"，
对应的 Agent 重新运行一轮。

---

## 各轮次详细定义

### Round 1: Narrator - 初始叙述帧

**Agent**: narrator.md

**输入**:
- world-config.yaml (世界定义)
- evidence_catalog (物证列表)
- act1/frames.md (第一幕参考帧)

**任务**: 生成 3 个初始叙述帧，覆盖第一幕的关键节点。

**验收标准**:
- [ ] 每个帧包含 narrative（≤200字档案体文字）
- [ ] 每个帧至少引用一个 evidence_catalog 中的物证 ID
- [ ] 每个帧的 sigmaDelta 在合理范围内（-0.1 到 +0.3）
- [ ] 没有发明不在 evidence_catalog 中的物证
- [ ] tone 从 "archive" 开始，随 sigma 升高向 "suspicious" 过渡

**通过条件**: 5项全部满足

---

### Round 2: Investigator - 矛盾提取与决策点设计

**Agent**: investigator.md

**输入**: Round 1 的叙述帧

**任务**: 为每个叙述帧识别至少 2 个矛盾点，为每个矛盾设计 2-4 个决策选项。

**验收标准**:
- [ ] 每个帧至少 2 个矛盾点
- [ ] 每个矛盾点有 2-4 个决策选项
- [ ] 每个选项附带 sigma 值
- [ ] sigma 值的分布合理（从低到高，不是随机跳）
- [ ] 每个选项引用至少一个物证 ID
- [ ] sigma 最高的选项必须对应一个未打开的档案缝隙

**通过条件**: 6项全部满足

---

### Round 3: Witness - 目击者证词

**Agent**: witness.md

**输入**: Round 2 的决策点 + 相关物证

**任务**: 为每个决策点生成至少 1 个目击者证词片段。

**验收标准**:
- [ ] 每个证词是碎片化的（≤200字第一人称）
- [ ] 每个证词包含一个与主线矛盾的关键细节
- [ ] 每个证词包含一个刻意遗漏的内容
- [ ] 证词的可靠性评分在 0.3-0.8 之间（不是 0，也不是 1.0）
- [ ] 至少一个证词提到了"婴儿"或"第六个人"

**通过条件**: 5项全部满足

---

### Round 4: Investigator - Sigma 校准

**Agent**: investigator.md

**输入**: Round 1-3 的全部输出

**任务**: 校准所有 sigma 值。确保 sigma 值与历史影响力成幂律关系。

**校准公式**:
```
sigma = base_sigma × (historical_impact_factor)

其中:
- base_sigma = 决策选项的基础偏移值（0.05 - 1.90）
- historical_impact_factor =
    - 影响 1-2 人的选择: 0.7
    - 影响 3-5 人的选择: 1.0
    - 影响超过 5 人的选择: 1.3
    - 改写历史认知的选择: 1.5
    - 涉及政府/军方掩盖的选择: 1.8
```

**验收标准**:
- [ ] 所有 sigma 值经过幂律校准
- [ ] 最高 sigma 选项（改写历史认知）不超过 2.0
- [ ] 最低 sigma 选项（接受官方解释）不低于 0.05
- [ ] sigma 值与 archive_gaps 的"深度"匹配

**通过条件**: 4项全部满足

---

### Round 5: Narrator - 最终帧整合

**Agent**: narrator.md

**输入**: Round 1-4 的全部输出

**任务**: 将所有输出整合为完整的叙事帧序列。每个帧包含:
- frameId
- act
- tone
- sigma（累计值）
- narrative
- evidenceRefs
- archiveGaps
- visualCue
- decisionOptions（来自 Round 2）
- witnessTestimony（来自 Round 3）

**验收标准**:
- [ ] 输出是有效的 JSON
- [ ] 每个帧的 narrative 连贯（与前后帧形成叙事弧线）
- [ ] sigma 值在整个帧序列中递增（除玩家选择降低 sigma 的分支外）
- [ ] 至少有一个"终极分歧" -- sigma >= 1.5 的选项
- [ ] 至少有一个"沉默" -- 某个档案缝隙永远不被打开
- [ ] 输出可直接被前端 index.html 消费（schema 匹配）

**通过条件**: 6项全部满足

---

## 打回规则

- 任何一轮未通过验收 → 自动打回该轮 → 该 Agent 重新运行
- 同一 Agent 连续 2 次未通过同一验收标准 → 升级为人工审查
- 5 轮循环用尽仍未全部通过 → 停止并报告哪些验收标准未通过及原因

## 循环终止条件

1. 所有 5 轮全部通过验收 → 输出最终帧序列
2. 同一验收标准连续 2 次未通过 → 停止，报告
3. 5 轮循环用尽 → 停止，报告当前最佳输出
4. 用户手动终止 → 保存当前进度
