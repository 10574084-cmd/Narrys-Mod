// 5 mapas generados proceduralmente (cada partida es un layout distinto)
export let N = 48;       // celdas por lado (se puede cambiar con setMapSize antes de generar)
export const setMapSize = n => { N = n; };
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
    props: [], lamps: [], sprites: [],
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


// farolas/postes con luz (solo exteriores con lámpara activa)
function postLamps(c, mod, h = 5) {
  if (!c.def.lamp.int) return;
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    if (c.g[I(x, z)] !== 0 || !neighborsWall(c, x, z) || (x * 31 + z * 17) % mod !== 0) continue;
    const wx = (x + 0.5) * CELL, wz = (z + 0.5) * CELL;
    c.lamps.push({ x: wx, z: wz, y: h });
    c.props.push({ x: wx, z: wz, rot: 0, parts: [part('cyl', 0, h / 2, 0, 0.14, h, 0.14, 0x2a2d33), part('sphere', 0, h + 0.1, 0, 0.5, 0.5, 0.5, c.def.lamp.color, true)] });
  }
}
const tree = (s, dark) => [
  part('cyl', 0, 1.2, 0, 0.55, 2.4, 0.55, 0x3d2a1a),
  part('cone', 0, 3.4, 0, 2.8 * s, 3.4 * s, 2.8 * s, dark ? 0x12351f : 0x1b4a26), part('cone', 0, 5, 0, 2 * s, 2.6 * s, 2 * s, dark ? 0x174326 : 0x225a2e)];

/* ---------------------------- BACKROOMS ---------------------------- */
function genBackrooms(def, rng) {
  const c = ctxNew(def, rng); c.g.fill(1);
  const nn = Math.floor((N - 1) / 3), nx = i => 1 + 3 * i;
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
      if (rng() < 0.75) addProp(c, x, z, { hx: 0.6, hz: 0.6, parts: [box(0, def.wallH / 2, 0, 1.2, def.wallH, 1.2, def.pillar || 0xcdbb5e)] });
    }
  }
  border(c);
  const free = keepLargest(c);
  if (def.indoor) indoorLamps(c, 0.85); else postLamps(c, 13);
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
      const sh = def.shelf, col = (sh ? sh.cols : [0x4f6d8a, 0x8a5a3c, 0x5c7a4a])[Math.floor(rng() * (sh ? sh.cols.length : 3))];
      addProp(c, x, z, { hx: 1.25, hz: 0.6, parts: [
        box(0, 1.7, 0, 2.5, 3.4, 1.1, sh ? sh.frame : 0x2c3138),
        box(0, 0.55, 0, 2.3, 0.7, 1.15, col), box(0, 1.45, 0, 2.3, 0.7, 1.15, sh ? sh.cols[(rng() * sh.cols.length) | 0] : 0x9a7b4f), box(0, 2.35, 0, 2.3, 0.7, 1.15, col), box(0, 3.1, 0, 2.3, 0.5, 1.15, sh ? 0xe8e8e8 : 0x8c6a42),
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
  const cols = def.cols || [0x5a3a24, 0x3b2a22, 0x6e2b2b, 0x2f3e4f, 0x4a4a3a];
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
      const s = 0.8 + rng() * 0.7, dark = rng() < 0.5, T = def.trees;
      addProp(c, x, z, { hx: 0.45, hz: 0.45, parts: [
        part('cyl', 0, 1.2, 0, 0.55, 2.4, 0.55, T ? T.trunk : 0x3d2a1a),
        part('cone', 0, 3.4, 0, 2.8 * s, 3.4 * s, 2.8 * s, T ? T.a : dark ? 0x12351f : 0x1b4a26), part('cone', 0, 5, 0, 2 * s, 2.6 * s, 2 * s, T ? T.b : dark ? 0x174326 : 0x225a2e)] });
    } else if (r < p + 0.015) {
      const s = 0.8 + rng();
      addProp(c, x, z, { hx: 0.6 * s, hz: 0.6 * s, parts: [part('sphere', 0, 0.4 * s, 0, 1.7 * s, 1.1 * s, 1.4 * s, def.rockC || 0x5b5f66)] });
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


/* ---------------------------- LLANURA PLANA ---------------------------- */
function genFlat(def, rng) {
  const c = ctxNew(def, rng); border(c, 3);
  for (let k = 0; k < 28; k++) {
    const x = 2 + Math.floor(rng() * (N - 4)), z = 2 + Math.floor(rng() * (N - 4));
    if (c.g[I(x, z)] !== 0) continue;
    const s = 1.2 + rng() * 0.9;
    addProp(c, x, z, { hx: s / 2, hz: s / 2, rot: rng() * 3, parts: [box(0, s / 2, 0, s, s, s, 0x9b7a4a), box(0, s + 0.3, 0, s * 0.6, 0.6, s * 0.6, 0x86683f)] });
  }
  for (let k = 0; k < 9; k++) { // bloques de piedra
    const x = 3 + Math.floor(rng() * (N - 7)), z = 3 + Math.floor(rng() * (N - 7));
    if ([0, 1].every(a => [0, 1].every(b => c.g[I(x + a, z + b)] === 0))) wallRect(c, x, z, x + 2, z + 2, 3 + rng() * 3);
  }
  for (let k = 0; k < 14; k++) {
    const x = 2 + Math.floor(rng() * (N - 4)), z = 2 + Math.floor(rng() * (N - 4));
    if (c.g[I(x, z)] === 0) addProp(c, x, z, { hx: 0.45, hz: 0.45, parts: tree(0.8 + rng() * 0.5, false) });
  }
  const free = keepLargest(c);
  return { c, free };
}


/* ============================ MAPAS NUEVOS ============================ */
// antorchas/farolas sueltas sobre celdas libres (para los exteriores)
function torches(c, free, rng, n, col = 0xffa94d, h = 2.6) {
  for (let k = 0; k < n; k++) {
    const i = free[Math.floor(rng() * free.length)], x = i % N, z = (i / N) | 0;
    if (c.g[I(x, z)] !== 0) continue;
    const wx = (x + 0.5) * CELL, wz = (z + 0.5) * CELL;
    c.lamps.push({ x: wx, z: wz, y: h });
    c.props.push({ x: wx, z: wz, rot: 0, parts: [part('cyl', 0, h / 2 - 0.1, 0, 0.1, h, 0.1, 0x2a2a2f), part('sphere', 0, h + 0.1, 0, 0.35, 0.35, 0.35, col, true)] });
  }
}

/* ---------------------------- METRO ---------------------------- */
// salas largas paralelas con andenes, trenes parados y pilares; se cruza por pasos entre salas
function genTunnels(def, rng) {
  const c = ctxNew(def, rng); border(c);
  const rows = []; for (let z0 = 1; z0 + 5 < N - 1; z0 += 6) rows.push(z0);
  for (let k = 1; k < rows.length; k++) {
    const wz = rows[k] - 1;
    for (let x = 1; x < N - 1; x++) c.g[I(x, wz)] = 1;
    const gaps = 3 + Math.floor(rng() * 2);
    for (let g = 0; g < gaps; g++) { const gx = 3 + Math.floor(rng() * (N - 8)); for (let d = 0; d < 3; d++) c.g[I(gx + d, wz)] = 0; }
  }
  const carCols = [0x2a6fb0, 0xc23b3b, 0xd8d8de, 0x3a8a5a, 0xd8a52a];
  rows.forEach((z0, r) => {
    const train = r % 2 === 1 || rng() < 0.3;
    for (let x = 4; x < N - 4; x++) {
      if (train) {
        if ((x - 4) % 9 >= 7) continue; // huecos para cruzar entre vagones
        const col = carCols[Math.floor((x - 4) / 9 + r) % carCols.length];
        for (let z = z0 + 1; z <= z0 + 3; z++) if (c.g[I(x, z)] === 0) addProp(c, x, z, { hx: 1.25, hz: 1.25, parts: [box(0, 1.35, 0, 2.5, 2.7, 2.5, col), box(0, 1.7, 0, 2.54, 0.7, 2.1, 0xcfe8ff), box(0, 2.78, 0, 2.2, 0.1, 2.2, 0x22262b)] });
      } else if (x % 4 === 0 && c.g[I(x, z0 + 2)] === 0) {
        addProp(c, x, z0 + 2, { hx: 0.6, hz: 0.6, parts: [box(0, def.wallH / 2, 0, 1.2, def.wallH, 1.2, def.pillar || 0x9a9ea3)] });
      }
    }
    if (!train) for (let k = 0; k < 3; k++) { // bancos (solo en salas sin tren, junto a un pilar de la fila central)
      const x = 3 + 4 * Math.floor(rng() * ((N - 8) / 4)) + 2, z = z0 + (rng() < 0.5 ? 1 : 3);
      if (c.g[I(x, z)] === 0) addProp(c, x, z, { hx: 0.9, hz: 0.35, parts: [box(0, 0.45, 0, 1.8, 0.1, 0.6, 0x6b4a2a), box(-0.7, 0.22, 0, 0.1, 0.45, 0.5, 0x222222), box(0.7, 0.22, 0, 0.1, 0.45, 0.5, 0x222222)] });
    }
  });
  const free = keepLargest(c);
  indoorLamps(c, 0.8);
  return { c, free };
}

/* ---------------------------- ESTACIONAMIENTO ---------------------------- */
function genParking(def, rng) {
  const c = ctxNew(def, rng); border(c);
  const carCols = [0xb02a2a, 0x2a5fb0, 0xcfcfcf, 0x222222, 0xd0a82a, 0x2a8a4a, 0x7a7a82];
  for (let k = 0; k < 4; k++) { // cajas de escaleras / ascensores
    const w = 3 + Math.floor(rng() * 2), h = 3 + Math.floor(rng() * 2);
    const x0 = 3 + Math.floor(rng() * (N - w - 6)), z0 = 3 + Math.floor(rng() * (N - h - 6));
    wallRect(c, x0, z0, x0 + w, z0 + h, def.wallH);
    const side = Math.floor(rng() * 4);
    for (let d = 0; d < 2; d++) {
      if (side === 0) c.g[I(x0 + 1 + d, z0)] = 0; else if (side === 1) c.g[I(x0 + 1 + d, z0 + h - 1)] = 0;
      else if (side === 2) c.g[I(x0, z0 + 1 + d)] = 0; else c.g[I(x0 + w - 1, z0 + 1 + d)] = 0;
    }
  }
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    if (c.g[I(x, z)] !== 0) continue;
    if (x % 6 === 0 && z % 6 === 0) { addProp(c, x, z, { hx: 0.6, hz: 0.6, parts: [box(0, def.wallH / 2, 0, 1.2, def.wallH, 1.2, def.pillar || 0x8a8d90)] }); continue; }
    const zz = z % 6;
    if ((zz === 1 || zz === 4) && x % 3 === 1 && rng() < 0.6 && c.g[I(x, z + 1)] === 0) { // coche aparcado (2 celdas de largo)
      const col = carCols[Math.floor(rng() * carCols.length)];
      addProp(c, x, z, { hx: 0.9, hz: 1.2, parts: [box(0, 0.55, 0.2, 1.8, 0.8, 2.4, col), box(-0.8, 0.2, 0.9, 0.2, 0.4, 0.5, 0x111111), box(0.8, 0.2, 0.9, 0.2, 0.4, 0.5, 0x111111)] });
      addProp(c, x, z + 1, { hx: 0.9, hz: 1.2, parts: [box(0, 0.55, -0.2, 1.8, 0.8, 2.4, col), box(0, 1.15, -0.2, 1.6, 0.6, 1.7, 0x1b2330), box(-0.8, 0.2, -0.9, 0.2, 0.4, 0.5, 0x111111), box(0.8, 0.2, -0.9, 0.2, 0.4, 0.5, 0x111111)] });
    }
  }
  const free = keepLargest(c);
  indoorLamps(c, 0.7);
  return { c, free };
}

/* ---------------------------- DESIERTO ---------------------------- */
function genDesert(def, rng) {
  const c = ctxNew(def, rng); border(c, 3.4);
  const sand = 0xc9a06a;
  for (let k = 0; k < 5; k++) { // ruinas de arenisca con huecos y columnas rotas
    const w = 6 + Math.floor(rng() * 5), h = 5 + Math.floor(rng() * 4);
    const x0 = 4 + Math.floor(rng() * (N - w - 8)), z0 = 4 + Math.floor(rng() * (N - h - 8));
    for (let x = x0; x < x0 + w; x++) for (const z of [z0, z0 + h - 1]) if (rng() > 0.3) { c.g[I(x, z)] = 1; c.hgt[I(x, z)] = 2.2 + rng() * 2; }
    for (let z = z0; z < z0 + h; z++) for (const x of [x0, x0 + w - 1]) if (rng() > 0.3) { c.g[I(x, z)] = 1; c.hgt[I(x, z)] = 2.2 + rng() * 2; }
    for (let q = 0; q < 3; q++) { const px = x0 + 2 + Math.floor(rng() * (w - 4)), pz = z0 + 2 + Math.floor(rng() * (h - 4)), ph = 1.5 + rng() * 2.5;
      if (c.g[I(px, pz)] === 0) addProp(c, px, pz, { hx: 0.5, hz: 0.5, parts: [part('cyl', 0, ph / 2, 0, 0.9, ph, 0.9, 0xd8bb8a), part('cyl', 0, 0.1, 0, 1.2, 0.2, 1.2, 0xb9996a)] }); }
  }
  for (let k = 0; k < 9; k++) { // mesetas
    const x = 3 + Math.floor(rng() * (N - 8)), z = 3 + Math.floor(rng() * (N - 8)), s = 2 + Math.floor(rng() * 2);
    if ([...Array(s).keys()].every(a => [...Array(s).keys()].every(b => c.g[I(x + a, z + b)] === 0))) wallRect(c, x, z, x + s, z + s, 3 + rng() * 3.5);
  }
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    if (c.g[I(x, z)] !== 0) continue;
    const r = rng();
    if (r < 0.022) { // cactus
      const s = 0.8 + rng() * 0.6;
      addProp(c, x, z, { hx: 0.35, hz: 0.35, parts: [part('cyl', 0, 1.2 * s, 0, 0.5, 2.4 * s, 0.5, 0x3f7a3a), box(0.45, 1.3 * s, 0, 0.7, 0.28, 0.28, 0x3f7a3a), box(0.7, 1.7 * s, 0, 0.28, 0.9, 0.28, 0x3f7a3a), box(-0.45, 1.0 * s, 0, 0.7, 0.28, 0.28, 0x3f7a3a), box(-0.7, 1.4 * s, 0, 0.28, 0.8, 0.28, 0x3f7a3a)] });
    } else if (r < 0.04) {
      const s = 0.7 + rng() * 0.9;
      addProp(c, x, z, { hx: 0.55 * s, hz: 0.55 * s, parts: [part('sphere', 0, 0.4 * s, 0, 1.6 * s, 1.0 * s, 1.3 * s, sand)] });
    }
  }
  const free = keepLargest(c);
  torches(c, free, rng, 10);
  return { c, free };
}

/* ---------------------------- CEMENTERIO ---------------------------- */
function genGraveyard(def, rng) {
  const c = ctxNew(def, rng); border(c, 3.4);
  for (let k = 0; k < 3; k++) { // mausoleos
    const w = 6 + Math.floor(rng() * 2), h = 5 + Math.floor(rng() * 2);
    const x0 = 4 + Math.floor(rng() * (N - w - 8)), z0 = 4 + Math.floor(rng() * (N - h - 8));
    wallRect(c, x0, z0, x0 + w, z0 + h, 4);
    for (let x = x0 + 1; x < x0 + w - 1; x++) for (let z = z0 + 1; z < z0 + h - 1; z++) c.g[I(x, z)] = 0;
    const door = x0 + Math.floor(w / 2);
    c.g[I(door, z0 + h - 1)] = 0; c.g[I(door + 1, z0 + h - 1)] = 0;
    addProp(c, x0 + 2, z0 + 2, { hx: 0.9, hz: 0.6, parts: [box(0, 0.5, 0, 1.8, 1, 1.0, 0x777b82), box(0, 1.05, 0, 1.9, 0.12, 1.1, 0x5d6168)] });
  }
  for (let z = 3; z < N - 3; z += 3) for (let x = 3; x < N - 3; x += 2) {
    if (c.g[I(x, z)] !== 0 || x % 12 < 2 || rng() > 0.6) continue; // dejamos pasillos
    const cross = rng() < 0.25, rot = (rng() - 0.5) * 0.3;
    addProp(c, x, z, { hx: 0.35, hz: 0.25, rot, parts: cross
      ? [box(0, 0.8, 0, 0.18, 1.6, 0.18, 0x8a8d94), box(0, 1.1, 0, 0.8, 0.18, 0.18, 0x8a8d94)]
      : [box(0, 0.5, 0, 0.9, 1.0, 0.25, 0x80848b), part('cyl', 0, 1.0, 0, 0.9, 0.3, 0.25, 0x80848b), box(0, 0.05, 0, 1.1, 0.1, 0.5, 0x4d5157)] });
  }
  for (let k = 0; k < Math.round(N * 0.45); k++) { // árboles muertos
    const x = 2 + Math.floor(rng() * (N - 4)), z = 2 + Math.floor(rng() * (N - 4));
    if (c.g[I(x, z)] !== 0) continue;
    addProp(c, x, z, { hx: 0.4, hz: 0.4, parts: [part('cyl', 0, 1.6, 0, 0.45, 3.2, 0.45, 0x2a211b), box(0.5, 3.0, 0, 1.2, 0.14, 0.14, 0x2a211b), box(-0.45, 3.4, 0.2, 1.0, 0.12, 0.12, 0x2a211b), box(0.1, 3.8, -0.3, 0.12, 0.9, 0.12, 0x2a211b)] });
  }
  const free = keepLargest(c);
  torches(c, free, rng, 12, 0x8affc0, 2.4);
  return { c, free };
}

/* ---------------------------- FERIA ABANDONADA ---------------------------- */
function genFair(def, rng) {
  const c = ctxNew(def, rng); border(c, 3.4);
  const cols = [0xd23a3a, 0xe8d03a, 0x3a8ad2, 0x8a3ad2, 0x3ad28a];
  const mid = Math.floor(N / 2);
  // noria en el centro: base maciza y ruedas de cabinas decorativas
  for (let d = -1; d <= 1; d += 2) addProp(c, mid + d * 2, mid, { hx: 0.7, hz: 0.7, parts: [box(0, 3.5, 0, 0.7, 7, 0.7, 0x6a6f78)] });
  const spokes = [];
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; spokes.push(part('sphere', Math.cos(a) * 6.2 * 0 , 7.4 + Math.sin(a) * 6.2, 0, 1.1, 1.1, 1.1, cols[k % cols.length])); spokes[k].dx = Math.cos(a) * 6.2; spokes[k].dz = 0; }
  c.props.push({ x: (mid + 0.5) * CELL, z: (mid + 0.5) * CELL, rot: 0, parts: [...spokes, part('sphere', 0, 7.4, 0, 1.2, 1.2, 1.2, 0xcfd3da)] });
  for (let k = 0; k < 4; k++) { // carruseles
    const x = 4 + Math.floor(rng() * (N - 9)), z = 4 + Math.floor(rng() * (N - 9));
    if (Math.abs(x - mid) < 6 && Math.abs(z - mid) < 6) continue;
    if (c.g[I(x, z)] === 0) addProp(c, x, z, { hx: 1.2, hz: 1.2, parts: [part('cyl', 0, 0.25, 0, 5.6, 0.5, 5.6, 0x9a4a6a), part('cyl', 0, 1.6, 0, 0.5, 3.2, 0.5, 0xd8d8de), part('cone', 0, 3.8, 0, 6, 1.6, 6, cols[k % cols.length])] });
  }
  for (let k = 0; k < 10; k++) { // puestos y carpas de 2x2 celdas
    const x = 3 + Math.floor(rng() * (N - 7)), z = 3 + Math.floor(rng() * (N - 7)), col = cols[k % cols.length];
    if (Math.abs(x - mid) < 6 && Math.abs(z - mid) < 6) continue;
    if (![0, 1].every(a => [0, 1].every(b => c.g[I(x + a, z + b)] === 0))) continue;
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const parts = [box(0, 1.2, 0, 2.4, 2.4, 2.4, k % 2 ? col : 0xf0f0f0), box(0, 1.9, 0, 2.5, 0.5, 2.5, col)];
      if (!a && !b) parts.push(part('cone', 1.25, 3.2, 1.25, 5.6, 1.8, 5.6, col));
      addProp(c, x + a, z + b, { hx: 1.15, hz: 1.15, parts });
    }
  }
  for (let k = 0; k < 14; k++) { // globos atados
    const x = 2 + Math.floor(rng() * (N - 4)), z = 2 + Math.floor(rng() * (N - 4));
    if (c.g[I(x, z)] === 0) addProp(c, x, z, { hx: 0.3, hz: 0.3, parts: [part('cyl', 0, 0.8, 0, 0.05, 1.6, 0.05, 0xdddddd), part('sphere', 0, 2.1, 0, 0.9, 1.1, 0.9, cols[k % cols.length]), part('sphere', 0.35, 2.4, 0.2, 0.8, 1.0, 0.8, cols[(k + 2) % cols.length])] });
  }
  const free = keepLargest(c);
  torches(c, free, rng, 18, 0xffe08a, 3.0);
  return { c, free };
}

/* ---------------------------- ARENA DEL JEFE (secreta) ---------------------------- */
// Backrooms "planos": una sala enorme abierta, sin techo, solo con pilares y algunos muros bajos
function genChocoArena(def, rng) {
  const c = ctxNew(def, rng); border(c, 3.4);
  for (let k = 0; k < 14; k++) { // muros cortos como cobertura
    const horiz = rng() < 0.5, len = 3 + Math.floor(rng() * 4);
    const x = 4 + Math.floor(rng() * (N - 10)), z = 4 + Math.floor(rng() * (N - 10));
    if (horiz) wallRect(c, x, z, x + len, z + 1, 3.4); else wallRect(c, x, z, x + 1, z + len, 3.4);
  }
  for (let k = 0; k < 60; k++) { // pilares
    const x = 2 + Math.floor(rng() * (N - 4)), z = 2 + Math.floor(rng() * (N - 4));
    if (c.g[I(x, z)] === 0) addProp(c, x, z, { hx: 0.6, hz: 0.6, parts: [box(0, def.wallH / 2, 0, 1.2, def.wallH, 1.2, def.pillar)] });
  }
  const free = keepLargest(c);
  return { c, free };
}

export const CHOCO_DEF = {
  id: 'chocoarena', name: 'Backrooms Planos', icon: '🍫', desc: 'Backrooms planos y sin techo: la arena del jefe. ¡Desbloqueada!',
  indoor: false, wallH: 3.4, sky: 0xd8cc78, fog: [0xcfc36e, 0.012], hemi: [0xfff3b0, 0x8a7a30, 1.5],
  tex: { wall: ['wallpaper', '#c9b458', '#b39c40'], floor: ['carpet', '#8c7c36'] },
  lamp: { color: 0xfff0a8, int: 0, dist: 20 }, moon: 0xfff2b0, sunInt: 1.9, pillar: 0xcdbb5e, flicker: 0, drone: 55, gen: genChocoArena,
};

/* ---------------------------- GREEN HILLS .EXE (secreta) ---------------------------- */
// colina verde corrompida: suelo de hierba, muros a cuadros, palmeras con sangre, flores con un ojo y charcos de sangre
function genGreenHill(def, rng) {
  const c = ctxNew(def, rng); border(c, 4.6);
  for (let k = 0; k < 22; k++) { // terrazas a cuadros
    const w = 2 + Math.floor(rng() * 3), h = 2 + Math.floor(rng() * 3);
    const x = 3 + Math.floor(rng() * (N - w - 6)), z = 3 + Math.floor(rng() * (N - h - 6));
    wallRect(c, x, z, x + w, z + h, 2 + rng() * 2.6);
  }
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    if (c.g[I(x, z)] !== 0) continue;
    const r = rng();
    if (r < 0.035) { // palmera con sangre
      const s = 0.85 + rng() * 0.5, lean = (rng() - 0.5) * 0.5;
      addProp(c, x, z, { hx: 0.4, hz: 0.4, rot: rng() * 6.28, parts: [
        part('cyl', 0, 2.3 * s, 0, 0.5, 4.6 * s, 0.5, 0x6b4a2a), part('cyl', 0, 1.1 * s, 0, 0.56, 1.5 * s, 0.56, 0x8a0b0b), part('box', 0.27, 0.5 * s, 0, 0.1, 1.4 * s, 0.14, 0x6a0606),
        part('sphere', lean, 4.7 * s, 0, 3.4 * s, 0.7, 3.4 * s, 0x1d5a22), part('sphere', lean + 0.3, 4.95 * s, 0.2, 2.2 * s, 0.6, 2.2 * s, 0x2a7a2c),
        part('sphere', lean + 1.1, 4.4 * s, 0.3, 0.45, 0.6, 0.45, 0x9a0e0e), part('sphere', lean - 0.9, 4.45 * s, -0.5, 0.4, 0.55, 0.4, 0x8a0b0b)] });
    } else if (r < 0.065) { // flor con un ojo en medio
      const col = [0xb040c8, 0xf0c020, 0xe06090][Math.floor(rng() * 3)];
      const parts = [part('cyl', 0, 0.45, 0, 0.09, 0.9, 0.09, 0x2f7a2a)];
      for (let a = 0; a < 7; a++) parts.push(part('sphere', Math.cos(a * 0.8976) * 0.3, 0.95, Math.sin(a * 0.8976) * 0.3, 0.26, 0.12, 0.26, col));
      parts.push(part('sphere', 0, 0.95, 0, 0.36, 0.3, 0.36, 0xf4f4f0), part('sphere', 0, 0.97, 0.12, 0.2, 0.2, 0.12, 0x9a0000), part('sphere', 0, 0.97, 0.17, 0.1, 0.1, 0.08, 0x000000));
      addProp(c, x, z, { hx: 0.18, hz: 0.18, rot: rng() * 6.28, parts });
    } else if (r < 0.072) { // piedra con manchas
      const s = 0.7 + rng() * 0.8;
      addProp(c, x, z, { hx: 0.6 * s, hz: 0.6 * s, parts: [part('sphere', 0, 0.4 * s, 0, 1.6 * s, 1.0 * s, 1.3 * s, 0x6b6258), part('sphere', 0.2, 0.75 * s, 0.1, 0.7 * s, 0.4 * s, 0.6 * s, 0x7a0a0a)] });
    }
  }
  const free = keepLargest(c);
  for (let k = 0; k < Math.round(70 * (N / 48) ** 2); k++) { // charcos de sangre
    const i = free[Math.floor(rng() * free.length)], wx = ((i % N) + 0.5) * CELL + (rng() - 0.5) * 1.6, wz = (((i / N) | 0) + 0.5) * CELL + (rng() - 0.5) * 1.6;
    const s = 0.7 + rng() * 1.1;
    c.props.push({ x: wx, z: wz, rot: rng() * 6.28, parts: [part('cyl', 0, 0.03, 0, 2.2 * s, 0.05, 1.5 * s, 0x4a0505)] });
  }
  return { c, free };
}

export const GREEN_DEF = {
  id: 'greenhill', name: 'Green Hills .EXE', icon: '🌴', desc: 'Una colina verde corrompida: palmeras con sangre, flores con ojos y charcos de sangre. ¡Desbloqueada!',
  indoor: false, wallH: 4.6, sky: 0x4a0f12, fog: [0x3d1012, 0.022], hemi: [0xffb59a, 0x3a1a14, 1.15],
  tex: { wall: ['checker', '#5a3416', '#b88a45'], floor: ['grass', '#2f6a22'] },
  lamp: { color: 0xff6050, int: 0, dist: 20 }, moon: 0xff8a70, sunInt: 1.5, flicker: 0, drone: 38, gen: genGreenHill,
};

export const VERITY_DEF = {
  id: 'verityhouse', name: 'Casa de Verity', icon: '🏠', desc: 'Una casa acogedora con muchas habitaciones… y alguien que siempre sonríe. ¡Desbloqueada!',
  indoor: true, wallH: 3.0, ceilH: 3.0, sky: 0x120c08, fog: [0x1a120c, 0.035], hemi: [0xffe6c0, 0x4a3828, 1.25],
  tex: { wall: ['wallpaper', '#d9c7a0', '#c9b58a'], floor: ['wood', '#8a5a34'], ceil: ['ceiling', '#e8dcc4'] },
  cols: [0x8a5a34, 0xb08a5a, 0x5a7a9a, 0x9a4a4a, 0x6a8a5a],
  lamp: { color: 0xffe2a8, int: 38, dist: 18, panel: 0xfff0c8 }, flicker: 0.1, drone: 30, gen: genMansion,
};


/* ---------------------------- LA VECINDAD DEL CHAVO ---------------------------- */
// Patio central abierto rodeado de dos edificios con puertas, lavadero, barriles, triciclo, macetas y escaleras.
function genVecindad(def, rng) {
  const c = ctxNew(def, rng); border(c, def.wallH); c.barrels = [];
  const t = Math.max(6, Math.round(N * 0.17)), rw = 6;
  for (const north of [true, false]) { // edificios norte y sur con habitaciones (puertas hacia el patio)
    const z0 = north ? 0 : N - t, front = north ? t - 1 : N - t;
    wallRect(c, 1, z0, N - 1, z0 + t, def.wallH);
    for (let x0 = 2; x0 + rw < N - 1; x0 += rw + 1) {
      for (let z = z0 + 1; z < z0 + t - 1; z++) for (let x = x0; x < x0 + rw; x++) c.g[I(x, z)] = 0;
      for (let d = 0; d < 2; d++) c.g[I(x0 + 2 + d, front)] = 0; // puerta
      const mid = north ? z0 + 2 : z0 + t - 3;
      if (rng() < 0.6) addProp(c, x0 + 1, mid, { hx: 0.8, hz: 0.5, parts: [box(0, 0.4, 0, 1.6, 0.8, 1.0, 0x7a4a2a), box(0, 0.85, 0, 1.7, 0.1, 1.1, 0xc9a27a)] }); // mesa
      if (rng() < 0.5) addProp(c, x0 + rw - 2, mid, { hx: 0.5, hz: 0.5, parts: [box(0, 0.3, 0, 1.0, 0.6, 1.0, 0xcfd8e0), box(0, 0.65, -0.3, 1.0, 0.1, 0.4, 0xe8e8e8)] }); // cama/sillón
    }
    // macetas con plantas frente a las paredes
    for (let x = 3; x < N - 3; x += 3) {
      const z = north ? t : N - t - 1;
      if (c.g[I(x, z)] === 0 && c.g[I(x, north ? t - 1 : N - t)] === 1 && rng() < 0.7)
        addProp(c, x, z, { hx: 0.3, hz: 0.3, parts: [part('cyl', 0, 0.3, 0, 0.55, 0.6, 0.55, 0x9a4a30), part('sphere', 0, 0.85, 0, 0.8, 0.7, 0.8, 0x2f8f3a), part('sphere', 0.15, 1.1, 0.1, 0.45, 0.4, 0.45, 0x3aa047)] });
    }
  }
  const cx = Math.floor(N / 2), cz = Math.floor(N / 2);
  const mark = (x, z) => c.g[I(x, z)] === 0;
  // lavadero (rojo-café) en el centro
  for (let d = -1; d <= 1; d++) if (mark(cx + d, cz)) {
    addProp(c, cx + d, cz, { hx: 1.1, hz: 0.8, parts: [box(0, 0.5, 0, 2.4, 1.0, 1.4, 0x8a3a24), box(0, 1.02, 0, 2.0, 0.06, 1.0, 0xb8b2a8), part('cyl', 0, 1.3, -0.5, 0.1, 0.5, 0.1, 0x9aa0a8)] });
    break;
  }
  // escaleras al piso de arriba (decorativas, sólidas) pegadas al edificio norte
  const sx = Math.round(N * 0.7), sz = t;
  if (c.g[I(sx, sz)] === 0) addProp(c, sx, sz, { hx: 1.2, hz: 1.2, parts: [0, 1, 2, 3, 4].map(k => box(0, 0.25 + k * 0.5, -1 + k * 0.45, 2.4, 0.5, 0.45 * (5 - k) + 0.5, 0xb5583c)) });
  // barriles de madera (los que usa el Chavo para esconderse) repartidos por el patio
  const spots = [];
  const cands = [];
  for (let z = t + 1; z < N - t - 1; z++) for (let x = 3; x < N - 3; x++) if (c.g[I(x, z)] === 0) cands.push([x, z]);
  for (let k = 0; k < 400 && spots.length < 7 && cands.length; k++) {
    const [x, z] = cands[Math.floor(rng() * cands.length)];
    if (spots.some(([a, b]) => Math.hypot(a - x, b - z) < 6) || Math.hypot(x - cx, z - cz) < 3) continue;
    spots.push([x, z]);
  }
  for (const [x, z] of spots) {
    addProp(c, x, z, { hx: 0.55, hz: 0.55, parts: [part('cyl', 0, 0.7, 0, 1.15, 1.4, 1.15, 0x8a5a2b), part('cyl', 0, 0.35, 0, 1.2, 0.09, 1.2, 0x555a60), part('cyl', 0, 1.05, 0, 1.2, 0.09, 1.2, 0x555a60), part('cyl', 0, 1.41, 0, 1.0, 0.04, 1.0, 0x5a3a1c)] });
    c.barrels.push({ x: (x + 0.5) * CELL, z: (z + 0.5) * CELL });
  }
  // triciclo rojo, pelota y bancas
  for (let k = 0; k < 3; k++) {
    const [x, z] = cands[Math.floor(rng() * cands.length)] || [cx, cz + 2];
    if (c.g[I(x, z)] !== 0) continue;
    if (k === 0) addProp(c, x, z, { hx: 0.4, hz: 0.6, rot: rng() * 6, parts: [part('cyl', 0, 0.35, 0.45, 0.6, 0.06, 0.6, 0x222222), part('box', 0, 0.55, 0, 0.1, 0.5, 0.1, 0xd02020), part('box', 0, 0.8, -0.2, 0.5, 0.08, 0.35, 0xd02020), part('cyl', -0.3, 0.2, -0.3, 0.4, 0.05, 0.4, 0x222222), part('cyl', 0.3, 0.2, -0.3, 0.4, 0.05, 0.4, 0x222222)] });
    else if (k === 1) addProp(c, x, z, { hx: 0.25, hz: 0.25, parts: [part('sphere', 0, 0.25, 0, 0.5, 0.5, 0.5, 0xe8d040), part('box', 0, 0.25, 0, 0.51, 0.06, 0.51, 0xd03030)] });
    else addProp(c, x, z, { hx: 0.9, hz: 0.3, rot: rng() * 3, parts: [box(0, 0.45, 0, 1.8, 0.1, 0.5, 0x7a4a2a), box(-0.75, 0.22, 0, 0.1, 0.45, 0.4, 0x5a3a1c), box(0.75, 0.22, 0, 0.1, 0.45, 0.4, 0x5a3a1c)] });
  }
  const free = keepLargest(c);
  c.barrels = c.barrels.filter(b => c.g[I(Math.floor(b.x / CELL), Math.floor(b.z / CELL))] === 2);
  return { c, free };
}

export const VECINDAD_DEF = {
  id: 'vecindad', name: 'La Vecindad del Chavo', icon: '🛢️', desc: 'Un patio con barriles, lavadero y puertas numeradas… ¡sin querer queriendo! ¡Desbloqueada!',
  indoor: false, wallH: 5.4, sky: 0x8ec8f2, fog: [0xc9e3f4, 0.012], hemi: [0xffffff, 0x9a8a70, 1.25],
  tex: { wall: ['vecindad', '#e3b43c', '#b5583c'], floor: ['checker', '#a86a46', '#cfa070'] },
  lamp: { color: 0xffe2a8, int: 0, dist: 20 }, moon: 0xfff0d0, sunInt: 1.8, flicker: 0, drone: 30, gen: genVecindad,
};

/* ---------------------------- ZONA DE CONSTRUCCIÓN ---------------------------- */
function genConstruction(def, rng) {
  const c = ctxNew(def, rng); border(c, 4); const rooms = [];
  for (let k = 0; k < 40 && rooms.length < 12; k++) {
    const w = 5 + Math.floor(rng() * 5), h = 5 + Math.floor(rng() * 5);
    const x0 = 2 + Math.floor(rng() * (N - w - 4)), z0 = 2 + Math.floor(rng() * (N - h - 4));
    if (rooms.some(r => x0 < r.x1 + 3 && x0 + w > r.x0 - 3 && z0 < r.z1 + 3 && z0 + h > r.z0 - 3)) continue;
    rooms.push({ x0, z0, x1: x0 + w, z1: z0 + h });
    const hh = 4 + rng() * 5;
    for (let x = x0; x < x0 + w; x++) for (const z of [z0, z0 + h - 1]) { c.g[I(x, z)] = 1; c.hgt[I(x, z)] = hh; }
    for (let z = z0; z < z0 + h; z++) for (const x of [x0, x0 + w - 1]) { c.g[I(x, z)] = 1; c.hgt[I(x, z)] = hh; }
    const side = Math.floor(rng() * 4);
    for (let d = 0; d < 2; d++) {
      if (side === 0) c.g[I(x0 + 2 + d, z0)] = 0; else if (side === 1) c.g[I(x0 + 2 + d, z0 + h - 1)] = 0;
      else if (side === 2) c.g[I(x0, z0 + 2 + d)] = 0; else c.g[I(x0 + w - 1, z0 + 2 + d)] = 0;
    }
  }
  const cols = [0xb23a2e, 0x2e5fb2, 0xd9a227, 0x2f8f5a, 0x6b6f76];
  for (let k = 0; k < 50; k++) { // contenedores (2 celdas)
    const x = 1 + Math.floor(rng() * (N - 3)), z = 1 + Math.floor(rng() * (N - 2));
    if (c.g[I(x, z)] !== 0 || c.g[I(x + 1, z)] !== 0) continue;
    const col = cols[Math.floor(rng() * cols.length)];
    c.g[I(x, z)] = 2; c.g[I(x + 1, z)] = 2;
    for (const px of [x, x + 1]) { c.hx[I(px, z)] = 1.25; c.hz[I(px, z)] = 1.1; }
    c.props.push({ x: (x + 1) * CELL, z: (z + 0.5) * CELL, rot: 0, parts: [box(0, 1.3, 0, 4.9, 2.6, 2.2, col), box(0, 2.62, 0, 4.9, 0.06, 2.2, 0x222222), box(0, 1.3, 1.11, 4.5, 2.2, 0.04, 0x00000, false)] });
  }
  for (let k = 0; k < 30; k++) { // barriles
    const x = 1 + Math.floor(rng() * (N - 2)), z = 1 + Math.floor(rng() * (N - 2));
    if (c.g[I(x, z)] === 0) addProp(c, x, z, { hx: 0.45, hz: 0.45, parts: [part('cyl', 0, 0.55, 0, 0.9, 1.1, 0.9, rng() < 0.5 ? 0xb03a2e : 0x2e6fb0)] });
  }
  const free = keepLargest(c);
  postLamps(c, 17);
  return { c, free };
}

/* ---------------------------- ISLA TROPICAL ---------------------------- */
function genIsland(def, rng) {
  const c = ctxNew(def, rng); const mid = N / 2, R = N / 2 - 3.5;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    if (Math.hypot(x + 0.5 - mid, z + 0.5 - mid) + rng() * 1.5 > R) { c.g[I(x, z)] = 1; c.hgt[I(x, z)] = def.wallH; }
  }
  border(c, def.wallH);
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    if (c.g[I(x, z)] !== 0) continue;
    const r = rng();
    if (r < 0.07) {
      const s = 0.85 + rng() * 0.4;
      addProp(c, x, z, { hx: 0.35, hz: 0.35, rot: rng() * 6, parts: [
        part('cyl', 0, 2.2, 0, 0.35, 4.4, 0.35, 0x8a6a3a),
        part('sphere', 0, 4.5, 0, 3.4 * s, 0.7, 3.4 * s, 0x2f8f3a), part('sphere', 0.3, 4.8, 0.2, 2.2 * s, 0.6, 2.2 * s, 0x3aa047)] });
    } else if (r < 0.085) {
      const s = 0.8 + rng() * 0.8;
      addProp(c, x, z, { hx: 0.6 * s, hz: 0.6 * s, parts: [part('sphere', 0, 0.4 * s, 0, 1.7 * s, 1.1 * s, 1.4 * s, 0x8a8f96)] });
    }
  }
  const free = keepLargest(c);
  for (let k = 0; k < 14; k++) { // antorchas tiki
    const i = free[Math.floor(rng() * free.length)], x = i % N, z = (i / N) | 0;
    const wx = (x + 0.5) * CELL, wz = (z + 0.5) * CELL;
    c.lamps.push({ x: wx, z: wz, y: 2.2 });
    c.props.push({ x: wx, z: wz, rot: 0, parts: [part('cyl', 0, 1.1, 0, 0.1, 2.2, 0.1, 0x6b4a2a), part('sphere', 0, 2.3, 0, 0.34, 0.34, 0.34, 0xffa94d, true)] });
  }
  return { c, free };
}

/* ---------------------------- MINAS PROFUNDAS ---------------------------- */
function genCave(def, rng) {
  const c = ctxNew(def, rng);
  let a = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) a[i] = rng() < 0.45 ? 1 : 0;
  for (let it = 0; it < 5; it++) {
    const b = new Uint8Array(a);
    for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
      let n = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) n += a[I(x + dx, z + dz)];
      b[I(x, z)] = n >= 5 ? 1 : 0;
    }
    a = b;
  }
  for (let i = 0; i < N * N; i++) c.g[i] = a[i];
  border(c);
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    if (c.g[I(x, z)] === 0 && rng() < 0.035) addProp(c, x, z, { hx: 0.4, hz: 0.4, parts: [part('cone', 0, 0.9, 0, 0.9, 1.8, 0.9, 0x5a5048)] });
  }
  const free = keepLargest(c);
  for (let k = 0; k < 40; k++) { // cristales luminosos
    const i = free[Math.floor(rng() * free.length)], x = i % N, z = (i / N) | 0;
    const wx = (x + 0.5) * CELL, wz = (z + 0.5) * CELL;
    c.lamps.push({ x: wx, z: wz, y: 1.3 });
    c.props.push({ x: wx, z: wz, rot: 0, parts: [part('cone', 0, 0.6, 0, 0.5, 1.2, 0.5, def.lamp.panel, true), part('cone', 0.25, 0.35, 0.1, 0.3, 0.7, 0.3, def.lamp.panel, true)] });
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
  { id: 'flat', name: 'Llanura Plana', icon: '🟩', desc: 'Campo abierto de día sin dónde esconderse. Corre lejos y rápido.',
    indoor: false, wallH: 3, sky: 0x8fc4ff, fog: [0xa8d0f0, 0.008], hemi: [0xcfe6ff, 0x5a7a4a, 1.3],
    tex: { wall: ['hedge', '#2f5f2a'], floor: ['grass', '#3f7a34'] },
    lamp: { color: 0xffffff, int: 0, dist: 10 }, moon: 0xfff2d6, sunInt: 2.4, flicker: 0, drone: 45, gen: genFlat },
  { id: 'construction', name: 'Zona de Construcción', icon: '🏗️', desc: 'Contenedores, barriles y edificios a medio hacer con luces de obra.',
    indoor: false, wallH: 6, sky: 0x9aa7b4, fog: [0xa9b3bd, 0.012], hemi: [0xdfe6ee, 0x555a60, 1.2],
    tex: { wall: ['concrete', '#8d9096'], floor: ['concrete', '#6a6d72'] },
    lamp: { color: 0xffe2a8, int: 40, dist: 22 }, moon: 0xfff0d0, sunInt: 1.8, flicker: 0.1, drone: 52, gen: genConstruction },
  { id: 'cityday', name: 'Gran Ciudad (Día)', icon: '🏙️', desc: 'Rascacielos y calles anchas a plena luz del día.',
    indoor: false, wallH: 10, sky: 0x9fd0ff, fog: [0xb7d6f0, 0.01], hemi: [0xdceaff, 0x4a4d55, 1.3],
    tex: { wall: ['building', '#6f7782', 0.03], floor: ['asphalt', '#3b3d42'] },
    lamp: { color: 0xffe2a8, int: 0, dist: 20 }, moon: 0xfff6e0, sunInt: 2.6, flicker: 0, drone: 58, gen: genCity },
  { id: 'island', name: 'Isla Tropical', icon: '🏝️', desc: 'Palmeras, rocas y antorchas rodeadas de mar.',
    indoor: false, wallH: 1.6, sky: 0x7ec8ff, fog: [0x9fdcff, 0.008], hemi: [0xd8f0ff, 0xe0c890, 1.2],
    tex: { wall: ['water', '#1f6fa8'], floor: ['sand', '#d8c58a'] },
    lamp: { color: 0xffa94d, int: 35, dist: 16 }, moon: 0xfff0d0, sunInt: 2.4, flicker: 0.4, drone: 44, gen: genIsland },
  { id: 'cave', name: 'Minas Profundas', icon: '⛏️', desc: 'Cuevas estrechas iluminadas por cristales naranjas.',
    indoor: true, wallH: 4.5, ceilH: 4.5, sky: 0x050404, fog: [0x0a0806, 0.06], hemi: [0xffc890, 0x1a1410, 0.7],
    tex: { wall: ['rock', '#4a4038'], floor: ['rock', '#3a322c'], ceil: ['rock', '#2e2824'] },
    lamp: { color: 0xff9a4d, int: 40, dist: 16, panel: 0xffa860 }, flicker: 0.3, drone: 36, gen: genCave },
  { id: 'bunker', name: 'Búnker Militar', icon: '🪖', desc: 'Pasillos de hormigón, cajas de munición y luces verdes.',
    indoor: true, wallH: 3, ceilH: 3, sky: 0x040605, fog: [0x080d0a, 0.05], hemi: [0xb8ffd0, 0x0c1410, 0.55],
    tex: { wall: ['concrete', '#5a6258'], floor: ['metal', '#2d332e'], ceil: ['metal', '#252a26'] },
    lamp: { color: 0x9dffb8, int: 24, dist: 16, panel: 0xc8ffd8 }, cols: [0x3a4a30, 0x4a5a3a, 0x2f3a2a, 0x555b50], flicker: 0.6, drone: 40, gen: genMansion },
  { id: 'hedge', name: 'Laberinto de Setos', icon: '🌳', desc: 'Un jardín-laberinto al anochecer con estatuas y farolas.',
    indoor: false, wallH: 3.4, sky: 0x2a1f3a, fog: [0x2a2038, 0.03], hemi: [0xb8a0d8, 0x20182a, 1.0],
    tex: { wall: ['hedge', '#1c4a24'], floor: ['grass', '#27502a'] },
    lamp: { color: 0xffd9a0, int: 55, dist: 18 }, moon: 0xc8a0ff, sunInt: 0.8, pillar: 0x7a7a82, flicker: 0.3, drone: 40, gen: genBackrooms },
  { id: 'metro', name: 'Estación de Metro', icon: '🚇', desc: 'Andenes largos, trenes detenidos y pilares. Cruza entre salas por los pasos.',
    indoor: true, wallH: 4.2, ceilH: 4.2, sky: 0x050608, fog: [0x0a0c10, 0.045], hemi: [0xbcd0ff, 0x15181d, 0.7],
    tex: { wall: ['concrete', '#8f959a'], floor: ['concrete', '#4a4d52'], ceil: ['concrete', '#5a5e63'] },
    lamp: { color: 0xdff1ff, int: 30, dist: 20, panel: 0xeaf6ff }, pillar: 0x9a9ea3, flicker: 0.5, drone: 46, gen: genTunnels },
  { id: 'school', name: 'Escuela Abandonada', icon: '🏫', desc: 'Aulas y pasillos con pupitres viejos. Alguien tocó el timbre...',
    indoor: true, wallH: 3.2, ceilH: 3.2, sky: 0x0a0a08, fog: [0x14120e, 0.05], hemi: [0xfff0c8, 0x24201a, 0.9],
    tex: { wall: ['wallpaper', '#a9c9a0', '#98b890'], floor: ['wood', '#7b5a38'], ceil: ['ceiling', '#d6d2c0'] },
    lamp: { color: 0xfff4d0, int: 26, dist: 18, panel: 0xfff8e0 }, cols: [0x7a5230, 0x3d5a80, 0x8a3a2a, 0x6b6f3a], flicker: 0.45, drone: 44, gen: genMansion },
  { id: 'hospital', name: 'Hospital Abandonado', icon: '🏥', desc: 'Camillas, habitaciones frías y luces que parpadean.',
    indoor: true, wallH: 3.2, ceilH: 3.2, sky: 0x060a09, fog: [0x0c1412, 0.05], hemi: [0xcffff0, 0x1a2422, 0.7],
    tex: { wall: ['concrete', '#cfe0dc'], floor: ['concrete', '#8fa3a0'], ceil: ['ceiling', '#e6efee'] },
    lamp: { color: 0xdffff6, int: 28, dist: 18, panel: 0xeafff9 }, cols: [0xe8f0ee, 0x9fd0c8, 0x6fa8a0, 0xffffff, 0xb8c8c4], flicker: 0.65, drone: 41, gen: genMansion },
  { id: 'market', name: 'Supermercado', icon: '🛒', desc: 'Pasillos de estanterías llenas, bien iluminado... y vacío.',
    indoor: true, wallH: 5, ceilH: 5, sky: 0x0c0c0c, fog: [0x1a1816, 0.03], hemi: [0xfff8e8, 0x2a2824, 0.9],
    tex: { wall: ['wallpaper', '#e8d8e0', '#d8c8d0'], floor: ['concrete', '#c8c6bc'], ceil: ['ceiling', '#f0eee0'] },
    lamp: { color: 0xfffbe8, int: 38, dist: 24, panel: 0xffffff }, shelf: { frame: 0xd9dce0, cols: [0xd23a3a, 0x3a8ad2, 0xe0c030, 0x4aa860] }, flicker: 0.2, drone: 52, gen: genWarehouse },
  { id: 'parking', name: 'Estacionamiento', icon: '🅿️', desc: 'Garaje subterráneo con coches aparcados y columnas. Tubos fluorescentes.',
    indoor: true, wallH: 3.2, ceilH: 3.2, sky: 0x050505, fog: [0x0b0b0a, 0.055], hemi: [0xffe6a8, 0x1a1810, 0.6],
    tex: { wall: ['concrete', '#6c6f73'], floor: ['asphalt', '#2b2c30'], ceil: ['concrete', '#55585c'] },
    lamp: { color: 0xffe6a8, int: 30, dist: 18, panel: 0xfff0c8 }, pillar: 0x8a8d90, flicker: 0.7, drone: 43, gen: genParking },
  { id: 'space', name: 'Estación Espacial', icon: '🛰️', desc: 'Módulos de metal con luces azules y consolas. Silencio de vacío.',
    indoor: true, wallH: 3.6, ceilH: 3.6, sky: 0x03060a, fog: [0x050a10, 0.05], hemi: [0x9fe8ff, 0x16222c, 0.85],
    tex: { wall: ['metal', '#33404f'], floor: ['metal', '#1d242c'], ceil: ['metal', '#27313b'] },
    lamp: { color: 0x6fe8ff, int: 30, dist: 18, panel: 0x9ff4ff }, cols: [0x1f8fb0, 0x2a3a4a, 0xd0e8f0, 0x6a2ab0], flicker: 0.3, drone: 62, gen: genMansion },
  { id: 'desert', name: 'Desierto de Ruinas', icon: '🏜️', desc: 'Dunas, cactus y templos de arenisca bajo un sol de plomo.',
    indoor: false, wallH: 4, sky: 0xf2c98a, fog: [0xe8c48a, 0.012], hemi: [0xfff0d0, 0xb08850, 1.3],
    tex: { wall: ['rock', '#a07848'], floor: ['sand', '#e0b872'] },
    lamp: { color: 0xffa94d, int: 40, dist: 18 }, moon: 0xfff0d0, sunInt: 2.6, flicker: 0.3, drone: 40, gen: genDesert },
  { id: 'tundra', name: 'Tundra Nevada', icon: '❄️', desc: 'Pinos cubiertos de nieve y ventisca. Las antorchas son tu única guía.',
    indoor: false, wallH: 5, sky: 0xc9dcee, fog: [0xdbe7f2, 0.026], hemi: [0xeaf4ff, 0x9fb0c0, 1.3],
    tex: { wall: ['rock', '#9fb4c8'], floor: ['sand', '#eef4fa'] }, trees: { trunk: 0x4a3a2a, a: 0xdce8f4, b: 0xf3f8fd }, rockC: 0xaab8c8,
    lamp: { color: 0xffb866, int: 40, dist: 20 }, moon: 0xdfeaff, sunInt: 1.8, flicker: 0.4, drone: 33, gen: genForest },
  { id: 'graveyard', name: 'Cementerio', icon: '🪦', desc: 'Lápidas torcidas, mausoleos y árboles muertos bajo la niebla.',
    indoor: false, wallH: 3.4, sky: 0x0b0d16, fog: [0x141a24, 0.04], hemi: [0x8fa4d0, 0x1a2030, 1.25],
    tex: { wall: ['rock', '#3a3f48'], floor: ['grass', '#1c2a1a'] },
    lamp: { color: 0x8affc0, int: 45, dist: 18 }, moon: 0x9fb4e8, sunInt: 1.3, flicker: 0.6, drone: 36, gen: genGraveyard },
  { id: 'fair', name: 'Feria Abandonada', icon: '🎡', desc: 'Noria, carruseles y puestos desiertos con luces de colores.',
    indoor: false, wallH: 3.4, sky: 0x1a1033, fog: [0x241848, 0.02], hemi: [0xd0b8ff, 0x201830, 1.0],
    tex: { wall: ['wood', '#7a3b5a'], floor: ['sand', '#b69a6a'] },
    lamp: { color: 0xffe08a, int: 70, dist: 24 }, moon: 0xb09cff, sunInt: 0.8, flicker: 0.3, drone: 52, gen: genFair },
];


/* ---------------------------- MAPA FINAL GLITCHEADO ---------------------------- */
// Mezcla trozos de todos los mapas, todo plano (paredes bajas) y sin techo.
function genGlitch(def, rng) {
  const c = ctxNew(def, rng);
  const pool = [...MAP_DEFS.filter(d => !d.glitch && d !== CHOCO_DEF && d !== GREEN_DEF && d !== VERITY_DEF), GREEN_DEF, VERITY_DEF]; // siempre el mismo grupo (también en cooperativo)
  const srcs = [];
  for (let k = 0; k < 7; k++) {
    const d = pool[Math.floor(rng() * pool.length)];
    try { const r = d.gen(d, rng); srcs.push({ c: r.c, d }); } catch (e) { /* se ignora */ }
  }
  const B = 8, FLAT = 3.2;
  const bn = Math.ceil(N / B), pick = new Int32Array(bn * bn);
  for (let i = 0; i < pick.length; i++) pick[i] = Math.floor(rng() * srcs.length);
  const owner = new Int32Array(N * N);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const s = srcs[pick[Math.floor(z / B) * bn + Math.floor(x / B)]], i = I(x, z);
    owner[i] = pick[Math.floor(z / B) * bn + Math.floor(x / B)];
    if (!s) { c.g[i] = rng() < 0.2 ? 1 : 0; c.hgt[i] = FLAT; continue; }
    c.g[i] = s.c.g[i]; c.hx[i] = s.c.hx[i]; c.hz[i] = s.c.hz[i]; c.hgt[i] = Math.min(FLAT, s.c.hgt[i]);
  }
  const blockOf = (px, pz) => { const x = Math.floor(px / CELL), z = Math.floor(pz / CELL); return inb(x, z) ? owner[I(x, z)] : -1; };
  srcs.forEach((s, si) => {
    for (const p of s.c.props) {
      const x = Math.floor(p.x / CELL), z = Math.floor(p.z / CELL);
      if (inb(x, z) && owner[I(x, z)] === si && c.g[I(x, z)] === 2) {
        if (p.parts.some(q => q.s === 'cone')) continue; // sin árboles
        c.props.push(p);
      }
    }
  });
  // cualquier "objeto" sin prop real vuelve a ser suelo (por si un prop cayó en otro bloque)
  const has = new Set(c.props.map(p => I(Math.floor(p.x / CELL), Math.floor(p.z / CELL))));
  for (let i = 0; i < N * N; i++) if (c.g[i] === 2 && !has.has(i)) c.g[i] = 0;
  // plaza central abierta + pasillo largo hacia atrás (escenario de la intro del jefe final)
  { const m = N >> 1, carve = (x, z) => (Math.abs(x - m) <= 10 && Math.abs(z - m) <= 10) || (Math.abs(x - m) <= 6 && z >= 6 && z <= m - 10);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (carve(x, z)) { c.g[I(x, z)] = 0; c.hx[I(x, z)] = 0; c.hz[I(x, z)] = 0; }
    c.props = c.props.filter(p => !carve(Math.floor(p.x / CELL), Math.floor(p.z / CELL))); }
  // pasillos abiertos para que todo conecte
  for (let k = 8; k < N - 4; k += 16) {
    for (let t = 1; t < N - 1; t++) for (const [x, z] of [[t, k], [k, t]]) {
      const i = I(x, z);
      if (c.g[i] === 2) { const pi = c.props.findIndex(p => Math.floor(p.x / CELL) === x && Math.floor(p.z / CELL) === z); if (pi >= 0) c.props.splice(pi, 1); }
      c.g[i] = 0;
    }
  }
  border(c, FLAT);
  // texturas de otros mapas en varios bloques (el resto usa la textura glitch)
  c.srcDefs = srcs.map(s => s.d);
  c.texs = new Int8Array(N * N).fill(-1);
  const useTex = srcs.map(() => rng() < 0.7);
  for (let i = 0; i < N * N; i++) if (useTex[owner[i]] && srcs[owner[i]]) c.texs[i] = owner[i];
  const free = keepLargest(c);
  return { c, free };
}

export const GLITCH_DEF = {
  id: 'glitchzone', name: 'Zona Glitch', icon: '👾', desc: 'La combinación corrupta de todos los mapas.', glitch: true,
  indoor: false, wallH: 3.2, sky: 0x2a0044, fog: [0x2a0044, 0.012], hemi: [0xffffff, 0x8040a0, 1.5],
  tex: { wall: ['glitch'], floor: ['glitch'] },
  lamp: { color: 0xff40ff, int: 0, dist: 20 }, moon: 0xc080ff, sunInt: 1.2, flicker: 0, drone: 40, gen: genGlitch,
};

export function generateMap(def, seed) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const rng = makeRng((seed + attempt * 7919) >>> 0);
    const { c, free } = def.gen(def, rng);
    if (free.length < N * N * 0.22) continue;
    return { def, seed, N, CELL, grid: c.g, hgt: c.hgt, hx: c.hx, hz: c.hz, props: c.props, lamps: c.lamps, sprites: c.sprites || [], barrels: c.barrels || [], texs: c.texs, srcDefs: c.srcDefs, free };
  }
  throw new Error('No se pudo generar el mapa ' + def.id);
}
