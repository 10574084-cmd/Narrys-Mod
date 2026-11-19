// 5 mapas generados proceduralmente (cada partida es un layout distinto)
export const N = 48;       // celdas por lado
export const CELL = 2.5;   // metros por celda

export function makeRng(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const I = (x, z) => z * N + x;
const inb = (x, z) => x >= 0 && z >= 0 && x < N && z < N;
const box = (dx, dy, dz, sx, sy, sz, c, e = false) => ({ s: 'box', dx, dy, dz, sx, sy, sz, c, e });
const part = (s, dx, dy, dz, sx, sy, sz, c, e = false) => ({ s, dx, dy, dz, sx, sy, sz, c, e });

function ctxNew(def, rng) {
  return {
    def, rng,
    g: new Uint8Array(N * N),                       // 0 libre, 1 pared, 2 objeto
    hgt: new Float32Array(N * N).fill(def.wallH),   // altura de pared
    hx: new Float32Array(N * N), hz: new Float32Array(N * N), // colisión de objetos
    props: [], lamps: [],
  };
}
function addProp(c, cx, cz, o) {
  const i = I(cx, cz);
  c.g[i] = 2; c.hx[i] = o.hx; c.hz[i] = o.hz;
  c.props.push({ x: (cx + 0.5) * CELL, z: (cz + 0.5) * CELL, rot: o.rot || 0, parts: o.parts });
}
function wallRect(c, x0, z0, x1, z1, h) {
  for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
    if (!inb(x, z)) continue;
    c.g[I(x, z)] = 1; if (h) c.hgt[I(x, z)] = h;
  }
}
function border(c, h) {
  for (let i = 0; i < N; i++) {
    for (const [x, z] of [[i, 0], [i, N - 1], [0, i], [N - 1, i]]) { c.g[I(x, z)] = 1; if (h) c.hgt[I(x, z)] = h; }
  }
}
function neighborsWall(c, x, z) {
  return (inb(x + 1, z) && c.g[I(x + 1, z)] === 1) || (inb(x - 1, z) && c.g[I(x - 1, z)] === 1) ||
         (inb(x, z + 1) && c.g[I(x, z + 1)] === 1) || (inb(x, z - 1) && c.g[I(x, z - 1)] === 1);
}

// Deja solo la región libre más grande (para que todo sea alcanzable)
function keepLargest(c) {
  const comp = new Int32Array(N * N).fill(-1);
  const sizes = []; const stack = new Int32Array(N * N);
  for (let s = 0; s < N * N; s++) {
    if (c.g[s] !== 0 || comp[s] >= 0) continue;
    const id = sizes.length; let sp = 0, count = 0;
    stack[sp++] = s; comp[s] = id;
    while (sp) {
      const cur = stack[--sp]; count++;
      const x = cur % N, z = (cur / N) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (!inb(nx, nz)) continue;
        const ni = I(nx, nz);
        if (c.g[ni] === 0 && comp[ni] < 0) { comp[ni] = id; stack[sp++] = ni; }
      }
    }
    sizes.push(count);
  }
  let best = -1, bn = 0;
  sizes.forEach((n, i) => { if (n > bn) { bn = n; best = i; } });
  const free = [];
  for (let i = 0; i < N * N; i++) {
    if (c.g[i] !== 0) continue;
    if (comp[i] === best) free.push(i); else c.g[i] = 1;
  }
  return free;
}

function indoorLamps(c, chance) {
  const h = c.def.ceilH;
  for (let z = 2; z < N - 1; z += 3) for (let x = 2; x < N - 1; x += 3) {
    if (c.g[I(x, z)] !== 0 || c.rng() > chance) continue;
    const wx = (x + 0.5) * CELL, wz = (z + 0.5) * CELL;
    c.lamps.push({ x: wx, z: wz, y: h - 0.5 });
    c.props.push({ x: wx, z: wz, rot: 0, parts: [box(0, h - 0.03, 0, 1.3, 0.06, 1.3, c.def.lamp.panel, true)] });
  }
}

/* ---------------------------- BACKROOMS ---------------------------- */
function genBackrooms(def, rng) {
  const c = ctxNew(def, rng); c.g.fill(1);
  const nn = 15, nx = i => 1 + 3 * i;
  const carveNode = (i, j) => { for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) c.g[I(nx(i) + a, nx(j) + b)] = 0; };
  const link = (i, j, k, l) => {
    if (i !== k) { const i0 = Math.min(i, k); for (let b = 0; b < 2; b++) c.g[I(nx(i0) + 2, nx(j) + b)] = 0; }
    else { const j0 = Math.min(j, l); for (let a = 0; a < 2; a++) c.g[I(nx(i) + a, nx(j0) + 2)] = 0; }
  };
  const vis = new Uint8Array(nn * nn); const st = [[0, 0]]; vis[0] = 1; carveNode(0, 0);
  while (st.length) {
    const [i, j] = st[st.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [i + a, j + b])
      .filter(([a, b]) => a >= 0 && b >= 0 && a < nn && b < nn && !vis[b * nn + a]);
    if (!nb.length) { st.pop(); continue; }
    const [a, b] = nb[Math.floor(rng() * nb.length)];
    vis[b * nn + a] = 1; carveNode(a, b); link(i, j, a, b); st.push([a, b]);
  }
  for (let j = 0; j < nn; j++) for (let i = 0; i < nn; i++) {
    if (i + 1 < nn && rng() < 0.2) link(i, j, i + 1, j);
    if (j + 1 < nn && rng() < 0.2) link(i, j, i, j + 1);
  }
  for (let k = 0; k < 5; k++) { // salas grandes con pilares
    const w = 6 + Math.floor(rng() * 5), h = 6 + Math.floor(rng() * 5);
    const x0 = 2 + Math.floor(rng() * (N - w - 4)), z0 = 2 + Math.floor(rng() * (N - h - 4));
    for (let z = z0; z < z0 + h; z++) for (let x = x0; x < x0 + w; x++) c.g[I(x, z)] = 0;
    for (let z = z0 + 1; z < z0 + h - 1; z += 3) for (let x = x0 + 1; x < x0 + w - 1; x += 3) {
      if (rng() < 0.75) addProp(c, x, z, { hx: 0.6, hz: 0.6, parts: [box(0, def.wallH / 2, 0, 1.2, def.wallH, 1.2, 0xcdbb5e)] });
    }
  }
  border(c);
  const free = keepLargest(c);
  indoorLamps(c, 0.85);
  return { c, free };
}

/* ---------------------------- ALMACÉN ---------------------------- */
function genWarehouse(def, rng) {
  const c = ctxNew(def, rng); border(c);
  const occ = new Uint8Array(N * N); const rooms = [];
  for (let k = 0; k < 14 && rooms.length < 3; k++) { // oficinas
    const w = 9 + Math.floor(rng() * 4), h = 7 + Math.floor(rng() * 3);
    const x0 = 3 + Math.floor(rng() * (N - w - 6)), z0 = 3 + Math.floor(rng() * (N - h - 6));
    let bad = false;
    for (const r of rooms) if (x0 < r.x1 + 3 && x0 + w > r.x0 - 3 && z0 < r.z1 + 3 && z0 + h > r.z0 - 3) bad = true;
    if (bad) continue;
    rooms.push({ x0, z0, x1: x0 + w, z1: z0 + h });
    for (let x = x0 - 1; x <= x0 + w; x++) for (let z = z0 - 1; z <= z0 + h; z++) if (inb(x, z)) occ[I(x, z)] = 1;
    for (let x = x0; x < x0 + w; x++) { c.g[I(x, z0)] = 1; c.g[I(x, z0 + h - 1)] = 1; }
    for (let z = z0; z < z0 + h; z++) { c.g[I(x0, z)] = 1; c.g[I(x0 + w - 1, z)] = 1; }
    const side = Math.floor(rng() * 4);
    for (let d = 0; d < 2; d++) {
      if (side === 0) c.g[I(x0 + 3 + d, z0)] = 0; else if (side === 1) c.g[I(x0 + 3 + d, z0 + h - 1)] = 0;
      else if (side === 2) c.g[I(x0, z0 + 3 + d)] = 0; else c.g[I(x0 + w - 1, z0 + 3 + d)] = 0;
    }
    for (let d = 0; d < 2; d++) { // escritorios
      const dx = x0 + 2 + Math.floor(rng() * (w - 4)), dz = z0 + 2 + Math.floor(rng() * (h - 4));
      if (c.g[I(dx, dz)] === 0) addProp(c, dx, dz, { hx: 0.9, hz: 0.6, parts: [box(0, 0.4, 0, 1.8, 0.8, 1.0, 0x6b4f33), box(0, 0.9, 0, 1.0, 0.1, 0.5, 0x222831)] });
    }
  }
  for (let z = 5; z < N - 4; z += 4) for (let x0 = 3; x0 < N - 4; x0 += 11) {
    if (rng() < 0.12) continue;
    for (let x = x0; x < Math.min(x0 + 8, N - 3); x++) {
      if (c.g[I(x, z)] !== 0 || occ[I(x, z)]) continue;
      const col = [0x4f6d8a, 0x8a5a3c, 0x5c7a4a][Math.floor(rng() * 3)];
      addProp(c, x, z, { hx: 1.25, hz: 0.6, parts: [
        box(0, 1.7, 0, 2.5, 3.4, 1.1, 0x2c3138),
        box(0, 0.55, 0, 2.3, 0.7, 1.15, col), box(0, 1.45, 0, 2.3, 0.7, 1.15, 0x9a7b4f), box(0, 2.35, 0, 2.3, 0.7, 1.15, col), box(0, 3.1, 0, 2.3, 0.5, 1.15, 0x8c6a42),
      ] });
    }
  }
  for (let k = 0; k < 40; k++) { // cajas sueltas
    const x = 2 + Math.floor(rng() * (N - 4)), z = 2 + Math.floor(rng() * (N - 4));
    if (c.g[I(x, z)] !== 0 || occ[I(x, z)]) continue;
    const s = 1.2 + rng() * 0.8;
    addProp(c, x, z, { hx: s / 2, hz: s / 2, rot: rng() * 0.6, parts: [box(0, s / 2, 0, s, s, s, 0x9b7a4a), box(0, s + 0.35, 0, s * 0.7, 0.7, s * 0.7, 0x86683f)] });
  }
  const free = keepLargest(c);
  indoorLamps(c, 0.8);
  return { c, free };
}

/* ---------------------------- MANSIÓN ---------------------------- */
function genMansion(def, rng) {
  const c = ctxNew(def, rng); border(c);
  const doors = [];
  const split = (x0, z0, w, h) => {
    if (w < 12 && h < 12) return;
    let vertical = w > h ? true : (h > w ? false : rng() < 0.5);
    if (vertical && w < 12) vertical = false;
    if (!vertical && h < 12) vertical = true;
    if (vertical) {
      const cx = x0 + 5 + Math.floor(rng() * (w - 10));
      for (let z = z0; z < z0 + h; z++) c.g[I(cx, z)] = 1;
      doors.push([cx, z0 + 2 + Math.floor(rng() * (h - 5)), 'v']);
      split(x0, z0, cx - x0, h); split(cx + 1, z0, x0 + w - cx - 1, h);
    } else {
      const cz = z0 + 5 + Math.floor(rng() * (h - 10));
      for (let x = x0; x < x0 + w; x++) c.g[I(x, cz)] = 1;
      doors.push([x0 + 2 + Math.floor(rng() * (w - 5)), cz, 'h']);
      split(x0, z0, w, cz - z0); split(x0, cz + 1, w, z0 + h - cz - 1);
    }
  };
  split(1, 1, N - 2, N - 2);
  for (const [x, z, t] of doors) { c.g[I(x, z)] = 0; if (t === 'v') c.g[I(x, z + 1)] = 0; else c.g[I(x + 1, z)] = 0; }
  const cols = [0x5a3a24, 0x3b2a22, 0x6e2b2b, 0x2f3e4f, 0x4a4a3a];
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    if (c.g[I(x, z)] !== 0 || !neighborsWall(c, x, z) || rng() > 0.09) continue;
    if (doors.some(([dx, dz]) => Math.abs(dx - x) < 3 && Math.abs(dz - z) < 3)) continue;
    const sx = 0.8 + rng() * 0.9, sz = 0.8 + rng() * 0.9, sy = 0.5 + rng() * 1.1, col = cols[Math.floor(rng() * cols.length)];
    addProp(c, x, z, { hx: sx / 2, hz: sz / 2, rot: 0, parts: [box(0, sy / 2, 0, sx, sy, sz, col), box(0, sy + 0.05, 0, sx * 0.9, 0.1, sz * 0.9, 0x1d1511)] });
  }
  const free = keepLargest(c);
  indoorLamps(c, 0.55);
  return { c, free };
}

/* ---------------------------- CIUDAD ---------------------------- */
function genCity(def, rng) {
  const c = ctxNew(def, rng);
  const P = 12, S = 4, heights = [7, 10, 14, 18];
  const trees = (x0, z0, x1, z1) => {
    for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
      if (c.g[I(x, z)] === 0 && rng() < 0.3) {
        const s = 0.8 + rng() * 0.5;
        addProp(c, x, z, { hx: 0.45, hz: 0.45, parts: [
          part('cyl', 0, 1, 0, 0.5, 2, 0.5, 0x4a3320),
          part('cone', 0, 3, 0, 2.4 * s, 3 * s, 2.4 * s, 0x1f5a2a), part('cone', 0, 4.4, 0, 1.8 * s, 2.2 * s, 1.8 * s, 0x276b33)] });
      }
    }
  };
  for (let bz = 0; bz < N / P; bz++) for (let bx = 0; bx < N / P; bx++) {
    const x0 = bx * P + S, z0 = bz * P + S, x1 = Math.min(x0 + P - S, N - 1), z1 = Math.min(z0 + P - S, N - 1);
    const r = rng();
    if (r < 0.14) trees(x0, z0, x1, z1);
    else if (r < 0.42) {
      const h1 = heights[Math.floor(rng() * 4)], h2 = heights[Math.floor(rng() * 4)];
      wallRect(c, x0, z0, x1, z1, h1);
      for (let z = z0; z < z1; z++) for (let x = x0 + 3; x < x0 + 5 && x < x1; x++) { c.g[I(x, z)] = 0; }
      wallRect(c, x0 + 5, z0, x1, z1, h2);
    } else wallRect(c, x0, z0, x1, z1, heights[Math.floor(rng() * 4)]);
  }
  border(c, 6);
  for (let k = 0; k < 60; k++) { // coches en las calles
    const vert = rng() < 0.5;
    const lane = 1 + P * Math.floor(rng() * 4), along = 1 + Math.floor(rng() * (N - 3));
    const xx = vert ? lane : along, zz = vert ? along : lane;
    const x2 = vert ? xx : xx + 1, z2 = vert ? zz + 1 : zz;
    if (!inb(x2, z2) || !inb(xx, zz)) continue;
    if (c.g[I(xx, zz)] !== 0 || c.g[I(x2, z2)] !== 0) continue;
    const onStreet = vert ? (xx % P) < S && (zz % P) >= S && (z2 % P) >= S : (zz % P) < S && (xx % P) >= S && (x2 % P) >= S;
    if (!onStreet) continue;
    const cols = [0x8c1c1c, 0x1c3d8c, 0xb8b8b8, 0x222222, 0x8c7a1c, 0x1c6b3a];
    const col = cols[Math.floor(rng() * cols.length)];
    const mx = ((xx + x2) / 2 + 0.5) * CELL, mz = ((zz + z2) / 2 + 0.5) * CELL;
    c.g[I(xx, zz)] = 2; c.g[I(x2, z2)] = 2;
    for (const [px, pz] of [[xx, zz], [x2, z2]]) { c.hx[I(px, pz)] = vert ? 0.95 : 1.25; c.hz[I(px, pz)] = vert ? 1.25 : 0.95; }
    c.props.push({ x: mx, z: mz, rot: vert ? 0 : Math.PI / 2, parts: [
      box(0, 0.22, 0, 1.7, 0.3, 3.8, 0x111111), box(0, 0.65, 0, 1.8, 0.6, 4.2, col),
      box(0, 1.2, -0.2, 1.55, 0.55, 2.1, 0x1b2a38), box(0, 0.7, 2.12, 1.4, 0.2, 0.05, 0xfff2b0, true), box(0, 0.7, -2.12, 1.4, 0.2, 0.05, 0xff2a2a, true)] });
  }
  const free = keepLargest(c);
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) { // farolas
    if (c.g[I(x, z)] !== 0 || !neighborsWall(c, x, z) || (x * 31 + z * 17) % 19 !== 0) continue;
    const wx = (x + 0.5) * CELL, wz = (z + 0.5) * CELL;
    c.lamps.push({ x: wx, z: wz, y: 5 });
    c.props.push({ x: wx, z: wz, rot: 0, parts: [part('cyl', 0, 2.5, 0, 0.14, 5, 0.14, 0x2a2d33), part('sphere', 0, 5.1, 0, 0.5, 0.5, 0.5, 0xffd9a0, true)] });
  }
  return { c, free };
}

/* ---------------------------- BOSQUE ---------------------------- */
function genForest(def, rng) {
  const c = ctxNew(def, rng); border(c, 5);
  const gn = 8, grid = Array.from({ length: gn * gn }, () => rng());
  const noise = (x, z) => {
    const fx = x / N * (gn - 1), fz = z / N * (gn - 1);
    const x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
    const g = (a, b) => grid[Math.min(gn - 1, b) * gn + Math.min(gn - 1, a)];
    return (g(x0, z0) * (1 - tx) + g(x0 + 1, z0) * tx) * (1 - tz) + (g(x0, z0 + 1) * (1 - tx) + g(x0 + 1, z0 + 1) * tx) * tz;
  };
  for (let k = 0; k < 4; k++) { // ruinas de piedra
    const w = 6 + Math.floor(rng() * 5), h = 5 + Math.floor(rng() * 4);
    const x0 = 4 + Math.floor(rng() * (N - w - 8)), z0 = 4 + Math.floor(rng() * (N - h - 8));
    for (let x = x0; x < x0 + w; x++) for (const z of [z0, z0 + h - 1]) if (rng() > 0.25) { c.g[I(x, z)] = 1; c.hgt[I(x, z)] = 2.4 + rng() * 1.2; }
    for (let z = z0; z < z0 + h; z++) for (const x of [x0, x0 + w - 1]) if (rng() > 0.25) { c.g[I(x, z)] = 1; c.hgt[I(x, z)] = 2.4 + rng() * 1.2; }
  }
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    if (c.g[I(x, z)] !== 0) continue;
    const p = 0.02 + 0.22 * noise(x, z) * noise(x, z) * 2;
    const r = rng();
    if (r < p) {
      const s = 0.8 + rng() * 0.7, dark = rng() < 0.5;
      addProp(c, x, z, { hx: 0.45, hz: 0.45, parts: [
        part('cyl', 0, 1.2, 0, 0.55, 2.4, 0.55, 0x3d2a1a),
        part('cone', 0, 3.4, 0, 2.8 * s, 3.4 * s, 2.8 * s, dark ? 0x12351f : 0x1b4a26), part('cone', 0, 5, 0, 2 * s, 2.6 * s, 2 * s, dark ? 0x174326 : 0x225a2e)] });
    } else if (r < p + 0.015) {
      const s = 0.8 + rng();
      addProp(c, x, z, { hx: 0.6 * s, hz: 0.6 * s, parts: [part('sphere', 0, 0.4 * s, 0, 1.7 * s, 1.1 * s, 1.4 * s, 0x5b5f66)] });
    }
  }
  const free = keepLargest(c);
  for (let k = 0; k < 14; k++) { // faroles con fuego
    const i = free[Math.floor(rng() * free.length)], x = i % N, z = (i / N) | 0;
    const wx = (x + 0.5) * CELL, wz = (z + 0.5) * CELL;
    c.lamps.push({ x: wx, z: wz, y: 2.6 });
    c.props.push({ x: wx, z: wz, rot: 0, parts: [part('cyl', 0, 1.2, 0, 0.1, 2.4, 0.1, 0x3a2a1a), part('sphere', 0, 2.5, 0, 0.35, 0.35, 0.35, 0xffa94d, true)] });
  }
  return { c, free };
}

/* ---------------------------- DEFINICIONES ---------------------------- */
export const MAP_DEFS = [
  { id: 'backrooms', name: 'Backrooms', icon: '🟨', desc: 'Laberinto infinito de oficinas amarillas. Las luces zumban...',
    indoor: true, wallH: 3.4, ceilH: 3.4, sky: 0x120f05, fog: [0x2a2310, 0.05], hemi: [0xfff1b0, 0x4a3d14, 0.8],
    tex: { wall: ['wallpaper', '#c9b458', '#b39c40'], floor: ['carpet', '#8c7c36'], ceil: ['ceiling', '#d9d2a6'] },
    lamp: { color: 0xfff0a8, int: 26, dist: 20, panel: 0xfff6c8 }, flicker: 0.5, drone: 55, gen: genBackrooms },
  { id: 'warehouse', name: 'Almacén', icon: '📦', desc: 'Pasillos de estanterías y oficinas abandonadas. Mucho donde esconderse.',
    indoor: true, wallH: 7, ceilH: 7, sky: 0x08090b, fog: [0x101216, 0.035], hemi: [0xbfd2ff, 0x20242a, 0.6],
    tex: { wall: ['concrete', '#7d8186'], floor: ['concrete', '#5c6066'], ceil: ['metal', '#33373d'] },
    lamp: { color: 0xcfe4ff, int: 60, dist: 26, panel: 0xdcecff }, flicker: 0.25, drone: 48, gen: genWarehouse },
  { id: 'mansion', name: 'Mansión Abandonada', icon: '🏚️', desc: 'Habitaciones oscuras, muebles viejos y puertas estrechas.',
    indoor: true, wallH: 3.2, ceilH: 3.2, sky: 0x060302, fog: [0x0a0504, 0.06], hemi: [0xffd0a0, 0x2a1810, 1.0],
    tex: { wall: ['wallpaper', '#6b2f2f', '#5a2626'], floor: ['wood', '#5a3d25'], ceil: ['ceiling', '#6f5a45'] },
    lamp: { color: 0xffb870, int: 34, dist: 18, panel: 0xffc890 }, flicker: 0.7, drone: 42, gen: genMansion },
  { id: 'city', name: 'Ciudad Nocturna', icon: '🌃', desc: 'Calles, coches y edificios altos bajo la luna. Corre por los callejones.',
    indoor: false, wallH: 10, sky: 0x070a12, fog: [0x0b0f1a, 0.02], hemi: [0x6a82b8, 0x14161c, 0.9],
    tex: { wall: ['building', '#2b3038'], floor: ['asphalt', '#25272b'] },
    lamp: { color: 0xffd9a0, int: 90, dist: 30 }, moon: 0x8aa4e0, flicker: 0.15, drone: 60, gen: genCity },
  { id: 'forest', name: 'Bosque Maldito', icon: '🌲', desc: 'Árboles, rocas y ruinas entre la niebla. Se oye algo detrás de ti.',
    indoor: false, wallH: 5, sky: 0x050a10, fog: [0x07120e, 0.045], hemi: [0x5f8f78, 0x0c1410, 0.9],
    tex: { wall: ['hedge', '#12301a'], floor: ['grass', '#1f3a1c'] },
    lamp: { color: 0xffa94d, int: 55, dist: 22 }, moon: 0x6f93c8, flicker: 0.6, drone: 38, gen: genForest },
];

export function generateMap(def, seed) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const rng = makeRng((seed + attempt * 7919) >>> 0);
    const { c, free } = def.gen(def, rng);
    if (free.length < N * N * 0.22) continue;
    return { def, seed, N, CELL, grid: c.g, hgt: c.hgt, hx: c.hx, hz: c.hz, props: c.props, lamps: c.lamps, free };
  }
  throw new Error('No se pudo generar el mapa ' + def.id);
}
