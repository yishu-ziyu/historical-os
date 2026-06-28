// yishuship_status.test.mjs — 状态机解析器单元测试
// 运行：node --test tools/yishuship_status.test.mjs

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const TOOL = join(__dirname, 'yishuship_status.mjs');

// 把 tool 临时复制到测试项目根下，让它的 PROJECT_ROOT = join(__dirname, '..') 解析到测试项目
function runInFakeProject(stateYaml, runStateYaml = null, args = []) {
  const dir = mkdtempSync(join(tmpdir(), 'yishuship-test-'));
  mkdirSync(join(dir, '.ship', 'tasks'), { recursive: true });
  writeFileSync(join(dir, '.ship', 'state.yaml'), stateYaml);
  if (runStateYaml) {
    const taskDir = join(dir, '.ship', 'tasks', 'test-task');
    mkdirSync(join(taskDir, 'control'), { recursive: true });
    writeFileSync(join(taskDir, 'control', 'run_state.yaml'), runStateYaml);
  }
  // 工具内部 PROJECT_ROOT = join(__dirname, '..')
  // 通过把 tool 复制到 fake project 的 tools/ 下，让它找到自己的 .ship/
  mkdirSync(join(dir, 'tools'), { recursive: true });
  const toolSrc = readFileSyncSync(TOOL);
  writeFileSync(join(dir, 'tools', 'yishuship_status.mjs'), toolSrc);
  const result = spawnSync('node', [join(dir, 'tools', 'yishuship_status.mjs'), ...args], { encoding: 'utf8' });
  return { ...result, projectDir: dir };
}

import { readFileSync, existsSync } from 'node:fs';
function readFileSyncSync(p) { return readFileSync(p, 'utf8'); }

describe('yishuship_status.mjs against real project', () => {
  it('prints human output and exits 0', () => {
    const result = spawnSync('node', [TOOL], { encoding: 'utf8' });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /yishuship 状态/);
    // 不硬编码 phase / activeTask；改用"必须在白名单内"
    const phaseMatch = result.stdout.match(/phase:\s+(\w+)/);
    assert.ok(phaseMatch, '必须输出 phase 行');
    assert.ok(['idle', 'intake', 'design', 'loop', 'qa', 'handoff'].includes(phaseMatch[1]),
      `phase "${phaseMatch[1]}" 不在白名单`);
  });

  it('JSON output has expected shape', () => {
    const result = spawnSync('node', [TOOL, '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    // 字段存在性 + 类型
    assert.ok(['idle', 'intake', 'design', 'loop', 'qa', 'handoff'].includes(parsed.phase));
    assert.ok(typeof parsed.activeTask === 'string' || parsed.activeTask === null);
    assert.ok(Array.isArray(parsed.recentMilestones));
    assert.ok(parsed.recentMilestones.includes('round_042_yishuship_protocol_onboarded'));
    assert.ok(Array.isArray(parsed.validation));
  });

  it('--check exits 0 when state valid', () => {
    const result = spawnSync('node', [TOOL, '--check'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
  });
});

describe('YAML subset parser edge cases', () => {
  it('parses simple key-value', () => {
    const r = runInFakeProject('phase: idle\nactiveTask: null\nlastSync: "2026-06-28"\n');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /phase:\s+idle/);
  });

  it('parses inline empty array', () => {
    const r = runInFakeProject('phase: idle\nactiveTask: null\nblocked: []\nlastSync: "2026-06-28"\n');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /blocked:\s+\(none\)/);
  });

  it('parses array of scalars', () => {
    const r = runInFakeProject(`
phase: idle
activeTask: null
lastSync: "2026-06-28"
completedMilestones:
  - round_001_a
  - round_002_b
  - round_003_c
`);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /round_003_c/);
  });

  it('parses nested object', () => {
    const r = runInFakeProject(`
phase: idle
activeTask: t1
lastSync: "2026-06-28"
`, null, ['--check']);
    // activeTask=t1 但没有 run_state，应该报校验错
    assert.equal(r.status, 1, '应该 exit 1 因为 activeTask 指向不存在的 task');
    assert.match(r.stdout, /activeTask "t1" has no control/);
  });

  it('handles run_state.yaml correctly', () => {
    const r = runInFakeProject(`
phase: loop
activeTask: test-task
lastStopReason: success
lastSync: "2026-06-28"
`, `
taskId: test-task
status: running
iteration: 2
stopReason: null
startedAt: "2026-06-28T10:00:00Z"
completedAt: null
`);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /status:\s+running/);
    assert.match(r.stdout, /iteration:\s+2/);
  });

  it('flags invalid phase', () => {
    const r = runInFakeProject(`
phase: not_a_real_phase
activeTask: null
lastSync: "2026-06-28"
`, null, ['--check']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /phase "not_a_real_phase" not in whitelist/);
  });

  it('flags invalid stopReason', () => {
    const r = runInFakeProject(`
phase: idle
activeTask: null
lastStopReason: bogus
lastSync: "2026-06-28"
`, null, ['--check']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /lastStopReason "bogus" not in whitelist/);
  });

  it('flags invalid run_state.status', () => {
    const r = runInFakeProject(`
phase: loop
activeTask: test-task
lastStopReason: success
lastSync: "2026-06-28"
`, `
taskId: test-task
status: maybe
iteration: 0
stopReason: null
`, ['--check']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /run_state.status "maybe" not in whitelist/);
  });

  it('flags invalid date format', () => {
    const r = runInFakeProject(`
phase: idle
activeTask: null
lastSync: "2026-6-28"
`, null, ['--check']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /lastSync "2026-6-28" not in YYYY-MM-DD/);
  });

  it('exits 2 on missing state file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'yishuship-empty-'));
    // 工具查找 PROJECT_ROOT/.ship/state.yaml；通过复制 tool 绕过
    mkdirSync(join(dir, 'tools'), { recursive: true });
    writeFileSync(join(dir, 'tools', 'yishuship_status.mjs'), readFileSync(TOOL, 'utf8'));
    const r = spawnSync('node', [join(dir, 'tools', 'yishuship_status.mjs')], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /state.yaml not found/);
  });
});

describe('Real project integration', () => {
  it('historical-archives task has run_state.yaml', () => {
    const taskStateFile = join(PROJECT_ROOT, '.ship/tasks/historical-archives/control/run_state.yaml');
    assert.ok(existsSync(taskStateFile), 'run_state.yaml 必须存在');
  });

  it('historical-archives task has pm/decision.md', () => {
    const decFile = join(PROJECT_ROOT, '.ship/tasks/historical-archives/pm/decision.md');
    assert.ok(existsSync(decFile), 'pm/decision.md 必须存在');
  });

  it('historical-archives task has input/requirement.md', () => {
    const reqFile = join(PROJECT_ROOT, '.ship/tasks/historical-archives/input/requirement.md');
    assert.ok(existsSync(reqFile), 'input/requirement.md 必须存在');
  });

  it('historical-archives task has plan/spec.md', () => {
    const specFile = join(PROJECT_ROOT, '.ship/tasks/historical-archives/plan/spec.md');
    assert.ok(existsSync(specFile), 'plan/spec.md 必须存在');
  });

  it('all 7 yishuship commands exist', () => {
    const expected = [
      'yishuship.md',
      'yishuship-intake.md',
      'yishuship-design.md',
      'yishuship-dev.md',
      'yishuship-qa.md',
      'yishuship-handoff.md',
      'yishuship-auto.md',
    ];
    for (const f of expected) {
      const p = join(PROJECT_ROOT, '.claude/commands', f);
      assert.ok(existsSync(p), `${f} 必须存在`);
    }
  });

  it('project-level builder + checker agents exist', () => {
    for (const f of ['builder.md', 'checker.md']) {
      const p = join(PROJECT_ROOT, '.claude/agents', f);
      assert.ok(existsSync(p), `${f} 必须存在`);
    }
  });

  it('builder agent does NOT have Edit tool whitelist violating (sanity)', () => {
    const text = readFileSync(join(PROJECT_ROOT, '.claude/agents/builder.md'), 'utf8');
    assert.match(text, /tools: Read, Write, Edit, Glob, Grep, Bash/);
  });

  it('checker agent does NOT have Write/Edit tools (hard isolation)', () => {
    const text = readFileSync(join(PROJECT_ROOT, '.claude/agents/checker.md'), 'utf8');
    assert.doesNotMatch(text, /^tools:.*Write/m, 'checker 绝不能有 Write 工具');
    assert.doesNotMatch(text, /^tools:.*Edit/m, 'checker 绝不能有 Edit 工具');
  });
});
