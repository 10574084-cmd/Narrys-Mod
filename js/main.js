// Menú principal, ajustes y conexión con el juego
import { MAP_DEFS, generateMap, N, setMapSize } from './maps.js';
import { Game, isTouch } from './game.js';
import { TitleScene } from './title.js';
import { MEME_KINDS, makeMemeCanvas, buildMemePool, addMedia, removeMedia, clearMedia } from './memes.js';

const $ = id => document.getElementById(id);
if (isTouch) document.body.classList.add('touch');

const KEY = 'narrysmod_cfg_v1';
const cfg = Object.assign({ map: 0, cpus: isTouch ? 10 : 20, bots: 3, diff: 1, dur: 240, quality: isTouch ? 'med' : 'high', size: 48, fov: 80, sens: 10, name: 'Jugador', only: false, counts: {} },
  (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })());
let title = null;
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
MAP_DEFS.forEach((def, i) => {
  const d = document.createElement('div'); d.className = 'map'; d.dataset.i = i;
  const c = document.createElement('canvas'); d.appendChild(c);
  const sp = document.createElement('span'); sp.textContent = `${def.icon} ${def.name}`; d.appendChild(sp);
  d.onclick = () => selectMap(i);
  mapsEl.appendChild(d);
  try { drawPreview(c, def); } catch (e) { console.warn(e); }
});
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
$('pOnly').checked = cfg.only; $('pOnly').onchange = e => { cfg.only = e.target.checked; save(); };
function updHint() { $('rtHint').style.display = cfg.quality === 'rt' ? 'block' : 'none'; }
updHint();
async function renderMemes() {
  const list = $('memeList'); let pool = [];
  try { pool = await buildMemePool(); } catch (e) { console.warn(e); }
  list.innerHTML = '';
  for (const e of pool) {
    const n = cfg.counts[e.id] || 0, d = document.createElement('div');
    d.className = 'meme' + (n ? ' on' : '');
    d.innerHTML = `<img alt=""><span></span><div class="cnt"><button type="button">−</button><b>${n}</b><button type="button">+</button></div>`;
    d.querySelector('img').src = e.thumb; d.querySelector('span').textContent = e.name; d.title = e.name;
    if (e.kind === 'gif' || e.kind === 'video') { const t = document.createElement('i'); t.className = 'tag'; t.textContent = e.kind.toUpperCase(); d.appendChild(t); }
    const [minus, plus] = d.querySelectorAll('button');
    const set = v => { cfg.counts[e.id] = Math.max(0, Math.min(10, v)); save(); d.querySelector('b').textContent = cfg.counts[e.id]; d.classList.toggle('on', cfg.counts[e.id] > 0); };
    minus.onclick = () => set((cfg.counts[e.id] || 0) - 1); plus.onclick = () => set((cfg.counts[e.id] || 0) + 1);
    if (e.dbId != null) {
      const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.type = 'button';
      x.onclick = async () => { await removeMedia(e.dbId); delete cfg.counts[e.id]; save(); renderMemes(); };
      d.appendChild(x);
    }
    list.appendChild(d);
  }
}
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
MAP_DEFS.forEach((def, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = `${def.icon} ${def.name}`;
  b.onclick = () => selectMap(i); $('mapChips').appendChild(b);
});
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
  show('loading', true); $('loadText').textContent = 'Generando mapa…';
  game.sfx.init(MAP_DEFS[cfg.map].drone); // el clic cuenta como gesto para activar el audio
  await new Promise(r => setTimeout(r, 30));
  try {
    let pool = await buildMemePool();
    if (cfg.only && pool.some(e => !e.builtin)) pool = pool.filter(e => !e.builtin);
    const plan = [];
    for (const e of pool) for (let k = 0; k < (cfg.counts[e.id] || 0); k++) plan.push(e);
    const total = Math.min(20, Math.max(cfg.bots, plan.length));
    plan.length = Math.min(plan.length, total);
    while (plan.length < total) plan.push(pool[Math.floor(Math.random() * pool.length)]);
    plan.sort(() => Math.random() - 0.5);
    $('loadText').textContent = cfg.quality === 'rt' ? 'Cargando efectos de raytracing…' : 'Construyendo escena…';
    await game.start({ map: cfg.map, cpus: cfg.cpus, bots: total, plan, diff: cfg.diff, size: cfg.size, dur: cfg.dur, quality: cfg.quality, fov: cfg.fov, sens: cfg.sens / 10, name: cfg.name }, pool);
  } catch (err) {
    console.error(err); show('loading', false);
    alert('Error al iniciar: ' + (err && err.message ? err.message : err));
    return;
  }
  if (title) title.pause();
  show('menu', false); show('loading', false); show('over', false); show('hud', true); show('pause', false);
  game.lock();
}

game.onEvent = (type, d) => {
  if (type === 'pause') {
    if (!$('over').classList.contains('hidden') || !$('chocoBox').classList.contains('hidden')) return; // ya hay una pantalla encima
    if (game.state === 'playing' || game.state === 'dead') { game.pause(); show('pause', true); }
  } else if (type === 'dead') {
    $('over').classList.remove('win'); $('overTitle').textContent = '¡TE ATRAPARON!';
    $('overText').textContent = `${d.by} te encontró. Sobreviviste ${Math.floor(d.time)} s y quedaste en el puesto ${d.place} de ${d.total}.`;
    $('spectHint').textContent = 'Mirando a los CPU · Espacio / clic para cambiar de jugador';
    show('choco', game.state === 'dead' && !game.chocoUsed);
    show('over', true); if (document.pointerLockElement) document.exitPointerLock();
  } else if (type === 'win') {
    $('over').classList.add('win'); $('overTitle').textContent = '¡SOBREVIVISTE!';
    $('overText').textContent = `Aguantaste toda la ronda. Quedan ${d.survivors} de ${d.total} jugadores con vida.`;
    $('spectHint').textContent = ''; show('over', true); if (document.pointerLockElement) document.exitPointerLock();
  } else if (type === 'end') {
    $('over').classList.remove('win'); $('overTitle').textContent = 'RONDA TERMINADA';
    $('overText').textContent = `Sobrevivieron ${d.survivors} de ${d.total} jugadores.`;
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
  v.onended = finish; v.onerror = finish; $('chocoSkip').onclick = finish;
  v.currentTime = 0; v.muted = false;
  const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play().catch(finish); });
};
$('play').onclick = play; $('play2').onclick = play;
function go(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id)); if (id === 'scrMain') updSummary(); $('menu').scrollTop = 0; }
document.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => go(b.dataset.go); });
function updSummary() {
  const q = { low: 'Bajo', med: 'Medio', high: 'Alto', rt: 'Raytracing' }[cfg.quality];
  $('summary').textContent = `${MAP_DEFS[cfg.map].name} · ${{48:'Normal',64:'Grande',80:'Enorme'}[cfg.size] || 'Normal'} · ${cfg.cpus} CPUs · ${cfg.bots} nextbots · ${q}`;
}
updSummary();
$('retry').onclick = () => { show('over', false); play(); };
$('toMenu1').onclick = toMenu; $('toMenu2').onclick = toMenu;
$('resume').onclick = () => { show('pause', false); game.unpause(); game.lock(); };
window.addEventListener('keydown', e => { if (e.code === 'Enter' && !$('menu').classList.contains('hidden') && document.activeElement.tagName !== 'INPUT') play(); });

try {
  title = new TitleScene($('bg3d'));
  title.setMap(MAP_DEFS[cfg.map]); title.start();
  $('menu').classList.add('has3d'); $('bgfaces').remove();
  window.__title = title;
} catch (err) { console.warn('Fondo 3D no disponible', err); $('bg3d').remove(); $('bgShade').remove(); }

window.__game = game; // útil para depurar en la consola
