// Menú principal, ajustes y conexión con el juego
import { MAP_DEFS, generateMap, N } from './maps.js';
import { Game, isTouch } from './game.js';
import { MEME_KINDS, makeMemeCanvas, buildMemePool, addUserImage, loadUserMemes, clearUserMemes } from './memes.js';

const $ = id => document.getElementById(id);
if (isTouch) document.body.classList.add('touch');

const KEY = 'narrysmod_cfg_v1';
const cfg = Object.assign({ map: 0, cpus: isTouch ? 10 : 20, bots: 3, diff: 1, dur: 240, quality: isTouch ? 'med' : 'high', fov: 80, sens: 10, name: 'Jugador', only: false },
  (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })());
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
  const m = generateMap(def, 1234 + def.id.length * 17), s = 4;
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
}

/* ---------- ajustes ---------- */
function bindRange(id, key, out, f = v => v) {
  const el = $(id); el.value = cfg[key]; const show = () => { $(out).textContent = f(el.value); };
  el.oninput = () => { cfg[key] = +el.value; show(); save(); }; show();
}
bindRange('pCpus', 'cpus', 'vCpus'); bindRange('pBots', 'bots', 'vBots');
bindRange('pFov', 'fov', 'vFov', v => v + '°'); bindRange('pSens', 'sens', 'vSens', v => (v / 10).toFixed(1) + '×');
$('pName').value = cfg.name; $('pName').oninput = e => { cfg.name = e.target.value.trim().slice(0, 16) || 'Jugador'; save(); };
for (const [id, key, num] of [['pDiff', 'diff', true], ['pDur', 'dur', true], ['pQual', 'quality', false]]) {
  const el = $(id); el.value = cfg[key]; el.onchange = () => { cfg[key] = num ? +el.value : el.value; save(); updHint(); };
}
$('pOnly').checked = cfg.only; $('pOnly').onchange = e => { cfg.only = e.target.checked; save(); };
function updHint() { $('rtHint').style.display = cfg.quality === 'rt' ? 'block' : 'none'; }
updHint();
function updMemeCount() { $('memeCount').textContent = `${loadUserMemes().length} imágenes tuyas + ${MEME_KINDS.length} incluidas`; }
updMemeCount();
$('pFile').onchange = async e => {
  for (const f of e.target.files) { try { await addUserImage(f); } catch (err) { alert('No se pudo guardar "' + f.name + '": ' + err.message); } }
  e.target.value = ''; updMemeCount();
};
$('pClear').onclick = () => { clearUserMemes(); updMemeCount(); };
selectMap(cfg.map);

/* ---------- juego ---------- */
const game = new Game($('c'));
const show = (id, on) => $(id).classList.toggle('hidden', !on);

function toMenu() {
  game.stop(); show('hud', false); show('over', false); show('pause', false); show('scare', false); show('menu', true);
  if (document.pointerLockElement) document.exitPointerLock();
}

async function play() {
  show('loading', true); $('loadText').textContent = 'Generando mapa…';
  game.sfx.init(MAP_DEFS[cfg.map].drone); // el clic cuenta como gesto para activar el audio
  await new Promise(r => setTimeout(r, 30));
  try {
    const pool = await buildMemePool(cfg.only);
    $('loadText').textContent = cfg.quality === 'rt' ? 'Cargando efectos de raytracing…' : 'Construyendo escena…';
    await game.start({ map: cfg.map, cpus: cfg.cpus, bots: cfg.bots, diff: cfg.diff, dur: cfg.dur, quality: cfg.quality, fov: cfg.fov, sens: cfg.sens / 10, name: cfg.name }, pool);
  } catch (err) {
    console.error(err); show('loading', false);
    alert('Error al iniciar: ' + (err && err.message ? err.message : err));
    return;
  }
  show('menu', false); show('loading', false); show('over', false); show('hud', true); show('pause', false);
  game.lock();
}

game.onEvent = (type, d) => {
  if (type === 'pause') {
    if (game.state === 'playing' || game.state === 'dead') { game.pause(); show('pause', true); }
  } else if (type === 'dead') {
    $('over').classList.remove('win'); $('overTitle').textContent = '¡TE ATRAPARON!';
    $('overText').textContent = `${d.by} te encontró. Sobreviviste ${Math.floor(d.time)} s y quedaste en el puesto ${d.place} de ${d.total}.`;
    $('spectHint').textContent = 'Mirando a los CPU · Espacio / clic para cambiar de jugador';
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

$('play').onclick = play;
$('retry').onclick = () => { show('over', false); play(); };
$('toMenu1').onclick = toMenu; $('toMenu2').onclick = toMenu;
$('resume').onclick = () => { show('pause', false); game.unpause(); game.lock(); };
window.addEventListener('keydown', e => { if (e.code === 'Enter' && !$('menu').classList.contains('hidden') && document.activeElement.tagName !== 'INPUT') play(); });

window.__game = game; // útil para depurar en la consola
