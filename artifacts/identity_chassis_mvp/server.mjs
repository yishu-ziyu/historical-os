/**
 * Identity Chassis MVP
 * Open-identity historical agent loop.
 * Contracts: PlayableRole / Situation / Action / WorldDelta
 * Rule engine is the source of truth; LLM is optional flavor only.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8901);
const HOST = '127.0.0.1';

// ─── sessions ─────────────────────────────────────────────
const sessions = new Map();

function id(prefix = 's') {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}

// ─── world anchors (shared chassis ground) ────────────────
const WORLD_ANCHORS = {
  year: 1933,
  date: '1933-10-17',
  cityPressure: {
    berlin: '国会纵火案之后的整肃仍在继续，街上多了制服与低声议论。',
    hamburg: '汉堡港挤满想离境的人和查证件的人，船期比诺言更硬。',
  },
  facts: [
    { id: 'einstein_not_left', label: '爱因斯坦仍在德国境内的传闻开始在学术圈低声传播' },
    { id: 'jewish_registry', label: '学术与职业团体开始出现“特别登记”与排挤' },
    { id: 'exit_pressure', label: '离境船票与签证变得昂贵、不稳定' },
    { id: 'press_control', label: '报刊言论空间收紧，小报靠八卦与擦边生存' },
  ],
};

// ─── preset identities ────────────────────────────────────
const PRESETS = {
  academy_clerk: {
    seed: '普鲁士科学院文书助理',
    template: {
      name: '卡尔·霍夫曼',
      occupation: '科学院文书助理',
      place: 'berlin',
      placeLabel: '柏林 · 普鲁士科学院侧楼',
      knows: [
        '院士通信与会议日程',
        '哪些名字最近从名录边缘滑走',
        '普朗克仍试图在机构内缓冲冲突',
      ],
      can: ['read_mail', 'whisper', 'delay_paper', 'escort', 'note', 'ask'],
      cannot: ['arrest', 'publish_front_page', 'order_police', 'board_ship_control'],
      pressure: ['上司要“正常运转”的假象', '有人托你“留意”某些犹太人学者'],
      privateGoals: ['别把自己卷进名单', '尽量让认识的人多撑一天'],
      anchors: ['jewish_registry', 'einstein_not_left'],
      verbsFlavor: '公文、走廊、钥匙与低声',
    },
  },
  tabloid_reporter: {
    seed: '柏林小报记者',
    template: {
      name: '莉娜·伯格',
      occupation: '小报记者',
      place: 'berlin',
      placeLabel: '柏林 · 弗里德里希街咖啡馆外',
      knows: [
        '哪些八卦能卖钱',
        '警察喜欢找谁的麻烦',
        '院士圈子有人开始取消公开讲座',
      ],
      can: ['ask', 'bribe_small', 'publish_rumor', 'follow', 'note', 'hide'],
      cannot: ['sign_academy', 'board_ship_control', 'order_police'],
      pressure: ['编辑要劲爆标题', '写错人会被告或更糟'],
      privateGoals: ['拿到独家', '别把自己写进去'],
      anchors: ['press_control', 'einstein_not_left'],
      verbsFlavor: '追问、交易、标题与烟雾',
    },
  },
  planck_student: {
    seed: '普朗克身边的学生',
    template: {
      name: '约翰·克劳斯',
      occupation: '理论物理学生',
      place: 'berlin',
      placeLabel: '柏林 · 大学物理系走廊',
      knows: [
        '实验室谁还来、谁突然不来',
        '普朗克语气比往年更短',
        '爱因斯坦名字在私聊里变得谨慎',
      ],
      can: ['ask', 'carry_message', 'note', 'hide', 'escort', 'read_mail'],
      cannot: ['arrest', 'publish_front_page', 'board_ship_control'],
      pressure: ['论文与前途', '师长要你少说话'],
      privateGoals: ['保住学业', '帮老师传一句不该写在纸上的话'],
      anchors: ['einstein_not_left', 'jewish_registry'],
      verbsFlavor: '纸条、讲座、沉默的实验室',
    },
  },
};

// ─── occupation keyword compiler (zero-shot chassis) ──────
const OCCUPATION_RULES = [
  {
    test: /(港口|码头|海关|船票|离境|办事员|检票|边检)/i,
    place: 'hamburg',
    placeLabel: '汉堡 · 港口证件窗口',
    occupation: '港口证件办事员',
    knows: ['船期与舱位压力', '证件不全的人会在窗口崩溃或行贿', '哪些章能拖、哪些章会惹上司'],
    can: ['stamp', 'delay_paper', 'ask', 'bribe_small', 'note', 'hide', 'board_ship_control'],
    cannot: ['sign_academy', 'publish_front_page', 'order_police'],
    pressure: ['队列太长', '上司要“程序正确”', '有人塞钱有人哭'],
    privateGoals: ['下班前别出事', '或许放走一个不该卡住的人'],
    anchors: ['exit_pressure', 'jewish_registry'],
    verbsFlavor: '章、队、护照与汽笛',
    namePool: ['奥托·里希特', '汉斯·贝克尔', '弗里茨·沃尔夫'],
  },
  {
    test: /(记者|报社|新闻|编辑|采访)/i,
    ...PRESETS.tabloid_reporter.template,
    namePool: ['莉娜·伯格', '埃里希·斯坦', '玛尔塔·科恩'],
  },
  {
    test: /(学生|助教|物理|普朗克|大学)/i,
    ...PRESETS.planck_student.template,
    namePool: ['约翰·克劳斯', '彼得·朗格', '安娜·肖尔茨'],
  },
  {
    test: /(秘书|文书|科学院|院士|档案|通信)/i,
    ...PRESETS.academy_clerk.template,
    namePool: ['卡尔·霍夫曼', '格奥尔格·米勒', '海伦·沃格尔'],
  },
  {
    test: /(警察|盖世|警探|巡警)/i,
    place: 'berlin',
    placeLabel: '柏林 · 分局走廊',
    occupation: '基层巡警',
    knows: ['街上谁在被盯', '哪些咖啡馆常被扫', '报告往上交会怎样'],
    can: ['ask', 'follow', 'note', 'arrest_soft', 'hide'],
    cannot: ['sign_academy', 'publish_front_page', 'board_ship_control'],
    pressure: ['指标与告密', '同事在看你是否够“积极”'],
    privateGoals: ['别显得心软', '或许假装没看见一次'],
    anchors: ['press_control', 'jewish_registry'],
    verbsFlavor: '靴声、盘问、假装例行',
    namePool: ['瓦尔特·库恩', '约瑟夫·布兰特'],
  },
];

const DEFAULT_OCC = {
  place: 'berlin',
  placeLabel: '柏林 · 街角',
  occupation: '普通人',
  knows: ['物价与传闻', '邻居最近更少交谈'],
  can: ['ask', 'note', 'hide', 'walk', 'listen'],
  cannot: ['order_police', 'sign_academy', 'board_ship_control'],
  pressure: ['活下去', '少惹眼'],
  privateGoals: ['看清今天发生了什么'],
  anchors: ['press_control'],
  verbsFlavor: '走路、听、躲开',
  namePool: ['无名氏'],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function compileRoleFromText(rawText) {
  const text = String(rawText || '').trim() || '柏林的普通人';
  const rule = OCCUPATION_RULES.find((r) => r.test.test(text)) || null;
  const base = rule
    ? {
        place: rule.place,
        placeLabel: rule.placeLabel,
        occupation: rule.occupation,
        knows: [...rule.knows],
        can: [...rule.can],
        cannot: [...rule.cannot],
        pressure: [...rule.pressure],
        privateGoals: [...rule.privateGoals],
        anchors: [...rule.anchors],
        verbsFlavor: rule.verbsFlavor,
        name: pick(rule.namePool || ['无名氏']),
      }
    : {
        ...DEFAULT_OCC,
        occupation: text.slice(0, 24),
        name: '无名氏',
        knows: [...DEFAULT_OCC.knows, `自述身份：${text}`],
        namePool: undefined,
      };

  // Merge free-text cues into knows for zero-shot flavor
  if (!rule) {
    base.knows = [...base.knows, `你坚持自己是：${text}`];
  } else if (text.length > 4) {
    base.knows = [...base.knows, `你这样描述自己：${text}`];
  }

  /** @type {import('./types.js').PlayableRole} */
  const role = {
    id: id('role'),
    name: base.name,
    year: WORLD_ANCHORS.year,
    date: WORLD_ANCHORS.date,
    place: base.place,
    placeLabel: base.placeLabel,
    occupation: base.occupation,
    seedText: text,
    knows: base.knows,
    can: base.can,
    cannot: base.cannot,
    pressure: base.pressure,
    privateGoals: base.privateGoals,
    anchors: base.anchors,
    verbsFlavor: base.verbsFlavor,
    compiledFrom: rule ? 'keyword_rule' : 'generic_fallback',
  };
  return role;
}

function compilePreset(presetId) {
  const p = PRESETS[presetId];
  if (!p) throw new Error('未知预设身份');
  const t = p.template;
  return {
    id: id('role'),
    name: t.name,
    year: WORLD_ANCHORS.year,
    date: WORLD_ANCHORS.date,
    place: t.place,
    placeLabel: t.placeLabel,
    occupation: t.occupation,
    seedText: p.seed,
    knows: [...t.knows],
    can: [...t.can],
    cannot: [...t.cannot],
    pressure: [...t.pressure],
    privateGoals: [...t.privateGoals],
    anchors: [...t.anchors],
    verbsFlavor: t.verbsFlavor,
    compiledFrom: 'preset',
    presetId,
  };
}

// ─── action catalog (verbs remain internal) ───────────────
const ACTION_DEFS = {
  ask: { risk: 1 },
  note: { risk: 0 },
  hide: { risk: 0 },
  whisper: { risk: 2 },
  delay_paper: { risk: 2 },
  read_mail: { risk: 1 },
  escort: { risk: 3 },
  follow: { risk: 2 },
  bribe_small: { risk: 2 },
  publish_rumor: { risk: 3 },
  stamp: { risk: 2 },
  board_ship_control: { risk: 2 },
  carry_message: { risk: 2 },
  listen: { risk: 0 },
  walk: { risk: 0 },
  arrest_soft: { risk: 4 },
};

function canDo(role, verb) {
  return role.can.includes(verb) && !role.cannot.includes(verb) && ACTION_DEFS[verb];
}

/** Build a book-page situation: prose + objects + 2–3 contextual choices */
function makeSituation({ role, world, tags, location, prose, objects, choices, present }) {
  const actions = [];
  for (const c of choices) {
    if (!canDo(role, c.verb)) continue;
    actions.push({
      id: c.verb,
      verb: c.verb,
      label: c.label,
      objectId: c.objectId || null,
      risk: ACTION_DEFS[c.verb].risk,
    });
    if (actions.length >= 3) break;
  }
  // fallback if identity filters wiped choices
  if (!actions.length) {
    for (const verb of role.can) {
      if (!canDo(role, verb)) continue;
      actions.push({
        id: verb,
        verb,
        label: `做一件你能做的事（${verb}）`,
        objectId: null,
        risk: ACTION_DEFS[verb].risk,
      });
      if (actions.length >= 2) break;
    }
  }
  const summary = prose.join(' ');
  return {
    id: id('sit'),
    time: `${world.date} ${world.clock}`,
    location: location || role.placeLabel,
    tags: tags || [],
    prose,
    objects: objects || [],
    actions,
    present: present || [],
    summary,
    sensory: '',
    conflict: '',
  };
}

// ─── situation generators ─────────────────────────────────
function clockAdd(clock, minutes) {
  const [h, m] = clock.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function createInitialWorld(role) {
  return {
    date: role.date,
    clock: role.place === 'hamburg' ? '09:40' : '14:10',
    place: role.place,
    heat: 1,
    trustSelf: 3,
    suspicion: 0,
    flags: {},
    relations: {},
    news: [],
    log: [],
  };
}

function openingSituation(role, world) {
  if (role.place === 'hamburg' || /港口|办事员/.test(role.occupation)) {
    return makeSituation({
      role,
      world,
      tags: ['queue'],
      location: role.placeLabel,
      prose: [
        '汽笛一声接一声。窗口玻璃上全是指纹。',
        '中年男人把[[passport|护照]]推过台面，指节发白。船票是今晚的，签注却缺一页。后面有人开始骂。',
        '里间有[[smoke|烟]]。上司没出来，但你知道他听得见章落不落。',
      ],
      objects: [
        { id: 'passport', label: '护照', hint: '缺页的证件，决定他今晚走不走得了。' },
        { id: 'smoke', label: '里间的烟', hint: '上司在那儿。你的每个章都可能被记一笔。' },
      ],
      present: [
        { name: '证件不全的男人', relation: '陌生人' },
        { name: '上司', relation: '压力' },
      ],
      choices: [
        { verb: 'stamp', label: '在护照上盖章，放他走', objectId: 'passport' },
        { verb: 'delay_paper', label: '把材料拨到“待补”，按规定卡住', objectId: 'passport' },
        { verb: 'bribe_small', label: '假装整理印章，让钞票从台面滑过去', objectId: 'smoke' },
      ],
    });
  }

  if (role.occupation.includes('记者')) {
    return makeSituation({
      role,
      world,
      tags: ['cafe'],
      location: role.placeLabel,
      prose: [
        '咖啡馆里烟比咖啡浓。',
        '线人把[[tip|半句话]]按在杯托下：“科学院那边，有人该走，却没走。”他不说名字，只伸手要第二杯的钱。',
        '邻桌那个[[coat|穿深色外套的男人]]已经翻同一页报纸翻了太久。',
      ],
      objects: [
        { id: 'tip', label: '半句话', hint: '可能是独家，也可能是饵。' },
        { id: 'coat', label: '深色外套', hint: '便衣的气味，或者你吓自己。' },
      ],
      present: [
        { name: '线人', relation: '不可靠' },
        { name: '邻桌男人', relation: '危险感' },
      ],
      choices: [
        { verb: 'ask', label: '追问线人：谁？哪条船？', objectId: 'tip' },
        { verb: 'follow', label: '结账离开，远远跟着深色外套', objectId: 'coat' },
        { verb: 'publish_rumor', label: '先把“某科学家行程不符”写成能见报的边角', objectId: 'tip' },
      ],
    });
  }

  if (role.occupation.includes('学生')) {
    return makeSituation({
      role,
      world,
      tags: ['lab'],
      location: role.placeLabel,
      prose: [
        '讲座散了。粉笔灰还在空气里转。',
        '普朗克没多说，只把一张叠好的[[note|纸条]]按在讲义下，目光示意你拿走。',
        '走廊尽头，[[watcher|有人]]在本子上记谁和谁说话。笔尖很轻，轻得像故意让你听见。',
      ],
      objects: [
        { id: 'note', label: '纸条', hint: '不该出现在公开记录里的东西。' },
        { id: 'watcher', label: '尽头的记录者', hint: '他不一定认识你，但会认识你的名字。' },
      ],
      present: [
        { name: '普朗克', relation: '师长' },
        { name: '记录者', relation: '监视' },
      ],
      choices: [
        { verb: 'carry_message', label: '把纸条塞进袖口，按他示意带走', objectId: 'note' },
        { verb: 'note', label: '只把纸条上的缩写记进自己的草稿本', objectId: 'note' },
        { verb: 'hide', label: '假装没看见讲义，若无其事走过记录者', objectId: 'watcher' },
      ],
    });
  }

  // academy clerk
  return makeSituation({
    role,
    world,
    tags: ['corridor'],
    location: role.placeLabel,
    prose: [
      '侧楼的打字声停了一拍，又响起来。',
      '通信架上，一封本该转出的[[letter|信]]还在。收件人的姓，你在“特别登记”旁注里见过。',
      '同事艾尔莎指了指[[tray|公文匣]]：“这份今天走程序吗？”她的声音不高，刚好够第三人听见。',
    ],
    objects: [
      { id: 'letter', label: '信', hint: '正常转发会留痕；压下也是痕迹。' },
      { id: 'tray', label: '公文匣', hint: '程序的嘴脸。' },
    ],
    present: [
      { name: '艾尔莎', relation: '同级' },
      { name: '收件人', relation: '危险关联' },
    ],
    choices: [
      { verb: 'delay_paper', label: '把信压在无害公文最底下', objectId: 'letter' },
      { verb: 'read_mail', label: '借“核对地址”的名义拆开看一眼', objectId: 'letter' },
      { verb: 'whisper', label: '压低声音问艾尔莎：谁在催这份', objectId: 'tray' },
    ],
  });
}

function applyAction(session, actionId) {
  const role = session.role;
  const world = session.world;
  const sit = session.situation;
  const verb = actionId;
  const chosen = (sit.actions || []).find((a) => a.id === verb || a.verb === verb);

  if (!role.can.includes(verb)) {
    return {
      ok: false,
      error: '这个身份做不到这件事。',
    };
  }
  if (role.cannot.includes(verb)) {
    return {
      ok: false,
      error: '越权了。世界规则挡住了你。',
    };
  }

  const def = ACTION_DEFS[verb];
  if (!def) {
    return { ok: false, error: '未知动作' };
  }

  const actionLabel = chosen?.label || verb;

  /** @type {object} */
  const delta = {
    actionId: verb,
    label: actionLabel,
    timeAdvanceMinutes: 8 + def.risk * 3,
    heatDelta: 0,
    suspicionDelta: 0,
    trustDelta: 0,
    flagsAdd: {},
    newsLine: null,
    consequence: '',
    relationTouches: [],
  };

  // Shared outcome logic by verb + place tags
  const tags = sit.tags || [];

  switch (verb) {
    case 'stamp':
      delta.heatDelta = 1;
      delta.suspicionDelta = world.flags.watched_by_boss ? 1 : 0;
      delta.flagsAdd.let_someone_through = true;
      delta.consequence =
        '你盖了章。男人眼睛红了，低声道谢，像怕声音太大。里间烟雾动了一下——上司也许听见了，也许没有。';
      delta.newsLine = '港口窗口今日放行节奏异常，有人议论“手松”。';
      break;
    case 'board_ship_control':
    case 'delay_paper':
      delta.heatDelta = tags.includes('queue') ? 1 : 0;
      delta.trustDelta = -0;
      delta.flagsAdd.delayed_exit = true;
      delta.consequence = tags.includes('queue')
        ? '你把材料拨到“待补”格。队列起哄。男人抓住台沿，说他孩子已经在船上。你没有抬头。'
        : '你把文件压在一叠无害公文下。世界少走了一条官样文章。';
      break;
    case 'ask':
      delta.suspicionDelta = 0;
      delta.consequence = tags.includes('cafe')
        ? '线人凑近：“不是水手的事。是科学院的。有人该走，船票却没买。”他伸出手要第二杯的钱。'
        : tags.includes('queue')
          ? '男人说缺的是“旧国籍证明”。他语无伦次，只重复：今晚的船。'
          : '对方顿了一下，给了你半句真半句假的话。你听出害怕，不确定怕的是谁。';
      delta.flagsAdd.asked_once = true;
      break;
    case 'whisper':
    case 'carry_message':
      delta.suspicionDelta = 1;
      delta.heatDelta = 1;
      delta.flagsAdd.secret_message = true;
      delta.consequence =
        '话/纸条离开你的手。空气变轻，责任变重。你意识到自己已经站在记录的另一侧。';
      break;
    case 'read_mail':
      delta.consequence =
        '信笺边角有汗渍。内容平常，像故意平常。附言一行被划掉，还能辨认：柏林比想象中难走。';
      delta.flagsAdd.read_sensitive = true;
      delta.suspicionDelta = 1;
      break;
    case 'note':
      delta.consequence = '你把关键词记在只有自己看得懂的缩写里。纸不会替你冒险，但会替你记得。';
      delta.flagsAdd.has_notes = true;
      break;
    case 'hide':
      delta.trustDelta = -0;
      delta.consequence = '你选择没看见。时钟走了，麻烦也许去找别人——也许明天绕回来。';
      delta.flagsAdd.looked_away = true;
      delta.heatDelta = 0;
      delta.timeAdvanceMinutes = 12;
      break;
    case 'bribe_small':
      delta.suspicionDelta = 1;
      delta.flagsAdd.dirty_hands = true;
      delta.consequence = tags.includes('queue')
        ? '钞票在护照下。你没有数。章落下去时，金属声比平常响。'
        : '你买到一个名字的音节，和一句警告：别写得太像真的。';
      break;
    case 'publish_rumor':
      delta.heatDelta = 2;
      delta.suspicionDelta = 2;
      delta.flagsAdd.published = true;
      delta.newsLine = '本市小报暗示：某著名科学家行程与官方口径不符。';
      delta.consequence = '标题比事实跑得快。你的名字不在报上，但编辑的电话会先找到你。';
      break;
    case 'follow':
      delta.suspicionDelta = 1;
      delta.consequence = '你隔着一条街跟着。目标进了侧门。你不敢再近，只记下门牌与时间。';
      delta.flagsAdd.followed = true;
      break;
    case 'escort':
      delta.heatDelta = 2;
      delta.suspicionDelta = 2;
      delta.flagsAdd.helped_exit = true;
      delta.consequence = '你带着人走侧梯。靴声在后面响了一下，又远了。你们没有说话。';
      break;
    case 'listen':
      delta.consequence = '碎片拼起来：船票、名单、谁还不走。没有证据，但有方向。';
      delta.flagsAdd.listened = true;
      break;
    case 'walk':
      delta.consequence = '你换了街区。橱窗里的新闻标题像在跟你对视。世界没有因为你离开而停。';
      delta.timeAdvanceMinutes = 20;
      break;
    case 'arrest_soft':
      delta.heatDelta = 2;
      delta.suspicionDelta = -1;
      delta.flagsAdd.performed_duty = true;
      delta.consequence = '你把人带走“问话”。同事点头。你胃里发沉，像吞了一枚章。';
      break;
    default:
      delta.consequence = '你做了这件事。空气挪了一寸。';
  }

  // Apply deltas
  world.clock = clockAdd(world.clock, delta.timeAdvanceMinutes);
  world.heat = clamp(world.heat + delta.heatDelta, 0, 10);
  world.suspicion = clamp((world.suspicion || 0) + delta.suspicionDelta, 0, 10);
  world.trustSelf = clamp((world.trustSelf || 3) + delta.trustDelta, 0, 10);
  Object.assign(world.flags, delta.flagsAdd);
  if (delta.newsLine) world.news.unshift({ t: `${world.date} ${world.clock}`, line: delta.newsLine });
  world.log.push({
    t: `${world.date} ${world.clock}`,
    action: actionLabel,
    consequence: delta.consequence,
  });

  // Next situation
  const next = nextSituation(role, world, delta, sit);
  session.situation = next;
  session.turn += 1;
  session.lastDelta = delta;

  return { ok: true, delta, situation: next, world: publicWorld(world), turn: session.turn };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function nextSituation(role, world, lastDelta, prevSit) {
  const tags = prevSit.tags || [];

  if (world.heat >= 4 && Math.random() < 0.55) {
    return makeSituation({
      role,
      world,
      tags,
      location: role.placeLabel,
      prose: [
        '空气发紧，像雷雨前。',
        '有人叫你的[[name|名字]]。不是客套。问题普通得像表格。',
        '你意识到：自己大概已经写进某本不该存在的簿子外围。',
      ],
      objects: [{ id: 'name', label: '名字', hint: '被叫到名字，比被推一把更冷。' }],
      present: [{ name: '问话的人', relation: '系统' }],
      choices: [
        { verb: 'ask', label: '反问：您是哪一部门的', objectId: 'name' },
        { verb: 'hide', label: '用职务应答，尽量缩短对话', objectId: 'name' },
        { verb: 'walk', label: '找借口离开这条走廊', objectId: 'name' },
      ],
    });
  }

  if (world.flags.let_someone_through && role.place === 'hamburg') {
    return makeSituation({
      role,
      world,
      tags: ['queue'],
      location: '汉堡 · 港区侧门',
      prose: [
        '傍晚前，一个孩子把一颗[[candy|糖]]放在你窗台上就跑了。没有字条。',
        '[[horn|汽笛]]响了第三次。你不知道那家人是否已在船上。',
      ],
      objects: [
        { id: 'candy', label: '糖', hint: '谢谢，或者把柄。' },
        { id: 'horn', label: '汽笛', hint: '船期不等人。' },
      ],
      present: [{ name: '空窗台', relation: '回声' }],
      choices: [
        { verb: 'stamp', label: '下一份也松一点手', objectId: 'candy' },
        { verb: 'delay_paper', label: '把窗台上的糖拨开，继续按章', objectId: 'candy' },
        { verb: 'note', label: '只把船名与时间记下来', objectId: 'horn' },
      ],
    });
  }

  if (world.flags.secret_message || world.flags.carry_message || world.flags.has_notes) {
    return makeSituation({
      role,
      world,
      tags: tags.includes('lab') ? ['lab'] : ['corridor'],
      location: role.place === 'hamburg' ? role.placeLabel : '柏林 · 无人的侧廊',
      prose: [
        '纸条的下一环没有出现。',
        '你看见自己的[[drawer|抽屉]]被人翻过——很轻，像提醒，不像搜查。',
        '走廊里只剩你的呼吸声。',
      ],
      objects: [{ id: 'drawer', label: '抽屉', hint: '有人知道你拿过不该拿的东西。' }],
      present: [{ name: '被翻动的抽屉', relation: '警告' }],
      choices: [
        { verb: 'hide', label: '把可疑的东西转移到鞋跟或领衬', objectId: 'drawer' },
        { verb: 'note', label: '记下翻动的痕迹：角度、时间', objectId: 'drawer' },
        { verb: 'walk', label: '立刻换地方，不在侧廊停留', objectId: 'drawer' },
      ],
    });
  }

  if (world.flags.published) {
    return makeSituation({
      role,
      world,
      tags: ['cafe'],
      location: '柏林 · 报社后门',
      prose: [
        '编辑把[[paper|早版]]拍在你胸口：“劲是够了。”',
        '“有人打电话来，没留名字。”他看你，像在估你会不会跑。',
      ],
      objects: [{ id: 'paper', label: '早版', hint: '标题比事实跑得快。' }],
      present: [{ name: '编辑', relation: '利益' }],
      choices: [
        { verb: 'publish_rumor', label: '再挖深一点，把科学院也写进边角', objectId: 'paper' },
        { verb: 'hide', label: '改口说消息源不可靠，先软化', objectId: 'paper' },
        { verb: 'follow', label: '去追那个没留名字的电话从哪来', objectId: 'paper' },
      ],
    });
  }

  // Continuity default: your last act leaves a residue + world pressure
  const residue = (lastDelta.consequence || '').slice(0, 42);
  const fact = WORLD_ANCHORS.facts.find((f) => role.anchors.includes(f.id)) || WORLD_ANCHORS.facts[0];
  return makeSituation({
    role,
    world,
    tags: tags.length ? tags : ['corridor'],
    location: role.placeLabel,
    prose: [
      `你刚做完这件事：${lastDelta.label}。`,
      residue ? `${residue}${residue.length >= 42 ? '…' : ''}` : '空气还没恢复原样。',
      `街角的[[news|报童]]喊了一嗓子，内容拐弯抹角地碰到你在意的事：${fact.label}。`,
    ],
    objects: [{ id: 'news', label: '报童', hint: '公开的噪声里，有时藏着私人的危险。' }],
    present: prevSit.present?.slice(0, 2) || [],
    choices: [
      { verb: 'listen', label: '多听一句报童在喊什么', objectId: 'news' },
      { verb: 'note', label: '把报上的措辞记下来', objectId: 'news' },
      { verb: 'walk', label: '离开这片吵闹，换个街区', objectId: 'news' },
    ],
  });
}

function worldTick(session) {
  const world = session.world;
  const role = session.role;
  const prev = session.situation || {};
  world.clock = clockAdd(world.clock, 15);
  world.heat = clamp(world.heat + (Math.random() < 0.35 ? 1 : 0), 0, 10);

  const isPort = role.place === 'hamburg';
  const line = isPort
    ? '广播里报了晚班船延误。队列没有散，骂声换了一批人。'
    : '有人在街角收走了几份刚贴出的通知。纸边还湿着浆糊。';

  world.news.unshift({ t: `${world.date} ${world.clock}`, line });
  world.log.push({ t: `${world.date} ${world.clock}`, action: '（世界自行推进）', consequence: line });

  // Keep character thread when ticking (student: note; port: queue; else ambient)
  if (isPort) {
    session.situation = makeSituation({
      role,
      world,
      tags: ['queue'],
      location: role.placeLabel,
      prose: [
        '你什么也没做的片刻里，世界自己动了。',
        line,
        '台上的[[passport|下一本护照]]已经推到你手边，章还温着。',
      ],
      objects: [{ id: 'passport', label: '下一本护照', hint: '队列不因你发呆而停。' }],
      present: [{ name: '下一个人', relation: '工作' }],
      choices: [
        { verb: 'stamp', label: '机械地盖下去', objectId: 'passport' },
        { verb: 'delay_paper', label: '借延误广播，把这份也拖一拖', objectId: 'passport' },
        { verb: 'ask', label: '抬头问一句：您从哪来', objectId: 'passport' },
      ],
    });
  } else if ((prev.tags || []).includes('lab') || role.occupation.includes('学生')) {
    session.situation = makeSituation({
      role,
      world,
      tags: ['lab'],
      location: role.placeLabel,
      prose: [
        '你站着没动。世界却动了。',
        line,
        '袖口里的[[note|纸条]]还在。走廊尽头的[[watcher|笔尖]]似乎停了一下，又响起来。',
      ],
      objects: [
        { id: 'note', label: '纸条', hint: '还在你身上。' },
        { id: 'watcher', label: '笔尖', hint: '他可能在等你先走。' },
      ],
      present: [{ name: '记录者', relation: '远' }],
      choices: [
        { verb: 'carry_message', label: '立刻把纸条送出去', objectId: 'note' },
        { verb: 'follow', label: '去街角看通知被收去哪', objectId: 'watcher' },
        { verb: 'hide', label: '继续装成看公告的学生', objectId: 'watcher' },
      ],
    });
  } else {
    session.situation = makeSituation({
      role,
      world,
      tags: prev.tags || ['corridor'],
      location: role.placeLabel,
      prose: [
        '你什么也没做的片刻里，世界自己动了。',
        line,
        '你面前仍有一件[[matter|眼前的事]]要处理，它不会因为你发呆而消失。',
      ],
      objects: [{ id: 'matter', label: '眼前的事', hint: '回到你的岗位与物件。' }],
      present: prev.present?.slice(0, 2) || [],
      choices: [
        { verb: 'listen', label: '先听清楚外面在发生什么', objectId: 'matter' },
        { verb: 'note', label: '把刚听到的记下来', objectId: 'matter' },
        { verb: 'walk', label: '走出去看一眼', objectId: 'matter' },
      ],
    });
  }

  session.turn += 1;
  session.lastDelta = {
    actionId: 'world_tick',
    label: '世界自行推进',
    consequence: line,
    timeAdvanceMinutes: 15,
  };
  return session;
}

function publicWorld(world) {
  return {
    date: world.date,
    clock: world.clock,
    place: world.place,
    heat: world.heat,
    suspicion: world.suspicion,
    trustSelf: world.trustSelf,
    flags: { ...world.flags },
    news: world.news.slice(0, 5),
    log: world.log.slice(-8),
  };
}

function publicRole(role) {
  return {
    id: role.id,
    name: role.name,
    occupation: role.occupation,
    placeLabel: role.placeLabel,
    year: role.year,
    date: role.date,
    knows: role.knows,
    can: role.can,
    cannot: role.cannot,
    pressure: role.pressure,
    privateGoals: role.privateGoals,
    seedText: role.seedText,
    compiledFrom: role.compiledFrom,
    verbsFlavor: role.verbsFlavor,
  };
}

function startSession({ presetId, customText }) {
  const role = presetId ? compilePreset(presetId) : compileRoleFromText(customText);
  const world = createInitialWorld(role);
  const situation = openingSituation(role, world);
  const sessionId = id('sess');
  const session = {
    id: sessionId,
    role,
    world,
    situation,
    turn: 1,
    createdAt: new Date().toISOString(),
    lastDelta: null,
  };
  sessions.set(sessionId, session);
  return {
    sessionId,
    role: publicRole(role),
    world: publicWorld(world),
    situation,
    turn: 1,
  };
}

// ─── HTTP ─────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(__dirname, rel);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const p = url.pathname;

  try {
    if (req.method === 'GET' && p === '/api/health') {
      return sendJson(res, 200, { ok: true, service: 'identity-chassis-mvp', presets: Object.keys(PRESETS) });
    }

    if (req.method === 'GET' && p === '/api/presets') {
      return sendJson(res, 200, {
        ok: true,
        presets: Object.entries(PRESETS).map(([id, v]) => ({
          id,
          label: v.seed,
          blurb: v.template.placeLabel + ' · ' + v.template.occupation,
        })),
      });
    }

    if (req.method === 'POST' && p === '/api/session/start') {
      const body = await readBody(req);
      const presetId = body.presetId || null;
      const customText = body.customText || body.identity || '';
      if (!presetId && !String(customText).trim()) {
        return sendJson(res, 400, { ok: false, error: '请选择预设身份，或输入自定义身份' });
      }
      if (presetId && !PRESETS[presetId]) {
        return sendJson(res, 400, { ok: false, error: '未知预设' });
      }
      const started = startSession({ presetId, customText });
      return sendJson(res, 200, { ok: true, ...started });
    }

    if (req.method === 'GET' && p.startsWith('/api/session/')) {
      const sessionId = p.split('/')[3];
      const session = sessions.get(sessionId);
      if (!session) return sendJson(res, 404, { ok: false, error: '会话不存在' });
      return sendJson(res, 200, {
        ok: true,
        sessionId,
        role: publicRole(session.role),
        world: publicWorld(session.world),
        situation: session.situation,
        turn: session.turn,
        lastDelta: session.lastDelta,
      });
    }

    if (req.method === 'POST' && p.endsWith('/act') && p.startsWith('/api/session/')) {
      const sessionId = p.split('/')[3];
      const session = sessions.get(sessionId);
      if (!session) return sendJson(res, 404, { ok: false, error: '会话不存在' });
      const body = await readBody(req);
      const actionId = body.actionId || body.verb;
      if (!actionId) return sendJson(res, 400, { ok: false, error: '缺少 actionId' });
      const result = applyAction(session, actionId);
      if (!result.ok) return sendJson(res, 422, result);
      return sendJson(res, 200, {
        ok: true,
        sessionId,
        role: publicRole(session.role),
        ...result,
      });
    }

    if (req.method === 'POST' && p.endsWith('/tick') && p.startsWith('/api/session/')) {
      const sessionId = p.split('/')[3];
      const session = sessions.get(sessionId);
      if (!session) return sendJson(res, 404, { ok: false, error: '会话不存在' });
      worldTick(session);
      return sendJson(res, 200, {
        ok: true,
        sessionId,
        role: publicRole(session.role),
        world: publicWorld(session.world),
        situation: session.situation,
        turn: session.turn,
        lastDelta: session.lastDelta,
      });
    }

    if (req.method === 'GET') {
      return serveStatic(req, res, p);
    }

    sendJson(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { ok: false, error: err.message || 'server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Identity Chassis MVP  http://${HOST}:${PORT}/`);
});
