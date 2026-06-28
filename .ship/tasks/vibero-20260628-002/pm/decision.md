# Round 044 PM 决策

## 决策:✅ 做

## 范围(In)
- 接 Playwright 作为 dev 依赖
- 写 6 个截图场景脚本:
  1. 首屏加载(情报卡)
  2. 回合 T1 完成后(态势面板)
  3. 回合 T2 + Aftermath(结局面板)
  4. 标记线索交互(选中 1 条线索 + 笔记)
  5. 档案柜打开(可见 4 文件夹 + 11 文件项)
  6. 重置 case 后(回到首屏)
- 生成 baseline.png(每个场景 1 张)
- 跑 diff,容差 0.5%,超出生成 diff.png
- 接 `pnpm test:visual` 脚本
- 复用现有 MiniMax-M3 配置(不重接 LLM)

## 范围(Out)
- 不覆盖回合中途的中间态动画/loading(只截最终态)
- 不覆盖移动端 viewport
- 不覆盖中英切换(假设默认中文)
- 不覆盖 API 层(已有 41 个白盒测试覆盖)
- 不写历史框架校验的 e2e(round 043 server.test 已覆盖)
- 不接 CI(本机跑通即可,CI 是后续 round)

## 优先级:P1
P0 是档案体/态势图主视觉打磨,P1 是验证基础设施

## 风险(一句话)
LLM 输出不稳定会导致像素 diff 误报率较高;baseline 必须
用首次跑通的真实模型输出固化,后续跑接受 0.5% 容差误报

## Stop Conditions(借 loop 协议)
- 5 轮未跑通:升级,拆任务
- 同一 fail 连续 2 次:升级,排查 Playwright 接入
- 截图 baseline 差异 >5%:可能 LLM 输出已偏离历史框架,需复核