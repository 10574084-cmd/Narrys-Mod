// Menú principal, ajustes y conexión con el juego
import { MAP_DEFS, CHOCO_DEF, generateMap, N, setMapSize } from './maps.js';
import { Game, isTouch } from './game.js';
import { TitleScene } from './title.js';
import { DEFAULT_KEYS, DEFAULT_PERF, DEFAULT_EXTRA, ACTIONS, keyLabel } from './settings.js';
import { runIntro, introActive, stopIntro } from './intro.js';
import { MEME_KINDS, makeMemeCanvas, buildMemePool, addMedia, removeMedia, clearMedia } from './memes.js';

const $ = id => document.getElementById(id);
if (isTouch) document.body.classList.add('touch');

const KEY = 'narrysmod_cfg_v1';
const cfg = Object.assign({ map: 0, cpus: isTouch ? 10 : 20, bots: 3, diff: 1, dur: 240, quality: isTouch ? 'med' : 'high', size: 48, fov: 80, sens: 10, name: 'Jugador', only: false, counts: {} },
  (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })());
let title = null;
if (cfg.ai === undefined) cfg.ai = !cfg.only; // antes: «usar solo mis imágenes»
const isAI = e => !!e.builtin && e.id !== 'secret-choco'; // los de IA = los que hice yo (el jefe no cuenta)
cfg.choco = Object.assign({ size: 9, hp: 14000 }, cfg.choco || {});
cfg.perf = Object.assign({}, DEFAULT_PERF, cfg.perf || {});
cfg.extra = Object.assign({}, DEFAULT_EXTRA, cfg.extra || {});
cfg.keys = Object.assign({}, DEFAULT_KEYS, cfg.keys || {});
const UKEY = 'narrysmod_unlocks_v1';
const unlocks = (() => { try { return JSON.parse(localStorage.getItem(UKEY) || '{}'); } catch { return {}; } })();
const saveUnl = () => { try { localStorage.setItem(UKEY, JSON.stringify(unlocks)); } catch { /* nada */ } };
let chocoCache = null;
if (unlocks.choco && !MAP_DEFS.includes(CHOCO_DEF)) MAP_DEFS.push(CHOCO_DEF); // mapa del jefe desbloqueado
if (cfg.map >= MAP_DEFS.length) cfg.map = 0;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* nada */ } };

/* ---------- caras flotando de fondo ---------- */
(function bgFaces() {
  const box = $('bgfaces');
  MEME_KINDS.forEach((k, i) => {
    const img = new Image(); img.src = makeMemeCanvas(k.id).toDataURL();
    const s = (0.7 + Math.random() * 1.1).toFixed(2);
    img.style.cssText = `--x0:${Math.random() * 90}vw;--x1:${Math.random() * 90}vw;--s:${s};--r:${(Math.random() * 720 - 360) | 0}deg;animation-duration:${16 + Math.random() * 18}s;animation-delay:${-Math.random() * 20}s`;
    box.appendChild(img);
  });
})();

/* ---------- selector de mapas con vista previa ---------- */
function drawPreview(canvas, def) {
  setMapSize(48); const m = generateMap(def, 1234 + def.id.length * 17), s = 4;
  canvas.width = canvas.height = N * s;
  const x = canvas.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, N * s, N * s);
  for (let i = 0; i < N * N; i++) {
    const v = m.grid[i];
    x.fillStyle = v === 1 ? '#8a8a99' : v === 2 ? '#4a4a55' : '#16161c';
    x.fillRect((i % N) * s, ((i / N) | 0) * s, s, s);
  }
}
const mapsEl = $('maps');
function addMapCard(def, i) {
  const d = document.createElement('div'); d.className = 'map'; d.dataset.i = i;
  const c = document.createElement('canvas'); d.appendChild(c);
  const sp = document.createElement('span'); sp.textContent = `${def.icon} ${def.name}`; d.appendChild(sp);
  d.onclick = () => selectMap(i);
  mapsEl.appendChild(d);
  try { drawPreview(c, def); } catch (e) { console.warn(e); }
}
MAP_DEFS.forEach(addMapCard);
function selectMap(i) {
  cfg.map = i; save();
  [...mapsEl.children].forEach((el, k) => el.classList.toggle('sel', k === i));
  $('mapDesc').textContent = MAP_DEFS[i].desc;
  document.querySelectorAll('.chip').forEach((el, k) => el.classList.toggle('sel', k === i));
  if (title) title.setMap(MAP_DEFS[i]);
  if (typeof updSummary === 'function') updSummary();
}

/* ---------- ajustes ---------- */
function bindRange(id, key, out, f = v => v) {
  const el = $(id); el.value = cfg[key]; const show = () => { $(out).textContent = f(el.value); };
  el.oninput = () => { cfg[key] = +el.value; show(); save(); }; show();
}
bindRange('pCpus', 'cpus', 'vCpus'); bindRange('pBots', 'bots', 'vBots');
bindRange('pFov', 'fov', 'vFov', v => v + '°'); bindRange('pSens', 'sens', 'vSens', v => (v / 10).toFixed(1) + '×');
$('pName').value = cfg.name; $('pName').oninput = e => { cfg.name = e.target.value.trim().slice(0, 16) || 'Jugador'; save(); };
for (const [id, key, num] of [['pSize', 'size', true], ['pDiff', 'diff', true], ['pDur', 'dur', true], ['pQual', 'quality', false]]) {
  const el = $(id); el.value = cfg[key]; el.onchange = () => { cfg[key] = num ? +el.value : el.value; save(); updHint(); updSummary(); };
}
function updAI() {
  const b = $('btnAI'); b.textContent = `🤖 Nextbots de IA: ${cfg.ai ? 'SÍ' : 'NO'}`; b.classList.toggle('ghost', !cfg.ai); b.setAttribute('aria-pressed', cfg.ai);
  $('aiHint').textContent = cfg.ai ? 'Se usan los de IA y los tuyos.' : 'Solo se usan tus imágenes (si no subiste ninguna, se usan los de IA).';
}
$('btnAI').onclick = () => { cfg.ai = !cfg.ai; save(); updAI(); renderMemes(); };
updAI();
function updHint() { $('rtHint').style.display = cfg.quality === 'rt' ? 'block' : 'none'; }
updHint();

/* ---------- rendimiento, extras y controles ---------- */
const OPTS = [ // [id, objeto, clave, tipo, etiqueta de valor, formato]
  ['pScale', cfg.perf, 'scale', 'num', 'vScale', v => v + '%'], ['pShadows', cfg.perf, 'shadows', 'str'], ['pLights', cfg.perf, 'lights', 'str'],
  ['pDist', cfg.perf, 'dist', 'num'], ['pFps', cfg.perf, 'fps', 'num'], ['pAuto', cfg.perf, 'auto', 'chk'], ['pShowFps', cfg.perf, 'showFps', 'chk'],
  ['pVol', cfg.extra, 'volume', 'num', 'vVol', v => v + '%'], ['pBob', cfg.extra, 'bob', 'chk'], ['pInv', cfg.extra, 'invert', 'chk'],
  ['pMini', cfg.extra, 'minimap', 'chk'], ['pFeed', cfg.extra, 'feed', 'chk'], ['pNames', cfg.extra, 'names', 'chk'],
  ['pRunT', cfg.extra, 'runToggle', 'chk'], ['pAimT', cfg.extra, 'aimToggle', 'chk'], ['pMouse', cfg.extra, 'mouse', 'str'],
  ['pCrossC', cfg.extra, 'crossColor', 'str'], ['pCrossS', cfg.extra, 'crossSize', 'num', 'vCrossS', v => v + '%'],
];
function refreshOpts() {
  for (const [id, obj, key, kind, out, f] of OPTS) {
    const el = $(id); if (kind === 'chk') el.checked = !!obj[key]; else el.value = obj[key];
    if (out) $(out).textContent = f(obj[key]);
  }
}
for (const [id, obj, key, kind, out, f] of OPTS) {
  const el = $(id), ev = kind === 'chk' || el.tagName === 'SELECT' ? 'onchange' : 'oninput';
  el[ev] = () => { obj[key] = kind === 'chk' ? el.checked : kind === 'num' ? +el.value : el.value; if (out) $(out).textContent = f(obj[key]); save(); };
}
refreshOpts();

function syncGameInputs() { // vuelve a mostrar en el menú valores que el botón de rendimiento pudo cambiar
  $('pQual').value = cfg.quality; $('pCpus').value = cfg.cpus; $('vCpus').textContent = cfg.cpus; $('pSize').value = cfg.size;
  updHint(); updSummary();
}
$('btnPerf').onclick = () => {
  const ch = [];
  if (cfg.quality !== 'low') { ch.push(`calidad ${cfg.quality === 'rt' ? 'Raytracing' : cfg.quality === 'high' ? 'Alta' : 'Media'} → Baja`); cfg.quality = 'low'; }
  Object.assign(cfg.perf, { ...DEFAULT_PERF, scale: 75, shadows: 'off', lights: 'few', dist: 70, auto: true });
  ch.push('resolución 75% (y automática)', 'sombras apagadas', 'pocas luces', 'distancia de dibujado media');
  const maxCpus = isTouch ? 10 : 20;
  if (cfg.cpus > maxCpus) { ch.push(`CPUs ${cfg.cpus} → ${maxCpus}`); cfg.cpus = maxCpus; }
  if (cfg.size > 48) { ch.push('mapa Normal'); cfg.size = 48; }
  save(); refreshOpts(); syncGameInputs();
  $('perfMsg').textContent = '⚡ Listo: ' + ch.join(' · ') + '.';
};
$('btnPerfReset').onclick = () => {
  Object.assign(cfg.perf, DEFAULT_PERF); cfg.quality = isTouch ? 'med' : 'high'; save(); refreshOpts(); syncGameInputs();
  $('perfMsg').textContent = 'Rendimiento restablecido a los valores por defecto.';
};

// controles: tocar un botón y pulsar la tecla nueva
let listening = null;
function updControlHints() {
  const k = n => `<b>${keyLabel(cfg.keys[n])}</b>`, mv = `${k('fwd')}${k('left')}${k('back')}${k('right')}`;
  const run = cfg.extra.runToggle ? 'alternar correr' : 'correr', rev = cfg.keys.revive;
  $('ctrlHint').innerHTML = `${mv} mover · ${k('run')} ${run} · ${k('jump')} saltar · <b>Ratón</b> mirar · ${k('light')} linterna · ${k('board')} jugadores · <b>Clic</b> disparar · <b>Clic derecho</b> apuntar · ${k('slot1')} ${k('slot2')} ${k('slot3')} armas · ${k('revive')} revivir · <b>Esc</b> pausa`;
  $('ctrlFoot').innerHTML = `${mv} mover · ${k('run')} ${run} · ${k('jump')} saltar · ${k('light')} linterna · <b>Clic</b> disparar · ${k('slot1')} ${k('slot2')} ${k('slot3')} armas · ${k('revive')} revivir · <b>Esc</b> pausa`;
  void rev;
}
function renderKeys() {
  const box = $('keyList'); box.innerHTML = '';
  for (const [act, label] of ACTIONS) {
    const row = document.createElement('div'); row.className = 'keyRow';
    const sp = document.createElement('span'); sp.textContent = label;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'keyBtn'; b.textContent = keyLabel(cfg.keys[act]);
    b.onclick = () => { stopListen(); listening = { act, b }; b.textContent = 'Pulsa una tecla…'; b.classList.add('wait'); };
    row.append(sp, b); box.appendChild(row);
  }
  updControlHints();
}
function stopListen() { if (listening) { listening.b.classList.remove('wait'); listening = null; renderKeys(); } }
window.addEventListener('keydown', e => {
  if (!listening) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.code === 'Escape') { stopListen(); return; }
  const { act } = listening, old = cfg.keys[act];
  const other = Object.keys(cfg.keys).find(a => a !== act && cfg.keys[a] === e.code);
  if (other) cfg.keys[other] = old; // intercambia con la acción que ya usaba esa tecla
  cfg.keys[act] = e.code; save(); listening.b.classList.remove('wait'); listening = null; renderKeys();
}, true);
$('btnKeysReset').onclick = () => { listening = null; Object.assign(cfg.keys, DEFAULT_KEYS); save(); renderKeys(); };
renderKeys();

async function getChocoEntry() {
  if (!chocoCache) {
    const blob = await (await fetch('assets/odio-el-chocolate.mp4')).blob();
    chocoCache = { id: 'secret-choco', name: 'ODIO EL CHOCOLATE', kind: 'video', blob, aspect: 1, thumb: await chocoThumb(blob), builtin: true };
  }
  return chocoCache;
}
async function fullPool() { // memes normales + el jefe si está desbloqueado
  const pool = await buildMemePool();
  if (unlocks.choco) { try { pool.push(await getChocoEntry()); } catch (e) { console.warn('Jefe no disponible', e); } }
  return pool;
}
async function renderMemes() {
  const list = $('memeList'); let pool = [];
  try { pool = await fullPool(); } catch (e) { console.warn(e); }
  list.innerHTML = '';
  for (const e of pool) {
    const n = cfg.counts[e.id] || 0, d = document.createElement('div');
    d.className = 'meme' + (n ? ' on' : '') + (!cfg.ai && isAI(e) ? ' off' : '');
    d.innerHTML = `<img alt=""><span></span><div class="cnt"><button type="button">−</button><b>${n}</b><button type="button">+</button></div>`;
    d.querySelector('img').src = e.thumb; d.querySelector('span').textContent = e.name; d.title = e.name;
    if (e.kind === 'gif' || e.kind === 'video') { const t = document.createElement('i'); t.className = 'tag'; t.textContent = e.kind.toUpperCase(); d.appendChild(t); }
    const [minus, plus] = d.querySelectorAll('button');
    const set = v => { cfg.counts[e.id] = Math.max(0, Math.min(10, v)); save(); d.querySelector('b').textContent = cfg.counts[e.id]; d.classList.toggle('on', cfg.counts[e.id] > 0); };
    minus.onclick = () => set((cfg.counts[e.id] || 0) - 1); plus.onclick = () => set((cfg.counts[e.id] || 0) + 1);
    if (e.id === 'secret-choco') { // engranaje: tamaño y vida del jefe
      const gear = document.createElement('button'); gear.className = 'gear'; gear.type = 'button'; gear.title = 'Tamaño y vida'; gear.textContent = '⚙';
      gear.onclick = ev => { ev.stopPropagation(); openChocoCfg(); };
      d.appendChild(gear);
    }
    if (e.dbId != null) {
      const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.type = 'button';
      x.onclick = async () => { await removeMedia(e.dbId); delete cfg.counts[e.id]; save(); renderMemes(); };
      d.appendChild(x);
    }
    list.appendChild(d);
  }
}
/* ---------- ajustes del nextbot jefe (tamaño y vida) ---------- */
const HP_MAX = 10000000, hpFromR = r => Math.round(Math.exp(Math.log(HP_MAX) * (r / 1000))), rFromHp = hp => Math.round(Math.log(Math.max(1, hp)) / Math.log(HP_MAX) * 1000);
const fmtN = n => Number(n).toLocaleString('es');
function syncChocoCfg(from) {
  const ch = cfg.choco;
  if (from === 'r') ch.hp = hpFromR(+$('ccHpR').value);
  else if (from === 'n') ch.hp = Math.min(HP_MAX, Math.max(1, Math.round(+$('ccHp').value) || 1));
  else if (typeof from === 'number') ch.hp = from;
  ch.size = +$('ccSize').value; save();
  if (from !== 'r') $('ccHpR').value = rFromHp(ch.hp);
  if (from !== 'n') $('ccHp').value = ch.hp;
  $('ccSizeV').textContent = ch.size + ' m de alto'; $('ccHpV').textContent = fmtN(ch.hp);
}
function openChocoCfg() { $('ccSize').value = cfg.choco.size; syncChocoCfg(cfg.choco.hp); show('chocoCfg', true); }
for (const v of [100, 14000, 100000, 1000000, 10000000]) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small ghost'; b.textContent = fmtN(v); b.onclick = () => syncChocoCfg(v); $('ccPresets').appendChild(b);
}
$('ccSize').oninput = () => syncChocoCfg(); $('ccHpR').oninput = () => syncChocoCfg('r'); $('ccHp').oninput = () => syncChocoCfg('n');
$('ccClose').onclick = () => show('chocoCfg', false);
$('chocoCfg').addEventListener('click', e => { if (e.target === $('chocoCfg')) show('chocoCfg', false); });

async function addFiles(files) {
  for (const f of files) { try { await addMedia(f); } catch (err) { alert('No se pudo guardar "' + f.name + '": ' + (err && err.message || err)); } }
  renderMemes();
}
$('pFile').onchange = async e => { await addFiles([...e.target.files]); e.target.value = ''; };
$('pClear').onclick = async () => { try { await clearMedia(); } catch { /* nada */ } cfg.counts = {}; save(); renderMemes(); };
window.addEventListener('dragover', e => { if (!$('menu').classList.contains('hidden')) { e.preventDefault(); document.body.classList.add('drag'); } });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('drag'); });
window.addEventListener('drop', e => { document.body.classList.remove('drag'); if (!$('menu').classList.contains('hidden')) { e.preventDefault(); addFiles([...e.dataTransfer.files]); } });
renderMemes();
function addMapChip(def, i) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = `${def.icon} ${def.name}`;
  b.onclick = () => selectMap(i); $('mapChips').appendChild(b);
}
MAP_DEFS.forEach(addMapChip);
selectMap(cfg.map);

/* ---------- juego ---------- */
const game = new Game($('c'));
const show = (id, on) => $(id).classList.toggle('hidden', !on);

function toMenu() {
  go('scrMain'); if (title) { title.resize(); title.start(); }
  game.stop(); show('hud', false); show('over', false); show('pause', false); show('scare', false); show('menu', true);
  if (document.pointerLockElement) document.exitPointerLock();
}

async function play() {
  stopIntro();
  show('loading', true); $('loadText').textContent = 'Generando mapa…';
  game.sfx.init(MAP_DEFS[cfg.map].drone); // el clic cuenta como gesto para activar el audio
  await new Promise(r => setTimeout(r, 30));
  try {
    let pool = await fullPool();
    if (!cfg.ai) { const own = pool.filter(e => !isAI(e)); if (own.length) pool = own; } // sin IA: solo tus imágenes
    const plan = [];
    for (const e of pool) for (let k = 0; k < (cfg.counts[e.id] || 0); k++) plan.push(e);
    const total = Math.min(20, Math.max(cfg.bots, plan.length));
    plan.length = Math.min(plan.length, total);
    while (plan.length < total) plan.push(pool[Math.floor(Math.random() * pool.length)]);
    plan.sort(() => Math.random() - 0.5);
    $('loadText').textContent = cfg.quality === 'rt' ? 'Cargando efectos de raytracing…' : 'Construyendo escena…';
    await game.start({ map: cfg.map, cpus: cfg.cpus, bots: total, plan, perf: cfg.perf, extra: cfg.extra, keys: cfg.keys, diff: cfg.diff, size: cfg.size, choco: { size: cfg.choco.size, hp: cfg.choco.hp }, dur: cfg.dur, quality: cfg.quality, fov: cfg.fov, sens: cfg.sens / 10, name: cfg.name }, pool);
  } catch (err) {
    console.error(err); show('loading', false);
    alert('Error al iniciar: ' + (err && err.message ? err.message : err));
    return;
  }
  if (title) title.pause();
  show('menu', false); show('loading', false); show('over', false); show('hud', true); show('pause', false);
  game.lock();
}

function unlockMsg(text) { const el = $('unlockMsg'); el.textContent = text || ''; el.classList.toggle('hidden', !text); }
function unlockChoco() {
  if (unlocks.choco) return false;
  unlocks.choco = true; saveUnl();
  if (!MAP_DEFS.includes(CHOCO_DEF)) { MAP_DEFS.push(CHOCO_DEF); addMapCard(CHOCO_DEF, MAP_DEFS.length - 1); addMapChip(CHOCO_DEF, MAP_DEFS.length - 1); }
  renderMemes();
  return true;
}
function bossReward() {
  if (!game.bossDead) return unlockMsg('');
  unlockMsg(unlockChoco() ? '🔓 ¡Desbloqueaste el nextbot ODIO EL CHOCOLATE y el mapa Backrooms Planos! Los encuentras en «Memes / nextbots» y en «Mapa y partida».' : '🔓 Ya tienes desbloqueados el nextbot y el mapa del jefe.');
}
game.onEvent = (type, d) => {
  if (type === 'pause') {
    if (!$('over').classList.contains('hidden') || !$('chocoBox').classList.contains('hidden')) return; // ya hay una pantalla encima
    if (game.state === 'playing' || game.state === 'dead') { game.pause(); show('pause', true); }
  } else if (type === 'dead') {
    unlockMsg(''); $('over').classList.remove('win'); $('overTitle').textContent = '¡TE ATRAPARON!';
    $('overText').textContent = `${d.by} te encontró. Sobreviviste ${Math.floor(d.time)} s y quedaste en el puesto ${d.place} de ${d.total}.`;
    $('spectHint').textContent = 'Mirando a los CPU · Espacio / clic para cambiar de jugador';
    show('choco', game.state === 'dead' && !game.chocoUsed); show('loseLink', !!(game.opts && game.opts.boss));
    show('over', true); if (document.pointerLockElement) document.exitPointerLock();
  } else if (type === 'win') {
    bossReward(); show('loseLink', !!(game.opts && game.opts.boss) && !game.bossDead); $('over').classList.add('win'); $('overTitle').textContent = '¡SOBREVIVISTE!';
    $('overText').textContent = game.bossDead ? `¡Derrotaste a ODIO EL CHOCOLATE junto a tus CPUs! Quedan ${d.survivors} de ${d.total} jugadores con vida.` : `Aguantaste toda la ronda. Quedan ${d.survivors} de ${d.total} jugadores con vida.`;
    $('spectHint').textContent = ''; show('over', true); if (document.pointerLockElement) document.exitPointerLock();
  } else if (type === 'end') {
    bossReward(); show('loseLink', !!(game.opts && game.opts.boss) && !game.bossDead);
    $('over').classList.remove('win'); $('overTitle').textContent = 'RONDA TERMINADA';
    $('overText').textContent = game.bossDead ? `Tus CPUs derrotaron a ODIO EL CHOCOLATE. Sobrevivieron ${d.survivors} de ${d.total} jugadores.` : `Sobrevivieron ${d.survivors} de ${d.total} jugadores.`;
    $('spectHint').textContent = ''; show('over', true);
  }
};

$('choco').onclick = () => {
  const box = $('chocoBox'), v = $('chocoVid');
  if (game.chocoUsed || game.state !== 'dead') return;
  show('over', false); show('choco', false); game.pause(); show('chocoBox', true);
  let done = false;
  const finish = () => {
    if (done) return; done = true; v.onended = v.onerror = null; v.pause(); show('chocoBox', false);
    game.unpause(); // vuelve al estado 'dead' en el que estaba
    if (game.revivePlayer()) { show('over', false); game.lock(); }
    else show('over', true);
  };
  v.onended = finish; v.onerror = finish;
  v.currentTime = 0; v.muted = false;
  const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play().catch(finish); });
};
/* ---------- códigos secretos ---------- */
let lastBoss = false;
async function chocoThumb(blob) {
  try {
    const url = URL.createObjectURL(blob), v = document.createElement('video'); v.muted = true; v.src = url;
    await new Promise(r => { v.onloadeddata = r; v.onerror = r; setTimeout(r, 3000); });
    v.currentTime = Math.min(1, (v.duration || 2) / 2);
    await new Promise(r => { v.onseeked = r; setTimeout(r, 1500); });
    const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d').drawImage(v, 0, 0, 256, 256);
    URL.revokeObjectURL(url); return c.toDataURL('image/jpeg', 0.85);
  } catch { /* nada */ }
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#5a3418'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif'; x.textAlign = 'center'; x.fillText('ODIO EL', 128, 120); x.fillText('CHOCOLATE', 128, 156);
  return c.toDataURL();
}
async function playBoss() {
  stopIntro();
  lastBoss = true;
  show('loading', true); $('loadText').textContent = 'Invocando al jefe…';
  game.sfx.init(CHOCO_DEF.drone);
  await new Promise(r => setTimeout(r, 30));
  try {
    const entry = await getChocoEntry();
    $('loadText').textContent = 'Construyendo la arena…';
    await game.start({ boss: true, perf: cfg.perf, extra: cfg.extra, keys: cfg.keys, choco: { size: 9, hp: 14000 }, def: CHOCO_DEF, map: 0, cpus: 100, bots: 1, plan: [entry], diff: 1, size: 64, dur: 600,
      quality: cfg.quality === 'rt' ? 'high' : cfg.quality, fov: cfg.fov, sens: cfg.sens / 10, name: cfg.name }, [entry]);
  } catch (err) {
    console.error(err); show('loading', false);
    alert('Error al iniciar el jefe: ' + (err && err.message ? err.message : err));
    return;
  }
  if (title) title.pause();
  show('menu', false); show('loading', false); show('over', false); show('hud', true); show('pause', false);
  game.lock();
}
function tryCode() {
  const raw = $('codeIn').value, code = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const msg = $('codeMsg');
  if (code === 'odioelchocolate') { msg.textContent = '🍫 ¡Código correcto! Preparando el Boss Fight…'; $('codeIn').value = ''; playBoss(); }
  else if (!code) msg.textContent = '';
  else msg.textContent = '❌ Código incorrecto';
}
$('codeGo').onclick = tryCode;
$('codeIn').onkeydown = e => { if (e.key === 'Enter') tryCode(); };

// la página del troll se abre en una ventana emergente (así puede moverse); si el navegador la bloquea, se abre en pestaña
document.querySelector('#loseLink a').onclick = e => {
  const w = 480, h = 360, l = Math.max(0, (screen.width - w) / 2), t = Math.max(0, (screen.height - h) / 2);
  const pop = window.open(e.currentTarget.href, 'odioeltroyano', `popup=yes,width=${w},height=${h},left=${l},top=${t}`);
  if (pop) e.preventDefault();
};
$('play').onclick = () => { lastBoss = false; play(); }; $('play2').onclick = () => { lastBoss = false; play(); };
function go(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id)); if (id === 'scrMain') updSummary(); $('menu').scrollTop = 0; }
document.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => go(b.dataset.go); });
function updSummary() {
  const q = { low: 'Bajo', med: 'Medio', high: 'Alto', rt: 'Raytracing' }[cfg.quality];
  $('summary').textContent = `${MAP_DEFS[cfg.map].name} · ${{48:'Normal',64:'Grande',80:'Enorme'}[cfg.size] || 'Normal'} · ${cfg.cpus} CPUs · ${cfg.bots} nextbots · ${q}`;
}
updSummary();
$('retry').onclick = () => { show('over', false); (lastBoss ? playBoss : play)(); };
$('toMenu1').onclick = toMenu; $('toMenu2').onclick = toMenu;
$('resume').onclick = () => { show('pause', false); game.unpause(); game.lock(); };
window.addEventListener('keydown', e => { if (e.code === 'Enter' && !$('menu').classList.contains('hidden') && document.activeElement.tagName !== 'INPUT' && !introActive()) play(); });

try {
  title = new TitleScene($('bg3d'));
  title.setMap(MAP_DEFS[cfg.map]); title.start();
  $('menu').classList.add('has3d'); $('bgfaces').remove();
  window.__title = title;
} catch (err) { console.warn('Fondo 3D no disponible', err); $('bg3d').remove(); $('bgShade').remove(); }

window.__game = game; window.__maps = MAP_DEFS; // útil para depurar en la consola

runIntro();
