// Menú principal, ajustes y conexión con el juego
import { MAP_DEFS, CHOCO_DEF, GREEN_DEF, VERITY_DEF, GLITCH_DEF, generateMap, N, setMapSize } from './maps.js';
import { Game, isTouch } from './game.js';
import { TitleScene } from './title.js';
import { DEFAULT_KEYS, DEFAULT_PERF, DEFAULT_EXTRA, ACTIONS, keyLabel } from './settings.js';
import * as A from './achievements.js';
import { runIntro, introActive, stopIntro } from './intro.js';
import { MEME_KINDS, makeMemeCanvas, buildMemePool, addMedia, removeMedia, clearMedia } from './memes.js';

const $ = id => document.getElementById(id);
if (isTouch) document.body.classList.add('touch');

const KEY = 'narrysmod_cfg_v1';
const cfg = Object.assign({ map: 0, cpus: isTouch ? 10 : 20, bots: 3, diff: 1, dur: 240, quality: isTouch ? 'med' : 'high', size: 48, fov: 80, sens: 10, name: 'Jugador', only: false, counts: {} },
  (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })());
let title = null;
if (cfg.ai === undefined) cfg.ai = !cfg.only; // antes: «usar solo mis imágenes»
const isAI = e => !!e.builtin && !String(e.id).startsWith('secret-'); // los de IA = los que hice yo (el jefe no cuenta)
cfg.choco = Object.assign({ size: 9, hp: 14000 }, cfg.choco || {});
cfg.perf = Object.assign({}, DEFAULT_PERF, cfg.perf || {});
cfg.extra = Object.assign({}, DEFAULT_EXTRA, cfg.extra || {});
cfg.keys = Object.assign({}, DEFAULT_KEYS, cfg.keys || {});
const UKEY = 'narrysmod_unlocks_v1';
const unlocks = (() => { try { return JSON.parse(localStorage.getItem(UKEY) || '{}'); } catch { return {}; } })();
const saveUnl = () => { try { localStorage.setItem(UKEY, JSON.stringify(unlocks)); } catch { /* nada */ } };
let chocoCache = null;
if (unlocks.choco && !MAP_DEFS.includes(CHOCO_DEF)) MAP_DEFS.push(CHOCO_DEF); // mapa del jefe desbloqueado
if (unlocks.exe && !MAP_DEFS.includes(GREEN_DEF)) MAP_DEFS.push(GREEN_DEF); // mapa de Sonic.exe desbloqueado
if (unlocks.verity && !MAP_DEFS.includes(VERITY_DEF)) MAP_DEFS.push(VERITY_DEF); // casa de Verity desbloqueada
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
  A.unlock('optimize');
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
  $('ctrlHint').innerHTML = `${mv} mover · ${k('run')} ${run} · ${k('jump')} saltar · <b>Ratón</b> mirar · ${k('light')} linterna · ${k('board')} jugadores · <b>Clic</b> disparar · <b>Clic derecho</b> apuntar · ${k('slot1')}–${k('slot6')} armas · ${k('revive')} revivir · <b>Esc</b> pausa`;
  $('ctrlFoot').innerHTML = `${mv} mover · ${k('run')} ${run} · ${k('jump')} saltar · ${k('light')} linterna · <b>Clic</b> disparar · ${k('slot1')}–${k('slot6')} armas · ${k('revive')} revivir · <b>Esc</b> pausa`;
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
  A.unlock('rebind'); cfg.keys[act] = e.code; save(); listening.b.classList.remove('wait'); listening = null; renderKeys();
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
const EXE_BOSSES = [['secret-exe-sonic', 'SONIC.EXE', 'sonic', 271 / 512], ['secret-exe-tails', 'TAILS DOLL.EXE', 'tails', 307 / 454], ['secret-exe-knuckles', 'KNUCKLES.EXE', 'knuckles', 164 / 291]];
let exeCache = null;
async function getExeEntries() {
  if (!exeCache) exeCache = await Promise.all(EXE_BOSSES.map(async ([id, name, f, aspect]) => ({ id, name, kind: 'image', blob: await (await fetch(`assets/exe/${f}.png`)).blob(), thumb: `assets/exe/${f}.png`, aspect, builtin: true })));
  return exeCache;
}
let verityCache = null;
async function getVerityEntry() {
  if (!verityCache) verityCache = { id: 'secret-verity', name: 'VERITY', kind: 'image', blob: await (await fetch('assets/verity/verity.png')).blob(), thumb: 'assets/verity/verity.png', aspect: 1, builtin: true };
  return verityCache;
}
async function fullPool() { // memes normales + los jefes desbloqueados
  const pool = await buildMemePool();
  if (unlocks.choco) { try { pool.push(await getChocoEntry()); } catch (e) { console.warn('Jefe no disponible', e); } }
  if (unlocks.verity) { try { pool.push(await getVerityEntry()); } catch (e) { console.warn('Verity no disponible', e); } }
  if (unlocks.exe) { try { pool.push(...await getExeEntries()); } catch (e) { console.warn('Jefes .EXE no disponibles', e); } }
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
  for (const f of files) { try { await addMedia(f); A.unlock('upload'); } catch (err) { alert('No se pudo guardar "' + f.name + '": ' + (err && err.message || err)); } }
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
  A.add('games'); A.unlock('first_game'); A.addToSet('maps', MAP_DEFS[cfg.map].id);
  if (cfg.cpus >= 60) A.unlock('crowd'); if (cfg.cpus === 0) A.unlock('solo'); if (cfg.bots >= 10) A.unlock('memes10');
  show('menu', false); show('loading', false); show('over', false); show('hud', true); show('pause', false);
  game.lock();
}

function unlockMsg(text) { const el = $('unlockMsg'); el.textContent = text || ''; el.classList.toggle('hidden', !text); }
function unlockChoco() {
  if (unlocks.choco) return false;
  unlocks.choco = true; saveUnl();
  if (!MAP_DEFS.includes(CHOCO_DEF)) { MAP_DEFS.push(CHOCO_DEF); addMapCard(CHOCO_DEF, MAP_DEFS.length - 1); addMapChip(CHOCO_DEF, MAP_DEFS.length - 1); }
  renderMemes(); renderBossKeys();
  return true;
}
function unlockExe() {
  if (unlocks.exe) return false;
  unlocks.exe = true; saveUnl();
  if (!MAP_DEFS.includes(GREEN_DEF)) { MAP_DEFS.push(GREEN_DEF); addMapCard(GREEN_DEF, MAP_DEFS.length - 1); addMapChip(GREEN_DEF, MAP_DEFS.length - 1); }
  renderMemes(); renderBossKeys();
  return true;
}
function unlockVerity() {
  if (unlocks.verity) return false;
  unlocks.verity = true; saveUnl();
  if (!MAP_DEFS.includes(VERITY_DEF)) { MAP_DEFS.push(VERITY_DEF); addMapCard(VERITY_DEF, MAP_DEFS.length - 1); addMapChip(VERITY_DEF, MAP_DEFS.length - 1); }
  renderMemes(); renderBossKeys();
  return true;
}
let rushTimer = 0;
function rushAdvance() {
  if (!rush || !game.bossDead || lastBoss === 'final') return false;
  const next = RUSH[RUSH.indexOf(lastBoss) + 1];
  if (!next) return false;
  $('over').classList.add('rushnext'); $('overTitle').textContent = '¡JEFE DERROTADO!';
  $('overText').textContent = next === 'final' ? 'Siguiente: ¡EL BOSS FINAL con todos los jefes en la Zona Glitch!' : 'Preparando al siguiente jefe…';
  rushTimer = setTimeout(() => { show('over', false); playBoss(next, true); }, 4500);
  return true;
}
const bossName = () => lastBoss === 'final' ? 'TODOS LOS JEFES' : lastBoss === 'exe' ? 'SONIC.EXE y sus amigos' : lastBoss === 'verity' ? 'VERITY' : 'ODIO EL CHOCOLATE';
function bossReward() {
  if (!game.bossDead) return unlockMsg('');
  if (lastBoss === 'final') { A.unlock('rush_final'); return unlockMsg('👾 ¡Completaste ???! Derrotaste a todos los jefes en la Zona Glitch.'); }
  if (rush) { A.unlock(lastBoss === 'exe' ? 'boss_exe' : lastBoss === 'verity' ? 'boss_verity' : 'boss_choco'); return unlockMsg(''); }
  A.unlock(lastBoss === 'exe' ? 'boss_exe' : lastBoss === 'verity' ? 'boss_verity' : 'boss_choco');
  if (lastBoss === 'verity') return unlockMsg(unlockVerity() ? '🔓 ¡Desbloqueaste a VERITY como nextbot y el mapa Casa de Verity! Los encuentras en «Memes / nextbots» y en «Mapa y partida».' : '🔓 Ya tienes desbloqueados a Verity y su casa.');
  if (lastBoss === 'exe') return unlockMsg(unlockExe() ? '🔓 ¡Desbloqueaste a SONIC.EXE, TAILS DOLL y KNUCKLES.EXE como nextbots y el mapa Green Hills .EXE! Los encuentras en «Memes / nextbots» y en «Mapa y partida».' : '🔓 Ya tienes desbloqueados los nextbots y el mapa de Sonic.exe.');
  unlockMsg(unlockChoco() ? '🔓 ¡Desbloqueaste el nextbot ODIO EL CHOCOLATE y el mapa Backrooms Planos! Los encuentras en «Memes / nextbots» y en «Mapa y partida».' : '🔓 Ya tienes desbloqueados el nextbot y el mapa del jefe.');
}
game.onEvent = (type, d) => {
  if (type === 'stat') { A.onGameStat(d); return; }
  if (type === 'pause') {
    if (!$('over').classList.contains('hidden') || !$('chocoBox').classList.contains('hidden')) return; // ya hay una pantalla encima
    if (game.state === 'playing' || game.state === 'dead') { game.pause(); show('pause', true); }
  } else if (type === 'dead') {
    A.add('deaths'); A.unlock('first_death');
    unlockMsg(''); $('over').classList.remove('win'); $('overTitle').textContent = '¡TE ATRAPARON!';
    $('overText').textContent = `${d.by} te encontró. Sobreviviste ${Math.floor(d.time)} s y quedaste en el puesto ${d.place} de ${d.total}.`;
    $('spectHint').textContent = 'Mirando a los CPU · Espacio / clic para cambiar de jugador';
    { const troll = !!(game.opts && game.opts.boss) && lastBoss === 'choco'; // en la pelea del jefe el botón de revivir sale siempre, y fondo negro
      show('choco', game.state === 'dead' && !game.chocoUsed && (troll || !!unlocks.choco)); show('loseLink', troll); $('over').classList.toggle('troll', troll);
      $('choco').textContent = troll ? '🍫 Odias el chocolate' : '🍫 Odio el chocolate'; }
    show('over', true); if (document.pointerLockElement) document.exitPointerLock();
  } else if (type === 'win') {
    if (!(game.opts && game.opts.boss)) {
      A.add('wins'); A.unlock('win1');
      if (cfg.diff >= 2) A.unlock('win_hard'); if (cfg.diff >= 3) A.unlock('win_nightmare');
      if (cfg.dur >= 600) A.unlock('win_long'); if (cfg.size >= 80) A.unlock('win_huge');
    }
    bossReward(); { const troll = !!(game.opts && game.opts.boss) && lastBoss === 'choco' && !game.bossDead; show('loseLink', troll); $('over').classList.toggle('troll', troll); } $('over').classList.add('win'); $('overTitle').textContent = '¡SOBREVIVISTE!';
    $('overText').textContent = game.bossDead ? `¡Derrotaste a ${bossName()} junto a tus CPUs! Quedan ${d.survivors} de ${d.total} jugadores con vida.` : `Aguantaste toda la ronda. Quedan ${d.survivors} de ${d.total} jugadores con vida.`;
    $('spectHint').textContent = ''; show('over', true); if (document.pointerLockElement) document.exitPointerLock(); rushAdvance();
  } else if (type === 'end') {
    bossReward(); { const troll = !!(game.opts && game.opts.boss) && lastBoss === 'choco' && !game.bossDead; show('loseLink', troll); $('over').classList.toggle('troll', troll); }
    $('over').classList.remove('win'); $('overTitle').textContent = 'RONDA TERMINADA';
    $('overText').textContent = game.bossDead ? `Tus CPUs derrotaron a ${bossName()}. Sobrevivieron ${d.survivors} de ${d.total} jugadores.` : `Sobrevivieron ${d.survivors} de ${d.total} jugadores.`;
    $('spectHint').textContent = ''; show('over', true); rushAdvance();
  }
};

$('choco').onclick = () => {
  A.unlock('choco_revive');
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
let lastBoss = false, rush = false, lastRush = false;
const RUSH = ['choco', 'exe', 'verity', 'final'];
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
async function playBoss(kind = 'choco', inRush = false) {
  stopIntro();
  lastBoss = kind; rush = lastRush = inRush; clearTimeout(rushTimer); $('over').classList.remove('rushnext');
  const exe = kind === 'exe', ver = kind === 'verity', fin = kind === 'final', def = fin ? GLITCH_DEF : exe ? GREEN_DEF : ver ? VERITY_DEF : CHOCO_DEF;
  show('loading', true); $('loadText').textContent = exe ? 'Corrompiendo la colina…' : 'Invocando al jefe…';
  game.sfx.init(def.drone);
  await new Promise(r => setTimeout(r, 30));
  try {
    const plan = fin ? [await getChocoEntry(), ...(await getExeEntries()), await getVerityEntry()] : exe ? await getExeEntries() : ver ? [await getVerityEntry()] : [await getChocoEntry()];
    $('loadText').textContent = exe ? 'Plantando flores con ojos…' : 'Construyendo la arena…';
    await game.start({ boss: true, bossKey: kind, music: fin ? 'assets/music/final-zone.mp3' : exe ? 'assets/music/exe-funk.mp3' : ver ? 'assets/music/verity-inst.mp3' : 'assets/music/choco-chase.mp3', vocal: ver ? 'assets/music/verity-vocal.mp3' : undefined, bossMsg: fin ? '👾 ¡BOSS FINAL! Derrota a TODOS los jefes con tus 150 CPUs' : exe ? '💀 ¡BOSS FIGHT! Derrota a SONIC.EXE, TAILS DOLL y KNUCKLES.EXE (5000 de vida cada uno) con tus 100 CPUs' : ver ? '🙂 ¡BOSS FIGHT! Derrota a VERITY en su casa con tus 100 CPUs' : undefined,
      perf: cfg.perf, extra: cfg.extra, keys: cfg.keys, choco: { size: fin ? 7 : 9, hp: 14000 }, def, map: 0, cpus: fin ? 150 : 100, bots: plan.length, plan, diff: 1, size: fin ? 80 : ver ? 36 : 64, dur: 600,
      quality: cfg.quality === 'rt' ? 'high' : cfg.quality, fov: cfg.fov, sens: cfg.sens / 10, name: cfg.name }, plan);
  } catch (err) {
    console.error(err); show('loading', false);
    alert('Error al iniciar el jefe: ' + (err && err.message ? err.message : err));
    return;
  }
  if (title) title.pause();
  A.add('games'); A.unlock('first_game');
  show('menu', false); show('loading', false); show('over', false); show('hud', true); show('pause', false);
  game.lock();
}
function tryCode() {
  const raw = $('codeIn').value, code = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const msg = $('codeMsg');
  if (code === 'odioelchocolate') { msg.textContent = '🍫 ¡Código correcto! Preparando el Boss Fight…'; $('codeIn').value = ''; A.unlock('code_choco'); playBoss('choco'); }
  else if (code === 'verity') { msg.textContent = '🙂 ¡Código correcto! Entrando a la casa de Verity…'; $('codeIn').value = ''; A.unlock('code_verity'); playBoss('verity'); }
  else if (code === 'sonic1exe') { msg.textContent = '💀 ¡Código correcto! Corrompiendo Green Hills…'; $('codeIn').value = ''; A.unlock('code_exe'); playBoss('exe'); }
  else if (!code) msg.textContent = '';
  else msg.textContent = '❌ Código incorrecto';
}
$('codeGo').onclick = tryCode;
$('codeIn').onkeydown = e => { if (e.key === 'Enter') tryCode(); };

// la página del troll se abre en una ventana emergente (así puede moverse); si el navegador la bloquea, se abre en pestaña
document.querySelector('#loseLink a').onclick = e => {
  A.unlock('troll'); $('over').classList.remove('troll'); // tras clicar vuelven los botones normales
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
$('retry').onclick = () => { show('over', false); $('over').classList.remove('troll'); lastBoss ? playBoss(lastBoss, lastRush) : play(); };
$('toMenu1').onclick = toMenu; $('toMenu2').onclick = () => { clearTimeout(rushTimer); $('over').classList.remove('rushnext'); toMenu(); };
$('resume').onclick = () => { show('pause', false); game.unpause(); game.lock(); };
window.addEventListener('keydown', e => { if (e.code === 'Enter' && !$('menu').classList.contains('hidden') && document.activeElement.tagName !== 'INPUT' && !introActive()) play(); });

try {
  title = new TitleScene($('bg3d'));
  title.setMap(MAP_DEFS[cfg.map]); title.start();
  $('menu').classList.add('has3d'); $('bgfaces').remove();
  window.__title = title;
} catch (err) { console.warn('Fondo 3D no disponible', err); $('bg3d').remove(); $('bgShade').remove(); }

window.__playBoss = (k, r) => playBoss(k, r); window.__game = game; window.__maps = MAP_DEFS; // útil para depurar en la consola

runIntro();

/* ---------- logros: botón del trofeo, pantalla y aviso ---------- */
const updTrophy = () => { $('trophyN').textContent = `${A.count()}/${A.ACH.length}`; };
$('trophyBtn').onclick = () => { A.render($('achList'), $('achHead')); go('scrAch'); };
let achQ = [], achBusy = false;
function showAch() {
  if (achBusy || !achQ.length) return;
  achBusy = true; const a = achQ.shift(), el = $('achToast');
  el.querySelector('.ic').textContent = a.icon; el.querySelector('b').textContent = a.name;
  el.classList.remove('hidden'); void el.offsetWidth; el.classList.add('in');
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => { el.classList.add('hidden'); achBusy = false; showAch(); }, 400); }, 3600);
}
A.onAchievement(a => { achQ.push(a); updTrophy(); showAch(); if (!$('scrAch').classList.contains('hidden')) A.render($('achList'), $('achHead')); });
updTrophy();

/* ---------- reinicio de fábrica: el juego se olvida de todo ---------- */
$('btnFactory').onclick = async () => {
  if (!confirm('¿Reiniciar el juego de fábrica?\n\nSe borrarán ajustes, controles, logros, desbloqueos, estadísticas y tus nextbots subidos. No se puede deshacer.')) return;
  if (!confirm('Última confirmación: ¿borrar todo y empezar de cero?')) return;
  try { game.sfx.ctx && game.sfx.ctx.close(); } catch { /* nada */ }
  try {
    const dbs = indexedDB.databases ? await indexedDB.databases() : [{ name: 'narrysmod_media' }];
    await Promise.all(dbs.filter(d => d.name).map(d => new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = () => r(); setTimeout(r, 1500); })));
  } catch { /* nada */ }
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* nada */ }
  location.reload();
};

/* ---------- atajos a los jefes derrotados (esquina superior izquierda) ---------- */
function renderBossKeys() {
  const box = $('bossKeys'); box.innerHTML = '';
  const list = [['choco', '🍫', 'ODIO EL CHOCOLATE', 'Backrooms Planos'], ['exe', '💀', 'SONIC.EXE y amigos', 'Green Hills .EXE'], ['verity', '🙂', 'VERITY', 'Casa de Verity']];
  for (const [k, ico, name, map] of list) {
    if (!unlocks[k]) continue;
    const b = document.createElement('button'); b.type = 'button'; b.title = `Pelear otra vez contra ${name} (${map})`;
    b.innerHTML = `<span>${ico}</span><i>${name}</i>`;
    b.onclick = () => { if (confirm(`¿Pelear otra vez contra ${name}?`)) playBoss(k); };
    box.appendChild(b);
  }
  box.classList.toggle('hidden', !box.children.length);
  $('btnRush').classList.toggle('hidden', !(unlocks.choco && unlocks.exe && unlocks.verity));
}
renderBossKeys();
$('btnRush').onclick = () => { if (confirm('¿Empezar ???: derrotar a todos los jefes seguidos y luego el BOSS FINAL?')) playBoss('choco', true); };
