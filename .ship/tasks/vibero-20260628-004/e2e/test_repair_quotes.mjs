// round 049: 验证 repairMissingQuotes 正则逻辑
// 这是 JSON 解析失败的核心修复——LLM 漏字符串值开引号的场景
// 必须证明：① 能修复漏引号 ② 不破坏合法 JSON ③ 不破坏数字/布尔/null ④ 嵌套场景正确

function repairMissingQuotes(text) {
  return text.replace(
    /(:\s*|[\[,]\s*)([^\s"',}\]\[\{\n][^,}\]\n]*?)(?=\s*[,}\]])/g,
    (match, prefix, value) => {
      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) return match;
      if (value === 'true' || value === 'false' || value === 'null') return match;
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `${prefix}"${escaped}"`;
    }
  );
}

const cases = [
  {
    name: '漏引号修复（核心场景：中文书名号《》前漏开引号）',
    input: '{"label": 《授权法案》通过后的影响, "x": 1}',
    expect: '{"label": "《授权法案》通过后的影响", "x": 1}',
  },
  {
    name: '合法 JSON 字符串值不变',
    input: '{"label": "档案标题", "x": 1}',
    expect: '{"label": "档案标题", "x": 1}',
  },
  {
    name: '数字值不变',
    input: '{"value": 123, "y": 45.6, "z": -7}',
    expect: '{"value": 123, "y": 45.6, "z": -7}',
  },
  {
    name: '布尔和 null 不变',
    input: '{"flag": true, "off": false, "empty": null}',
    expect: '{"flag": true, "off": false, "empty": null}',
  },
  {
    name: '嵌套对象内的裸值修复',
    input: '{"header": {"title": 档案标题}, "x": 1}',
    expect: '{"header": {"title": "档案标题"}, "x": 1}',
  },
  {
    name: '中文逗号在裸值里（中文逗号不是 ASCII 逗号，应保留在值内）',
    input: '{"text": 他说，你好}',
    expect: '{"text": "他说，你好"}',
  },
  {
    name: '多个裸值同时修复',
    input: '{"a": 档案, "b": 标题, "c": 1}',
    expect: '{"a": "档案", "b": "标题", "c": 1}',
  },
  {
    name: '数组内裸值',
    input: '{"list": [裸值1, 裸值2]}',
    expect: '{"list": ["裸值1", "裸值2"]}',
  },
  {
    name: '空对象合法',
    input: '{}',
    expect: '{}',
  },
  {
    name: '科学计数法数字不变',
    input: '{"big": 1.5e10, "small": -2.3E-4}',
    expect: '{"big": 1.5e10, "small": -2.3E-4}',
  },
];

let pass = 0, fail = 0;
for (const { name, input, expect } of cases) {
  const got = repairMissingQuotes(input);
  if (got === expect) {
    console.log(`PASS  ${name}`);
    pass++;
  } else {
    console.log(`FAIL  ${name}`);
    console.log(`  input:    ${input}`);
    console.log(`  expected: ${expect}`);
    console.log(`  got:      ${got}`);
    fail++;
  }
}

// 额外验证：修复后的 JSON 能被 JSON.parse 成功解析
console.log('\n--- JSON.parse 验证 ---');
const parseTests = [
  '{"label": 《授权法案》通过, "x": 1}',
  '{"header": {"title": 档案标题}, "y": true}',
  '{"list": [裸值1, 裸值2], "n": null}',
];
for (const t of parseTests) {
  const repaired = repairMissingQuotes(t);
  try {
    const parsed = JSON.parse(repaired);
    console.log(`PASS  解析成功: ${JSON.stringify(parsed).slice(0, 80)}`);
    pass++;
  } catch (e) {
    console.log(`FAIL  解析失败: ${e.message}`);
    console.log(`  原始: ${t}`);
    console.log(`  修复后: ${repaired}`);
    fail++;
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
