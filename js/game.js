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
      this.cpus.push({ type: 'cpu', name, x: w.x, z: w.z, r: 0.4, alive: true, model, tag, skill, reactTime: rand(0.25, 1.3) * (1.4 - skill),
        react: 0, mode: 'wander', path: null, pi: 0, repath: 0, idle: Math.random() * 2, stamina: 1, tired: false, yaw: Math.random() * 6.28, spd: 0, lx: w.x, lz: w.z, stuckT: 0 });
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
        target: null, retarget: 0, path: null, pi: 0, repath: 0, lx: 0, lz: 0, stuckT: 0, phase: Math.random() * 6 });
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
    this.toast(`¡${b.name.toUpperCase()} te está buscando!`, 2600);
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
    if (wantRun && p.stamina > 0 && !p.tired) { speed = 8.4; p.stamina -= dt * 0.2; if (p.stamina <= 0) p.tired = true; }
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

  updateCpu(c, dt) {
    const W = this.world;
    if (!c.alive) { animateHumanoid(c.model, dt, 0, true); return; }
    let threat = null, td = 1e9;
    for (const b of this.bots) { if (!b.active) continue; const d = Math.hypot(b.x - c.x, b.z - c.z); if (d < td) { td = d; threat = b; } }
    const sight = c.skill > 0.65 ? 32 : 22;
    const sees = threat && td < sight && (td < 8 || W.los(c.x, c.z, threat.x, threat.z, 0.3));
    c.react = sees ? c.react + dt : Math.max(0, c.react - dt * 1.5);
    if (c.react > c.reactTime) {
      if (c.mode !== 'flee') { c.mode = 'flee'; c.repath = 0; }
      c.repath -= dt;
      if (!c.path || c.repath <= 0) { this.pickFlee(c, threat); c.repath = 0.7 + Math.random() * 0.6; }
    } else if (c.mode === 'flee' && (!threat || td > sight * 0.8)) { c.mode = 'wander'; c.path = null; c.idle = Math.random() * 1.5; }
    const flee = c.mode === 'flee';
    if (!flee) {
      if (c.idle > 0) c.idle -= dt;
      else if (!c.path || c.pi >= c.path.length) this.pickWander(c);
    }
    let sp = 0;
    if (c.path && c.pi < c.path.length && (flee || c.idle <= 0)) {
      const wp = c.path[c.pi], dx = wp.x - c.x, dz = wp.z - c.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { c.pi++; if (c.pi >= c.path.length) { c.path = null; if (!flee) c.idle = 0.5 + Math.random() * 2.5; } }
      else {
        if (flee) {
          if (c.stamina > 0 && !c.tired) { sp = 4.2 + c.skill * 2.2; c.stamina -= dt * 0.12; if (c.stamina <= 0) c.tired = true; } else sp = 3.4;
        } else { sp = 2.7; c.stamina = Math.min(1, c.stamina + dt * 0.12); if (c.tired && c.stamina > 0.3) c.tired = false; }
        W.move(c, dx / d * sp * dt, dz / d * sp * dt);
        const ty = Math.atan2(dx, dz); let da = ty - c.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
        c.yaw += da * Math.min(1, dt * 10);
      }
    } else c.stamina = Math.min(1, c.stamina + dt * 0.12);
    c.spd += (sp - c.spd) * Math.min(1, dt * 8);
    c.stuckT += dt;
    if (c.stuckT > 0.9) {
      if (sp > 0 && Math.hypot(c.x - c.lx, c.z - c.lz) < 0.3) { c.path = null; c.repath = 0; c.idle = 0; }
      c.lx = c.x; c.lz = c.z; c.stuckT = 0;
    }
  }

  pickWander(c) {
    const free = this.map.free, W = this.world;
    for (let t = 0; t < 8; t++) {
      const w = W.cellWorld(free[Math.floor(Math.random() * free.length)]);
      const d = Math.hypot(w.x - c.x, w.z - c.z);
      if (d < 8 || d > 40) continue;
      c.path = W.path(c.x, c.z, w.x, w.z); c.pi = 0;
      if (c.path.length) return;
    }
    c.idle = 1 + Math.random();
  }

  pickFlee(c, threat) {
    const free = this.map.free, W = this.world, n = 4 + Math.floor(c.skill * 12);
    let best = null, bs = -1e9;
    for (let i = 0; i < n; i++) {
      const w = W.cellWorld(free[Math.floor(Math.random() * free.length)]);
      const dMe = Math.hypot(w.x - c.x, w.z - c.z);
      if (dMe < 8 || dMe > 45) continue;
      let score = dMe;
      if (threat) { const dB = Math.hypot(w.x - threat.x, w.z - threat.z); if (dB < dMe) continue; score = dB - dMe * 0.4; }
      if (score > bs) { bs = score; best = w; }
    }
    if (!best) { this.pickWander(c); return; }
    c.path = W.path(c.x, c.z, best.x, best.z); c.pi = 0;
  }

  updateBot(b, dt) {
    if (!b.active) { if (this.time >= b.spawnAt) this.activateBot(b); return; }
    const W = this.world;
    b.retarget -= dt;
    if (b.retarget <= 0 || !b.target || !b.target.alive) {
      b.retarget = 0.8 + Math.random() * 0.4;
      let best = null, bd = 1e9;
      const cand = [this.player, ...this.cpus];
      for (const e of cand) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - b.x, e.z - b.z) * (e.type === 'player' ? 0.6 : 1);
        if (d < bd) { bd = d; best = e; }
      }
      b.target = best; b.path = null;
    }
    const t = b.target; if (!t) return;
    const sp = this.botSpeed();
    let tx = t.x, tz = t.z;
    if (!W.los(b.x, b.z, t.x, t.z, 0.45)) {
      b.repath -= dt;
      if (!b.path || b.repath <= 0) { b.path = W.path(b.x, b.z, t.x, t.z); b.pi = 0; b.repath = 0.45 + Math.random() * 0.25; }
      if (b.path.length) {
        while (b.pi < b.path.length - 1 && Math.hypot(b.path[b.pi].x - b.x, b.path[b.pi].z - b.z) < 0.7) b.pi++;
        tx = b.path[b.pi].x; tz = b.path[b.pi].z;
      }
    } else b.path = null;
    const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz) || 1;
    W.move(b, dx / d * sp * dt, dz / d * sp * dt);
    b.stuckT += dt;
    if (b.stuckT > 1) { if (Math.hypot(b.x - b.lx, b.z - b.lz) < 0.4) { b.path = null; b.repath = 0; } b.lx = b.x; b.lz = b.z; b.stuckT = 0; }
    // captura
    const dd = Math.hypot(t.x - b.x, t.z - b.z);
    if (dd < b.r + t.r + 0.35) this.kill(t, b);
    else for (const e of [this.player, ...this.cpus]) {
      if (e.alive && e !== t && Math.hypot(e.x - b.x, e.z - b.z) < b.r + e.r + 0.3) this.kill(e, b);
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
    if (!e.alive) return;
    e.alive = false;
    if (e.type === 'cpu') {
      e.tag.visible = false; this.sfx.thud(clamp(1 - Math.hypot(e.x - this.player.x, e.z - this.player.z) / 40, 0.03, 0.5));
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
      const ang = Math.atan2(cam.position.x - b.x, cam.position.z - b.z);
      const sc = 1 + Math.sin(b.phase * 1.3) * 0.05;
      b.mesh.position.set(b.x, 1.45 + Math.sin(b.phase) * 0.08, b.z);
      b.mesh.rotation.set(0, ang, Math.sin(b.phase * 0.7) * 0.06); b.mesh.scale.set(b.bw * sc, 2.5 * sc, 1);
      const dir = new THREE.Vector3(b.x - cam.position.x, 0, b.z - cam.position.z).normalize().multiplyScalar(0.12);
      b.halo.position.set(b.x + dir.x, 1.45, b.z + dir.z);
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (p.alive) nearest = Math.min(nearest, d);
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
      x.fillStyle = '#ff2a3d'; x.beginPath(); x.arc(b.x * k, b.z * k, 3, 0, 6.3); x.fill();
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
