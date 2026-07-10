# Loop 控制器 · Loop Controller

## 角色定义

Loop 控制器是案卷库叙事引擎的编排器。它管理 CaseReader → NarrativeArchitect → ArchiveVerifier → SigmaCalibrator → QualityAuditor 的循环流程。

## 流程图

```
                    ┌──────────────┐
                    │  CaseReader  │
                    │ (Step 1-2)   │
                    └──────┬───────┘
                           │ 输出: 结构化叙事要素
                           ▼
                    ┌──────────────┐
                    │NarrativeArch │
                    │ (Step 3)     │
                    └──────┬───────┘
                           │ 输出: 叙事框架
                           ▼
                    ┌──────────────┐
                    │ArchiveVerify │
                    │ (Step 4)     │
                    └──────┬───────┘
                           │ 输出: 核验报告
                           ▼
                    ┌──────────────┐
                    │SigmaCalibrat │
                    │ (Step 5)     │
                    └──────┬───────┘
                           │ 输出: 校准后 JSON
                           ▼
                    ┌──────────────┐
                    │QualityAudit  │
                    │ (Step 6)     │
                    └──────┬───────┘
                           │ 输出: 审计报告
                           ▼
                    ┌──────────────┐
                    │ Loop 控制器  │
                    │ (Step 7)     │
                    └──────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
           通过                       不通过
              │                         │
              ▼                         ▼
        输出最终 JSON            打回对应 Agent
```

## 循环管理规则

### 轮次管理
- 最大轮次: 5
- 每轮开始声明 "Cycle N/5"
- 记录每轮的通过/失败状态

### 停止条件

| 条件 | 动作 |
|------|------|
| QualityAuditor overallScore >= 75 | 通过，输出最终 JSON |
| 同一 Agent 连续 3 次未通过 | 停止，升级为人工审查 |
| 5 轮用尽 | 停止，输出当前最佳版本 + 失败报告 |
| ArchiveVerifier 发现档案矛盾 | 打回 NarrativeArchitect |
| SigmaCalibrator 发现分布不合法 | 打回 NarrativeArchitect |
| 用户手动终止 | 保存当前进度 |

### 状态追踪

每轮循环记录：
```yaml
cycle: N
caseId: <案件ID>
status: running | passed | failed | escalated
failedAgents: [<失败过的Agent列表>]
scores: {
  caseReader: <分数>,
  narrativeArchitect: <分数>,
  archiveVerifier: <分数>,
  sigmaCalibrator: <分数>,
  qualityAuditor: <分数>
}
```

## 与 DSPy 的接口

当 Loop 完成 3 次以上的迭代后，可以将以下数据输出为 DSPy 训练集：

```yaml
training_data:
  input: "<原始案件文件>"
  gold_output: "<通过质检的叙事 JSON>"
  failed_outputs: ["<未通过的版本>"]
  feedback: "<哪一步失败了，为什么>"
```

DSPy 将使用这些数据自动优化各 Agent 的 prompt。

## 当前激活的案件

- Phase 1 (独立世界): yuba-county-five (独立 Loop，不走此控制器)
- Phase 2 (案卷库): 全部 11 个案件

## 执行指令

当收到 "run loop <caseId>" 指令时：
1. 读取案件文件
2. 按流程依次执行 7 个步骤
3. 每步完成后检查验收标准
4. 不通过则打回修正
5. 通过则进入下一步
6. 最终输出结构化 JSON 到 worlds/<caseId>/ 目录
