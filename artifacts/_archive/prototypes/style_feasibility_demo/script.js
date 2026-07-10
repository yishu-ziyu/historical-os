const styles = {
  archive: {
    title: "档案素描风",
    assetScore: "低",
    contentFit: "高",
    webFit: "高",
    summary: "最适合当前项目。人物多、事件多、历史资料多时，用档案卡、素描头像和报纸文本承载内容，资产压力最低，历史感最强。",
    bullets: [
      "人物不做全身行走动画，只做头像、身份、关系、欲望与恐惧。",
      "地图可以是静态纸图，事件通过标记和档案引用进入。",
      "适合 LLM 生成内容，因为文本本身就是界面的一部分。"
    ],
    render(turn) {
      return `
        <div class="archive-layout pulse">
          <section class="paper-card">
            <span class="stamp">异常档案</span>
            <h2>人物档案：阿尔伯特·爱因斯坦</h2>
            <div class="portrait"></div>
            <p><strong>身份：</strong>物理学家 / 犹太知识分子 / 国际舆论符号</p>
            <p><strong>当前状态：</strong>${turn > 0 ? "疑似仍在柏林附近，被多方监控" : "未按基准历史离境"}</p>
            <p><strong>关系风险：</strong>普鲁士科学院、德国警察、海外救援网络、美国学术机构。</p>
          </section>
          <section class="paper-card">
            <div class="newspaper-title">柏林夜报</div>
            <div class="columns">
              <p>本报获悉，一名国际知名科学家仍未离开德国。官方尚未回应边境记录缺失问题。</p>
              <p>档案员发现，基准历史中的通信记录与当前世界线出现断裂。</p>
              <p>${turn > 0 ? "新回合：一份未署名电报声称，卡普特住宅附近出现秘密会面。" : "建议：先核验来源，再决定是否接触目标。"}</p>
            </div>
          </section>
        </div>
      `;
    }
  },
  pixel: {
    title: "极简像素战略地图风",
    assetScore: "中",
    contentFit: "中",
    webFit: "中高",
    summary: "适合展示国家、城市、边境、事件标记和宏观态势，但不适合把 300 个历史人物都做成可移动小人。",
    bullets: [
      "像素地图适合宏观变化，不适合承载复杂人物关系。",
      "必须严格控制分辨率、整数缩放和 UI 字体，否则会显得廉价。",
      "人物仍应以档案卡显示，地图只显示参与事件的少数标记。"
    ],
    render(turn) {
      return `
        <div class="pixel-layout pulse">
          <h2>战略地图 / 1933 欧洲异常层</h2>
          <div class="pixel-map">
            <div class="region uk"></div>
            <div class="region france"></div>
            <div class="region germany"></div>
            <div class="pixel-marker berlin" title="Berlin"></div>
          </div>
          <div class="pixel-log">
            <div><strong>BERLIN</strong><br/>异常信号 ${turn + 1}</div>
            <div><strong>CAPUTH</strong><br/>住宅线索未核验</div>
            <div><strong>PRINCETON</strong><br/>基准通信断裂</div>
          </div>
        </div>
      `;
    }
  },
  wargame: {
    title: "纸上兵棋/历史地图风",
    assetScore: "低",
    contentFit: "高",
    webFit: "高",
    summary: "很适合架空历史推演。它比像素更轻，用纸图、箭头、印章、筹码表达政治、战争、救援与舆论线路。",
    bullets: [
      "地图可以不追求真实地形，重点是关系、方向、压力和事件传播。",
      "战争、政变、瘟疫、外交、救援都能用箭头和标记表达。",
      "适合和报纸/电报/年鉴 UI 合并，形成严肃历史桌面感。"
    ],
    render(turn) {
      return `
        <div class="wargame-layout pulse">
          <h2>纸上推演图：柏林异常事件</h2>
          <div class="map-sheet">
            <div class="front-line"></div>
            <div class="arrow one"></div>
            <div class="arrow two"></div>
            <div class="counter einstein">E-33</div>
            <div class="counter press">PRESS</div>
          </div>
          <div class="dispatch-row">
            <article><strong>外交通道</strong><br/>英国与比利时救援线可尝试重连。</article>
            <article><strong>国内压力</strong><br/>德国学术清洗正在加速。</article>
            <article><strong>新回合</strong><br/>${turn > 0 ? "救援网络暴露风险上升。" : "等待玩家选择干预方向。"}</article>
          </div>
        </div>
      `;
    }
  }
};

let active = "archive";
let turn = 0;

const stage = document.querySelector("#stage");
const title = document.querySelector("#styleTitle");
const summary = document.querySelector("#styleSummary");
const bullets = document.querySelector("#styleBullets");
const assetScore = document.querySelector("#assetScore");
const contentFit = document.querySelector("#contentFit");
const webFit = document.querySelector("#webFit");

function render() {
  const current = styles[active];
  document.querySelector(".workspace").dataset.activeStyle = active;
  title.textContent = current.title;
  summary.textContent = current.summary;
  assetScore.textContent = current.assetScore;
  contentFit.textContent = current.contentFit;
  webFit.textContent = current.webFit;
  bullets.innerHTML = current.bullets.map((item) => `<li>${item}</li>`).join("");
  stage.innerHTML = current.render(turn);
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    active = button.dataset.style;
    turn = 0;
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    render();
  });
});

document.querySelector("#advanceBtn").addEventListener("click", () => {
  turn += 1;
  render();
});

document.querySelector("#resetBtn").addEventListener("click", () => {
  turn = 0;
  render();
});

render();
