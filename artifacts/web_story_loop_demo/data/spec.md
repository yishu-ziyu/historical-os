# 情报卡系统数据结构 Spec v0.1

> 2026-06-27 起草。基于 round 035 回合循环设计。

## 总览

三个回合段对应三个数据结构：

```
情报卡 (intel-card) → 态势面板 (situation-room) → 状态变更 (state-changes)
   ↑ 档案体文案             ↑ 节点/连线/风险           ↑ LLM 输出声明
```

## 数据流转

```
Turn N Briefing 阶段：
  intel-card → 展示给玩家 → 玩家标记线索

Turn N Situation Room 阶段：
  situation-room（基于当前 state）→ 生成 action-options → 玩家选择

Turn N Aftermath 阶段：
  LLM 生成叙事 + state-changes 声明 → 引擎执行 state-changes → Turn N+1 的 situation-room 和 intel-card 基于新 state 生成
```

## 四个 Schema 的关系

| Schema | 阶段 | 谁来生成 | 谁来消费 |
|--------|------|---------|---------|
| `intel-card` | Briefing | LLM（档案体 prompt）+ 手工锚定 | 前端渲染 |
| `situation-room` | Situation Room | 引擎从 case state 编译 | 前端渲染态势图 |
| `action-options` | Situation Room | LLM 基于 situation-room 生成 | 前端渲染选项 |
| `state-changes` | Aftermath | LLM 输出（结构化声明） | 引擎执行 → 更新 case state |

## 关键规则

1. **intel-card 的 provenance.type 决定可信度**：generated / unverified / baseline / player_created
2. **state-changes 的 visibility 控制玩家能看到什么**：不是所有状态变更都展示给玩家
3. **situation-room 的 riskIndicators 影响 action-options 的可用性**：高风险时某些选项被移除
4. **historyFlags 贯穿所有层级**：fictional_branch / sensitive_context / archive_provenance_risk 等

## 与现有代码的衔接

现有 `server.mjs` 的 `buildPrompt` 需要扩展为分段 prompt：
- Briefing prompt：生成 intel-card
- Situation Room prompt：生成 action-options（基于当前 state）
- Aftermath prompt：生成 narrative + state-changes

现有 `artifactTypes` Set 需要扩展为 intel-card 类型：
- archive_record / telegram / newspaper / map_marker / timeline_delta / character_profile / risk_notce

## TODO

- [ ] 写 Briefing prompt（生成 intel-card）
- [ ] 写 Situation Room prompt（生成 action-options）
- [ ] 写 Aftermath prompt（生成 narrative + state-changes）
- [ ] 前端渲染 intel-card 的「档案体」UI
- [ ] 前端渲染 situation-room 的态势图
- [ ] 前端渲染 action-options 的选项卡片
- [ ] 引擎执行 state-changes 的状态更新逻辑
