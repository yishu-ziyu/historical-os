#!/usr/bin/env node
// yishuship_status.mjs — 打印当前 phase、activeTask、最近里程碑、活跃 task 的 run_state
//
// 用法：
//   node tools/yishuship_status.mjs               # 打印全部
//   node tools/yishuship_status.mjs --json        # 输出 JSON（给 /loop 自动化用）
//   node tools/yishuship_status.mjs --check       # 退出码：0=OK / 1=FAIL（CI 友好）
//
// 设计：纯文件 I/O + 自写 YAML 子集解析，零外部依赖

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const SHIP_DIR = join(PROJECT_ROOT, '.ship');
const STATE_FILE = join(SHIP_DIR, 'state.yaml');
const TASKS_DIR = join(SHIP_DIR, 'tasks');

// ---------- YAML 轻量解析 ----------
// 支持本项目用到的子集：
//   key: value
//   key:    (嵌套对象开始)
//   key: [] (空数组)
//   - value (数组项，标量)
//   -       (数组项是对象开始)
//   - key: value (数组项是单行对象)
//   # 注释
//   空行
// 不支持：多文档、引用、anchor、flow style {a:1} / [1,2]

function parseScalar(value) {
  if (value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^".*"$/.test(value)) return value.slice(1, -1);
  if (/^'.*'$/.test(value)) return value.slice(1, -1);
  return value;
}

function parseYamlSubset(text) {
  const lines = text.split('\n');
  const root = {};
  // 栈：[{ indent, container, key }]，container 是当前 dict 或 array，key 是父 dict 里要写入的 key
  const stack = [{ indent: -1, container: root, key: null, isArray: false }];

  function top() { return stack[stack.length - 1]; }
  function parent() { return stack[stack.length - 2] || top(); }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // 去掉纯注释行和空行
    const stripped = raw.replace(/\s+$/, '');
    if (!stripped.trim()) continue;
    if (/^\s*#/.test(stripped)) continue;
    // YAML 文档分隔符 ---
    if (/^---\s*$/.test(stripped)) continue;

    const indent = stripped.match(/^ */)[0].length;
    const content = stripped.slice(indent);

    // 弹栈：找到 indent 严格小于当前行的栈帧
    while (stack.length > 1 && top().indent >= indent) {
      stack.pop();
    }

    if (content.startsWith('- ')) {
      // 数组项
      const value = content.slice(2).trim();
      const t = top();

      // pendingArrayResolve：上一行 key: 后空，遇到数组项时把 {} 改为 []
      if (t.pendingArrayResolve) {
        // 找父容器：t.key 是父 dict 里要改的 key
        const p = parent();
        p.container[t.key] = [];
        // 改 t 的引用指向新 array
        t.container = p.container[t.key];
        t.isArray = true;
        t.pendingArrayResolve = false;
      }

      // 确保 top 是 array
      if (!t.isArray) {
        // 父级是 dict，把 t 指向父 dict 的 value
        // 实际上 top 应该是 array，所以这里是状态错误
        throw new Error(`YAML: 数组项前不是数组 (line ${i + 1}): ${stripped}`);
      }

      if (value === '') {
        // 数组项是对象，下一行 indent > 当前
        const newObj = {};
        t.container.push(newObj);
        stack.push({ indent, container: newObj, key: null, isArray: false });
      } else if (value.includes(':')) {
        // 数组项是单行 key: value，inline 对象
        // 也可能是 [a, b] 风格，简化不支持
        const newObj = {};
        t.container.push(newObj);
        // 在当前数组项下解析 key: value
        const m = value.match(/^([\w_-]+):\s*(.*)$/);
        if (m) {
          const [, k, v] = m;
          newObj[k] = v.trim() === '' ? null : parseScalar(v.trim());
          // 注意：单行 key: value 的值如果为空，意味着结构跨行，理论上需要推栈
          // 本项目不用这种跨行结构，简化处理
        }
      } else {
        // 标量数组项
        t.container.push(parseScalar(value));
      }
    } else if (content.startsWith('-')) {
      // 单 "-" 没空格（不标准但兼容）
      throw new Error(`YAML: 数组项格式错误 (line ${i + 1}): ${stripped}`);
    } else {
      // key: value
      const m = content.match(/^([\w_-]+):\s*(.*)$/);
      if (!m) {
        throw new Error(`YAML parse error at line ${i + 1}: ${stripped}`);
      }
      const [, key, valueRaw] = m;
      const value = valueRaw.trim();
      const t = top();

      // 当前栈顶是不是 dict？
      if (t.isArray) {
        // 数组的下一行如果是 key: value，逻辑上不合法（除非是单行对象）
        throw new Error(`YAML: 数组下出现 key: value (line ${i + 1}): ${stripped}`);
      }

      if (value === '' || value === '[]') {
        if (value === '[]') {
          t.container[key] = [];
          // 不推栈（这一行是完整声明）
        } else {
          // 暂时初始化为 {}，但要预判下一行是不是数组项
          // 懒判断：推栈时挂一个 hint，遇到第一行 - 才改类型
          t.container[key] = {};
          stack.push({
            indent,
            container: t.container[key],
            key,
            isArray: false,
            pendingArrayResolve: true,  // 见下面处理
          });
        }
      } else if (value.startsWith('-') && value !== '-') {
        // 简单行内数组 ["- a - b - c"] 简化为 - 起始
        // 实际更简单：把单行 - a - b - c 解析为数组
        // 不支持复杂情况
        throw new Error(`YAML: 不支持行内数组 (line ${i + 1}): ${stripped}`);
      } else {
        t.container[key] = parseScalar(value);
        // 不推栈（叶子节点）
      }
    }
  }

  return root;
}

// ---------- 状态读取 ----------

function readState() {
  if (!existsSync(STATE_FILE)) {
    throw new Error(`.ship/state.yaml not found at ${STATE_FILE}`);
  }
  const text = readFileSync(STATE_FILE, 'utf8');
  return parseYamlSubset(text);
}

function readTaskRunState(taskId) {
  const file = join(TASKS_DIR, taskId, 'control', 'run_state.yaml');
  if (!existsSync(file)) return null;
  try {
    return parseYamlSubset(readFileSync(file, 'utf8'));
  } catch (err) {
    return { _parseError: err.message };
  }
}

function readTaskDecision(taskId) {
  const file = join(TASKS_DIR, taskId, 'pm', 'decision.md');
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  return lines[0]?.replace(/^#+\s*/, '').trim() || null;
}

// ---------- 校验 ----------

const VALID_PHASES = new Set(['idle', 'intake', 'design', 'loop', 'qa', 'handoff']);
const VALID_STATUS = new Set(['pending', 'running', 'done', 'failed']);
const VALID_STOP_REASONS = new Set([
  'success', 'max_iterations', 'same_failure_2x',
  'regression', 'no_progress_2x', 'capability_boundary', null, undefined,
]);

function validateState(state, runState) {
  const issues = [];
  if (!VALID_PHASES.has(state.phase)) {
    issues.push(`state.phase "${state.phase}" not in whitelist`);
  }
  if (state.lastStopReason !== undefined && state.lastStopReason !== null && !VALID_STOP_REASONS.has(state.lastStopReason)) {
    issues.push(`state.lastStopReason "${state.lastStopReason}" not in whitelist`);
  }
  if (state.activeTask && state.activeTask !== null) {
    if (!runState) {
      issues.push(`activeTask "${state.activeTask}" has no control/run_state.yaml`);
    } else if (runState._parseError) {
      issues.push(`run_state.yaml parse error: ${runState._parseError}`);
    } else if (!VALID_STATUS.has(runState.status)) {
      issues.push(`run_state.status "${runState.status}" not in whitelist`);
    }
  }
  if (state.lastSync && !/^\d{4}-\d{2}-\d{2}$/.test(state.lastSync)) {
    issues.push(`state.lastSync "${state.lastSync}" not in YYYY-MM-DD format`);
  }
  return issues;
}

// ---------- 输出 ----------

function formatHuman(state, runState, decision) {
  const lines = [];
  lines.push('┌─ yishuship 状态 ─────────────────────');
  lines.push(`│ phase:        ${state.phase}`);
  lines.push(`│ activeTask:   ${state.activeTask || '(null)'}`);
  lines.push(`│ blocked:      ${state.blocked?.length ? state.blocked.join(', ') : '(none)'}`);
  lines.push(`│ lastStop:     ${state.lastStopReason || '(none)'}`);
  lines.push(`│ lastSync:     ${state.lastSync}`);

  if (state.activeTask) {
    lines.push('│');
    lines.push(`├─ 活跃 task: ${state.activeTask} ──`);
    if (runState) {
      if (runState._parseError) {
        lines.push(`│ status:       (parse error)`);
      } else {
        lines.push(`│ status:       ${runState.status}`);
        lines.push(`│ iteration:    ${runState.iteration}`);
        lines.push(`│ stopReason:   ${runState.stopReason || '(none)'}`);
        lines.push(`│ completedAt:  ${runState.completedAt || '(in progress)'}`);
      }
    } else {
      lines.push('│ status:       (no run_state.yaml)');
    }
    if (decision) {
      lines.push(`│ decision:     ${decision}`);
    }
  }

  lines.push('│');
  lines.push('├─ 最近 5 个里程碑 ──');
  const ms = state.completedMilestones || [];
  ms.slice(-5).forEach(m => lines.push(`│   ${m}`));

  lines.push('│');
  lines.push('├─ 校验 ──');
  const issues = validateState(state, runState);
  if (issues.length === 0) {
    lines.push('│ ✓ all checks passed');
  } else {
    issues.forEach(i => lines.push(`│ ✗ ${i}`));
  }
  lines.push('└──────────────────────────────────────');
  return lines.join('\n');
}

// ---------- 入口 ----------

function main() {
  const args = process.argv.slice(2);
  const wantJson = args.includes('--json');
  const wantCheck = args.includes('--check');

  try {
    const state = readState();
    const runState = state.activeTask ? readTaskRunState(state.activeTask) : null;
    const decision = state.activeTask ? readTaskDecision(state.activeTask) : null;

    if (wantJson) {
      const out = {
        phase: state.phase,
        activeTask: state.activeTask,
        blocked: state.blocked,
        lastStopReason: state.lastStopReason,
        lastSync: state.lastSync,
        recentMilestones: (state.completedMilestones || []).slice(-5),
        activeTaskState: runState && !runState._parseError ? {
          status: runState.status,
          iteration: runState.iteration,
          stopReason: runState.stopReason,
        } : null,
        validation: validateState(state, runState),
      };
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(formatHuman(state, runState, decision));
    }

    if (wantCheck) {
      const issues = validateState(state, runState);
      process.exit(issues.length === 0 ? 0 : 1);
    }
  } catch (err) {
    console.error(`yishuship_status.mjs: ${err.message}`);
    process.exit(2);
  }
}

main();
