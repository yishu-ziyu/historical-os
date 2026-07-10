/**
 * Multi-beat story threads for identity chassis.
 * Each role archetype advances along a 5+ beat arc.
 * Beats read session flags so choices branch without abandoning the thread.
 */

export function threadIdForRole(role) {
  if (role.place === 'hamburg' || /港口|办事员/.test(role.occupation || '')) return 'port';
  if ((role.occupation || '').includes('记者')) return 'reporter';
  if ((role.occupation || '').includes('学生')) return 'student';
  return 'clerk';
}

export function createThread(role) {
  return {
    id: threadIdForRole(role),
    beat: 0,
    history: [],
  };
}

/** Record what the player did so later prose can name it. */
export function rememberAct(thread, { verb, label, objectId }) {
  thread.history.push({ verb, label, objectId: objectId || null, atBeat: thread.beat });
  thread.beat += 1;
  thread.lastVerb = verb;
  thread.lastLabel = label;
  thread.lastObjectId = objectId || null;
}

function lastLabel(thread, fallback = '你刚才做的事') {
  return thread.lastLabel || fallback;
}

/**
 * Return beat content builder inputs for makeSituation.
 * beat index is the beat we are ENTERING (after rememberAct, beat is already incremented).
 */
export function situationForThread({ role, world, thread }) {
  const beats = ARCS[thread.id] || ARCS.clerk;
  const idx = Math.min(thread.beat, beats.length - 1);
  const builder = beats[idx];
  return builder({ role, world, thread, flags: world.flags, idx });
}

/** Idle / world-tick still stays on-thread */
export function tickSituationForThread({ role, world, thread }) {
  const flags = world.flags;
  const id = thread.id;

  if (id === 'port') {
    return {
      tags: ['queue'],
      location: role.placeLabel,
      prose: [
        '你发呆的片刻里，广播又报了一班延误。',
        flags.let_someone_through
          ? '队列里有人低声说：刚才那个窗口手松。你假装没听见。'
          : '台上的[[passport|下一本护照]]又推到你手边，像潮水。',
        '船期不会因为你停下来而停。',
      ],
      objects: [{ id: 'passport', label: '下一本护照', hint: '工作还在。' }],
      present: [{ name: '队列', relation: '持续' }],
      choices: [
        { verb: 'stamp', label: '继续盖章', objectId: 'passport' },
        { verb: 'delay_paper', label: '再卡一份“待补”', objectId: 'passport' },
        { verb: 'ask', label: '问一句来处与去向', objectId: 'passport' },
      ],
    };
  }

  if (id === 'student') {
    return {
      tags: ['lab'],
      location: role.placeLabel,
      prose: [
        '你站着没动。世界却动了。',
        flags.secret_message || flags.carry_message || flags.has_notes
          ? '袖口/口袋里那点纸的重量还在。街角有人在收[[notice|通知]]，浆糊未干。'
          : '街角有人在收[[notice|通知]]。走廊尽头的笔尖仍在响。',
        '普朗克的事没有因为你发呆而结束。',
      ],
      objects: [{ id: 'notice', label: '通知', hint: '和学院的气氛连在一起。' }],
      present: [{ name: '街角', relation: '外界' }],
      choices: [
        { verb: 'follow', label: '跟着看通知被收去哪', objectId: 'notice' },
        { verb: 'hide', label: '退回系里，装作看公告', objectId: 'notice' },
        { verb: 'note', label: '只记下时间与收通知的人的衣着', objectId: 'notice' },
      ],
    };
  }

  if (id === 'reporter') {
    return {
      tags: ['cafe'],
      location: role.placeLabel,
      prose: [
        '你没追问的空档里，咖啡馆换了一拨人。',
        flags.published
          ? '有人把早版叠在邻桌，标题像在看你。'
          : '线人留下的[[tip|位置]]还空着，杯托湿印没干。',
        '独家不会自己走过来。',
      ],
      objects: [{ id: 'tip', label: '线人的位置', hint: '线索还热。' }],
      present: [{ name: '空位', relation: '未完' }],
      choices: [
        { verb: 'ask', label: '再找线人的接头暗号', objectId: 'tip' },
        { verb: 'follow', label: '去科学院外围转一圈', objectId: 'tip' },
        { verb: 'note', label: '把已知碎片写成时间线', objectId: 'tip' },
      ],
    };
  }

  // clerk
  return {
    tags: ['corridor'],
    location: role.placeLabel,
    prose: [
      '你停了一会儿。打字声没有停。',
      flags.delayed_exit || flags.read_sensitive
        ? '那封信的位置在你脑子里发光，像没盖好的墨水瓶。'
        : '通信架上又多了一叠[[mail|新到的信]]。',
      '文件不会等人。',
    ],
    objects: [{ id: 'mail', label: '新到的信', hint: '程序的下一拍。' }],
    present: [{ name: '通信架', relation: '工作' }],
    choices: [
      { verb: 'read_mail', label: '抽一封核对', objectId: 'mail' },
      { verb: 'delay_paper', label: '先把敏感的压一压', objectId: 'mail' },
      { verb: 'whisper', label: '问艾尔莎今天谁来过侧楼', objectId: 'mail' },
    ],
  };
}

// ─── arcs: index 0 = opening (also mirrored in openingSituation) ───
// After first act, beat becomes 1, so beats[1] is second scene, etc.

const ARCS = {
  student: [
    // 0 opening handled externally; keep placeholder for index safety
    () => null,
    // 1 after first choice
    ({ thread, flags }) => {
      const took = flags.secret_message || flags.carry_message || flags.has_notes;
      const hid = flags.looked_away;
      return {
        tags: ['lab'],
        location: '柏林 · 大学物理系侧廊',
        prose: [
          took
            ? `你做完了：${lastLabel(thread)}。纸的棱角还抵着手腕。`
            : `你做完了：${lastLabel(thread)}。讲义下已经空了，像什么都没发生过。`,
          hid
            ? '记录者的笔尖顿了一下，又写起来。你不确定他是否写下了你的背影。'
            : '走廊尽头那人合上本子，朝楼梯口走。他没有回头。',
          '楼下中庭有人在低声念一个名字——你听清了半个音节，像“爱因…”。',
        ],
        objects: [
          { id: 'stairs', label: '楼梯口', hint: '记录者下去了。' },
          { id: 'wrist', label: '手腕', hint: took ? '纸条还在。' : '空的。' },
        ],
        present: [
          { name: '记录者', relation: '刚离开' },
          { name: '中庭的声音', relation: '传闻' },
        ],
        choices: [
          { verb: 'follow', label: '跟着记录者下楼，保持距离', objectId: 'stairs' },
          { verb: 'carry_message', label: took ? '按地址把纸条送出去' : '回讲台再确认是否还有第二张', objectId: 'wrist' },
          { verb: 'listen', label: '下到中庭，听清那个名字', objectId: 'stairs' },
        ],
      };
    },
    // 2
    ({ thread, flags }) => ({
      tags: ['lab'],
      location: '柏林 · 中庭到街角',
      prose: [
        `上一拍你选择了：${lastLabel(thread)}。`,
        flags.followed
          ? '记录者进了街角一间没有招牌的门。门缝里有打字声。'
          : '你没有跟上去。风把一张[[notice|通知]]的碎角吹到你鞋边——墨迹未干。',
        flags.secret_message || flags.has_notes
          ? '你忽然意识到：纸条上的缩写，和通知边角的机关字号，可能是同一套笔迹习惯。'
          : '有人说科学院今晚有“内部说明会”。谁都可以听，只要你敢进去。',
      ],
      objects: [
        { id: 'door', label: '无招牌的门', hint: '打字声。' },
        { id: 'notice', label: '通知碎角', hint: '字号与笔迹。' },
      ],
      present: [{ name: '街角', relation: '分叉' }],
      choices: [
        { verb: 'follow', label: '在门对面的报亭耗十分钟，看谁进出', objectId: 'door' },
        { verb: 'note', label: '抄下通知碎角上的字号', objectId: 'notice' },
        { verb: 'walk', label: '回实验室，把今天写进只有自己懂的符号', objectId: 'notice' },
      ],
    }),
    // 3
    ({ thread, flags }) => ({
      tags: ['lab'],
      location: '柏林 · 物理系夜间',
      prose: [
        '天色暗了。系里只剩值夜的灯。',
        `你一路带着的选择还在：${lastLabel(thread)}。`,
        flags.has_notes || flags.secret_message
          ? '抽屉被人翻过的痕迹更明显了——不是乱翻，是找一样薄的东西。'
          : '普朗克的办公室门缝下透出光。他很少这么晚还在。',
        '窗外有车停了太久。',
      ],
      objects: [
        { id: 'drawer', label: '抽屉', hint: '有人知道你拿过纸。' },
        { id: 'office', label: '普朗克的门', hint: '还亮着。' },
      ],
      present: [{ name: '夜', relation: '压力' }],
      choices: [
        { verb: 'hide', label: '把敏感的东西转移到鞋跟夹层', objectId: 'drawer' },
        { verb: 'whisper', label: '敲普朗克的门，只说一句“有人翻过”', objectId: 'office' },
        { verb: 'walk', label: '从侧门离开，今晚不回宿舍正门', objectId: 'drawer' },
      ],
    }),
    // 4
    ({ thread, flags }) => ({
      tags: ['lab'],
      location: '柏林 · 次日清晨',
      prose: [
        '报纸送到实验室门口，油墨未干。',
        flags.published
          ? '边角里已经有人写“某科学家行程成谜”。你的名字不在上面，但圈子很小。'
          : '没有你的名字。只有一行更冷的通告：若干讲座改期，名单不公示。',
        `你昨天的动作（${lastLabel(thread)}）已经变成别人嘴里的版本——你还没来得及解释。`,
        '普朗克在走廊尽头对你点了点头，很轻，像确认你还活着。',
      ],
      objects: [
        { id: 'paper', label: '报纸', hint: '公开世界的回声。' },
        { id: 'planck', label: '普朗克', hint: '他还在。' },
      ],
      present: [
        { name: '普朗克', relation: '师长' },
        { name: '报纸', relation: '外界' },
      ],
      choices: [
        { verb: 'ask', label: '问普朗克：纸条的下一环还要不要送', objectId: 'planck' },
        { verb: 'note', label: '把报纸通告剪下来夹进草稿本', objectId: 'paper' },
        { verb: 'hide', label: '假装只关心课程表，先活过这周', objectId: 'paper' },
      ],
    }),
    // 5+ epilogue loop with continuity
    ({ role, thread, flags }) => ({
      tags: ['lab'],
      location: role.placeLabel || '柏林 · 物理系',
      prose: [
        `线还没断。你最近一次选择是：${lastLabel(thread)}。`,
        flags.secret_message || flags.has_notes
          ? '纸条或它的抄本仍在你控制的某处。它让你比昨天更重，也更清楚。'
          : '你没有握住那张纸。空白本身也是一种立场。',
        '下一项压力已经在门口：有人要约“谈话”，时间写在便条上，没有署名。',
      ],
      objects: [{ id: 'summons', label: '约谈便条', hint: '可去，可拖，可告诉老师。' }],
      present: [{ name: '便条', relation: '下一拍' }],
      choices: [
        { verb: 'ask', label: '拿着便条去问普朗克是否知情', objectId: 'summons' },
        { verb: 'delay_paper', label: '把约谈拖到“考试周之后”', objectId: 'summons' },
        { verb: 'walk', label: '先离开柏林三天，让约谈找不到人', objectId: 'summons' },
      ],
    }),
  ],

  port: [
    () => null,
    ({ thread, flags }) => ({
      tags: ['queue'],
      location: '汉堡 · 港口证件窗口',
      prose: [
        `章落之后（${lastLabel(thread)}），队列只安静了一秒。`,
        flags.let_someone_through
          ? '男人消失在雨里。里间的烟浓了一点。上司咳嗽，像暗号。'
          : '男人还在“待补”格前站着。孩子的帽子湿了。',
        '下一本[[passport|护照]]已经推上来。你的手还热。',
      ],
      objects: [
        { id: 'passport', label: '下一本护照', hint: '工作不结束。' },
        { id: 'smoke', label: '里间的烟', hint: '上司在看节奏。' },
      ],
      present: [{ name: '上司', relation: '监视感' }],
      choices: [
        { verb: 'stamp', label: '机械地继续放行', objectId: 'passport' },
        { verb: 'delay_paper', label: '把下一份也拖进待补', objectId: 'passport' },
        { verb: 'bribe_small', label: '把“手续费”习惯压下去，假装整理印章', objectId: 'smoke' },
      ],
    }),
    ({ thread, flags }) => ({
      tags: ['queue'],
      location: '汉堡 · 港区侧廊',
      prose: [
        '轮班间隙你走到侧廊透气。',
        flags.let_someone_through
          ? '窗台上有一颗[[candy|糖]]。没有字。汽笛第三次响。'
          : '侧廊贴了一张新的[[list|检查加严说明]]。字号很大，像说给你看。',
        `你上午的选择（${lastLabel(thread)}）已经在同事的玩笑里变了味。`,
      ],
      objects: [
        { id: 'candy', label: '糖', hint: '谢谢或把柄。' },
        { id: 'list', label: '加严说明', hint: '程序在收紧。' },
      ],
      present: [{ name: '同事的玩笑', relation: '舆论' }],
      choices: [
        { verb: 'note', label: '记下谁先开始传“手松”的说法', objectId: 'list' },
        { verb: 'hide', label: '把糖拨开，当什么都没有', objectId: 'candy' },
        { verb: 'stamp', label: '提前回窗，用更多“按章”洗白自己', objectId: 'list' },
      ],
    }),
    ({ thread, flags }) => ({
      tags: ['queue'],
      location: '汉堡 · 证件窗口（午后）',
      prose: [
        '下午的人更急。有人把[[ticket|船票]]拍在玻璃上，喊今晚最后一班。',
        flags.dirty_hands
          ? '你袖口还留着别人的体温和纸币的涩。'
          : '你的袖口干净，良心未必。',
        '上司第一次走到你身后，看了你三分钟，什么都没说。',
      ],
      objects: [
        { id: 'ticket', label: '船票', hint: '时间在吼。' },
        { id: 'boss', label: '上司', hint: '沉默比骂更重。' },
      ],
      present: [{ name: '上司', relation: '压迫' }],
      choices: [
        { verb: 'stamp', label: '在他注视下盖一个“可争议”的章', objectId: 'ticket' },
        { verb: 'delay_paper', label: '严格到让他满意，也让一家人错过船', objectId: 'boss' },
        { verb: 'ask', label: '转过身问上司：这份缺页怎么算', objectId: 'boss' },
      ],
    }),
    ({ thread, flags }) => ({
      tags: ['queue'],
      location: '汉堡 · 下班铃后',
      prose: [
        '铃响了。你本可以走。',
        flags.let_someone_through
          ? '一份没有抬头的内部条塞进你的格子：明日请说明上午放行标准。'
          : '格子里没有条子。只有干净的章与更重的明天。',
        `今天你反复做的那种事（最近一次：${lastLabel(thread)}）已经写成别人的报告素材。`,
      ],
      objects: [{ id: 'memo', label: '内部条', hint: '审计的第一声。' }],
      present: [{ name: '内部条', relation: '后果' }],
      choices: [
        { verb: 'note', label: '连夜写一份“程序说明”草稿', objectId: 'memo' },
        { verb: 'hide', label: '把条子夹进别的档案，假装没看见', objectId: 'memo' },
        { verb: 'walk', label: '先回家，明天再决定是否硬刚', objectId: 'memo' },
      ],
    }),
    ({ thread }) => ({
      tags: ['queue'],
      location: '汉堡 · 港口',
      prose: [
        `线索仍是港口与证件。你上一拍：${lastLabel(thread)}。`,
        '新的一天，新的队列。世界没有给你“通关结束”的字幕。',
        '有人在窗口放下一本你似曾相识的护照——姓氏你见过。',
      ],
      objects: [{ id: 'passport', label: '似曾相识的护照', hint: '故事还在循环里加深。' }],
      present: [{ name: '队列', relation: '持续世界' }],
      choices: [
        { verb: 'stamp', label: '认出姓氏，仍然盖章', objectId: 'passport' },
        { verb: 'delay_paper', label: '认出姓氏，故意卡住', objectId: 'passport' },
        { verb: 'ask', label: '低声问：您是否与昨日那人同行', objectId: 'passport' },
      ],
    }),
  ],

  reporter: [
    () => null,
    ({ thread, flags }) => ({
      tags: ['cafe'],
      location: '柏林 · 咖啡馆外街',
      prose: [
        `你离开座位时还想着：${lastLabel(thread)}。`,
        flags.followed
          ? '深色外套拐进一条小巷，停在科学院侧门对面的报亭。'
          : flags.published
            ? '报童已经在喊一种被你催肥的标题。'
            : '线人消失得干净。杯托下只剩湿印。',
        '雨开始下。字会晕，消息更快。',
      ],
      objects: [
        { id: 'kiosk', label: '报亭', hint: '观察点。' },
        { id: 'rain', label: '雨', hint: '掩盖脚步。' },
      ],
      present: [{ name: '街', relation: '追踪' }],
      choices: [
        { verb: 'follow', label: '在报亭买一份晚报，盯侧门', objectId: 'kiosk' },
        { verb: 'publish_rumor', label: '先打电话回社里占版面', objectId: 'rain' },
        { verb: 'bribe_small', label: '给报亭老板一笔“记性钱”', objectId: 'kiosk' },
      ],
    }),
    ({ thread, flags }) => ({
      tags: ['cafe'],
      location: '柏林 · 报社',
      prose: [
        '编辑把手指敲在桌上。',
        `“你带来的是${lastLabel(thread)}。我要的是能印的。”`,
        flags.published
          ? '电话响了第二次。没人说话，只有呼吸。'
          : '他还愿意等你一小时——只要你回来时带着名字。',
      ],
      objects: [{ id: 'phone', label: '电话', hint: '威胁或线索。' }],
      present: [{ name: '编辑', relation: '压力' }],
      choices: [
        { verb: 'ask', label: '追问电话从哪条线打进', objectId: 'phone' },
        { verb: 'publish_rumor', label: '用匿名“接近内情人士”再出一条', objectId: 'phone' },
        { verb: 'hide', label: '要求撤下署名，只留社论口吻', objectId: 'phone' },
      ],
    }),
    ({ thread, flags }) => ({
      tags: ['cafe'],
      location: '柏林 · 科学院外围',
      prose: [
        '你终于站在铁栅外。',
        flags.asked_once
          ? '线人给过的半个名字在这里对上了门牌。'
          : '你没有任何名字，只有风向与烟囱。',
        `你一路的选择（${lastLabel(thread)}）把你送到这里——不是英雄，是记者。`,
      ],
      objects: [{ id: 'gate', label: '铁栅门', hint: '进不去，但能等。' }],
      present: [{ name: '门卫', relation: '障碍' }],
      choices: [
        { verb: 'ask', label: '用采访证件试门卫', objectId: 'gate' },
        { verb: 'follow', label: '跟着下班的助理走两条街', objectId: 'gate' },
        { verb: 'note', label: '只记录进出车辆与时间', objectId: 'gate' },
      ],
    }),
    ({ thread, flags }) => ({
      tags: ['cafe'],
      location: '柏林 · 夜',
      prose: [
        '你把今天写成三页，又划掉两页。',
        flags.published
          ? '早版已经让某些人睡不好。你也是。'
          : '什么都还没印。你的包里只有湿袜子与笔记。',
        `上一拍：${lastLabel(thread)}。故事没有“结局按钮”，只有下一期截稿。`,
      ],
      objects: [{ id: 'copy', label: '稿纸', hint: '可印，可烧，可藏。' }],
      present: [{ name: '截稿', relation: '时限' }],
      choices: [
        { verb: 'publish_rumor', label: '交一版擦边但够劲的稿', objectId: 'copy' },
        { verb: 'note', label: '把真名只写在自己的密码本', objectId: 'copy' },
        { verb: 'walk', label: '换旅店睡，明天再写', objectId: 'copy' },
      ],
    }),
    ({ thread }) => ({
      tags: ['cafe'],
      location: '柏林',
      prose: [
        `线仍在科学院与报纸之间。你最近一次动作：${lastLabel(thread)}。`,
        '新的线头出现：有人愿意“匿名见面”，地点写在火柴盒内侧。',
      ],
      objects: [{ id: 'matchbox', label: '火柴盒', hint: '下一场。' }],
      present: [{ name: '匿名', relation: '饵' }],
      choices: [
        { verb: 'follow', label: '赴约，但早到一小时踩点', objectId: 'matchbox' },
        { verb: 'ask', label: '先找编辑商量要不要带第二个人', objectId: 'matchbox' },
        { verb: 'hide', label: '不赴约，只把火柴盒交给警方——或扔掉', objectId: 'matchbox' },
      ],
    }),
  ],

  clerk: [
    () => null,
    ({ thread, flags }) => ({
      tags: ['corridor'],
      location: '柏林 · 科学院侧楼',
      prose: [
        `你处理完那份：${lastLabel(thread)}。`,
        flags.read_sensitive
          ? '信里没有阴谋的形容词，只有一个日期与一个码头名。你不该知道。'
          : flags.delayed_exit
            ? '信还在最底下。像一颗没有拔掉的刺。'
            : '艾尔莎看了你一眼，什么都没问。',
        '下午的会议名单送来了。有两个名字被铅笔轻轻框过。',
      ],
      objects: [
        { id: 'list', label: '会议名单', hint: '铅笔框。' },
        { id: 'letter', label: '那封信', hint: '还在或不在。' },
      ],
      present: [{ name: '艾尔莎', relation: '同级' }],
      choices: [
        { verb: 'note', label: '记下被框的两个名字', objectId: 'list' },
        { verb: 'delay_paper', label: '把名单也压一压', objectId: 'list' },
        { verb: 'whisper', label: '问艾尔莎铅笔是谁的', objectId: 'list' },
      ],
    }),
    ({ thread, flags }) => ({
      tags: ['corridor'],
      location: '柏林 · 档案室',
      prose: [
        '你被临时叫去“协助整理”。',
        `这当然与你上午的动作有关：${lastLabel(thread)}。`,
        flags.has_notes
          ? '你的笔记在口袋里发烫。档案室的灯太亮。'
          : '你两手空空，反而像最安全的人。',
        '一册[[registry|特别登记]]的副本就在推车上层，封面朝下。',
      ],
      objects: [{ id: 'registry', label: '特别登记', hint: '不该单独待着。' }],
      present: [{ name: '档案员', relation: '程序' }],
      choices: [
        { verb: 'read_mail', label: '借整理之机翻开封面朝下的册子', objectId: 'registry' },
        { verb: 'hide', label: '只搬无关的箱子，眼睛看地', objectId: 'registry' },
        { verb: 'note', label: '记住册子的编号与位置', objectId: 'registry' },
      ],
    }),
    ({ thread, flags }) => ({
      tags: ['corridor'],
      location: '柏林 · 侧楼黄昏',
      prose: [
        '下班铃响了两次。',
        flags.read_sensitive || flags.has_notes
          ? '你知道的东西已经超过文书助理的工资所覆盖的风险。'
          : '你仍只是螺丝钉。螺丝钉也有锈穿的时候。',
        `上一拍：${lastLabel(thread)}。走廊尽头有人在等你签字领“说明义务”。`,
      ],
      objects: [{ id: 'form', label: '说明义务表', hint: '签或不签。' }],
      present: [{ name: '等人签字的人', relation: '程序暴力' }],
      choices: [
        { verb: 'delay_paper', label: '推说要请示上级再签', objectId: 'form' },
        { verb: 'hide', label: '签一个最小范围的版本', objectId: 'form' },
        { verb: 'walk', label: '从消防梯离开，明天再解释', objectId: 'form' },
      ],
    }),
    ({ thread }) => ({
      tags: ['corridor'],
      location: '柏林 · 次日',
      prose: [
        '新的公文匣比昨天厚。',
        `你的线还在科学院的纸堆里。最近一次选择：${lastLabel(thread)}。`,
        '有人托艾尔莎带话：别多手。也有人托她带话：多看一眼。',
      ],
      objects: [{ id: 'msg', label: '带话', hint: '两个方向。' }],
      present: [{ name: '艾尔莎', relation: '通道' }],
      choices: [
        { verb: 'whisper', label: '问清楚两句话分别来自谁', objectId: 'msg' },
        { verb: 'note', label: '只把原话记下来，不表态', objectId: 'msg' },
        { verb: 'hide', label: '对艾尔莎说：当我没听见', objectId: 'msg' },
      ],
    }),
    ({ thread }) => ({
      tags: ['corridor'],
      location: '柏林 · 科学院',
      prose: [
        `文书工作仍在转。你上一拍：${lastLabel(thread)}。`,
        '新的异常是一张未编号的便条，夹在普通通知里：码头名与日期——与你见过的信一致。',
      ],
      objects: [{ id: 'slip', label: '未编号便条', hint: '同一条线。' }],
      present: [{ name: '便条', relation: '回声' }],
      choices: [
        { verb: 'read_mail', label: '把便条与旧信细节对照', objectId: 'slip' },
        { verb: 'delay_paper', label: '让便条“丢失”在无害堆里', objectId: 'slip' },
        { verb: 'whisper', label: '只把码头名告诉一个你信得过的人', objectId: 'slip' },
      ],
    }),
  ],
};

