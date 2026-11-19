// Caras meme para los nextbots: se dibujan en canvas (originales) y además puedes subir tus propias imágenes
export const MEME_KINDS = [
  { id: 'scream', name: 'Gritón' },
  { id: 'derp', name: 'Sr. Derp' },
  { id: 'grin', name: 'Sonrisa Eterna' },
  { id: 'laugh', name: 'Llorón Risueño' },
  { id: 'rock', name: 'La Piedra' },
  { id: 'redeyes', name: 'Ojos Rojos' },
  { id: 'cat', name: 'Gato Asustado' },
  { id: 'glitch', name: 'Glitch Man' },
];

const S = 256;
const rnd = (a, b) => a + Math.random() * (b - a);

function ell(x, cx, cy, rx, ry, fill, stroke, lw = 4, rot = 0) {
  x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); }
}
function head(x, c1, c2, rx = 112, ry = 118) {
  const g = x.createRadialGradient(100, 90, 20, 128, 128, 130);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ell(x, 128, 128, rx, ry, g, '#1a1208', 5);
}
function caption(x, text) {
  x.font = '900 34px Impact, "Arial Black", sans-serif'; x.textAlign = 'center';
  x.lineWidth = 7; x.strokeStyle = '#000'; x.fillStyle = '#fff';
  x.strokeText(text, 128, 246); x.fillText(text, 128, 246);
}

const DRAW = {
  scream(x) {
    head(x, '#ffe27a', '#e0a526');
    ell(x, 88, 96, 26, 32, '#fff', '#000', 4); ell(x, 168, 96, 26, 32, '#fff', '#000', 4);
    ell(x, 92, 100, 8, 8, '#000'); ell(x, 164, 100, 8, 8, '#000');
    x.strokeStyle = '#000'; x.lineWidth = 9; x.lineCap = 'round';
    x.beginPath(); x.moveTo(58, 56); x.lineTo(108, 66); x.moveTo(198, 56); x.lineTo(148, 66); x.stroke();
    ell(x, 128, 175, 46, 52, '#2a0509', '#000', 5);
    ell(x, 128, 200, 30, 20, '#e0505a');
    x.fillStyle = '#fff'; x.fillRect(96, 128, 64, 14);
    caption(x, 'AAAAAAA');
  },
  derp(x) {
    head(x, '#ffd8b0', '#d49a68');
    ell(x, 82, 100, 30, 30, '#fff', '#000', 4); ell(x, 172, 92, 18, 18, '#fff', '#000', 4);
    ell(x, 96, 106, 10, 10, '#000'); ell(x, 164, 90, 7, 7, '#000');
    x.strokeStyle = '#3a2410'; x.lineWidth = 8; x.lineCap = 'round';
    x.beginPath(); x.moveTo(50, 62); x.lineTo(110, 52); x.moveTo(150, 70); x.lineTo(200, 58); x.stroke();
    x.strokeStyle = '#000'; x.lineWidth = 6;
    x.beginPath(); x.moveTo(78, 170); x.quadraticCurveTo(128, 190, 178, 160); x.stroke();
    ell(x, 160, 188, 20, 30, '#e56a80', '#000', 4, 0.4);
    caption(x, 'ESPERA');
  },
  grin(x) {
    head(x, '#f6efe0', '#bfae8c');
    ell(x, 86, 96, 24, 24, '#fff', '#000', 3); ell(x, 170, 96, 24, 24, '#fff', '#000', 3);
    ell(x, 86, 96, 4, 4, '#000'); ell(x, 170, 96, 4, 4, '#000');
    x.fillStyle = '#1a0408'; x.beginPath(); x.moveTo(40, 150);
    x.quadraticCurveTo(128, 260, 216, 150); x.quadraticCurveTo(128, 190, 40, 150); x.fill();
    x.strokeStyle = '#000'; x.lineWidth = 4; x.stroke();
    x.fillStyle = '#fff';
    for (let i = 0; i < 9; i++) { const px = 54 + i * 18; x.fillRect(px, 166 + Math.sin(i / 8 * Math.PI) * 12, 12, 16); }
    caption(x, 'NO PARES');
  },
  laugh(x) {
    head(x, '#ffe27a', '#e0a526');
    x.strokeStyle = '#000'; x.lineWidth = 9; x.lineCap = 'round';
    x.beginPath(); x.arc(86, 100, 22, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    x.beginPath(); x.arc(170, 100, 22, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    ell(x, 128, 168, 56, 44, '#2a0509', '#000', 5);
    ell(x, 128, 190, 34, 18, '#e0505a');
    ell(x, 52, 130, 12, 26, '#7ec8ff', '#2a6aa8', 3); ell(x, 204, 130, 12, 26, '#7ec8ff', '#2a6aa8', 3);
    caption(x, 'JAJAJA');
  },
  rock(x) {
    const g = x.createRadialGradient(100, 90, 20, 128, 128, 140);
    g.addColorStop(0, '#9aa0a6'); g.addColorStop(1, '#4b5056');
    ell(x, 128, 128, 108, 120, g, '#222', 6);
    for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(0,0,0,${rnd(0.05, 0.25)})`; x.fillRect(rnd(30, 226), rnd(10, 246), rnd(1, 4), rnd(1, 4)); }
    x.strokeStyle = '#1e2124'; x.lineWidth = 12; x.lineCap = 'round';
    x.beginPath(); x.moveTo(52, 94); x.lineTo(108, 94); x.moveTo(148, 80); x.lineTo(204, 70); x.stroke();
    ell(x, 82, 112, 12, 8, '#15171a'); ell(x, 176, 108, 12, 8, '#15171a');
    x.beginPath(); x.moveTo(98, 188); x.lineTo(158, 188); x.stroke();
    caption(x, 'MMM...');
  },
  redeyes(x) {
    head(x, '#2a2a30', '#0a0a0d');
    for (const cx of [82, 174]) {
      const g = x.createRadialGradient(cx, 100, 2, cx, 100, 40);
      g.addColorStop(0, '#fff'); g.addColorStop(0.2, '#ff3030'); g.addColorStop(1, 'rgba(255,0,0,0)');
      x.fillStyle = g; x.fillRect(cx - 45, 55, 90, 90);
    }
    x.strokeStyle = '#eee'; x.lineWidth = 6; x.beginPath();
    x.moveTo(60, 176); x.quadraticCurveTo(128, 232, 196, 176); x.stroke();
    caption(x, 'TE VEO');
  },
  cat(x) {
    x.fillStyle = '#e08a2e'; x.strokeStyle = '#1a1208'; x.lineWidth = 5;
    x.beginPath(); x.moveTo(30, 120); x.lineTo(40, 14); x.lineTo(100, 60); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(226, 120); x.lineTo(216, 14); x.lineTo(156, 60); x.closePath(); x.fill(); x.stroke();
    head(x, '#f5a850', '#c8701c', 108, 104);
    ell(x, 88, 112, 28, 32, '#fff', '#000', 4); ell(x, 168, 112, 28, 32, '#fff', '#000', 4);
    ell(x, 88, 112, 6, 28, '#000'); ell(x, 168, 112, 6, 28, '#000');
    x.fillStyle = '#e56a80'; x.beginPath(); x.moveTo(118, 156); x.lineTo(138, 156); x.lineTo(128, 168); x.fill();
    x.strokeStyle = '#000'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(128, 168); x.quadraticCurveTo(110, 190, 92, 178); x.moveTo(128, 168); x.quadraticCurveTo(146, 190, 164, 178); x.stroke();
    caption(x, 'MIAU?!');
  },
  glitch(x, c) {
    DRAW.derp(x);
    for (let i = 0; i < 14; i++) {
      const y = rnd(0, S - 20), h = rnd(6, 26), off = rnd(-30, 30);
      x.drawImage(c, 0, y, S, h, off, y, S, h);
    }
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = 'rgba(0,255,255,0.35)'; x.fillRect(0, 0, S / 2, S);
    x.fillStyle = 'rgba(255,0,200,0.35)'; x.fillRect(S / 2, 0, S / 2, S);
    x.globalCompositeOperation = 'source-over';
  },
};

export function makeMemeCanvas(id) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  DRAW[id](x, c);
  for (let i = 0; i < 700; i++) { // ruido "deep fried"
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.12})`;
    x.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  return c;
}

/* ---- media del usuario (PNG/JPG/WEBP/GIF/WEBM) guardada en IndexedDB ---- */
const DB = 'narrysmod_media', ST = 'files';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction(ST, mode); const req = fn(t.objectStore(ST));
    t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error);
  });
}
export const listMedia = () => tx('readonly', s => s.getAll());
export const removeMedia = id => tx('readwrite', s => s.delete(id));
export const clearMedia = () => tx('readwrite', s => s.clear());

export function kindOf(file) {
  const n = (file.name || '').toLowerCase(), t = file.type || '';
  if (t.startsWith('video/') || /\.(webm|mp4)$/.test(n)) return 'video';
  if (t === 'image/gif' || n.endsWith('.gif')) return 'gif';
  if (t.startsWith('image/') || /\.(png|jpe?g|webp|avif)$/.test(n)) return 'image';
  return null;
}
export async function addMedia(file) {
  const kind = kindOf(file);
  if (!kind) throw new Error('Formato no soportado (usa PNG, JPG, GIF o WEBM)');
  await tx('readwrite', s => s.add({ name: (file.name || 'Meme').replace(/\.[^.]+$/, '').slice(0, 24), kind, blob: file }));
}

// miniatura y proporción de una imagen/gif/video
function makeThumb(kind, blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob), c = document.createElement('canvas');
    c.width = c.height = 96;
    const fin = (el, w, h) => {
      const x = c.getContext('2d'), k = Math.max(96 / w, 96 / h);
      try { x.drawImage(el, (96 - w * k) / 2, (96 - h * k) / 2, w * k, h * k); } catch { /* nada */ }
      URL.revokeObjectURL(url); resolve({ thumb: c.toDataURL('image/png'), aspect: (w / h) || 1 });
    };
    if (kind === 'video') {
      const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url;
      v.onloadeddata = () => { v.currentTime = Math.min(0.1, (v.duration || 1) / 2); };
      v.onseeked = () => fin(v, v.videoWidth || 96, v.videoHeight || 96);
      v.onerror = () => { URL.revokeObjectURL(url); resolve({ thumb: '', aspect: 1 }); };
    } else {
      const i = new Image(); i.onload = () => fin(i, i.naturalWidth || 96, i.naturalHeight || 96);
      i.onerror = () => { URL.revokeObjectURL(url); resolve({ thumb: '', aspect: 1 }); }; i.src = url;
    }
  });
}

// Pool completo: incluidos + tuyos (IndexedDB) + los de images/memes/manifest.json
export async function buildMemePool() {
  const pool = [];
  for (const k of MEME_KINDS) {
    const canvas = makeMemeCanvas(k.id);
    pool.push({ id: 'b_' + k.id, name: k.name, kind: 'canvas', canvas, thumb: canvas.toDataURL(), aspect: 1, builtin: true });
  }
  let mine = []; try { mine = await listMedia(); } catch { /* sin IndexedDB */ }
  for (const m of mine) {
    const { thumb, aspect } = await makeThumb(m.kind, m.blob);
    pool.push({ id: 'u_' + m.id, dbId: m.id, name: m.name, kind: m.kind, blob: m.blob, thumb, aspect });
  }
  try { // images/memes/manifest.json = ["a.png","b.gif","c.webm"]
    const r = await fetch('images/memes/manifest.json', { cache: 'no-cache' });
    if (r.ok) for (const f of await r.json()) {
      const rr = await fetch('images/memes/' + encodeURIComponent(f)).catch(() => null);
      if (!rr || !rr.ok) continue;
      const blob = await rr.blob(), kind = kindOf({ name: String(f), type: blob.type });
      if (!kind) continue;
      const { thumb, aspect } = await makeThumb(kind, blob);
      pool.push({ id: 'r_' + f, name: String(f).replace(/\.[^.]+$/, ''), kind, blob, thumb, aspect });
    }
  } catch { /* sin manifest */ }
  return pool;
}
