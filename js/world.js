// Colisiones, línea de visión y pathfinding (A*) sobre la cuadrícula del mapa
import { N, CELL } from './maps.js';

export class World {
  constructor(map) {
    this.map = map; this.g = map.grid; this.hx = map.hx; this.hz = map.hz;
    this.size = N * CELL;
    this.cur = 0;
    this.stamp = new Uint32Array(N * N);
    this.closed = new Uint32Array(N * N);
    this.gs = new Float32Array(N * N);
    this.from = new Int32Array(N * N);
  }

  cellWorld(i) { return { x: ((i % N) + 0.5) * CELL, z: (((i / N) | 0) + 0.5) * CELL }; }

  collides(x, z, r) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0 || cz < 0 || cx >= N || cz >= N) return true;
      const i = cz * N + cx, v = this.g[i];
      if (v === 0) continue;
      if (v === 1) return true;
      const px = (cx + 0.5) * CELL, pz = (cz + 0.5) * CELL;
      const qx = Math.max(px - this.hx[i], Math.min(px + this.hx[i], x));
      const qz = Math.max(pz - this.hz[i], Math.min(pz + this.hz[i], z));
      const dx = x - qx, dz = z - qz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  move(e, dx, dz) {
    if (!this.collides(e.x + dx, e.z, e.r)) e.x += dx;
    if (!this.collides(e.x, e.z + dz, e.r)) e.z += dz;
  }

  los(ax, az, bx, bz, r = 0.3) {
    const dx = bx - ax, dz = bz - az, n = Math.ceil(Math.hypot(dx, dz) / 0.5);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.collides(ax + dx * t, az + dz * t, r)) return false;
    }
    return true;
  }

  nearestFree(cx, cz) {
    cx = Math.max(0, Math.min(N - 1, cx)); cz = Math.max(0, Math.min(N - 1, cz));
    if (this.g[cz * N + cx] === 0) return cz * N + cx;
    for (let r = 1; r <= 6; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = cx + dx, z = cz + dz;
        if (x >= 0 && z >= 0 && x < N && z < N && this.g[z * N + x] === 0) return z * N + x;
      }
    }
    return -1;
  }

  // Devuelve una lista de puntos {x,z} desde (sx,sz) hasta (tx,tz). [] si no hay camino.
  path(sx, sz, tx, tz) {
    const s = this.nearestFree(Math.floor(sx / CELL), Math.floor(sz / CELL));
    const t = this.nearestFree(Math.floor(tx / CELL), Math.floor(tz / CELL));
    if (s < 0 || t < 0) return [];
    if (s === t) return [{ x: tx, z: tz }];
    const cur = ++this.cur, gs = this.gs, st = this.stamp, cl = this.closed, from = this.from, g = this.g;
    const tX = t % N, tZ = (t / N) | 0;
    const hi = [], hk = [];
    const hpush = (id, k) => {
      let i = hi.length; hi.push(id); hk.push(k);
      while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= hk[i]) break; [hi[p], hi[i]] = [hi[i], hi[p]]; [hk[p], hk[i]] = [hk[i], hk[p]]; i = p; }
    };
    const hpop = () => {
      const id = hi[0], lastI = hi.pop(), lastK = hk.pop();
      if (hi.length) {
        hi[0] = lastI; hk[0] = lastK; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < hi.length && hk[l] < hk[m]) m = l;
          if (r < hi.length && hk[r] < hk[m]) m = r;
          if (m === i) break;
          [hi[m], hi[i]] = [hi[i], hi[m]]; [hk[m], hk[i]] = [hk[i], hk[m]]; i = m;
        }
      }
      return id;
    };
    const heur = (x, z) => { const dx = Math.abs(x - tX), dz = Math.abs(z - tZ); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    gs[s] = 0; st[s] = cur; from[s] = -1; hpush(s, heur(s % N, (s / N) | 0));
    let found = false;
    while (hi.length) {
      const id = hpop();
      if (id === t) { found = true; break; }
      if (cl[id] === cur) continue;
      cl[id] = cur;
      const x = id % N, z = (id / N) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const ni = nz * N + nx;
        if (g[ni] !== 0) continue;
        if (dx && dz && (g[z * N + nx] !== 0 || g[nz * N + x] !== 0)) continue;
        const ng = gs[id] + (dx && dz ? 1.414 : 1);
        if (st[ni] !== cur || ng < gs[ni]) { st[ni] = cur; gs[ni] = ng; from[ni] = id; hpush(ni, ng + heur(nx, nz)); }
      }
    }
    if (!found) return [];
    const cells = [];
    for (let i = t; i !== -1; i = from[i]) cells.push(i);
    cells.reverse();
    const pts = [{ x: sx, z: sz }];
    for (let k = 1; k < cells.length; k++) pts.push(this.cellWorld(cells[k]));
    pts[pts.length - 1] = { x: tx, z: tz };
    // suavizado: salta a los puntos más lejanos con línea de visión
    const out = []; let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.los(pts[i].x, pts[i].z, pts[j].x, pts[j].z, 0.45)) j--;
      out.push(pts[j]); i = j;
    }
    return out;
  }
}
