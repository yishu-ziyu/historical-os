const seed = {
  title: "爱因斯坦仍在德国",
  story: "柏林的夜雨敲在窗上。系统推送了一条异常：爱因斯坦没有离开德国。\n\n这不是一条普通传闻。真实历史里，他本该避开纳粹德国；但当前世界线里，最后的目击记录仍停在柏林附近。\n\n现在，你要决定这条历史裂缝往哪里生长。",
  choices: [
    { title: "爱因斯坦自杀了", hint: "一位科学家的死亡如何震动欧洲学术界？" },
    { title: "爱因斯坦被纳粹杀害", hint: "国家暴力变成了世界线的第一块多米诺骨牌。" },
    { title: "爱因斯坦被迫进入德国研究机构", hint: "合作、拖延、欺骗，还是暗中破坏？" },
    { title: "爱因斯坦通过秘密渠道逃离", hint: "逃亡路线会牵动哪些人和国家？" }
  ]
};

const fragments = [
  "这件事没有立刻改变战争，却改变了每个人对未来的想象。",
  "最先反应的不是政府，而是一群已经学会沉默的学者。",
  "报纸没有报道真相，只留下了几句互相矛盾的短讯。",
  "一条看似无关的边境记录，突然变成了整条世界线的钥匙。",
  "没有人知道这是偶然、阴谋，还是历史自己选择了另一条路。"
];

const followUps = [
  ["跟进德国科学界", "看学者们如何选择沉默、逃亡或合作。"],
  ["跟进美国情报系统", "看海外世界如何理解这条异常。"],
  ["跟进犹太科学家逃亡网络", "看一条秘密营救线如何形成。"],
  ["跟进纳粹宣传机器", "看政权如何利用或掩盖这件事。"],
  ["跟进爱因斯坦本人", "看他如何在恐惧、责任与求生之间选择。"]
];

let history = [seed];
let current = seed;

const storyText = document.getElementById("storyText");
const choices = document.getElementById("choices");
const nodeList = document.getElementById("nodeList");
const backBtn = document.getElementById("backBtn");
const customInput = document.getElementById("customInput");
const customBtn = document.getElementById("customBtn");

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function generateNode(direction) {
  const existingTitles = new Set(history.map(node => node.title));
  existingTitles.add(direction);

  const nextChoices = [...followUps]
    .filter(([title]) => !existingTitles.has(title))
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(([title, hint]) => ({ title, hint }));

  return {
    title: direction,
    story: `你选择了：${direction}\n\n${expand(direction)}\n\n${pick(fragments)}\n\n故事没有结束。它分裂成了新的几条线。`,
    choices: nextChoices
  };
}

function expand(direction) {
  if (direction.includes("自杀")) {
    return "消息最初被压了下来。几位德国学者在私人信件里提到：死亡本身已经可怕，但更可怕的是它被迫变成一种政治信号。美国和英国的学术救援网络开始重新评估每一个仍在欧洲的科学家。";
  }
  if (direction.includes("杀害")) {
    return "柏林方面没有发布正式声明。几天后，国外报纸只得到互相矛盾的说法：突发疾病、意外、叛国调查。学术界第一次意识到，知识分子的名字也可以成为政权展示力量的材料。";
  }
  if (direction.includes("研究机构") || direction.includes("合作")) {
    return "他被带进一间不对外存在的研究机构。表面上，政权得到了最著名的科学家；实际上，他开始用含混、拖延和错误方向保护某些人，也误导某些人。没有人确定他是在合作，还是在抵抗。";
  }
  if (direction.includes("逃")) {
    return "逃亡不是一条路，而是一串人名。边境官员、旧同事、陌生的记者、看似无关的船票，全都被卷进同一个夜晚。每多一个人知道，安全就少一分。";
  }
  return `这个想法改变了故事的方向：${direction}。系统把它识别为一个新的历史分叉，并开始寻找它会影响的人、地点和后果。`;
}

function render() {
  storyText.textContent = current.story;
  choices.innerHTML = "";
  current.choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.innerHTML = `${choice.title}<small>${choice.hint}</small>`;
    btn.onclick = () => move(choice.title);
    choices.appendChild(btn);
  });

  nodeList.innerHTML = "";
  history.forEach((node, index) => {
    const item = document.createElement("button");
    item.className = `node ${node === current ? "current" : ""}`;
    item.textContent = `${index + 1}. ${node.title}`;
    item.onclick = () => jumpTo(index);
    nodeList.appendChild(item);
  });

  backBtn.disabled = history.length <= 1;
}

function move(direction) {
  current = generateNode(direction);
  history.push(current);
  customInput.value = "";
  render();
}

function jumpTo(index) {
  current = history[index];
  history = history.slice(0, index + 1);
  render();
}

backBtn.onclick = () => {
  if (history.length > 1) {
    history.pop();
    current = history[history.length - 1];
    render();
  }
};

customBtn.onclick = () => {
  const text = customInput.value.trim();
  if (!text) return;
  move(text);
};

render();
