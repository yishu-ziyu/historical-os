const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const hintBar = document.querySelector("#hintBar");
const dossier = document.querySelector("#dossier");
const stability = document.querySelector("#stability");
const risk = document.querySelector("#risk");
const nextShape = document.querySelector("#nextShape");
const resetButton = document.querySelector("#resetButton");

const keys = new Set();
const tile = 24;
const assetSheet = new Image();
assetSheet.src = "./assets/berlin_asset_sheet_v1.png";
let assetReady = false;
assetSheet.addEventListener("load", () => {
  assetReady = true;
});

const playerStart = { x: 452, y: 298 };
const player = {
  x: playerStart.x,
  y: playerStart.y,
  w: 22,
  h: 30,
  speed: 2.2,
  facing: "down",
  moving: false,
};

const hotspots = [
  {
    id: "port",
    label: "汉堡港撤离线",
    x: 108,
    y: 94,
    w: 168,
    h: 92,
    color: "#6f9b6a",
    icon: "PASS",
    prompt: "按空格：安排离开德国",
    title: "分叉 A：离开德国",
    result:
      "爱因斯坦离开柏林。世界线回到较稳定的轨道，但美国、英国和流亡学者网络提前被点亮。",
    stability: "86%",
    risk: "低",
    next: "港口电报 / 乘船记录 / 流亡网络地图",
  },
  {
    id: "university",
    label: "普鲁士科学院",
    x: 404,
    y: 80,
    w: 160,
    h: 110,
    color: "#d9a441",
    icon: "DOC",
    prompt: "按空格：留在德国继续发声",
    title: "分叉 B：留下德国",
    result:
      "他选择留在柏林，试图保护学术共同体。公共风险上升，档案系统生成新的监控、信件和同僚关系线。",
    stability: "51%",
    risk: "高",
    next: "科学院档案 / 公开声明 / 风险听证",
  },
  {
    id: "police",
    label: "秘密警察档案室",
    x: 696,
    y: 116,
    w: 164,
    h: 118,
    color: "#b95142",
    icon: "RISK",
    prompt: "按空格：触发抓捕风险线",
    title: "分叉 C：被捕风险",
    result:
      "情报显示他被列入高风险名单。这里不做猎奇死亡演出，而进入严肃历史审计：迫害、营救、舆论与外交干预。",
    stability: "34%",
    risk: "极高",
    next: "风险审计 / 营救任务 / 历史敏感性提示",
  },
  {
    id: "press",
    label: "柏林报社",
    x: 596,
    y: 354,
    w: 172,
    h: 94,
    color: "#8ea3b7",
    icon: "NEWS",
    prompt: "按空格：制造舆论保护",
    title: "分叉 D：公开舆论",
    result:
      "报社开始报道科学家处境。舆论能制造保护，也可能暴露目标。系统进入报纸 UI 和影响力扩散层。",
    stability: "63%",
    risk: "中高",
    next: "报纸头版 / 读者反应 / 国际声援",
  },
];

let activeHotspot = null;
let transition = null;
let lastTime = performance.now();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updatePlayer() {
  let dx = 0;
  let dy = 0;
  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;
  if (keys.has("arrowup") || keys.has("w")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s")) dy += 1;

  player.moving = Boolean(dx || dy);

  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    player.x += (dx / len) * player.speed;
    player.y += (dy / len) * player.speed;
    if (Math.abs(dx) > Math.abs(dy)) player.facing = dx > 0 ? "right" : "left";
    else player.facing = dy > 0 ? "down" : "up";
  }

  player.x = clamp(player.x, 28, canvas.width - player.w - 28);
  player.y = clamp(player.y, 56, canvas.height - player.h - 38);

  activeHotspot = hotspots.find((spot) =>
    rectsOverlap(
      { x: player.x - 6, y: player.y - 6, w: player.w + 12, h: player.h + 12 },
      spot,
    ),
  );

  hintBar.textContent = activeHotspot
    ? `${activeHotspot.label}：${activeHotspot.prompt}`
    : "移动到发光地点，按空格读取分叉。";
}

function drawBackground() {
  ctx.fillStyle = "#171915";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (assetReady) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.drawImage(assetSheet, 0, 210, 1536, 570, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  for (let y = 0; y < canvas.height; y += tile) {
    for (let x = 0; x < canvas.width; x += tile) {
      const alt = (x / tile + y / tile) % 2 === 0;
      ctx.fillStyle = alt ? "#1b1d18" : "#171914";
      ctx.fillRect(x, y, tile, tile);
    }
  }

  drawRoad(0, 274, 960, 66);
  drawRoad(444, 0, 74, 540);
  drawWater();
  drawBuilding(86, 64, 210, 134, "港口客运站", "#2d3a36");
  drawBuilding(388, 62, 196, 148, "科学院", "#41382a");
  drawBuilding(678, 92, 208, 160, "档案室", "#3a2725");
  drawBuilding(578, 334, 212, 132, "报社", "#28323b");
  drawLampPosts();
}

function drawRoad(x, y, w, h) {
  ctx.fillStyle = "#24231f";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(216, 199, 165, 0.18)";
  for (let i = x + 12; i < x + w; i += 64) {
    ctx.fillRect(i, y + h / 2 - 2, 28, 4);
  }
}

function drawWater() {
  ctx.fillStyle = "#18232a";
  ctx.fillRect(0, 0, 960, 46);
  for (let x = 14; x < 940; x += 54) {
    ctx.fillStyle = "rgba(142, 163, 183, 0.24)";
    ctx.fillRect(x, 24 + ((x / 54) % 2) * 6, 32, 3);
  }
}

function drawBuilding(x, y, w, h, label, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(x + 10, y + 12, w - 20, h - 24);
  ctx.fillStyle = "rgba(216, 199, 165, 0.26)";
  for (let wx = x + 24; wx < x + w - 20; wx += 42) {
    ctx.fillRect(wx, y + 34, 18, 18);
    ctx.fillRect(wx, y + 70, 18, 18);
  }
  ctx.fillStyle = "#e2d2ad";
  ctx.font = "16px serif";
  ctx.fillText(label, x + 16, y + h - 18);
}

function drawSheetMotif() {
  if (!assetReady) return;
  ctx.save();
  ctx.globalAlpha = 0.78;
  ctx.drawImage(assetSheet, 982, 36, 420, 232, 764, 300, 146, 82);
  ctx.drawImage(assetSheet, 948, 304, 454, 240, 42, 384, 170, 90);
  ctx.restore();
}

function drawLampPosts() {
  const lamps = [
    [326, 258],
    [546, 258],
    [326, 350],
    [546, 350],
    [830, 318],
  ];
  for (const [x, y] of lamps) {
    ctx.fillStyle = "#5f5031";
    ctx.fillRect(x, y, 4, 28);
    const glow = ctx.createRadialGradient(x + 2, y, 0, x + 2, y, 44);
    glow.addColorStop(0, "rgba(217, 164, 65, 0.36)");
    glow.addColorStop(1, "rgba(217, 164, 65, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x + 2, y, 44, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHotspots(now) {
  for (const spot of hotspots) {
    const pulse = 0.45 + Math.sin(now / 280) * 0.18;
    ctx.strokeStyle = spot.color;
    ctx.lineWidth = activeHotspot?.id === spot.id ? 4 : 2;
    ctx.globalAlpha = activeHotspot?.id === spot.id ? 0.95 : pulse;
    ctx.strokeRect(spot.x, spot.y, spot.w, spot.h);
    ctx.fillStyle = spot.color;
    ctx.globalAlpha = activeHotspot?.id === spot.id ? 0.2 : 0.08;
    ctx.fillRect(spot.x, spot.y, spot.w, spot.h);
    ctx.globalAlpha = 1;
    drawLocationMarker(spot);
    ctx.fillStyle = "#eadfc9";
    ctx.font = "14px serif";
    ctx.fillText(spot.label, spot.x + 10, spot.y - 8);
  }
}

function drawLocationMarker(spot) {
  const markerX = spot.x + spot.w / 2 - 25;
  const markerY = spot.y + spot.h / 2 - 18;
  ctx.fillStyle = "rgba(20, 16, 12, 0.78)";
  ctx.fillRect(markerX, markerY, 50, 36);
  ctx.strokeStyle = spot.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(markerX, markerY, 50, 36);
  ctx.fillStyle = "#f0dfba";
  ctx.font = "12px serif";
  ctx.fillText(spot.icon, markerX + 10, markerY + 23);
}

function drawPlayer(now) {
  const x = Math.round(player.x);
  const y = Math.round(player.y);

  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(x - 4, y + player.h - 2, player.w + 8, 6);

  if (assetReady) {
    drawEinsteinAvatar(x, y, now);
    return;
  }

  drawFallbackPlayer(x, y);
}

function drawEinsteinAvatar(x, y, now) {
  const walk = player.moving ? Math.sin(now / 120) : 0;
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(-6, 28, 34, 7);

  ctx.fillStyle = "#202420";
  ctx.fillRect(3, 8, 18, 22);
  ctx.fillStyle = "#34382f";
  ctx.fillRect(1, 13, 22, 14);
  ctx.fillStyle = "#171817";
  ctx.fillRect(5, 30, 5, 8 + walk);
  ctx.fillRect(15, 30, 5, 8 - walk);

  ctx.fillStyle = "#cdbf9e";
  ctx.fillRect(5, -2, 15, 13);
  ctx.fillStyle = "#e6dfcf";
  ctx.fillRect(1, -5, 6, 8);
  ctx.fillRect(17, -5, 6, 8);
  ctx.fillRect(7, -8, 10, 5);
  ctx.fillStyle = "#5c5548";
  ctx.fillRect(4, 8, 16, 3);
  ctx.fillStyle = "#1d1b18";
  ctx.fillRect(8, 3, 3, 2);
  ctx.fillRect(15, 3, 3, 2);
  ctx.fillRect(10, 10, 8, 2);

  if (player.facing === "left") {
    ctx.fillStyle = "#cdbf9e";
    ctx.fillRect(2, 3, 3, 5);
  } else if (player.facing === "right") {
    ctx.fillStyle = "#cdbf9e";
    ctx.fillRect(20, 3, 3, 5);
  }

  ctx.restore();
}

function drawFallbackPlayer(x, y) {
  ctx.fillStyle = "#c9b78f";
  ctx.fillRect(x + 4, y, 14, 12);
  ctx.fillStyle = "#3d3a32";
  ctx.fillRect(x + 3, y + 9, 16, 3);
  ctx.fillStyle = "#2c302d";
  ctx.fillRect(x + 2, y + 13, 18, 15);
  ctx.fillStyle = "#1c1c1a";
  ctx.fillRect(x + 5, y + 28, 5, 8);
  ctx.fillRect(x + 13, y + 28, 5, 8);
  ctx.fillStyle = "#efe1bd";
  ctx.fillRect(x + 7, y + 5, 3, 2);
  ctx.fillRect(x + 14, y + 5, 3, 2);
}

function drawTransition(now) {
  if (!transition) return;
  const elapsed = now - transition.startedAt;
  const alpha = clamp(elapsed / 260, 0, 1);
  ctx.fillStyle = `rgba(12, 10, 8, ${alpha * 0.82})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (assetReady) {
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.drawImage(assetSheet, 790, 545, 620, 320, 360, 96, 420, 216);
    ctx.restore();
  }

  ctx.fillStyle = "#d8c7a5";
  ctx.font = "28px serif";
  ctx.fillText(transition.title, 84, 176);
  ctx.font = "18px serif";
  wrapText(transition.result, 84, 220, 760, 30);

  if (elapsed > 1800) transition = null;
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = Array.from(text);
  let line = "";
  for (const char of words) {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = char;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function triggerHotspot() {
  if (!activeHotspot) return;
  transition = { ...activeHotspot, startedAt: performance.now() };
  dossier.querySelector("h2").textContent = activeHotspot.title;
  dossier.querySelector("p").textContent = activeHotspot.result;
  stability.textContent = activeHotspot.stability;
  risk.textContent = activeHotspot.risk;
  nextShape.textContent = activeHotspot.next;
}

function resetScene() {
  player.x = playerStart.x;
  player.y = playerStart.y;
  player.facing = "down";
  player.moving = false;
  transition = null;
  dossier.querySelector("h2").textContent = "爱因斯坦仍在柏林";
  dossier.querySelector("p").textContent =
    "真实历史基准中，他于 1933 年离开德国。当前场景把历史选择做成可触发地点，用来测试“行走探索 + 档案分叉”的可玩性。";
  stability.textContent = "72%";
  risk.textContent = "中";
  nextShape.textContent = "档案卡 / 报纸 / 地图反馈";
}

function loop(now) {
  const delta = Math.min(now - lastTime, 32);
  lastTime = now;
  void delta;
  updatePlayer();
  drawBackground();
  drawSheetMotif();
  drawHotspots(now);
  drawPlayer(now);
  drawTransition(now);
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s", " "].includes(key)) {
    event.preventDefault();
  }
  if (key === " ") triggerHotspot();
  else keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

resetButton.addEventListener("click", resetScene);
requestAnimationFrame(loop);
