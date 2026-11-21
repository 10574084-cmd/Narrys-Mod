import { randomTips } from './tips.js';
// Intro: créditos + tips tontos sincronizados con la canción; en el drop aparece el menú principal
const DROP = 29.83; // segundo exacto donde la canción revienta
const LINES = [
  [0.6, 5.2, 'big', 'NARRY\'S MOD', 'presenta…'],
  [5.6, 10.8, 'mid', 'Programado por', 'CLAUDE', 'una IA que nunca duerme (ni va al baño)'],
  [11.2, 16.4, 'mid', 'Ideas, memes y locura por', 'ms63', 'el verdadero jefe del juego'],
  [16.9, 22.6, 'tip', '💡 TIP #1', ''],
  [23.0, 28.2, 'tip', '💡 TIP #2', ''],
  [28.5, 29.78, 'big', 'Prepárate…', ''],
];
let audio = null, root = null, raf = 0, active = false, done = null, t0 = 0;

export const introActive = () => active;

export function stopIntro() {
  if (audio) { try { audio.pause(); } catch { /* nada */ } audio = null; }
  if (root) { root.remove(); root = null; }
  cancelAnimationFrame(raf); active = false;
}

function finish() {
  if (!active) return;
  cancelAnimationFrame(raf); active = false;
  root.classList.add('drop');                         // flash blanco + sacudida
  document.getElementById('menu').classList.add('boom');
  setTimeout(() => { if (root) { root.remove(); root = null; } document.getElementById('menu').classList.remove('boom'); }, 700);
  if (done) done();
  // la música sigue sonando en el menú, con fundido al final
  if (audio) {
    const a = audio;
    const fade = setInterval(() => {
      if (!a.paused && a.duration - a.currentTime < 3) a.volume = Math.max(0, a.volume - 0.02);
      if (a.ended || a.paused) clearInterval(fade);
    }, 100);
  }
}

export function runIntro(onDone) {
  done = onDone;
  root = document.getElementById('intro');
  if (!root) { onDone && onDone(); return; }
  active = true;
  const [t1, t2] = randomTips(2);
  LINES[3][4] = t1; LINES[4][4] = t2;           // tips distintos en cada visita
  const stage = root.querySelector('.stage');
  let shown = -1;
  const render = i => {
    shown = i;
    stage.className = 'stage';
    if (i < 0) { stage.innerHTML = ''; return; }
    const L = LINES[i]; stage.className = 'stage ' + L[2]; stage.innerHTML = '';
    for (let k = 3; k < L.length; k++) {
      if (!L[k]) continue;
      const d = document.createElement('div'); d.className = 'l' + (k - 3); d.textContent = L[k]; stage.appendChild(d);
    }
  };
  const clock = () => (performance.now() - t0) / 1000;
  const tick = () => {
    const t = audio && !audio.paused ? audio.currentTime : clock();
    if (t >= DROP) { finish(); return; }
    let idx = -1;
    for (let i = 0; i < LINES.length; i++) if (t >= LINES[i][0] && t < LINES[i][1]) idx = i;
    if (idx !== shown) render(idx);
    root.style.setProperty('--tense', Math.max(0, (t - 26) / 3.8).toFixed(3));
    raf = requestAnimationFrame(tick);
  };
  // arranca sola; si el navegador bloquea el audio, suena con el primer toque/tecla (sincronizada con el reloj)
  audio = new Audio('assets/intro.mp3'); audio.preload = 'auto'; audio.volume = 0.9;
  t0 = performance.now();
  const unlock = () => {
    if (!audio || !active) return;
    audio.play().then(() => { try { audio.currentTime = clock(); } catch { /* nada */ } }).catch(() => {});
  };
  const events = ['pointerdown', 'keydown', 'touchstart'];
  const once = () => { events.forEach(ev => window.removeEventListener(ev, once, true)); unlock(); };
  audio.play().catch(() => events.forEach(ev => window.addEventListener(ev, once, true)));
  raf = requestAnimationFrame(tick);
}
