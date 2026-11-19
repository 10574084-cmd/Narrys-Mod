// Escena 3D en vivo para el fondo del menú: humanoides corriendo y nextbots persiguiéndolos.
// El entorno (suelo, paredes, luces, niebla) cambia según el mapa elegido.
import * as THREE from 'three';
import { TEX } from './textures.js';
import { createHumanoid, animateHumanoid } from './models.js';
import { MEME_KINDS, makeMemeCanvas } from './memes.js';

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,60,60,0.9)'); g.addColorStop(0.5, 'rgba(255,0,0,0.25)'); g.addColorStop(1, 'rgba(255,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class TitleScene {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(55, 1, 0.1, 160);
    this.t = 0; this.running = false; this.env = null; this.def = null;

    this.faces = MEME_KINDS.map(k => {
      const tex = new THREE.CanvasTexture(makeMemeCanvas(k.id)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      return { name: k.name, tex };
    });
    this.glowTex = glowTexture();

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.8);
    this.lamp = new THREE.PointLight(0xffffff, 40, 34, 2); this.lamp.position.set(0, 6, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 0); this.sun.position.set(8, 16, 6);
    this.scene.add(this.hemi, this.lamp, this.sun);

    // humanoides que corren en círculo
    this.runners = [];
    for (let i = 0; i < 6; i++) {
      const h = createHumanoid(false); this.scene.add(h);
      this.runners.push({ h, a: (i / 6) * Math.PI * 2, r: 6 + (i % 2) * 1.8 });
    }
    // nextbots que los persiguen
    this.chasers = [];
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: this.faces[(i * 3) % this.faces.length].tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, fog: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), mat);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.8 }));
      glow.scale.set(5.4, 5.4, 1);
      this.scene.add(mesh, glow); this.chasers.push({ mesh, glow, i, face: (i * 3) % this.faces.length });
    }
    // nextbot gigante al fondo (cambia de cara)
    const bm = new THREE.MeshBasicMaterial({ map: this.faces[0].tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, fog: false });
    this.big = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), bm);
    this.bigGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.9 }));
    this.bigGlow.scale.set(24, 24, 1);
    this.scene.add(this.big, this.bigGlow); this.bigFace = 0; this.bigT = 0;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.r.setSize(w, h, false);
    this.cam.aspect = w / h;
    if (w > 900) this.cam.setViewOffset(w, h, -w * 0.18, 0, w, h); else this.cam.clearViewOffset();
    this.cam.updateProjectionMatrix();
  }

  clearEnv() {
    if (!this.env) return;
    this.scene.remove(this.env);
    this.env.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
    this.env = null;
  }

  setMap(def) {
    this.def = def; this.clearEnv();
    const env = new THREE.Group(), rand = rng(def.id.length * 977 + def.id.charCodeAt(0) * 31);
    this.scene.background = new THREE.Color(def.sky);
    this.scene.fog = new THREE.FogExp2(def.fog[0], Math.max(0.012, def.fog[1] * 0.8));
    this.hemi.color.setHex(def.hemi[0]); this.hemi.groundColor.setHex(def.hemi[1]); this.hemi.intensity = def.hemi[2] * 0.9;
    this.lamp.color.setHex(def.lamp.color); this.lamp.userData.base = def.lamp.int > 0 ? def.lamp.int * 1.6 : 20;
    if (def.moon) { this.sun.color.setHex(def.moon); this.sun.intensity = (def.sunInt || 0.9) * 0.9; } else this.sun.intensity = 0;

    // suelo
    const ft = TEX[def.tex.floor[0]](...def.tex.floor.slice(1));
    ft.repeat.set(90 / ft.userData.tileW, 90 / ft.userData.tileH);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; env.add(floor);

    // paredes del fondo y laterales
    const wt = TEX[def.tex.wall[0]](...def.tex.wall.slice(1));
    const baseH = def.indoor ? Math.max(def.wallH, 3.4) : Math.max(def.wallH, 3.2);
    const mats = [0.75, 1, 1.35].map(k => {
      const t = wt.clone(); t.needsUpdate = true; t.repeat.set(2.5 / wt.userData.tileW, (baseH * k) / wt.userData.tileH);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    });
    const addWall = (x, z) => {
      const k = Math.floor(rand() * 3), h = baseH * [0.75, 1, 1.35][k];
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.5, h, 2.5), mats[k]); m.position.set(x, h / 2, z); env.add(m);
    };
    for (let x = -32; x <= 32; x += 2.5) addWall(x, -26);
    for (let z = -23.5; z <= 6; z += 2.5) { addWall(-24, z); addWall(24, z); }
    // columnas o árboles sueltos al fondo
    const outdoorTrees = ['forest', 'hedge', 'island', 'flat'].includes(def.id);
    for (let i = 0; i < 10; i++) {
      const x = (rand() - 0.5) * 36, z = -6 - rand() * 16;
      if (Math.abs(x) < 3) continue;
      if (outdoorTrees) {
        const g = new THREE.Group(), s = 0.8 + rand() * 0.7;
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0x3d2a1a, roughness: 1 })); tr.position.y = 1.2;
        const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.4 * s, 3.4 * s, 9), new THREE.MeshStandardMaterial({ color: def.id === 'island' ? 0x2f8f3a : 0x1b4a26, roughness: 1 })); c1.position.y = 3.6;
        g.add(tr, c1); g.position.set(x, 0, z); env.add(g);
      } else {
        const col = new THREE.Mesh(new THREE.BoxGeometry(1.2, baseH, 1.2), mats[1]); col.position.set(x, baseH / 2, z); env.add(col);
      }
    }
    this.scene.add(env); this.env = env;
  }

  start() {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    const loop = now => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.update(dt); this.r.render(this.scene, this.cam);
    };
    requestAnimationFrame(loop);
  }

  pause() { this.running = false; }

  // el destello va justo detrás de la cara (evita que se pisen y se vean bandas)
  glowBehind(glow, p, off) {
    const dx = this.cam.position.x - p.x, dy = this.cam.position.y - p.y, dz = this.cam.position.z - p.z, l = Math.hypot(dx, dy, dz) || 1;
    glow.position.set(p.x - dx / l * off, p.y - dy / l * off, p.z - dz / l * off);
  }

  update(dt) {
    this.t += dt; const t = this.t, w = 0.85;
    for (const o of this.runners) {
      o.a += dt * w;
      o.h.position.set(Math.cos(o.a) * o.r, 0, Math.sin(o.a) * o.r);
      o.h.rotation.y = Math.atan2(-Math.sin(o.a), Math.cos(o.a));
      animateHumanoid(o.h, dt, 7, false);
    }
    const lead = this.runners[0].a;
    for (const c of this.chasers) {
      const a = lead - 0.7 - c.i * 0.75 - 0.18 * Math.sin(t * 0.9 + c.i * 2);
      const r = 6.8 + (c.i % 2) * 1.2;
      c.mesh.position.set(Math.cos(a) * r, 1.5 + Math.sin(t * 5 + c.i) * 0.1, Math.sin(a) * r);
      c.mesh.lookAt(this.cam.position.x, c.mesh.position.y, this.cam.position.z);
      c.mesh.rotation.z = Math.sin(t * 3 + c.i) * 0.07;
      const s = 1 + Math.sin(t * 6 + c.i) * 0.05; c.mesh.scale.set(s, s, 1);
      this.glowBehind(c.glow, c.mesh.position, 0.2);
      if (Math.floor(t / 5 + c.i * 0.7) !== c.lastSwap) { c.lastSwap = Math.floor(t / 5 + c.i * 0.7); c.face = (c.face + 1) % this.faces.length; c.mesh.material.map = this.faces[c.face].tex; c.mesh.material.needsUpdate = true; }
    }
    // nextbot gigante
    this.bigT += dt;
    if (this.bigT > 4.5) { this.bigT = 0; this.bigFace = (this.bigFace + 1) % this.faces.length; this.big.material.map = this.faces[this.bigFace].tex; this.big.material.needsUpdate = true; }
    this.big.position.set(Math.sin(t * 0.3) * 3, 6 + Math.sin(t * 0.8) * 0.5, -20);
    this.big.lookAt(this.cam.position.x, this.big.position.y, this.cam.position.z);
    const bs = 1 + Math.sin(t * 1.3) * 0.04; this.big.scale.set(bs, bs, 1);
    this.glowBehind(this.bigGlow, this.big.position, 0.6);
    // cámara en vaivén
    const th = Math.sin(t * 0.14) * 0.55;
    this.cam.position.set(Math.sin(th) * 14, 3.2 + Math.sin(t * 0.3) * 0.5, Math.cos(th) * 14);
    this.cam.lookAt(0, 1.8, 0);
    // luz con parpadeo según el mapa
    const base = this.lamp.userData.base || 30, fl = this.def ? this.def.flicker : 0;
    this.lamp.intensity = base * (Math.random() < fl * 0.04 ? 0.15 : 1);
  }
}
