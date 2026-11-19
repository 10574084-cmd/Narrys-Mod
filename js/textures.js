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
  building(base = '#2b3038') {
    const [c, x] = mk(256, 512);
    const [e, ex] = mk(256, 512);
    x.fillStyle = base; x.fillRect(0, 0, 256, 512);
    speckle(x, 256, 512, 5000, 0.2);
    ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 512);
    const cols = 2, rows = 4;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const wx = 22 + k * 118, wy = 22 + r * 124, ww = 94, wh = 84;
      const lit = Math.random() < 0.32;
      x.fillStyle = lit ? '#e9c46a' : '#0b1018';
      x.fillRect(wx, wy, ww, wh);
      x.strokeStyle = '#161a20'; x.lineWidth = 5; x.strokeRect(wx, wy, ww, wh);
      x.beginPath(); x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh); x.stroke();
      if (lit) { ex.fillStyle = 'rgba(233,196,106,0.9)'; ex.fillRect(wx, wy, ww, wh); }
    }
    const t = tex(c, 2.5, 5);
    const et = tex(e, 2.5, 5);
    t.userData.emissive = et;
    return t;
  },
};
