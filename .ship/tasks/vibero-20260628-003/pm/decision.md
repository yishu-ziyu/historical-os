# Round 045 — 修测试可移植性 bug(绝对路径 → import.meta.url)

## 用户原话
> "必修(这是公开仓 bug)"

## 来源
ChatGPT Code Wiki §17.2 / §23.4:
> `marked_clue_state.test.mjs` 当前包含 `/Users/mahaoxuan/Desktop/黑客松/架空历史故事游戏/...`
> 风险:换机器运行会失败,CI 运行会失败

公开仓库已暴露这个 bug — 任何 clone 用户都会看到一行硬编码的本机路径。

## 范围
- 改 1 行:`artifacts/web_story_loop_demo/marked_clue_state.test.mjs:12`
- 改前:`cwd: '/Users/mahaoxuan/Desktop/...'` (绝对路径)
- 改后:`cwd: dirname(fileURLToPath(import.meta.url))` (相对路径)
- 新增 2 个 import:`fileURLToPath` + `dirname`

## 范围(Out)
- 不动 server.mjs
- 不动 turn_cycle.js
- 不接 CI(本机能跑通即交付)
- 不改其他测试文件(server.test.mjs / turn_cycle_*.test.mjs)
  - 那些文件没硬编码绝对路径,无需改

## 优先级:P0
公开仓库的 bug,影响所有接手人。

## 风险(一句话)
极低,只改 1 个测试文件,新增 2 个 stdlib import。

## 验证标准
1. `cd /tmp && node --test /path/to/marked_clue_state.test.mjs` 11/11 通过
2. 原路径跑也 11/11 通过(向后兼容)
3. 仓库里 grep 不再出现 `/Users/mahaoxuan/`