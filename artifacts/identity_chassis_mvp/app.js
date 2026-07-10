const $ = (sel) => document.querySelector(sel);

const state = {
  sessionId: null,
  role: null,
  world: null,
  situation: null,
  thread: null,
  turn: 0,
  lastDelta: null,
  busy: false,
  selectedObjectId: null,
  seenGuide: false,
  lastSituationId: null,
  animateBeat: false,
  animateHint: false,
  animateEcho: false,
};

const el = {
  entry: $('#screen-entry'),
  play: $('#screen-play'),
  presets: $('#preset-list'),
  customForm: $('#custom-form'),
  customInput: $('#custom-input'),
  entryError: $('#entry-error'),
  loading: $('#loading'),
  whoName: $('#who-name'),
  whoJob: $('#who-job'),
  metaTime: $('#meta-time'),
  metaTurn: $('#meta-turn'),
  firstGuide: $('#first-guide'),
  prose: $('#prose'),
  objectHint: $('#object-hint'),
  choicesQ: $('#choices-q'),
  actions: $('#actions'),
  consequence: $('#consequence'),
  knows: $('#knows'),
  news: $('#news'),
  barHeat: $('#bar-heat'),
  barSuspicion: $('#bar-suspicion'),
  btnTick: $('#btn-tick'),
  btnRestart: $('#btn-restart'),
  compileTag: $('#compile-tag'),
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `请求失败 ${res.status}`);
  }
  return data;
}

function setLoading(on) {
  el.loading.hidden = !on;
}

function showError(msg) {
  el.entryError.hidden = !msg;
  el.entryError.textContent = msg || '';
}

function compileLabel(from) {
  if (from === 'preset') return '编译：预设';
  if (from === 'keyword_rule') return '编译：零样本';
  if (from === 'generic_fallback') return '编译：通用回退';
  return `编译：${from || '?'}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function pct(v, max = 10) {
  return `${Math.max(0, Math.min(100, ((Number(v) || 0) / max) * 100))}%`;
}

/** Parse [[objectId|display]] markers into clickable spans */
function renderProseHtml(proseLines, objects) {
  const objMap = new Map((objects || []).map((o) => [o.id, o]));
  return (proseLines || [])
    .map((line) => {
      const html = escapeHtml(line).replace(
        /\[\[([^|\]]+)\|([^\]]+)\]\]/g,
        (_, oid, label) => {
          const active = state.selectedObjectId === oid ? ' is-active' : '';
          const tip = objMap.get(oid)?.hint || '';
          return `<button type="button" class="obj${active}" data-object-id="${escapeHtml(oid)}" title="${escapeHtml(tip)}">${label}</button>`;
        },
      );
      return `<p>${html}</p>`;
    })
    .join('');
}

function applyPayload(data) {
  state.sessionId = data.sessionId;
  state.role = data.role;
  state.world = data.world;
  if (data.thread) state.thread = data.thread;
  const nextSit = data.situation;
  const sitId = nextSit?.id || null;
  state.animateBeat = sitId !== state.lastSituationId;
  state.lastSituationId = sitId;
  state.situation = nextSit;
  state.turn = data.turn;
  state.lastDelta = data.lastDelta || data.delta || null;
  state.animateEcho = Boolean(state.lastDelta?.consequence);
  state.selectedObjectId = null;
  renderPlay();
}

function renderEntryPresets(presets) {
  el.presets.innerHTML = '';
  for (const p of presets) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-card';
    btn.innerHTML = `<strong>${escapeHtml(p.label)}</strong><span>${escapeHtml(p.blurb)}</span>`;
    btn.addEventListener('click', () => startSession({ presetId: p.id }));
    el.presets.appendChild(btn);
  }
}

function selectObject(objectId) {
  if (state.selectedObjectId === objectId) {
    state.selectedObjectId = null;
    state.animateHint = false;
  } else {
    state.selectedObjectId = objectId;
    state.animateHint = true;
  }
  state.animateBeat = false;
  renderPlay();
}

function renderPlay() {
  el.entry.hidden = true;
  el.play.hidden = false;

  const r = state.role;
  const w = state.world;
  const s = state.situation;
  if (!r || !s || !w) return;

  const beatAnim = state.animateBeat;
  const hintAnim = state.animateHint;
  const echoAnim = state.animateEcho;

  el.whoName.textContent = r.name;
  el.whoJob.textContent = `${r.occupation}`;
  el.metaTime.textContent = s.time || `${w.date} ${w.clock}`;
  const thr = state.thread;
  el.metaTurn.textContent = thr?.beat
    ? `第 ${state.turn} 拍 · 线 ${thr.beat}`
    : `第 ${state.turn} 拍`;
  el.compileTag.textContent = compileLabel(r.compiledFrom);

  const meta = el.whoName.closest('.book-meta');
  if (meta) {
    meta.classList.toggle('is-entering', beatAnim);
  }

  el.firstGuide.hidden = !(state.turn <= 2);
  if (state.turn > 2) state.seenGuide = true;

  // Prose with object hotspots (C inside D)
  const proseLines =
    s.prose && s.prose.length
      ? s.prose
      : [s.summary || s.sensory || '（无正文）'].filter(Boolean);
  el.prose.innerHTML = renderProseHtml(proseLines, s.objects);
  el.prose.classList.toggle('is-entering', beatAnim);
  el.prose.querySelectorAll('.obj').forEach((btn) => {
    btn.addEventListener('click', () => selectObject(btn.getAttribute('data-object-id')));
  });

  // Object hint
  if (state.selectedObjectId) {
    const obj = (s.objects || []).find((o) => o.id === state.selectedObjectId);
    el.objectHint.hidden = false;
    el.objectHint.textContent = obj
      ? `关于「${obj.label}」：${obj.hint || '与下面标亮的选择相关。'}`
      : '与该物件相关的选择已标亮。';
    el.objectHint.classList.toggle('is-pop', hintAnim);
    el.choicesQ.textContent = obj ? `关于「${obj.label}」，你要怎么做？` : '你怎么办？';
  } else {
    el.objectHint.hidden = true;
    el.objectHint.textContent = '';
    el.objectHint.classList.remove('is-pop');
    el.choicesQ.textContent = '你怎么办？';
  }

  // Choices (D list + B situational labels)
  el.actions.innerHTML = '';
  el.actions.classList.toggle('is-entering', beatAnim);
  const actions = s.actions || [];
  actions.forEach((a, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice';
    btn.disabled = state.busy;
    const related =
      state.selectedObjectId && a.objectId && a.objectId === state.selectedObjectId;
    const dimmed =
      state.selectedObjectId && a.objectId && a.objectId !== state.selectedObjectId;
    if (related) btn.classList.add('is-related');
    if (dimmed) btn.classList.add('is-dimmed');
    btn.innerHTML = `<span class="num">${i + 1}.</span>${escapeHtml(a.label)}`;
    btn.addEventListener('click', () => {
      btn.classList.add('is-press');
      doAct(a.id || a.verb);
    });
    el.actions.appendChild(btn);
  });

  // Consequence echo (weak, italic) — not competing with prose
  if (state.lastDelta && state.lastDelta.consequence) {
    el.consequence.hidden = false;
    el.consequence.innerHTML = `<strong>${escapeHtml(state.lastDelta.label || '刚才')}</strong>${escapeHtml(state.lastDelta.consequence)}`;
    el.consequence.classList.toggle('is-fresh', echoAnim);
  } else {
    el.consequence.hidden = true;
    el.consequence.textContent = '';
    el.consequence.classList.remove('is-fresh');
  }

  // consume one-shot animation flags after paint
  if (beatAnim || hintAnim || echoAnim) {
    requestAnimationFrame(() => {
      state.animateBeat = false;
      state.animateHint = false;
      state.animateEcho = false;
    });
  }

  // Fold secondary
  el.knows.innerHTML = '';
  for (const k of (r.knows || []).slice(0, 5)) {
    const li = document.createElement('li');
    li.textContent = k;
    el.knows.appendChild(li);
  }
  el.news.innerHTML = '';
  const news = w.news || [];
  if (!news.length) {
    const li = document.createElement('li');
    li.textContent = '暂时安静。';
    el.news.appendChild(li);
  } else {
    for (const n of news.slice(0, 4)) {
      const li = document.createElement('li');
      li.textContent = `${n.t} — ${n.line}`;
      el.news.appendChild(li);
    }
  }
  el.barHeat.style.width = pct(w.heat);
  el.barSuspicion.style.width = pct(w.suspicion);
}

async function startSession(payload) {
  showError('');
  setLoading(true);
  state.busy = true;
  try {
    const data = await api('/api/session/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.busy = false;
    state.seenGuide = false;
    applyPayload(data);
  } catch (e) {
    showError(e.message);
    el.entry.hidden = false;
    el.play.hidden = true;
  } finally {
    state.busy = false;
    setLoading(false);
    if (state.sessionId) renderPlay();
  }
}

async function doAct(actionId) {
  if (!state.sessionId || state.busy) return;
  state.busy = true;
  renderPlay();
  try {
    const data = await api(`/api/session/${state.sessionId}/act`, {
      method: 'POST',
      body: JSON.stringify({ actionId }),
    });
    state.lastDelta = data.delta;
    state.world = data.world;
    if (data.thread) state.thread = data.thread;
    const sitId = data.situation?.id || null;
    state.animateBeat = sitId !== state.lastSituationId;
    state.lastSituationId = sitId;
    state.situation = data.situation;
    state.turn = data.turn;
    if (data.role) state.role = data.role;
    state.selectedObjectId = null;
    state.animateEcho = true;
  } catch (e) {
    el.consequence.hidden = false;
    el.consequence.innerHTML = `<strong>做不到</strong>${escapeHtml(e.message)}`;
  } finally {
    state.busy = false;
    renderPlay();
  }
}

async function doTick() {
  if (!state.sessionId || state.busy) return;
  state.busy = true;
  try {
    const data = await api(`/api/session/${state.sessionId}/tick`, {
      method: 'POST',
      body: '{}',
    });
    state.lastDelta = data.lastDelta;
    state.world = data.world;
    if (data.thread) state.thread = data.thread;
    const sitId = data.situation?.id || null;
    state.animateBeat = sitId !== state.lastSituationId;
    state.lastSituationId = sitId;
    state.situation = data.situation;
    state.turn = data.turn;
    state.selectedObjectId = null;
    state.animateEcho = true;
  } catch (e) {
    el.consequence.hidden = false;
    el.consequence.innerHTML = `<strong>错误</strong>${escapeHtml(e.message)}`;
  } finally {
    state.busy = false;
    renderPlay();
  }
}

function restart() {
  state.sessionId = null;
  state.role = null;
  state.world = null;
  state.situation = null;
  state.turn = 0;
  state.lastDelta = null;
  state.selectedObjectId = null;
  state.lastSituationId = null;
  state.animateBeat = false;
  el.play.hidden = true;
  el.entry.hidden = false;
  showError('');
  el.customInput.value = '';
}

el.customForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const customText = el.customInput.value.trim();
  if (!customText) {
    showError('写一个身份，或点上面的预设。');
    return;
  }
  startSession({ customText });
});

el.btnTick.addEventListener('click', doTick);
el.btnRestart.addEventListener('click', restart);

api('/api/presets')
  .then((data) => renderEntryPresets(data.presets || []))
  .catch((e) => showError(`无法加载预设：${e.message}`));
