// Texturas procedurales (se generan en canvas, no hace falta descargar nada)
import * as THREE from 'three';

function mk(w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
const rnd = (a, b) => a + Math.random() * (b - a);

function speckle(ctx, w, h, n, alpha, color = '0,0,0') {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(${color},${Math.random() * alpha})`;
    const s = 1 + Math.random() * 2.5;
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}

function tex(c, tileW, tileH, extra = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.userData = { tileW, tileH, ...extra };
  return t;
}

export const TEX = {
  wallpaper(base = '#c9b458', stripe = '#b39c40') {
    const [c, x] = mk();
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    x.fillStyle = stripe;
    for (let i = 0; i < 256; i += 32) x.fillRect(i, 0, 14, 256);
    speckle(x, 256, 256, 2500, 0.12);
    speckle(x, 256, 256, 800, 0.1, '255,255,255');
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 238, 256, 18); // zócalo
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.25, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return tex(c, 2.5, 2.5);
  },
  carpet(base = '#8c7c36') {
    const [c, x] = mk();
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    speckle(x, 256, 256, 9000, 0.22);
    speckle(x, 256, 256, 5000, 0.12, '255,255,255');
    return tex(c, 2.5, 2.5);
  },
  ceiling(base = '#d9d2a6') {
    const [c, x] = mk();
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    speckle(x, 256, 256, 3000, 0.1);
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3;
    x.strokeRect(0, 0, 256, 256);
    return tex(c, 2.5, 2.5);
  },
  concrete(base = '#7d8186') {
    const [c, x] = mk();
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    speckle(x, 256, 256, 7000, 0.18);
    speckle(x, 256, 256, 2500, 0.12, '255,255,255');
    x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      x.beginPath(); let px = rnd(0, 256), py = rnd(0, 256); x.moveTo(px, py);
      for (let k = 0; k < 6; k++) { px += rnd(-25, 25); py += rnd(5, 30); x.lineTo(px, py); }
      x.stroke();
    }
    return tex(c, 2.5, 2.5);
  },
  metal(base = '#3a3e44') {
    const [c, x] = mk();
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 16) {
      x.fillStyle = `rgba(255,255,255,${0.05 + (i % 32 ? 0.04 : 0)})`; x.fillRect(i, 0, 8, 256);
    }
    speckle(x, 256, 256, 3000, 0.15);
    return tex(c, 2.5, 2.5);
  },
  wood(base = '#6a4a2e') {
    const [c, x] = mk();
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      x.fillStyle = `rgba(0,0,0,${rnd(0.05, 0.25)})`; x.fillRect(0, y, 256, 32);
      x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(0, y, 256, 2);
      x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 1;
      for (let k = 0; k < 7; k++) {
        const yy = y + rnd(3, 30);
        x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(80, yy + rnd(-3, 3), 160, yy + rnd(-3, 3), 256, yy); x.stroke();
      }
    }
    speckle(x, 256, 256, 1500, 0.15);
    return tex(c, 2.5, 2.5);
  },
  asphalt(base = '#25272b') {
    const [c, x] = mk();
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    speckle(x, 256, 256, 9000, 0.3);
    speckle(x, 256, 256, 4000, 0.15, '255,255,255');
    return tex(c, 5, 5);
  },
  // suelo/paredes a cuadros marrones y crema (estilo colina verde)
  checker(a = '#5a3416', b = '#b88a45') {
    const [c, x] = mk();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * 64, j * 64, 64, 64); }
    speckle(x, 256, 256, 2500, 0.18);
    x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
    return tex(c, 3, 3);
  },
  // mapa final: bloques de colores al azar con líneas desplazadas (efecto glitch)
  glitch() {
    const [c, x] = mk(256, 256);
    const pal = ['#ff00ff', '#00ffff', '#111111', '#ffffff', '#ff2020', '#20ff40', '#2030ff', '#ffe600', '#6a00ff', '#000000'];
    for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) { x.fillStyle = pal[(Math.random() * pal.length) | 0]; x.fillRect(i * 11, j * 11, 11, 11); }
    for (let k = 0; k < 40; k++) { // franjas desplazadas
      const y = (Math.random() * 256) | 0, h = 2 + ((Math.random() * 14) | 0), dx = ((Math.random() - 0.5) * 120) | 0;
      x.drawImage(c, 0, y, 256, h, dx, y, 256, h);
    }
    for (let y = 0; y < 256; y += 4) { x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(0, y, 256, 1); }
    return tex(c, 5, 5);
  },
  grass(base = '#1f3a1c') {
    const [c, x] = mk();
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4500; i++) {
      x.strokeStyle = `rgba(${Math.random() < 0.5 ? '10,40,10' : '70,110,50'},${rnd(0.1, 0.5)})`;
      const px = rnd(0, 256), py = rnd(0, 256);
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + rnd(-3, 3), py - rnd(3, 9)); x.stroke();
    }
    return tex(c, 4, 4);
  },
  hedge(base = '#12301a') {
    const [c, x] = mk();
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = `rgba(${Math.random() < 0.5 ? '5,25,8' : '40,90,40'},${rnd(0.2, 0.7)})`;
      x.beginPath(); x.arc(rnd(0, 256), rnd(0, 256), rnd(2, 6), 0, 6.3); x.fill();
    }
    return tex(c, 2.5, 2.5);
  },
  building(base = '#2b3038', lit = 0.32) {
    const [c, x] = mk(256, 512);
    const [e, ex] = mk(256, 512);
    x.fillStyle = base; x.fillRect(0, 0, 256, 512);
    speckle(x, 256, 512, 5000, 0.2);
    ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 512);
    const cols = 2, rows = 4;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const wx = 22 + k * 118, wy = 22 + r * 124, ww = 94, wh = 84;
      const isLit = Math.random() < lit;
      x.fillStyle = isLit ? '#e9c46a' : '#0b1018';
      x.fillRect(wx, wy, ww, wh);
      x.strokeStyle = '#161a20'; x.lineWidth = 5; x.strokeRect(wx, wy, ww, wh);
      x.beginPath(); x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh); x.stroke();
      if (isLit) { ex.fillStyle = 'rgba(233,196,106,0.9)'; ex.fillRect(wx, wy, ww, wh); }
    }
    const t = tex(c, 2.5, 5);
    const et = tex(e, 2.5, 5);
    t.userData.emissive = et;
    return t;
  },
  sand(base = '#d8c58a') {
    const [c, x] = mk();
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    speckle(x, 256, 256, 7000, 0.18);
    speckle(x, 256, 256, 4000, 0.2, '255,255,255');
    x.strokeStyle = 'rgba(120,90,40,0.12)'; x.lineWidth = 2;
    for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(0, rnd(0, 256)); x.bezierCurveTo(80, rnd(0, 256), 170, rnd(0, 256), 256, rnd(0, 256)); x.stroke(); }
    return tex(c, 4, 4);
  },
  rock(base = '#4a4038') {
    const [c, x] = mk();
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${rnd(0.04, 0.14)})`;
      x.beginPath(); const px = rnd(0, 256), py = rnd(0, 256);
      x.moveTo(px, py); for (let k = 0; k < 5; k++) x.lineTo(px + rnd(-40, 40), py + rnd(-40, 40)); x.fill();
    }
    speckle(x, 256, 256, 6000, 0.25);
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2;
    for (let i = 0; i < 6; i++) { x.beginPath(); let px = rnd(0, 256), py = rnd(0, 256); x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += rnd(-30, 30); py += rnd(5, 30); x.lineTo(px, py); } x.stroke(); }
    return tex(c, 2.5, 2.5);
  },
  water(base = '#1f6fa8') {
    const [c, x] = mk();
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 3;
    for (let y = 10; y < 256; y += 22) { x.beginPath(); x.moveTo(0, y); for (let px = 0; px <= 256; px += 32) x.quadraticCurveTo(px + 16, y + rnd(-8, 8), px + 32, y); x.stroke(); }
    speckle(x, 256, 256, 1500, 0.1, '255,255,255');
    return tex(c, 2.5, 2.5);
  },
};
