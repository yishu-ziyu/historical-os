# 案卷转叙事技能 · Case-to-Narrative Skill

## Skill 定义

这是一个可复用的任务模板，定义了如何将一个 case-library 案件文件转化为可交互的叙事帧序列。

## 触发条件

输入: 一个 case-library/ 目录下的案件文件路径（.md 文件）

## 执行流程

```
Step 1: 读取案件文件
Step 2: CaseReader 提取叙事要素
Step 3: NarrativeArchitect 生成初始叙事框架
Step 4: ArchiveVerifier 验证档案忠实度
Step 5: SigmaCalibrator 校准 sigma 值
Step 6: QualityAuditor 全局质检
Step 7: 输出最终 JSON
```

## 各步骤的 Prompt

### Step 1 读取

```
你是一个档案阅读员。阅读以下案件文件，提取其结构：
- 案件概要
- 关键时间线
- 矛盾报告
- 档案缝隙
- 物证记录
- 游戏设计钩子

将提取的内容保存为结构化 JSON，字段名与 case-reader.md 中定义的格式一致。
```

### Step 2 提取叙事要素

```
你是 CaseReader。基于以下结构化数据，提取叙事要素：

<输入 Step 1 的 JSON>

输出格式与 case-reader.md 中定义的 JSON 格式一致。
特别关注：
1. 哪些矛盾最适合作为第一决策点？
2. 哪些档案缝隙是最深的（深度 4-5）？
3. 这个案子最适合什么叙事风格（archive-realism / cold-war-paranoia / occult-horror / bureaucratic-nightmare）？
```

### Step 3 生成叙事框架

```
你是 NarrativeArchitect。基于 CaseReader 提取的叙事要素，设计三幕叙事框架。

<输入 Step 2 的 JSON>

要求：
1. Act 1 (3-5帧): 建立认知，sigma 0.0 → 0.3
2. Act 2 (5-8帧): 打开裂缝，sigma 0.3 → 1.0
3. Act 3 (3-5帧): 真相/幻灭，sigma 1.0 → 最高
4. 至少 3 种结局
5. 每个决策点至少 2 个选项
6. 至少一个"不可逆"选择
```

### Step 4 验证档案忠实度

```
你是 ArchiveVerifier。验证以下叙事框架是否忠实于原始案卷。

<输入 Step 3 的 JSON>

原始案卷: <案件文件路径>

输出格式与 archive-verifier.md 中定义的 JSON 格式一致。
```

### Step 5 校准 Sigma

```
你是 SigmaCalibrator。校准以下叙事框架中的 sigma 值。

<输入 Step 4 的 JSON>

校准公式:
sigma = base_sigma × historical_impact_factor × narrative_weight

historical_impact_factor:
- 影响 1-2 人: 0.8
- 影响 3-10 人: 1.0
- 影响 10-100 人: 1.3
- 影响 100-1000 人: 1.5
- 影响 >1000 人或改变历史进程: 1.8

narrative_weight:
- 玩家主动选择型决策: 1.0
- 被动揭示型决策: 1.2
- 不可逆选择: 1.4
- 改写认知型揭示: 1.6
```

### Step 6 全局质检

```
你是 QualityAuditor。对以下叙事框架进行全局质检。

<输入 Step 5 的 JSON>

原始案卷: <案件文件路径>

输出格式与 quality-auditor.md 中定义的 JSON 格式一致。
```

### Step 7 输出最终 JSON

```
将以下所有步骤的输出整合为最终的叙事帧序列 JSON：

<输入 Step 1-6 的全部 JSON>

输出格式:
{
  "caseId": "<案件ID>",
  "caseTitle": "<案件名称>",
  "frames": [
    {
      "frameId": "<帧ID>",
      "act": "act1|act2|act3",
      "tone": "archive | suspicious | exposed",
      "sigma": 0.0-2.0,
      "narrative": "<档案体叙述，≤200字>",
      "evidenceRefs": ["ev-xxx"],
      "archiveGaps": ["ag-xxx"],
      "visualCue": "<镜头语言描述>",
      "decisions": [
        { "id": "<决策ID>", "text": "<选项文字>", "sigmaDelta": 0.0-2.0, "evidence": ["ev-xxx"], "consequence": "<后果简述>" }
      ],
      "witnessTestimony": [
        { "witnessId": "<目击者ID>", "text": "<证词>", "reliability": 0.0-1.0 }
      ]
    }
  ],
  "endings": [
    { "id": "<结局ID>", "sigmaRange": "0.0-0.4", "title": "<结局标题>", "description": "<结局描述>" }
  ],
  "sigmaArc": {
    "description": "<sigma 变化曲线说明>",
    "keyInflectionPoints": [
      { "frameId": "<帧ID>", "sigma": 0.0-2.0, "trigger": "<触发条件>" }
    ]
  }
}
```

## 评分标准

Skill 执行后，用以下标准评分输出质量：

| 维度 | 权重 | 评分标准 |
|------|------|---------|
| 档案缝隙覆盖率 | 0.30 | 每个缝隙至少在一个决策点中被触及 |
| Sigma 值与历史影响力 | 0.20 | 符合幂律分布 |
| 虚构与真实的交织 | 0.30 | 有明确的交织点 |
| 前端可渲染性 | 0.20 | 输出符合前端 schema |

## 迭代规则

- 评分 < 70: 打回 Step 2 重新运行
- 评分 70-84: 微调后通过
- 评分 >= 85: 直接通过
- 同一案件连续 3 次评分 < 70 → 升级为人工审查
