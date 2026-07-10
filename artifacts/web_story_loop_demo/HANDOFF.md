# 架空历史故事游戏 · Handoff Document

> Last updated: 2026-07-10
> Status: Phase 1 complete, Phase 2 partial, Phase 3-4 pending, voxel renderer pending

---

## 1. 项目当前状态

### 已完成

**Phase 1 -- 尤巴县五人独立叙事世界** (100% done)

```
worlds/yuba-county-five/
  world-config.yaml              -- 世界定义：5个角色、8个档案缝隙、9件物证、sigma体系
  agents/
    narrator.md                  -- 叙述者：档案体口吻，200字/帧，不煽情，不解释，只呈现证据
    investigator.md              -- 调查员：4个核心矛盾，每个矛盾4个决策选项，sigma映射
    witness.md                   -- 目击者：乔·肖恩斯证词，不可靠记忆，第一人称碎片
  narrative/
    act1/frames.md              -- 3帧：出发 → 球赛 → 掉头
    act2/frames.md              -- 6帧：弃车 → 搜救 → 肖恩斯 → 空白冬天 → 手表 → 拖车门
    act3/frames.md              -- 3帧：四具尸体 → 加里失踪 → 未结案
  skill/
    yuba-narrative-loop.md       -- 5轮Loop定义（每轮验收标准 + 打回规则）
  frontend/
    index.html                  -- 独立前端：胶片叙事引擎，sigma仪表，决策选项，胶片孔，sigma曲线图
```

- 9 个文件，纯 Markdown + HTML，零框架依赖
- 可在浏览器直接打开 `frontend/index.html` 查看效果（3个预加载帧，可点击决策选项）
- 这个世界的 sigma 指标是"叙事可信度崩塌度"，不是传统的世界线偏移

**Phase 2 -- 案卷库叙事引擎 Agent 系统** (100% done)

```
agents/
  case-reader.md               -- 从案卷提取结构化叙事要素
  narrative-architect.md       -- 三幕叙事框架设计（含3种结局）
  archive-verifier.md          -- 档案忠实度/物证一致性/缝隙深度核验
  sigma-calibrator.md          -- 幂律校准（历史影响力 × 叙事权重）
  quality-auditor.md           -- 5维全局质检
  loop-controller.md           -- 编排器（7步循环 + 停止条件 + 状态追踪）
skill/
  case-to-narrative.md         -- 可复用技能模板（7步流程 + 评分标准）
```

- 7 个文件，定义了完整的 5-Agent 质检管线
- 这些 Agent 的 prompt 可以直接被 LLM 调用

**体素渲染调研** (100% done)

- 结论：Three.js r0.180 + InstancedMesh + 自定义溶解 Shader
- 推荐理由见下方的"技术决策记录"
- 原型尚未实现

### 未完成 / 待修复

**案卷库 Loop 执行失败** (需要修复)

- 11/11 案子全部未通过质量审计
- 根本原因：单次 Agent 调用的上下文窗口不够装下"完整案卷 + 完整三幕叙事 JSON"
- 输出在 Act 2 中被截断，QualityAuditor 报 `narrative is truncated mid-sentence`
- 第一次跑的质量信号是正向的（叙事连贯性 72-85，事实准确性 72-85），内容是对的，只是没写完
- 修复方案：把 Loop 从"一次过"改成"分段装配" -- 每幕单独输出，在 Loop 控制器里拼装

**体素场景原型** (尚未开始)

- 调研已完成，技术选型确定
- 需要实现：Three.js InstancedMesh 渲染器 + 溶解 Shader + 档案缝隙触发机制
- 入口：用户在主界面上点击档案缝隙，从胶片风格切换到体素风格

---

## 2. 项目结构总览

```
artifacts/web_story_loop_demo/
├── case-library/                    # 11个案子的案卷文件（原始素材）
│   ├── README.md                    # 案卷库索引
│   ├── cold-war-anomalies/          # 5个冷战异常案子
│   ├── anomalous-events/            # 2个异常现象案子
│   ├── classified-operations/       # 3个机密行动案子
│   └── unsolved-cases/              # 2个未解悬案
├── worlds/
│   └── yuba-county-five/            # 尤巴县五人独立叙事世界
│       ├── world-config.yaml
│       ├── agents/
│       ├── narrative/
│       ├── skill/
│       └── frontend/
├── agents/                          # 案卷库叙事引擎 Agent 定义（通用）
│   ├── case-reader.md
│   ├── narrative-architect.md
│   ├── archive-verifier.md
│   ├── sigma-calibrator.md
│   ├── quality-auditor.md
│   └── loop-controller.md
├── skill/
│   └── case-to-narrative.md         # 可复用技能模板
├── data/
│   ├── spec.md                      # 情报卡系统数据结构 spec
│   └── *.schema.json                # 4个 JSON schema
├── film-reel-prototype.html         # 胶片叙事引擎原型（v2，12帧）
├── turn_cycle.js                    # 回合循环引擎
├── server.mjs                       # 后端服务器
└── *.test.mjs                       # 测试文件
```

---

## 3. 技术决策记录

### 为什么不用 CSS 3D 做体素渲染

- 性能天花板 ~1,000-5,000 体素，崩解效果有限
- Firefox 对 `transform-style: preserve-3d` 有已知兼容性问题
- 我们的档案缝隙场景需要 ~200-500 体素 + 实时崩解动画，CSS 3D 在边缘

### 为什么不用 Voxel.js 生态

- 7 年没维护，依赖 Three.js 0.56（当前 0.180）
- npm 包安装失败，无文档
- 没有任何一个 voxel-* 包有崩解/溶解效果

### 为什么不用 WebGPU

- 浏览器覆盖率 ~75-80%，Safari 刚支持（macOS 26+）
- 我们的场景规模（70个小场景，每个 ~200 体素）用不到 WebGPU 的计算着色器优势
- WebGL 2.0 + InstancedMesh 已经能跑到 60fps
- 迁移路径明确：Three.js WebGPURenderer 在实验阶段，稳定后可直接替换

### 为什么不用 Minecraft Classic 复刻

- 非开源，法律风险（DMCA）
- 与我们的叙事方向（档案缝隙 = 证据缺失）不匹配
- 体素风格是用来渲染"空白"和"崩解"的，不是用来还原 Minecraft 的

---

## 4. 下一步优先级

### 立即做 (下次会话开始)

1. **修复 Loop 分段装配策略**
   - 把"一次输出三幕全量 JSON"改成"每幕单独输出"
   - Loop 控制器负责拼装
   - 重新跑 11 个案子

2. **体素场景原型**
   - 用尤巴县的"1978年2月至6月之间的空白"作为第一个体素场景
   - 实现 Three.js InstancedMesh + 溶解 Shader
   - 从胶片风格切换到体素风格的过渡动画

### 短期 (1-2周)

3. **案卷库 → 前端渲染管线**
   - 把 Loop 产出的叙事 JSON 接入 `film-reel-prototype.html`
   - 实现"点击档案缝隙 → 进入体素场景"的交互

4. **尤巴县世界的完整三幕**
   - 当前 act1 有 3 帧，act2 有 6 帧，act3 有 3 帧
   - 需要用 Loop 引擎正式跑一遍，产出 JSON 格式的最终帧序列

### 中期 (1个月内)

5. **案卷库 11 个案子全部跑完 Loop**
6. **相互质检管线的端到端测试**
7. **DSPy 层** (最后做，先用手工验证 pipeline 有效)

---

## 5. 关键概念速查

| 概念 | 含义 | 对应文件 |
|------|------|---------|
| sigma | 叙事可信度崩塌度。低 = 官方解释可信，高 = 档案缝隙打开 | world-config.yaml |
| 档案缝隙 (archive gap) | 官方记录中缺失/矛盾/被涂黑的信息，深度 1-5 | 每个 case-library 案子 |
| 物证 (evidence) | 可验证的物理/文件/证词类证据 | evidence_catalog |
| Loop | 5轮迭代：Narrator → Investigator → Witness → SigmaCalibrator → QualityAuditor | yuba-narrative-loop.md |
| Skill | 可复用的任务模板，定义"做这件事的标准流程" | case-to-narrative.md |
| 体素世界 | 档案缝隙的内部空间。sigma 驱动从有序到崩解的视觉变化 | 待实现 |

---

## 6. 参考材料

- 视频 transcript: `/Users/mahaoxuan/Desktop/即时学习/你没活干吗_提示词怎么写/transcript.md`
- 视频素材: `/Users/mahaoxuan/Downloads/(diamondart)尤巴县五人事件（1978）...mp4`
- 案卷库 Loop 输出: `/private/tmp/claude-501/-/5e5abe11-4921-4569-9b77-31e5d23835fb/tasks/wcl4w3zhh.output`
- 体素渲染调研输出: `/private/tmp/claude-501/-/5e5abe11-4921-4569-9b77-31e5d23835fb/tasks/w6bs6xnmf.output`
