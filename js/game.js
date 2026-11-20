// Motor del juego: escena 3D, primera persona, jugadores CPU, nextbots, HUD
import * as THREE from 'three';
import { N, CELL, MAP_DEFS, generateMap } from './maps.js';
import { World } from './world.js';
import { TEX } from './textures.js';
import { createHumanoid, animateHumanoid, makeNameTag } from './models.js';
import { Sfx } from './audio.js';
import { CPU_NAMES } from './names.js';

export const isTouch = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;

const Q = {
  low:  { dpr: 0.75, shadows: false, shSize: 512,  lamps: 2, botLights: 1, cpuShadows: false },
  med:  { dpr: 1,    shadows: true,  shSize: 1024, lamps: 3, botLights: 2, cpuShadows: false },
  high: { dpr: 1.5,  shadows: true,  shSize: 2048, lamps: 4, botLights: 3, cpuShadows: true },
  rt:   { dpr: 1.5,  shadows: true,  shSize: 2048, lamps: 5, botLights: 3, cpuShadows: true, rt: true },
};
const DIFF = [0.8, 1, 1.2, 1.4];

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,60,60,0.9)'); g.addColorStop(0.5, 'rgba(255,0,0,0.25)'); g.addColorStop(1, 'rgba(255,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const REVIVE_TIME = 2.5, REVIVE_RANGE = 2.6; // segundos y distancia para revivir a un CPU
const PICKUP_RESPAWN = 60; // segundos hasta que reaparece un arma recogida (la bazuca no reaparece)
const RANK = { revolver: 1, shotgun: 2, bazooka: 3 };
const WEAPONS = {
  revolver: { name: 'REVÓLVER', ammo: 6, cd: 0.55, stun: 3.2, range: 60, tol: 1.15, grow: 0.0, beam: 0xffd24d },
  shotgun:  { name: 'ESCOPETA', ammo: 4, cd: 0.95, stun: 4.5, range: 28, tol: 1.2, grow: 0.14, beam: 0x6bd8ff },
  bazooka:  { name: 'BAZUCA', ammo: 2, cd: 1.3, stun: 7, range: 90, tol: 1.3, grow: 0.0, beam: 0xff5a2a, blast: 9 },
};

function weaponModel(type) {
  const g = new THREE.Group();
  const M = (c, r = 0.45, m = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const steel = M(0x8b9096), dark = M(0x23262b, 0.5, 0.6), wood = M(0x6b4423, 0.8, 0.05), olive = M(0x4f5d3a, 0.7, 0.3);
  const box = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  const cyl = (r, l, x, y, z, m, seg = 14) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); g.add(o); return o; };
  if (type === 'revolver') {
    cyl(0.017, 0.3, 0, 0.035, -0.15, steel); cyl(0.036, 0.07, 0, 0.0, -0.01, dark, 6);
    box(0.04, 0.075, 0.12, 0, 0.0, 0.03, steel);
    const grip = box(0.04, 0.12, 0.05, 0, -0.07, 0.085, wood); grip.rotation.x = -0.3;
    box(0.012, 0.03, 0.012, 0, 0.082, -0.29, dark);
  } else if (type === 'shotgun') {
    cyl(0.02, 0.72, 0, 0.02, -0.36, steel); cyl(0.017, 0.62, 0, -0.012, -0.31, dark);
    box(0.04, 0.045, 0.18, 0, -0.005, -0.22, wood);
    box(0.045, 0.075, 0.2, 0, 0.0, 0.0, dark);
    const st = box(0.045, 0.1, 0.3, 0, -0.03, 0.2, wood); st.rotation.x = 0.18;
  } else {
    cyl(0.07, 0.95, 0, 0.0, -0.4, olive, 18); cyl(0.088, 0.1, 0, 0, -0.9, dark, 18); cyl(0.088, 0.1, 0, 0, 0.07, dark, 18);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 14), M(0xc23b22, 0.5, 0.2)); cone.rotation.x = -Math.PI / 2; cone.position.set(0, 0, -1.05); g.add(cone);
    box(0.04, 0.12, 0.05, 0, -0.1, -0.35, dark); box(0.025, 0.05, 0.08, 0, 0.09, -0.5, dark);
  }
  return g;
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.camera = new THREE.PerspectiveCamera(80, 1, 0.1, 260);
    this.camera.rotation.order = 'YXZ';
    this.sfx = new Sfx();
    this.state = 'menu';
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.sprintBtn = false;
    this.onEvent = () => {};
    this.sens = 0.0022;
    this.yaw = 0; this.pitch = 0;
    this.scene = null; this.cpus = []; this.bots = [];
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  /* ------------------------------ ENTRADA ------------------------------ */
  bindInput() {
    window.addEventListener('keydown', e => {
      if (this.state === 'menu') return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyF' && this.flash) this.flash.visible = !this.flash.visible;
      if (e.code === 'Tab') this.showBoard(true);
      if (e.code === 'Space' && this.player && !this.player.alive) this.cycleSpectate();
      if (e.code === 'Space' && this.player && this.player.alive) this.jumpReq = true;
      const dm = /^(Digit|Numpad)([1-3])$/.exec(e.code);
      if (dm && this.state === 'playing' && this.player && this.player.alive && this.inv) this.equip(+dm[2] - 1);
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); if (e.code === 'Tab') this.showBoard(false); });
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== this.canvas || this.state === 'menu') return;
      this.yaw -= e.movementX * this.sens; this.pitch = clamp(this.pitch - e.movementY * this.sens, -1.45, 1.45);
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas && (this.state === 'playing' || this.state === 'dead') && !isTouch) this.onEvent('pause');
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !isTouch && this.state === 'playing') this.onEvent('pause'); });

    // táctil
    const joy = $('joy'), knob = $('knob');
    let jid = null, jc = null;
    const jmove = e => {
      const dx = clamp(e.clientX - jc.x, -50, 50), dy = clamp(e.clientY - jc.y, -50, 50);
      this.joy.x = dx / 50; this.joy.y = dy / 50;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
    };
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; jmove(e); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
    const jend = e => { if (e.pointerId !== jid) return; jid = null; this.joy.x = this.joy.y = 0; knob.style.transform = ''; };
    joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
    let lid = null, lx = 0, ly = 0;
    this.canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || lid !== null) return; lid = e.pointerId; lx = e.clientX; ly = e.clientY; });
    this.canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== lid) return;
      this.yaw -= (e.clientX - lx) * this.sens * 1.6; this.pitch = clamp(this.pitch - (e.clientY - ly) * this.sens * 1.6, -1.45, 1.45);
      lx = e.clientX; ly = e.clientY;
    });
    const lend = e => { if (e.pointerId === lid) lid = null; };
    this.canvas.addEventListener('pointerup', lend); this.canvas.addEventListener('pointercancel', lend);
    $('btnRun').addEventListener('pointerdown', () => { this.sprintBtn = true; });
    $('btnRun').addEventListener('pointerup', () => { this.sprintBtn = false; });
    $('btnRun').addEventListener('pointerleave', () => { this.sprintBtn = false; });
    $('btnLight').addEventListener('pointerdown', () => { if (this.flash) this.flash.visible = !this.flash.visible; });
    $('btnJump').addEventListener('pointerdown', () => { this.jumpReq = true; });
    $('btnFire').addEventListener('pointerdown', () => { this.fireReq = true; });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('btnRevive').addEventListener(ev, () => { this.reviveBtn = false; });
    $('btnRevive').addEventListener('pointerdown', () => { this.reviveBtn = true; });
    document.addEventListener('wheel', e => { if (document.pointerLockElement === this.canvas && this.state === 'playing' && this.inv && this.player.alive) this.cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
    this.slotEls = [0, 1, 2].map(i => {
      const d = document.createElement('div'); d.className = 'slot empty'; d.innerHTML = `<i>${i + 1}</i><b></b><span></span>`;
      d.addEventListener('pointerdown', () => { if (this.state === 'playing' && this.inv) this.equip(i); });
      $('hotbar').appendChild(d); return d;
    });
    document.addEventListener('mousedown', e => { if (e.button === 0 && document.pointerLockElement === this.canvas && this.state === 'playing') this.fireReq = true; });
    $('pauseBtn').addEventListener('click', () => this.onEvent('pause'));
    this.canvas.addEventListener('click', () => { if (this.state === 'dead') this.cycleSpectate(); });
  }

  lock() { if (!isTouch && this.canvas.requestPointerLock) { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* nada */ } } }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setSize(w, h); }
  }

  /* ------------------------------ INICIO ------------------------------ */
  async start(opts, memePool) {
    this.stop();
    this.opts = opts;
    const def = this.def = MAP_DEFS[opts.map];
    const q = this.q = Q[opts.quality] || Q.med;
    this.sens = 0.0022 * opts.sens;
    const seed = (Math.random() * 1e9) | 0;
    this.map = generateMap(def, seed);
    this.world = new World(this.map);
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
    r.shadowMap.enabled = q.shadows; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera.fov = opts.fov; this.camera.updateProjectionMatrix();
    this.buildScene();
    await this.setupPost();
    await this.buildMemes(opts.plan);
    this.spawnEntities();
    this.buildMini();
    this.sfx.init(def.drone);
    this.time = 0; this.round = opts.dur; this.endShown = false; this.kills = 0; this.specIdx = 0;
    this.sceneT = 0; this.lampT = 0; this.stepT = 0;
    this.state = 'playing';
    this.resize();
    $('vignette').style.opacity = 0;
    this.toast('¡CORRE! Los nextbots llegan pronto…', 3500);
    this.last = performance.now();
    this.raf = requestAnimationFrame(t => this.loop(t));
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.state = 'menu';
    if (this.composer) { try { this.composer.dispose(); } catch { /* nada */ } this.composer = null; }
    if (this.scene) {
      this.scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of ms) { for (const k of ['map', 'emissiveMap', 'bumpMap']) if (m[k]) m[k].dispose(); m.dispose(); }
      });
      if (this.scene.environment) this.scene.environment.dispose();
    }
    if (this.memes) { for (const m of this.memes.values()) { if (m.dispose) m.dispose(); if (m.tex) m.tex.dispose(); } this.memes = null; }
    this.animated = [];
    for (const o of [this.flash, this.flash && this.flash.target, this.muzzle, this.fpModel]) if (o) this.camera.remove(o);
    this.muzzle = null; this.fpModel = null; this.weapon = null; this.pickups = []; this.fx = []; this.inv = null; this.sel = -1;
    this.scene = null; this.cpus = []; this.bots = []; this.flash = null;
    this.keys.clear(); this.joy.x = this.joy.y = 0;
    this.renderer.renderLists.dispose();
    $('scare').classList.add('hidden');
  }

  /* ------------------------------ ESCENA ------------------------------ */
  buildScene() {
    const def = this.def, q = this.q, map = this.map;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(def.sky);
    scene.fog = new THREE.FogExp2(def.fog[0], def.fog[1]);
    scene.add(this.camera);
    scene.add(new THREE.HemisphereLight(def.hemi[0], def.hemi[1], def.hemi[2]));
    const size = N * CELL;
    const rt = !!q.rt;

    // suelo
    const ft = TEX[def.tex.floor[0]](...def.tex.floor.slice(1));
    ft.repeat.set(size / ft.userData.tileW, size / ft.userData.tileH);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: ft, roughness: rt ? 0.38 : 0.92, metalness: rt ? 0.15 : 0 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(size / 2, 0, size / 2); floor.receiveShadow = true;
    scene.add(floor);

    // techo (solo interiores)
    if (def.indoor) {
      const ct = TEX[def.tex.ceil[0]](...def.tex.ceil.slice(1));
      ct.repeat.set(size / ct.userData.tileW, size / ct.userData.tileH);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.95 }));
      ceil.rotation.x = Math.PI / 2; ceil.position.set(size / 2, def.ceilH, size / 2);
      scene.add(ceil);
    }

    // paredes (instanciadas, agrupadas por altura)
    const wt = TEX[def.tex.wall[0]](...def.tex.wall.slice(1));
    const groups = new Map();
    for (let i = 0; i < N * N; i++) {
      if (map.grid[i] !== 1) continue;
      const x = i % N, z = (i / N) | 0;
      const solid = (a, b) => a < 0 || b < 0 || a >= N || b >= N || map.grid[b * N + a] === 1;
      if (solid(x + 1, z) && solid(x - 1, z) && solid(x, z + 1) && solid(x, z - 1)) continue;
      const key = Math.round(map.hgt[i] * 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    }
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    for (const [key, list] of groups) {
      const h = key / 10;
      const t = wt.clone(); t.needsUpdate = true;
      t.repeat.set(CELL / wt.userData.tileW, def.indoor ? 1 : h / wt.userData.tileH);
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
      if (wt.userData.emissive) {
        const e = wt.userData.emissive.clone(); e.needsUpdate = true; e.repeat.copy(t.repeat);
        m.emissiveMap = e; m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 1.3;
      }
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, h, CELL), m, list.length);
      list.forEach((i, k) => {
        dummy.position.set(((i % N) + 0.5) * CELL, h / 2, (((i / N) | 0) + 0.5) * CELL);
        dummy.updateMatrix(); inst.setMatrixAt(k, dummy.matrix);
        const v = 0.82 + Math.random() * 0.18; inst.setColorAt(k, col.setRGB(v, v, v));
      });
      inst.castShadow = q.shadows; inst.receiveShadow = true;
      scene.add(inst);
    }

    // objetos (cajas, árboles, coches, lámparas…) agrupados por forma
    const GEOS = {
      box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
      cone: new THREE.ConeGeometry(0.5, 1, 10), sphere: new THREE.SphereGeometry(0.5, 14, 10),
    };
    const buckets = new Map();
    for (const p of map.props) {
      const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
      for (const pt of p.parts) {
        const key = pt.s + (pt.e ? 'E' : '');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push({ p, pt, cs, sn });
      }
    }
    const q4 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), pos = new THREE.Vector3(), mtx = new THREE.Matrix4();
    for (const [key, items] of buckets) {
      const emi = key.endsWith('E'), shape = emi ? key.slice(0, -1) : key;
      const mat = emi ? new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }) : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
      const inst = new THREE.InstancedMesh(GEOS[shape], mat, items.length);
      items.forEach(({ p, pt, cs, sn }, k) => {
        pos.set(p.x + pt.dx * cs + pt.dz * sn, pt.dy, p.z - pt.dx * sn + pt.dz * cs);
        q4.setFromAxisAngle(up, p.rot); sc.set(pt.sx, pt.sy, pt.sz);
        mtx.compose(pos, q4, sc); inst.setMatrixAt(k, mtx); inst.setColorAt(k, col.setHex(pt.c));
      });
      inst.castShadow = !emi && q.shadows; inst.receiveShadow = !emi;
      scene.add(inst);
    }

    // luz de la luna (exteriores) con sombras que siguen al jugador
    if (!def.indoor) {
      const moon = this.moon = new THREE.DirectionalLight(def.moon, def.sunInt || 0.9);
      moon.castShadow = q.shadows;
      moon.shadow.mapSize.set(q.shSize, q.shSize);
      const s = moon.shadow.camera; s.left = -38; s.right = 38; s.top = 38; s.bottom = -38; s.near = 1; s.far = 140;
      moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.04;
      scene.add(moon, moon.target);
    }

    // pool de luces de lámparas y de nextbots (se reubican cerca del jugador)
    this.lampLights = [];
    for (let i = 0; i < q.lamps; i++) {
      const L = new THREE.PointLight(def.lamp.color, def.lamp.int, def.lamp.dist, 2);
      L.position.set(0, -50, 0); L.userData = { base: def.lamp.int, off: 0 };
      scene.add(L); this.lampLights.push(L);
    }
    this.botLights = [];
    for (let i = 0; i < q.botLights; i++) {
      const L = new THREE.PointLight(0xff2020, 0, 14, 2); L.position.set(0, -50, 0);
      scene.add(L); this.botLights.push(L);
    }

    // linterna
    const flash = this.flash = new THREE.SpotLight(0xfff0d0, 110, 48, 0.5, 0.55, 2);
    flash.position.set(0.12, -0.08, 0); flash.castShadow = q.shadows;
    flash.shadow.mapSize.set(q.shSize / 2, q.shSize / 2); flash.shadow.bias = -0.0005; flash.shadow.camera.near = 0.3; flash.shadow.camera.far = 50;
    flash.target.position.set(0, 0, -6);
    this.camera.add(flash, flash.target);
    this.muzzle = new THREE.PointLight(0xffb060, 0, 14, 2); this.muzzle.position.set(0.2, -0.1, -0.7); this.camera.add(this.muzzle);
  }

  async setupPost() {
    this.composer = null;
    if (!this.q.rt) return;
    try {
      const [{ EffectComposer }, { RenderPass }, { SAOPass }, { OutputPass }, { RoomEnvironment }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/SAOPass.js'), import('three/addons/postprocessing/OutputPass.js'),
        import('three/addons/environments/RoomEnvironment.js'),
      ]);
      const r = this.renderer;
      const comp = new EffectComposer(r);
      comp.setPixelRatio(r.getPixelRatio()); comp.setSize(window.innerWidth, window.innerHeight);
      comp.addPass(new RenderPass(this.scene, this.camera));
      const sao = new SAOPass(this.scene, this.camera);
      Object.assign(sao.params, { saoBias: 0.6, saoIntensity: 0.02, saoScale: 4, saoKernelRadius: 30, saoMinResolution: 0, saoBlur: true, saoBlurRadius: 6, saoBlurStdDev: 4, saoBlurDepthCutoff: 0.02 });
      // los sprites (nombres, halos) no deben entrar en el pase de normales del AO
      const origRender = sao.render.bind(sao);
      sao.render = (...a) => {
        const hid = [];
        this.scene.traverse(o => { if (o.isSprite && o.visible) { o.visible = false; hid.push(o); } });
        origRender(...a);
        hid.forEach(o => { o.visible = true; });
      };
      comp.addPass(sao);
      comp.addPass(new OutputPass());
      this.composer = comp; this.sao = sao;
      const pm = new THREE.PMREMGenerator(r);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
      this.scene.traverse(o => { if (o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = 0.22; });
    } catch (err) {
      console.warn('Raytracing aprox. no disponible, usando calidad Alto', err);
      this.composer = null;
    }
  }

  async buildMemes(plan) {
    this.memes = new Map(); this.animated = [];
    for (const e of plan) {
      if (this.memes.has(e.id)) continue;
      const m = { name: e.name, aspect: e.aspect || 1, scare: e.thumb, update: null, dispose: null, tex: null };
      try {
        if (e.kind === 'canvas') { m.tex = new THREE.CanvasTexture(e.canvas); m.scare = e.canvas.toDataURL(); }
        else {
          const url = URL.createObjectURL(e.blob);
          if (e.kind === 'video') {
            const v = document.createElement('video');
            v.loop = true; v.muted = false; v.volume = 1; v.playsInline = true; v.src = url;
            await new Promise(r => { v.onloadeddata = r; v.onerror = r; setTimeout(r, 4000); });
            m.video = v;
            const ctx = this.sfx.ctx; // audio posicional: se oye más fuerte y desde su lado al acercarse
            if (ctx) {
              try {
                const src = ctx.createMediaElementSource(v), pn = ctx.createPanner(), gn = ctx.createGain();
                pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 3; pn.maxDistance = 80; pn.rolloffFactor = 1.3;
                gn.gain.value = 0; src.connect(pn); pn.connect(gn); gn.connect(this.sfx.master);
                m.panner = pn; m.gain = gn; m.src = src;
              } catch { m.panner = null; }
            }
            v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
            m.tex = new THREE.VideoTexture(v); m.aspect = (v.videoWidth / v.videoHeight) || 1;
            m.dispose = () => { try { if (m.src) m.src.disconnect(); if (m.gain) m.gain.disconnect(); } catch { /* nada */ } v.pause(); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); };
          } else {
            const img = new Image(); img.src = url; await img.decode().catch(() => {});
            m.aspect = (img.naturalWidth / img.naturalHeight) || 1; m.scare = url;
            if (e.kind === 'gif') { // el <img> en el DOM sigue animándose; se copia a un canvas cada ~50 ms
              img.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
              document.body.appendChild(img);
              const k = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight, 1));
              const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(img.naturalWidth * k)); c.height = Math.max(2, Math.round(img.naturalHeight * k));
              const x = c.getContext('2d'); m.tex = new THREE.CanvasTexture(c);
              m.update = () => { x.clearRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); m.tex.needsUpdate = true; };
              m.update(); this.animated.push(m);
              m.dispose = () => { img.remove(); URL.revokeObjectURL(url); };
            } else { m.tex = new THREE.Texture(img); m.tex.needsUpdate = true; m.dispose = () => URL.revokeObjectURL(url); }
          }
        }
      } catch (err) { console.warn('Meme no cargado', e.name, err); m.tex = new THREE.Texture(); }
      m.tex.colorSpace = THREE.SRGBColorSpace; m.tex.anisotropy = 4;
      this.memes.set(e.id, m);
    }
    this.haloTex = haloTexture();
  }

  /* ------------------------------ ENTIDADES ------------------------------ */
  spawnEntities() {
    const free = this.map.free, W = this.world, o = this.opts;
    const pick = () => free[Math.floor(Math.random() * free.length)];
    const pw = W.cellWorld(pick());
    this.player = { type: 'player', name: o.name || 'Jugador', x: pw.x, z: pw.z, r: 0.35, alive: true, stamina: 1, tired: false, bob: 0, y: 0, vy: 0 };
    this.yaw = Math.random() * Math.PI * 2; this.pitch = 0;
    this.spawnPickups(pick, pw);

    const names = CPU_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, o.cpus);
    this.cpus = [];
    for (const name of names) {
      let w = null;
      for (let t = 0; t < 50; t++) {
        const c = W.cellWorld(pick());
        if (Math.hypot(c.x - pw.x, c.z - pw.z) < 8) continue;
        if (this.cpus.some(e => Math.hypot(e.x - c.x, e.z - c.z) < 4)) continue;
        w = c; break;
      }
      if (!w) w = W.cellWorld(pick());
      const model = createHumanoid(this.q.cpuShadows);
      const tag = makeNameTag(name); model.add(tag);
      model.position.set(w.x, 0, w.z); this.scene.add(model);
      const skill = rand(0.3, 1);
      this.cpus.push({ type: 'cpu', name, x: w.x, z: w.z, r: 0.4, alive: true, model, tag, skill, reactTime: rand(0.15, 0.8) * (1.4 - skill),
        react: 0, mode: 'wander', path: null, pi: 0, repath: 0, idle: Math.random() * 2, stamina: 1, tired: false, yaw: Math.random() * 6.28, spd: 0, lx: w.x, lz: w.z, stuckT: 0,
        gun: null, gunModel: null, aim: 0, lostT: 0 });
    }

    // nextbots (aparecen escalonados)
    this.bots = [];
    const grace = 10, gap = 7;
    for (let i = 0; i < o.bots; i++) {
      const meme = this.memes.get(o.plan[i % o.plan.length].id);
      const mat = new THREE.MeshBasicMaterial({ map: meme.tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, fog: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.visible = false;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.8 }));
      halo.scale.set(5.2, 5.2, 1); halo.visible = false;
      this.scene.add(mesh, halo);
      this.bots.push({ type: 'bot', name: meme.name, meme, bw: Math.min(4.2, Math.max(1.2, 2.5 * meme.aspect)), x: 0, z: 0, r: 0.55, active: false, spawnAt: grace + i * gap, mesh, halo,
        target: null, retarget: 0, path: null, pi: 0, repath: 0, lx: 0, lz: 0, stuckT: 0, phase: Math.random() * 6,
        state: 'patrol', stun: 0, yaw: Math.random() * 6.28, visT: Math.random() * 0.25, stateT: 0, lostT: 0, lastX: 0, lastZ: 0, goalX: null, goalZ: null });
    }
  }

  // 1 bazuca en todo el mapa + 8 armas más (5 revólveres y 3 escopetas)
  spawnPickups(pick, pw) {
    const W = this.world;
    this.weapon = null; this.pickups = []; this.fx = []; this.inv = [null, null, null]; this.sel = -1; this.emptyT = undefined; this._hbSig = '';
    this.reviveT = 0; this.reviveTarget = null; this.reviveBtn = false;
    const list = ['bazooka', 'revolver', 'revolver', 'revolver', 'revolver', 'revolver', 'shotgun', 'shotgun', 'shotgun'];
    for (const type of list) {
      let spot = null;
      for (let t = 0; t < 80 && !spot; t++) {
        const c = W.cellWorld(pick());
        const minP = type === 'bazooka' ? 22 : 7;
        if (Math.hypot(c.x - pw.x, c.z - pw.z) < minP) continue;
        if (this.pickups.some(p => Math.hypot(p.x - c.x, p.z - c.z) < 8)) continue;
        spot = c;
      }
      if (!spot) spot = W.cellWorld(pick());
      this.pickups.push(this.makePickup(type, spot.x, spot.z));
    }
  }

  // arma en el suelo con su rayo de luz. 'ammo' solo se indica en armas soltadas por un CPU
  makePickup(type, x, z, ammo = null) {
    const def = WEAPONS[type], mesh = new THREE.Group();
    const model = weaponModel(type); model.scale.setScalar(type === 'revolver' ? 3 : 1.7); model.position.y = 1.0; mesh.add(model);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 8, 1, true), new THREE.MeshBasicMaterial({ color: def.beam, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    beam.position.y = 2.6; mesh.add(beam);
    mesh.position.set(x, 0, z); this.scene.add(mesh);
    return { type, x, z, mesh, model, taken: false, ph: Math.random() * 6, ammo, dropped: ammo !== null };
  }

  // un CPU que muere con arma la deja a su lado, con la munición que le quedaba
  dropCpuGun(c) {
    const g = c.gun; c.gun = null; this.setCpuGunModel(c, null);
    if (!g || g.ammo <= 0) return;
    let x = c.x, z = c.z;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]]) {
      if (!this.world.collides(c.x + dx, c.z + dz, 0.3)) { x = c.x + dx; z = c.z + dz; break; }
    }
    this.pickups.push(this.makePickup(g.type, x, z, g.ammo));
    this.feed(`🔫 ${c.name} soltó su ${WEAPONS[g.type].name}`);
  }

  showWeaponModel(type) {
    if (this.fpModel) { this.camera.remove(this.fpModel); this.fpModel = null; }
    if (!type) return;
    const m = this.fpModel = weaponModel(type);
    m.traverse(o => { if (o.isMesh) { o.material.depthTest = false; o.renderOrder = 999; o.material.metalness = 0.15; o.material.color.multiplyScalar(0.3); } });
    this.fpBase = type === 'bazooka' ? new THREE.Vector3(0.2, -0.2, -0.45) : type === 'shotgun' ? new THREE.Vector3(0.2, -0.17, -0.35) : new THREE.Vector3(0.18, -0.15, -0.35);
    m.position.copy(this.fpBase); m.rotation.y = 0.05;
    this.camera.add(m);
  }

  // recoger: si ya tienes ese arma se suma munición (máx. x3); si no, va al primer slot libre y se equipa
  // mantén E (o el botón 💚) cerca del cuerpo de un CPU para revivirlo
  updateRevive(dt) {
    const p = this.player; let target = null, bd = REVIVE_RANGE;
    if (p.alive) for (const c of this.cpus) {
      if (c.alive) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bd) { bd = d; target = c; }
    }
    if (target !== this.reviveTarget) this.reviveT = 0;
    this.reviveTarget = target;
    if (target && (this.keys.has('KeyE') || this.reviveBtn)) {
      this.reviveT += dt;
      if (this.reviveT >= REVIVE_TIME) { this.revive(target); this.reviveT = 0; this.reviveTarget = null; }
    } else this.reviveT = Math.max(0, this.reviveT - dt * 2);
  }

  revive(c) {
    c.alive = true; c.invuln = 3; c.mode = 'wander'; c.path = null; c.idle = 0.6; c.react = 0; c.lostT = 0;
    c.stamina = 1; c.tired = false; c.spd = 0; c.aim = 0; c.gun = null; this.setCpuGunModel(c, null);
    c.model.userData.fall = 0; c.model.rotation.x = 0; c.model.position.y = 0; c.tag.visible = true;
    this.toast(`💚 Reviviste a ${c.name}`, 1800); this.feed(`💚 Reviviste a ${c.name}`, true); this.sfx.revive();
  }

  // vuelve a aparecer en otro sitio al azar (lejos del jugador y de otras armas)
  respawnPickup(pk) {
    const W = this.world, free = this.map.free, P = this.player;
    let spot = null;
    for (let t = 0; t < 60 && !spot; t++) {
      const c = W.cellWorld(free[Math.floor(Math.random() * free.length)]);
      if (Math.hypot(c.x - P.x, c.z - P.z) < 7) continue;
      if (this.pickups.some(o => !o.taken && Math.hypot(o.x - c.x, o.z - c.z) < 8)) continue;
      spot = c;
    }
    if (!spot) spot = W.cellWorld(free[Math.floor(Math.random() * free.length)]);
    pk.x = spot.x; pk.z = spot.z; pk.mesh.position.set(spot.x, 0, spot.z); pk.mesh.visible = true; pk.taken = false;
    this.feed(`🔫 Reapareció un ${WEAPONS[pk.type].name.toLowerCase()}`);
  }

  giveWeapon(type, gain = null) {
    const def = WEAPONS[type], cap = def.ammo * 3, got = gain ?? def.ammo;
    const slot = this.inv.find(s => s && s.type === type);
    if (slot) {
      const before = slot.ammo; slot.ammo = Math.min(cap, slot.ammo + got); this.emptyT = undefined;
      const add = slot.ammo - before;
      this.toast(add > 0 ? `+${add} munición · ${def.name} (${slot.ammo})` : `${def.name}: munición al máximo (${cap})`, 1800);
      this.feed(`🔫 Más munición de ${def.name}`, true);
    } else {
      const i = this.inv.findIndex(s => !s);
      if (i < 0) return;
      this.inv[i] = { type, ammo: Math.min(cap, got), cd: 0.4 };
      this.toast(`Recogiste: ${def.name} (slot ${i + 1})`, 2200);
      this.feed(`🔫 Conseguiste ${def.name}`, true);
      this.equip(i, true);
    }
    this.sfx.thud(0.2);
  }

  // equipar un slot (pulsar el mismo slot otra vez guarda el arma)
  equip(i, force = false) {
    const s = this.inv[i]; if (!s) return;
    if (this.sel === i && !force) { this.sel = -1; this.weapon = null; this.showWeaponModel(null); return; }
    this.sel = i; this.weapon = s; s.cd = Math.max(s.cd, 0.25); this.recoil = 0.6; this.emptyT = undefined;
    this.showWeaponModel(s.type);
  }

  cycleWeapon(dir) {
    const idx = [0, 1, 2].filter(i => this.inv[i]); if (!idx.length) return;
    const cur = idx.indexOf(this.sel);
    this.equip(cur < 0 ? (dir > 0 ? idx[0] : idx[idx.length - 1]) : idx[(cur + dir + idx.length) % idx.length], true);
  }

  fire() {
    const w = this.weapon, def = w && WEAPONS[w.type], p = this.player, cam = this.camera;
    if (!w || !p.alive || w.cd > 0 || w.ammo <= 0) return;
    w.ammo--; w.cd = def.cd; this.recoil = 1;
    const d = cam.getWorldDirection(this._wd || (this._wd = new THREE.Vector3()));
    // impacto contra nextbots (la mira se tolera según el arma)
    let best = null, bt = def.range;
    for (const b of this.bots) {
      if (!b.active) continue;
      const vx = b.x - cam.position.x, vy = 1.45 - cam.position.y, vz = b.z - cam.position.z;
      const t = vx * d.x + vy * d.y + vz * d.z;
      if (t < 0 || t > def.range) continue;
      const dist = Math.hypot(vx - d.x * t, vy - d.y * t, vz - d.z * t);
      if (dist > def.tol + def.grow * t) continue;
      if (!this.world.los(p.x, p.z, b.x, b.z, 0.1)) continue;
      if (t < bt) { bt = t; best = b; }
    }
    // distancia hasta la primera pared
    let wt = def.range;
    for (let t = 0.6; t < def.range; t += 0.5) {
      const y = cam.position.y + d.y * t;
      if (y < 0.05 || this.world.collides(cam.position.x + d.x * t, cam.position.z + d.z * t, 0.05)) { wt = t; break; }
    }
    const loud = w.type === 'bazooka';
    this.sfx.burst(loud ? 0.5 : 0.18, loud ? 260 : 1400, loud ? 0.9 : 0.8, 0.7, loud ? 'lowpass' : 'bandpass');
    this.muzzleT = 0.07;
    if (loud) {
      const t = Math.min(wt, bt);
      this.explode(cam.position.x + d.x * t, Math.max(0.3, cam.position.y + d.y * t), cam.position.z + d.z * t, def);
    } else if (best && bt <= wt) {
      this.stunBot(best, def.stun);
      this.toast(`¡${best.name.toUpperCase()} aturdido!`, 1200);
    }
    if (w.ammo <= 0) this.emptyT = 0.6;
  }

  stunBot(b, secs) { b.stun = secs; b.path = null; }

  banish(b, secs) {
    const free = this.map.free, W = this.world, P = this.player;
    let best = null, bd = -1;
    for (let k = 0; k < 30; k++) {
      const c = W.cellWorld(free[Math.floor(Math.random() * free.length)]);
      const d = Math.hypot(c.x - P.x, c.z - P.z);
      if (d > bd) { bd = d; best = c; }
    }
    b.x = best.x; b.z = best.z; b.lx = b.x; b.lz = b.z; b.path = null; b.stun = secs; b.state = 'patrol'; b.goalX = null; b.target = null;
  }

  explode(x, y, z, def, by = null) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat); s.position.set(x, y, z);
    const L = new THREE.PointLight(0xff9040, 200, 40, 2); L.position.set(x, y + 0.5, z);
    this.scene.add(s, L); this.fx.push({ s, L, t: 0 });
    this.sfx.burst(1.3, 110, by ? Math.max(0.08, 1 - Math.hypot(x - this.player.x, z - this.player.z) / 60) : 1.0, 0.6, 'lowpass');
    let hit = 0;
    for (const b of this.bots) {
      if (!b.active) continue;
      if (Math.hypot(b.x - x, b.z - z) < def.blast) { this.banish(b, def.stun); hit++; this.feed(by ? `💥 ${by} desterró a ${b.name}` : `💥 ${b.name} fue desterrado por la bazuca`, !by); }
    }
    if (!by) this.toast(hit ? `¡BOOM! ${hit} nextbot${hit > 1 ? 's' : ''} desterrado${hit > 1 ? 's' : ''}` : '¡BOOM!', 1500);
  }

  updateWeapons(dt) {
    const p = this.player, w = this.weapon;
    // recogida de armas
    if (p.alive) for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - p.x, pk.z - p.z) < 1.5) { pk.taken = true; pk.takenAt = this.time; pk.mesh.visible = false; this.giveWeapon(pk.type, pk.ammo); }
    }
    for (const pk of this.pickups) if (pk.taken && !pk.dropped && pk.type !== 'bazooka' && this.time - pk.takenAt >= PICKUP_RESPAWN) this.respawnPickup(pk);
    for (const pk of this.pickups) if (!pk.taken) { pk.ph += dt * 2; pk.model.rotation.y += dt * 1.6; pk.model.position.y = 1.0 + Math.sin(pk.ph) * 0.12; }
    // disparo
    if (this.fireReq) { this.fireReq = false; if (w) this.fire(); }
    if (w) {
      w.cd = Math.max(0, w.cd - dt);
      if (w.ammo <= 0 && this.emptyT !== undefined) {
        this.emptyT -= dt;
        if (this.emptyT <= 0) {
          this.emptyT = undefined; this.inv[this.sel] = null; this.sel = -1; this.weapon = null; this.showWeaponModel(null);
          this.toast('Sin munición: arma descartada', 1400);
          const nxt = this.inv.findIndex(s => s); if (nxt >= 0) this.equip(nxt, true);
        }
      }
    }
    if (this.fpModel) { // retroceso y vaivén del arma
      this.recoil = Math.max(0, (this.recoil || 0) - dt * 6);
      const bob = p.moving ? Math.sin(p.bob) * 0.008 : 0;
      this.fpModel.position.set(this.fpBase.x, this.fpBase.y + bob - this.recoil * 0.02, this.fpBase.z + this.recoil * 0.12);
      this.fpModel.rotation.x = this.recoil * 0.25;
    }
    if (this.muzzle) { this.muzzleT = Math.max(0, (this.muzzleT || 0) - dt); this.muzzle.intensity = this.muzzleT > 0 ? 40 : 0; }
    // explosiones
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.t += dt;
      const k = f.t / 0.5;
      f.s.scale.setScalar(0.5 + k * 8); f.s.material.opacity = Math.max(0, 0.9 * (1 - k)); f.L.intensity = Math.max(0, 200 * (1 - k));
      if (k >= 1) { this.scene.remove(f.s, f.L); f.s.geometry.dispose(); f.s.material.dispose(); this.fx.splice(i, 1); }
    }
  }

  activateBot(b) {
    const free = this.map.free, W = this.world, P = this.player;
    const ref = P.alive ? P : (this.cpus.find(c => c.alive) || P);
    let best = null, bd = -1;
    for (let k = 0; k < 30; k++) {
      const c = W.cellWorld(free[Math.floor(Math.random() * free.length)]);
      const d = Math.hypot(c.x - ref.x, c.z - ref.z);
      if (d > bd) { bd = d; best = c; }
    }
    b.x = best.x; b.z = best.z; b.lx = b.x; b.lz = b.z; b.active = true; b.mesh.visible = true; b.halo.visible = true;
    b.state = 'patrol'; b.goalX = null; b.stateT = 0;
    this.toast(`¡${b.name.toUpperCase()} apareció!`, 2200);
    this.sfx.spawn();
  }

  botSpeed() { return 6.0 * DIFF[this.opts.diff] * (1 + 0.35 * Math.min(1, this.time / this.round)); }

  alive() { return (this.player.alive ? 1 : 0) + this.cpus.filter(c => c.alive).length; }

  /* ------------------------------ BUCLE ------------------------------ */
  loop(now) {
    this.raf = requestAnimationFrame(t => this.loop(t));
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (this.state === 'playing' || this.state === 'dead') this.update(dt);
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    if (this.state === 'paused') return;
    this.time += dt;
    this.updatePlayer(dt);
    this.updateWeapons(dt);
    this.updateRevive(dt);
    for (const c of this.cpus) this.updateCpu(c, dt);
    for (const b of this.bots) this.updateBot(b, dt);
    this.separate();
    this.updateVisuals(dt);
    this.updateHud();
    if (!this.endShown && this.time >= this.round) this.endRound();
  }

  updatePlayer(dt) {
    const p = this.player, k = this.keys;
    if (!p.alive) return;
    let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - this.joy.y;
    let s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.joy.x;
    const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    const moving = len > 0.05;
    const wantRun = (k.has('ShiftLeft') || k.has('ShiftRight') || this.sprintBtn || len > 0.95 && this.sprintBtn) && moving;
    let speed = 5.0;
    if (wantRun && p.stamina > 0 && !p.tired) { speed = 10.2; p.stamina -= dt * 0.1; if (p.stamina <= 0) p.tired = true; }
    else { p.stamina = Math.min(1, p.stamina + dt * (moving ? 0.1 : 0.2)); if (p.tired && p.stamina > 0.3) p.tired = false; }
    const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw);
    const dx = (-sn * f + cs * s) * speed * dt, dz = (-cs * f - sn * s) * speed * dt;
    this.world.move(p, dx, dz);
    // salto
    if (this.jumpReq && p.y === 0) { p.vy = 5.4; this.sfx.thud(0.12); }
    this.jumpReq = false;
    if (p.y > 0 || p.vy > 0) {
      p.vy -= 15 * dt; p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; this.sfx.step(false); }
    }
    p.running = speed > 5;
    if (moving && p.y === 0) {
      p.bob += dt * (p.running ? 11 : 7.5);
      this.stepT -= dt;
      if (this.stepT <= 0) { this.sfx.step(p.running); this.stepT = p.running ? 0.28 : 0.45; }
    }
    p.moving = moving;
  }

  setCpuGunModel(c, type) {
    if (c.gunModel) {
      c.model.userData.body.remove(c.gunModel);
      c.gunModel.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      c.gunModel = null;
    }
    if (!type) return;
    const m = weaponModel(type);
    m.scale.setScalar(type === 'revolver' ? 0.9 : 0.6); m.rotation.y = Math.PI; m.position.set(0.24, 1.12, 0.18);
    c.model.userData.body.add(m); c.gunModel = m;
  }

  cpuWants(c, type) {
    if (!c.gun) return true;
    if (c.gun.type === type) return c.gun.ammo < WEAPONS[type].ammo * 2;
    return RANK[type] > RANK[c.gun.type] || c.gun.ammo <= 1;
  }

  cpuTake(c, pk) {
    const def = WEAPONS[pk.type], got = pk.ammo ?? def.ammo;
    pk.taken = true; pk.takenAt = this.time; pk.mesh.visible = false;
    if (c.gun && c.gun.type === pk.type) c.gun.ammo = Math.min(def.ammo * 3, c.gun.ammo + got);
    else { c.gun = { type: pk.type, ammo: Math.min(def.ammo * 3, got), cd: 0.6 }; this.setCpuGunModel(c, pk.type); }
    this.feed(`🔫 ${c.name} recogió ${def.name}`);
  }

  cpuFire(c, b, d) {
    const g = c.gun, def = WEAPONS[g.type];
    g.ammo--; g.cd = def.cd * (1.0 + (1 - c.skill) * 0.4); c.aim = 0;
    const dp = Math.hypot(c.x - this.player.x, c.z - this.player.z);
    if (dp < 45) this.sfx.burst(g.type === 'bazooka' ? 0.4 : 0.15, g.type === 'bazooka' ? 260 : 1400, clamp(1 - dp / 45, 0.05, 1) * 0.6, 0.7, g.type === 'bazooka' ? 'lowpass' : 'bandpass');
    const p = clamp(1.0 - d * 0.009 * (1.3 - c.skill), 0.45, 0.97); // más precisión cuanto más hábil y más cerca
    if (Math.random() < p) {
      if (g.type === 'bazooka') this.explode(b.x, 1.4, b.z, def, c.name);
      else { this.stunBot(b, def.stun); this.feed(`🔫 ${c.name} aturdió a ${b.name}`); }
    }
    if (g.ammo <= 0) { c.gun = null; this.setCpuGunModel(c, null); }
  }

  // busca el arma más cercana que le interese (solo si no hay nextbots cerca)
  cpuLoot(c) {
    if (Math.random() > 0.7 + c.skill * 0.3) return false;
    if (this.bots.some(b => b.active && Math.hypot(b.x - c.x, b.z - c.z) < 16)) return false;
    let best = null, bd = 45;
    for (const pk of this.pickups) {
      if (pk.taken || !this.cpuWants(c, pk.type)) continue;
      const d = Math.hypot(pk.x - c.x, pk.z - c.z);
      if (d < bd) { bd = d; best = pk; }
    }
    if (!best) return false;
    c.path = this.world.path(c.x, c.z, best.x, best.z); c.pi = 0;
    return c.path.length > 0;
  }

  updateCpu(c, dt) {
    const W = this.world;
    if (!c.alive) { animateHumanoid(c.model, dt, 0, true); return; }
    if (c.invuln > 0) c.invuln -= dt;
    // percepción: nextbot más cercano y el más cercano que realmente ve
    let threat = null, td = 1e9, seen = null, sd = 1e9;
    const sight = c.skill > 0.65 ? 34 : 24;
    for (const b of this.bots) {
      if (!b.active) continue;
      const d = Math.hypot(b.x - c.x, b.z - c.z);
      if (d < td) { td = d; threat = b; }
      if (d < sight && d < sd && (d < 8 || W.los(c.x, c.z, b.x, b.z, 0.3))) { sd = d; seen = b; }
    }
    if (seen) { c.lostT = 0; c.react += dt; } else { c.lostT += dt; c.react = Math.max(0, c.react - dt * 1.5); }
    if (c.gun) c.gun.cd = Math.max(0, c.gun.cd - dt);
    const reacted = !!seen && c.react > (c.gun && c.gun.ammo > 0 ? c.reactTime * 0.5 : c.reactTime); // armado reacciona el doble de rápido

    // con arma y munición: se planta y dispara en vez de dejarse atrapar
    const g = c.gun && c.gun.ammo > 0 ? c.gun : null;
    if (reacted && g && !(seen.stun > 0)) {
      const def = WEAPONS[g.type];
      if (sd >= (g.type === 'bazooka' ? 6 : 0) && sd <= def.range * 0.95 && !(sd < 4 && g.cd > 0)) { // dispara a cualquier distancia; si está muy cerca y recargando, corre
        c.mode = 'fight'; c.path = null; c.aim += dt;
        const dx = seen.x - c.x, dz = seen.z - c.z; let da = Math.atan2(dx, dz) - c.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
        c.yaw += da * Math.min(1, dt * 12);
        if (g.cd <= 0 && c.aim > 0.15 * (1.5 - c.skill) && Math.abs(da) < 0.5) this.cpuFire(c, seen, sd);
        c.spd += (0 - c.spd) * Math.min(1, dt * 8);
        c.stamina = Math.min(1, c.stamina + dt * 0.12); if (c.tired && c.stamina > 0.3) c.tired = false;
        return;
      }
    }
    c.aim = 0;

    // huida o paseo
    if (reacted) {
      if (c.mode !== 'flee') { c.mode = 'flee'; c.repath = 0; }
      c.repath -= dt;
      if (!c.path || c.repath <= 0) { this.pickFlee(c); c.repath = 0.7 + Math.random() * 0.6; }
    } else if (c.mode !== 'wander' && (c.lostT > 3 || !threat)) { c.mode = 'wander'; c.path = null; c.idle = Math.random() * 1.2; }
    const flee = c.mode === 'flee';
    if (!flee) {
      if (c.idle > 0) c.idle -= dt;
      else if (!c.path || c.pi >= c.path.length) { if (!this.cpuLoot(c)) this.pickWander(c); }
    }
    let sp = 0;
    if (c.path && c.pi < c.path.length && (flee || c.idle <= 0)) {
      const wp = c.path[c.pi], dx = wp.x - c.x, dz = wp.z - c.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { c.pi++; if (c.pi >= c.path.length) { c.path = null; if (!flee) c.idle = 0.5 + Math.random() * 2.5; } }
      else {
        if (flee) {
          const urgent = (seen && sd < 32) || td < 18; // solo corre a tope si el peligro está cerca
          if (urgent && c.stamina > 0 && !c.tired) { sp = 8.5 + c.skill * 3; c.stamina -= dt * 0.08; if (c.stamina <= 0) c.tired = true; }
          else { sp = 6; c.stamina = Math.min(1, c.stamina + dt * 0.06); if (c.tired && c.stamina > 0.3) c.tired = false; }
        } else { sp = 3.6; c.stamina = Math.min(1, c.stamina + dt * 0.12); if (c.tired && c.stamina > 0.3) c.tired = false; }
        W.move(c, dx / d * sp * dt, dz / d * sp * dt);
        const ty = Math.atan2(dx, dz); let da = ty - c.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
        c.yaw += da * Math.min(1, dt * 10);
      }
    } else c.stamina = Math.min(1, c.stamina + dt * 0.12);
    c.spd += (sp - c.spd) * Math.min(1, dt * 8);
    // recoger armas al pasar por encima
    for (const pk of this.pickups) if (!pk.taken && Math.hypot(pk.x - c.x, pk.z - c.z) < 1.4 && this.cpuWants(c, pk.type)) { this.cpuTake(c, pk); break; }
    c.stuckT += dt;
    if (c.stuckT > 0.9) {
      if (sp > 0 && Math.hypot(c.x - c.lx, c.z - c.lz) < 0.3) { c.path = null; c.repath = 0; c.idle = 0; }
      c.lx = c.x; c.lz = c.z; c.stuckT = 0;
    }
  }

  // paseo: evita zonas con nextbots
  pickWander(c) {
    const free = this.map.free, W = this.world;
    const act = this.bots.filter(b => b.active);
    for (let t = 0; t < 10; t++) {
      const w = W.cellWorld(free[Math.floor(Math.random() * free.length)]);
      const d = Math.hypot(w.x - c.x, w.z - c.z);
      if (d < 8 || d > 40) continue;
      if (act.some(b => Math.hypot(b.x - w.x, b.z - w.z) < 16)) continue;
      c.path = W.path(c.x, c.z, w.x, w.z); c.pi = 0;
      if (c.path.length) return;
    }
    c.idle = 1 + Math.random();
  }

  // huida: lejos de TODOS los nextbots cercanos, sin correr hacia ellos y prefiriendo sitios ocultos a su vista
  pickFlee(c) {
    const free = this.map.free, W = this.world, n = 8 + Math.floor(c.skill * 20);
    const near = this.bots.filter(b => b.active && !(b.stun > 0) && Math.hypot(b.x - c.x, b.z - c.z) < 50);
    let best = null, bs = -1e9;
    for (let i = 0; i < n; i++) {
      const w = W.cellWorld(free[Math.floor(Math.random() * free.length)]);
      const dMe = Math.hypot(w.x - c.x, w.z - c.z);
      if (dMe < 8 || dMe > 45) continue;
      let minDB = 1e9, bad = false, hidden = true;
      for (const b of near) {
        const dB = Math.hypot(w.x - b.x, w.z - b.z); if (dB < minDB) minDB = dB;
        const db = Math.hypot(b.x - c.x, b.z - c.z);
        if (dB < dMe * 0.9) { bad = true; break; }                                   // el nextbot llega antes
        if (db < 22 && ((w.x - c.x) * (b.x - c.x) + (w.z - c.z) * (b.z - c.z)) / (dMe * db) > 0.55) { bad = true; break; } // iría hacia él
        if (hidden && W.los(b.x, b.z, w.x, w.z, 0.2)) hidden = false;
      }
      if (bad) continue;
      const score = (near.length ? Math.min(minDB, 60) : dMe) - dMe * 0.35 + (near.length && hidden ? 14 : 0);
      if (score > bs) { bs = score; best = w; }
    }
    if (!best) { this.pickWander(c); return; }
    c.path = W.path(c.x, c.z, best.x, best.z); c.pi = 0;
  }

  sightRange() { return 30 + this.opts.diff * 5; }

  // ¿ve el nextbot a esta entidad? Distancia + línea de visión + campo de visión (solo si aún no está alerta)
  botSees(b, e) {
    const dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz);
    if (d > this.sightRange()) return false;
    if (b.state !== 'chase' && d > (b.state === 'search' ? 4 : 6)) {
      const cone = b.state === 'search' ? -0.5 : 0.26; // buscando ve ~240°, patrullando ~150°
      if ((dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw)) / (d || 1) < cone) return false;
    }
    return this.world.los(b.x, b.z, e.x, e.z, 0.15);
  }

  onSpotted(b) {
    if (this.time - (this.lastSpot === undefined ? -9 : this.lastSpot) < 2.5) return;
    this.lastSpot = this.time;
    this.toast(`¡${b.name.toUpperCase()} te vio!`, 1400); this.sfx.alert();
  }

  pickPatrol(b) {
    const free = this.map.free, W = this.world;
    const alive = [this.player, ...this.cpus].filter(e => e.alive);
    let gx, gz;
    if (alive.length && Math.random() < 0.55) { // corazonada: ronda por donde hay gente, sin saber dónde exactamente
      const e = (this.player.alive && Math.random() < 0.35) ? this.player : alive[Math.floor(Math.random() * alive.length)];
      for (let t = 0; t < 14; t++) {
        const c = W.cellWorld(free[Math.floor(Math.random() * free.length)]);
        const d = Math.hypot(c.x - e.x, c.z - e.z);
        if (d > 6 && d < 24) { gx = c.x; gz = c.z; break; }
      }
    }
    if (gx === undefined) { const c = W.cellWorld(free[Math.floor(Math.random() * free.length)]); gx = c.x; gz = c.z; }
    b.goalX = gx; b.goalZ = gz; b.path = null; b.repath = 0; b.stateT = 0;
  }

  // camina hacia (gx,gz) (recto si ve el punto, por A* si no). Devuelve la distancia que falta.
  botGo(b, gx, gz, sp, dt) {
    const W = this.world; let tx = gx, tz = gz;
    if (!W.los(b.x, b.z, gx, gz, 0.45)) {
      b.repath -= dt;
      if (!b.path || b.repath <= 0) { b.path = W.path(b.x, b.z, gx, gz); b.pi = 0; b.repath = 0.5 + Math.random() * 0.3; }
      if (b.path.length) {
        while (b.pi < b.path.length - 1 && Math.hypot(b.path[b.pi].x - b.x, b.path[b.pi].z - b.z) < 0.7) b.pi++;
        tx = b.path[b.pi].x; tz = b.path[b.pi].z;
      }
    } else b.path = null;
    const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz) || 1;
    W.move(b, dx / d * sp * dt, dz / d * sp * dt);
    let da = Math.atan2(dx, dz) - b.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); b.yaw += da * Math.min(1, dt * 8);
    b.stuckT += dt;
    if (b.stuckT > 1) { if (Math.hypot(b.x - b.lx, b.z - b.lz) < 0.4) { b.path = null; b.repath = 0; b.goalX = null; } b.lx = b.x; b.lz = b.z; b.stuckT = 0; }
    return Math.hypot(gx - b.x, gz - b.z);
  }

  updateBot(b, dt) {
    if (!b.active) { if (this.time >= b.spawnAt) this.activateBot(b); return; }
    if (b.stun > 0) { b.stun -= dt; return; }
    const P = this.player, sp = this.botSpeed();
    b.stateT += dt;

    // vista (cada ~0.2 s, desfasada entre nextbots)
    b.visT -= dt;
    if (b.visT <= 0) {
      b.visT = 0.18 + Math.random() * 0.08;
      let seen = null, sd = 1e9;
      for (const e of [P, ...this.cpus]) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - b.x, e.z - b.z);
        if (d < sd && this.botSees(b, e)) { sd = d; seen = e; }
      }
      if (seen) {
        if (b.state !== 'chase' && seen === P) this.onSpotted(b);
        if (b.state !== 'chase') { b.path = null; b.repath = 0; }
        b.state = 'chase'; b.target = seen; b.lastX = seen.x; b.lastZ = seen.z; b.stateT = 0;
      } else if (b.state === 'chase') {
        b.state = 'search'; b.path = null; b.repath = 0; b.stateT = 0; b.lostT = 0; b.searchX = b.lastX; b.searchZ = b.lastZ;
      }
    }

    if (b.state === 'chase') {
      const t = b.target;
      if (t && t.alive && this.botSees(b, t)) { b.lastX = t.x; b.lastZ = t.z; this.botGo(b, t.x, t.z, sp, dt); }
      else { // te perdió de vista: va al ÚLTIMO sitio donde te vio (no sabe dónde te escondiste)
        b.state = 'search'; b.path = null; b.repath = 0; b.stateT = 0; b.lostT = 0; b.searchX = b.lastX; b.searchZ = b.lastZ;
      }
    } else if (b.state === 'search') {
      // va al último sitio donde vio a alguien, mira un poco alrededor y se rinde
      const left = this.botGo(b, b.searchX, b.searchZ, sp * 0.85, dt);
      if (left < 1.3) {
        b.lostT += dt;
        if (b.lostT > 1.8) { // pequeño rastreo cerca del último punto
          b.lostT = 0;
          for (let k = 0; k < 8; k++) {
            const nx = b.lastX + (Math.random() - 0.5) * 10, nz = b.lastZ + (Math.random() - 0.5) * 10;
            if (!this.world.collides(nx, nz, 0.5)) { b.searchX = nx; b.searchZ = nz; b.path = null; break; }
          }
        }
      }
      if (b.stateT > 7) { b.state = 'patrol'; b.target = null; b.goalX = null; b.stateT = 0; }
    } else { // patrulla
      if (b.goalX === null || b.stateT > 14) this.pickPatrol(b);
      if (this.botGo(b, b.goalX, b.goalZ, sp * 0.55, dt) < 1.5) b.goalX = null;
    }

    // captura por contacto
    for (const e of [P, ...this.cpus]) {
      if (e.alive && Math.hypot(e.x - b.x, e.z - b.z) < b.r + e.r + 0.35) this.kill(e, b);
    }
  }

  separate() {
    const W = this.world, list = this.cpus.filter(c => c.alive);
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = 0.8;
        if (d < m && d > 0.001) { const push = (m - d) * 0.25; W.move(a, -dx / d * push, -dz / d * push); W.move(b, dx / d * push, dz / d * push); }
      }
      const p = this.player;
      if (p.alive) { const dx = a.x - p.x, dz = a.z - p.z, d = Math.hypot(dx, dz); if (d < 0.8 && d > 0.001) W.move(a, dx / d * (0.8 - d) * 0.4, dz / d * (0.8 - d) * 0.4); }
    }
  }

  kill(e, bot) {
    if (!e.alive || e.invuln > 0) return;
    e.alive = false;
    if (e.type === 'cpu') {
      e.tag.visible = false; this.sfx.thud(clamp(1 - Math.hypot(e.x - this.player.x, e.z - this.player.z) / 40, 0.03, 0.5));
      this.dropCpuGun(e);
      this.feed(`💀 ${e.name} fue atrapado por ${bot.name}`);
      this.killer = bot;
      if (!this.player.alive && !this.cpus.some(c => c.alive)) this.endRound();
    } else {
      const left = this.cpus.filter(c => c.alive).length + 1;
      this.feed(`💀 Te atrapó ${bot.name}`, true);
      this.state = 'dead'; this.killer = bot; this.place = left;
      this.sfx.scare(); this.sfx.setThreat(0);
      const img = $('scareImg'); img.src = bot.meme.scare;
      $('scare').classList.remove('hidden'); $('vignette').style.opacity = 0; this.showBoard(false);
      this.specIdx = 0;
      setTimeout(() => {
        $('scare').classList.add('hidden');
        if (this.state === 'dead' || this.state === 'ended') this.onEvent('dead', { by: bot.name, place: this.place, total: this.cpus.length + 1, time: this.time });
      }, 1700);
    }
  }

  endRound() {
    if (this.endShown) return; this.endShown = true;
    const survivors = this.alive();
    if (this.player.alive) { this.state = 'ended'; this.sfx.win(); this.onEvent('win', { survivors, total: this.cpus.length + 1, time: this.time }); }
    else { this.state = 'ended'; this.onEvent('end', { survivors, total: this.cpus.length + 1 }); }
  }

  cycleSpectate() { this.specIdx++; }

  /* ------------------------------ VISUALES ------------------------------ */
  updateVisuals(dt) {
    const cam = this.camera, p = this.player, t = this.time;
    let fx = p.x, fz = p.z;
    if (p.alive) {
      cam.position.set(p.x, 1.65 + p.y + Math.sin(p.bob) * (p.running ? 0.06 : 0.035) * (p.moving ? 1 : 0), p.z);
      cam.rotation.set(this.pitch, this.yaw, Math.sin(p.bob * 0.5) * 0.004 * (p.moving ? 1 : 0));
      if (this.flash) this.flash.position.set(0.14, -0.1 + Math.sin(p.bob) * 0.004, 0);
    } else {
      const alive = this.cpus.filter(c => c.alive);
      let tg = alive.length ? alive[this.specIdx % alive.length] : (this.killer || p);
      const yy = tg.yaw !== undefined ? tg.yaw : 0;
      cam.position.set(tg.x - Math.sin(yy) * 3.2, 2.5, tg.z - Math.cos(yy) * 3.2);
      cam.lookAt(tg.x, 1.3, tg.z); fx = tg.x; fz = tg.z;
      if (this.flash) this.flash.visible = false;
    }
    if (this.moon) {
      this.moon.target.position.set(fx, 0, fz);
      this.moon.position.set(fx + 22, 46, fz + 14);
    }

    // humanoides
    for (const c of this.cpus) {
      c.model.position.x = c.x; c.model.position.z = c.z;
      if (c.alive) { c.model.position.y = 0; c.model.rotation.y = c.yaw; animateHumanoid(c.model, dt, c.spd, false); }
      if (c.alive) { const d = Math.hypot(c.x - cam.position.x, c.z - cam.position.z); c.tag.visible = d < 26; }
    }
    const nowMs = performance.now();
    for (const m of this.animated || []) if (nowMs - (m.last || 0) > 50) { m.last = nowMs; m.update(); }
    // nextbots
    let nearest = 1e9; const act = [];
    for (const b of this.bots) {
      if (!b.active) continue;
      b.phase += dt * 7;
      b.mesh.material.color.setHex(b.stun > 0 ? 0x6f9bff : 0xffffff);
      b.halo.material.opacity = b.state === 'chase' ? 1 : b.state === 'search' ? 0.6 : 0.3;
      const ang = Math.atan2(cam.position.x - b.x, cam.position.z - b.z);
      const sc = 1 + Math.sin(b.phase * 1.3) * 0.05;
      b.mesh.position.set(b.x, 1.45 + Math.sin(b.phase) * 0.08, b.z);
      b.mesh.rotation.set(0, ang, Math.sin(b.phase * 0.7) * 0.06); b.mesh.scale.set(b.bw * sc, 2.5 * sc, 1);
      const dir = new THREE.Vector3(b.x - cam.position.x, 0, b.z - cam.position.z).normalize().multiplyScalar(0.12);
      b.halo.position.set(b.x + dir.x, 1.45, b.z + dir.z);
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (p.alive) nearest = Math.min(nearest, b.stun > 0 ? d * 3 : b.state === 'chase' && b.target === p ? d : b.state === 'search' ? d * 1.6 : d * 2.5);
      act.push({ b, d });
    }
    act.sort((a, b) => a.d - b.d);
    this.botLights.forEach((L, i) => {
      const a = act[i];
      if (a) { L.position.set(a.b.x, 1.6, a.b.z); L.intensity = 28; } else { L.intensity = 0; L.position.y = -50; }
    });
    this.updateVideoAudio();
    const threat = p.alive ? clamp(1 - (nearest - 4) / 36, 0, 1) : 0;
    this.sfx.setThreat(threat);
    $('vignette').style.opacity = (threat * threat * 0.95).toFixed(2);

    // lámparas cercanas
    this.lampT -= dt;
    if (this.lampT <= 0) {
      this.lampT = 0.35;
      const L = this.map.lamps.map(l => ({ l, d: (l.x - fx) ** 2 + (l.z - fz) ** 2 })).sort((a, b) => a.d - b.d);
      this.lampLights.forEach((li, i) => { const s = L[i]; if (s) li.position.set(s.l.x, s.l.y, s.l.z); else li.position.y = -50; });
    }
    const fl = this.def.flicker;
    for (const li of this.lampLights) {
      const u = li.userData;
      if (u.off > 0) { u.off -= dt; li.intensity = u.base * 0.08; }
      else { li.intensity = u.base; if (Math.random() < 0.004 * fl * 60 * dt) u.off = 0.05 + Math.random() * 0.25; }
    }
  }

  updateVideoAudio() {
    const cam = this.camera, ctx = this.sfx.ctx;
    let any = false;
    for (const m of this.memes.values()) {
      if (!m.video) continue;
      any = true;
      let best = null, bd = 1e9;
      for (const b of this.bots) {
        if (!b.active || b.meme !== m) continue;
        const d = Math.hypot(b.x - cam.position.x, b.z - cam.position.z);
        if (d < bd) { bd = d; best = b; }
      }
      if (m.panner) {
        if (best) {
          const P = m.panner;
          if (P.positionX) { P.positionX.value = best.x; P.positionY.value = 1.45; P.positionZ.value = best.z; } else P.setPosition(best.x, 1.45, best.z);
          m.gain.gain.value = 2.2;
        } else m.gain.gain.value = 0;
      } else m.video.volume = best ? clamp(1 - bd / 45, 0, 1) ** 2 : 0;
    }
    if (any && ctx) {
      const L = ctx.listener, d = cam.getWorldDirection(this._dir || (this._dir = new THREE.Vector3()));
      if (L.positionX) {
        L.positionX.value = cam.position.x; L.positionY.value = cam.position.y; L.positionZ.value = cam.position.z;
        L.forwardX.value = d.x; L.forwardY.value = d.y; L.forwardZ.value = d.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
      } else { L.setPosition(cam.position.x, cam.position.y, cam.position.z); L.setOrientation(d.x, d.y, d.z, 0, 1, 0); }
    }
  }

  /* ------------------------------ HUD ------------------------------ */
  updateHud() {
    $('hudTime').textContent = fmt(Math.max(0, this.round - this.time));
    $('hudAlive').textContent = `👥 ${this.alive()} / ${this.cpus.length + 1}`;
    const sig = this.inv ? this.inv.map((s, i) => (s ? s.type + s.ammo : '-') + (i === this.sel ? '*' : '')).join('|') : '';
    if (sig !== this._hbSig) {
      this._hbSig = sig;
      this.slotEls.forEach((el, i) => {
        const s = this.inv && this.inv[i];
        el.classList.toggle('empty', !s); el.classList.toggle('sel', !!s && i === this.sel);
        el.querySelector('b').textContent = s ? WEAPONS[s.type].name : ''; el.querySelector('span').textContent = s ? s.ammo : '';
      });
    }
    $('btnFire').style.visibility = this.weapon ? 'visible' : 'hidden';
    const rv = $('revive');
    if (this.reviveTarget && this.player.alive) {
      rv.classList.remove('hidden');
      $('reviveText').textContent = `${isTouch ? 'Mantén 💚' : 'Mantén E'} para revivir a ${this.reviveTarget.name}`;
      $('reviveFill').style.width = (this.reviveT / REVIVE_TIME * 100).toFixed(0) + '%';
    } else rv.classList.add('hidden');
    $('btnRevive').style.visibility = this.reviveTarget && this.player.alive ? 'visible' : 'hidden';
    const st = $('stamina'); st.style.width = (this.player.stamina * 100).toFixed(0) + '%'; st.classList.toggle('low', this.player.tired);
    this.drawMini();
    if (this.boardOpen) this.renderBoard();
  }

  toast(msg, ms = 2000) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('on'), ms);
  }

  feed(msg, me = false) {
    const f = $('feed'), d = document.createElement('div'); d.textContent = msg; if (me) d.className = 'me';
    f.appendChild(d); setTimeout(() => d.remove(), 7000);
    while (f.children.length > 6) f.firstChild.remove();
  }

  showBoard(on) { this.boardOpen = on; $('board').classList.toggle('hidden', !on); if (on) this.renderBoard(); }
  renderBoard() {
    const rows = [`<div class="${this.player.alive ? 'you' : 'dead'}">★ ${this.player.name} (tú)</div>`]
      .concat(this.cpus.map(c => `<div class="${c.alive ? '' : 'dead'}">${c.name}</div>`));
    $('board').innerHTML = rows.join('');
  }

  buildMini() {
    const c = this.miniBase = document.createElement('canvas'); c.width = c.height = 150;
    const x = c.getContext('2d'), s = 150 / N;
    x.fillStyle = '#0b0b0e'; x.fillRect(0, 0, 150, 150);
    for (let i = 0; i < N * N; i++) {
      const v = this.map.grid[i]; if (!v) continue;
      x.fillStyle = v === 1 ? '#6b6b78' : '#3a3a44';
      x.fillRect((i % N) * s, ((i / N) | 0) * s, s + 0.5, s + 0.5);
    }
    this.miniCtx = $('mini').getContext('2d');
  }

  drawMini() {
    const x = this.miniCtx, k = 150 / (N * CELL), p = this.player;
    x.clearRect(0, 0, 150, 150); x.drawImage(this.miniBase, 0, 0);
    for (const b of this.bots) {
      if (!b.active || Math.hypot(b.x - p.x, b.z - p.z) > 30) continue;
      x.fillStyle = b.state === 'chase' ? '#ff2a3d' : '#a8602a'; x.beginPath(); x.arc(b.x * k, b.z * k, 3, 0, 6.3); x.fill();
    }
    for (const c of this.cpus) if (!c.alive && Math.hypot(c.x - p.x, c.z - p.z) < 45) { x.fillStyle = '#3ddc84'; x.fillRect(c.x * k - 2, c.z * k - 2, 4, 4); }
    for (const pk of this.pickups || []) {
      if (pk.taken) continue;
      x.fillStyle = pk.type === 'bazooka' ? '#ff8a2b' : '#ffe14d';
      x.fillRect(pk.x * k - (pk.type === 'bazooka' ? 3 : 2), pk.z * k - (pk.type === 'bazooka' ? 3 : 2), pk.type === 'bazooka' ? 6 : 4, pk.type === 'bazooka' ? 6 : 4);
    }
    const px = p.x * k, pz = p.z * k, a = Math.atan2(-Math.cos(this.yaw), -Math.sin(this.yaw));
    x.save(); x.translate(px, pz); x.rotate(a); x.fillStyle = p.alive ? '#7fe3ff' : '#888';
    x.beginPath(); x.moveTo(6, 0); x.lineTo(-4, 4); x.lineTo(-4, -4); x.closePath(); x.fill(); x.restore();
  }

  pause() {
    if (this.state === 'playing' || this.state === 'dead') {
      this.prevState = this.state; this.state = 'paused'; this.sfx.suspend();
      for (const m of this.memes ? this.memes.values() : []) if (m.video) m.video.pause();
    }
  }
  unpause() {
    if (this.state === 'paused') {
      this.state = this.prevState || 'playing'; this.sfx.resume(); this.last = performance.now();
      for (const m of this.memes ? this.memes.values() : []) if (m.video) m.video.play().catch(() => {});
    }
  }
}
