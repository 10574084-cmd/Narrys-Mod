// Motor del juego: escena 3D, primera persona, jugadores CPU, nextbots, HUD
import * as THREE from 'three';
import { N, CELL, MAP_DEFS, generateMap, setMapSize } from './maps.js';
import { World } from './world.js';
import { TEX } from './textures.js';
import { createHumanoid, animateHumanoid, makeNameTag } from './models.js';
import { Sfx } from './audio.js';
import { DEFAULT_KEYS, DEFAULT_PERF, DEFAULT_EXTRA } from './settings.js';
import { CPU_NAMES } from './names.js';
import * as Shop from './shop.js';

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
const CPU_LOOT_DELAY = 10;
const BOSS_HP = 14000, EXE_HP = 5000, VERITY_HP = 10000, VERITY_SIZE = 2.2;
const bossIco = b => { const id = String(b && b.meme && b.meme.id); return id.startsWith('secret-exe-') ? '💀' : id === 'secret-verity' ? '🙂' : '🍫'; };
const PICKUP_RESPAWN = 60; // segundos hasta que reaparece un arma recogida (la bazuca no reaparece)
const RANK = { revolver: 1, smg: 1.5, shotgun: 2, sniper: 2.5, grenade: 2.8, bazooka: 3 };
const WEAPONS = {
  revolver: { name: 'REVÓLVER', zoom: 0.5, dmg: 6, ammo: 6, cd: 0.55, stun: 3.2, range: 60, tol: 1.15, grow: 0.0, beam: 0xffd24d, mini: '#ffe14d', pk: 3, cpu: 0.9, fp: [0.18, -0.15, -0.35] },
  smg:      { name: 'SUBFUSIL', zoom: 0.3, dmg: 2, ammo: 24, cd: 0.1, auto: true, stun: 1.3, range: 45, tol: 0.9, grow: 0.05, beam: 0xb0ff6b, mini: '#b0ff6b', pk: 2.4, cpu: 0.8, fp: [0.19, -0.16, -0.33] },
  shotgun:  { name: 'ESCOPETA', zoom: 0.35, dmg: 14, ammo: 4, cd: 0.95, stun: 4.5, range: 28, tol: 1.2, grow: 0.14, beam: 0x6bd8ff, mini: '#6bd8ff', pk: 1.7, cpu: 0.6, fp: [0.2, -0.17, -0.35] },
  sniper:   { name: 'FRANCOTIRADOR', tag: 'FRANCOT.', zoom: 2.2, scope: true, dmg: 40, ammo: 5, cd: 1.5, stun: 6, range: 150, tol: 0.45, grow: 0.0, beam: 0xc58bff, mini: '#c58bff', pk: 1.5, cpu: 0.55, fp: [0.2, -0.17, -0.42] },
  grenade:  { name: 'LANZAGRANADAS', tag: 'GRANADAS', zoom: 0.4, dmg: 30, ammo: 5, cd: 0.9, stun: 5, range: 70, tol: 1.2, grow: 0.0, beam: 0x7dff6b, mini: '#7dff6b', blast: 5, pk: 2, cpu: 0.65, fp: [0.21, -0.18, -0.4] },
  bazooka:  { name: 'BAZUCA', zoom: 0.9, dmg: 90, ammo: 2, cd: 1.3, stun: 7, range: 90, tol: 1.3, grow: 0.0, beam: 0xff5a2a, mini: '#ff8a2b', blast: 9, pk: 1.7, cpu: 0.6, fp: [0.2, -0.2, -0.45] },
};

function weaponModel(type) {
  const g = new THREE.Group();
  const M = (c, r = 0.45, m = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const steel = M(0x8b9096), blued = M(0x3c4350, 0.35, 0.8), dark = M(0x1d2024, 0.5, 0.6), wood = M(0x7a4a26, 0.75, 0.05), woodD = M(0x4e2f17, 0.8, 0.05),
    olive = M(0x4f5d3a, 0.7, 0.3), brass = M(0xc9a24a, 0.35, 0.8), red = M(0xb02a2a, 0.6, 0.1), poly = M(0x2a2d31, 0.7, 0.2);
  const box = (w, h, d, x, y, z, m, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
  const cyl = (r, l, x, y, z, m, seg = 14) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); g.add(o); return o; };
  if (type === 'revolver') {
    cyl(0.0145, 0.24, 0, 0.042, -0.15, blued, 16);                 // cañón
    box(0.012, 0.009, 0.24, 0, 0.06, -0.15, steel);                // cinta superior
    cyl(0.012, 0.15, 0, 0.018, -0.1, blued, 10);                   // varilla extractora
    box(0.007, 0.016, 0.012, 0, 0.072, -0.262, red);               // mira delantera
    box(0.036, 0.072, 0.1, 0, 0.012, 0.025, blued);                // armazón
    cyl(0.032, 0.066, 0, 0.022, -0.025, steel, 18);                // tambor
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; cyl(0.0068, 0.068, Math.cos(a) * 0.021, 0.022 + Math.sin(a) * 0.021, -0.025, dark, 8); } // recámaras
    box(0.01, 0.03, 0.02, 0, 0.06, 0.07, steel, -0.5);             // martillo
    box(0.008, 0.01, 0.07, 0, 0.082, 0.025, dark);                 // mira trasera
    box(0.008, 0.008, 0.055, 0, -0.034, 0.045, blued);             // guardamonte
    box(0.008, 0.03, 0.008, 0, -0.02, 0.018, blued);
    box(0.007, 0.022, 0.008, 0, -0.018, 0.04, dark, 0.3);          // gatillo
    box(0.038, 0.125, 0.052, 0, -0.075, 0.09, wood, -0.3);         // empuñadura
    box(0.04, 0.02, 0.054, 0, -0.14, 0.108, woodD, -0.3);          // culata
  } else if (type === 'shotgun') {
    cyl(0.0185, 0.78, 0, 0.034, -0.4, blued, 16);                  // cañón
    cyl(0.0155, 0.52, 0, 0.0, -0.31, steel, 12);                   // tubo del cargador
    box(0.008, 0.008, 0.78, 0, 0.056, -0.4, dark);                 // cinta de puntería
    cyl(0.0055, 0.01, 0, 0.066, -0.77, brass, 8);                  // mira de punta
    box(0.044, 0.085, 0.24, 0, 0.012, -0.02, dark);                // recibidor
    box(0.002, 0.03, 0.07, 0.023, 0.025, -0.03, steel);            // ventana de expulsión
    box(0.05, 0.05, 0.2, 0, -0.018, -0.33, wood);                  // guardamanos (corredera)
    for (let k = 0; k < 5; k++) box(0.052, 0.052, 0.008, 0, -0.018, -0.26 - k * 0.035, woodD); // estrías
    const st = box(0.04, 0.1, 0.3, 0, -0.03, 0.22, wood, 0.16);    // culata
    box(0.042, 0.11, 0.02, 0, -0.045, 0.375, dark, 0.16);          // plancha
    box(0.034, 0.07, 0.05, 0, -0.07, 0.07, wood, -0.35);           // empuñadura
    box(0.008, 0.008, 0.06, 0, -0.045, -0.04, dark);               // guardamonte
    box(0.007, 0.022, 0.008, 0, -0.03, -0.03, dark, 0.3);          // gatillo
    for (let k = 0; k < 3; k++) cyl(0.0095, 0.05, -0.026, 0.0 + k * 0.022 - 0.01, 0.055, red, 10); // cartuchos al costado
    void st;
  } else if (type === 'smg') {
    box(0.04, 0.075, 0.26, 0, 0.0, -0.06, poly);                   // cuerpo
    box(0.032, 0.045, 0.17, 0, 0.012, -0.24, dark);                // funda del cañón
    for (let k = 0; k < 4; k++) box(0.034, 0.012, 0.016, 0, 0.012, -0.18 - k * 0.035, blued); // ranuras
    cyl(0.011, 0.14, 0, 0.012, -0.38, blued, 10);                  // cañón
    box(0.03, 0.012, 0.22, 0, 0.045, -0.08, steel);                // riel superior
    box(0.006, 0.02, 0.008, 0, 0.062, -0.18, red);                 // mira delantera
    box(0.026, 0.02, 0.01, 0, 0.058, 0.03, dark);                  // mira trasera
    box(0.028, 0.17, 0.05, 0, -0.115, -0.04, blued, 0.12);         // cargador
    box(0.034, 0.1, 0.045, 0, -0.07, 0.07, poly, -0.28);           // empuñadura
    box(0.008, 0.008, 0.06, 0, -0.04, 0.0, dark);                  // guardamonte
    box(0.012, 0.012, 0.2, 0, 0.0, 0.2, steel);                    // culata de alambre
    box(0.012, 0.075, 0.012, 0, -0.03, 0.3, steel);
  } else if (type === 'sniper') {
    cyl(0.0135, 0.62, 0, 0.032, -0.52, blued, 14);                 // cañón largo
    cyl(0.02, 0.07, 0, 0.032, -0.84, dark, 10);                    // freno de boca
    box(0.04, 0.068, 0.3, 0, 0.012, -0.12, dark);                  // recibidor
    cyl(0.021, 0.24, 0, 0.098, -0.12, dark, 14);                   // mira telescópica
    cyl(0.028, 0.05, 0, 0.098, -0.26, blued, 14); cyl(0.026, 0.045, 0, 0.098, 0.02, blued, 14); // campanas
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.004, 14), new THREE.MeshStandardMaterial({ color: 0x4fb8ff, emissive: 0x1b6fa8, roughness: 0.1, metalness: 0.4 }));
    lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.098, -0.288); g.add(lens);
    box(0.012, 0.022, 0.025, 0, 0.065, -0.2, steel); box(0.012, 0.022, 0.025, 0, 0.065, -0.04, steel); // soportes
    box(0.044, 0.095, 0.34, 0, -0.025, 0.24, olive, 0.1);          // culata
    box(0.046, 0.03, 0.14, 0, 0.03, 0.3, olive);                   // apoyo de mejilla
    box(0.045, 0.1, 0.02, 0, -0.04, 0.42, dark, 0.1);              // plancha
    box(0.026, 0.07, 0.06, 0, -0.06, -0.06, blued);                // cargador
    box(0.034, 0.08, 0.045, 0, -0.07, 0.08, olive, -0.3);          // empuñadura
    cyl(0.006, 0.05, 0.036, 0.02, -0.01, steel, 8).rotation.set(0, 0, Math.PI / 2); // palanca del cerrojo
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), steel); knob.position.set(0.062, 0.02, -0.01); g.add(knob);
    box(0.006, 0.006, 0.16, 0.014, -0.025, -0.5, steel, 0); box(0.006, 0.006, 0.16, -0.014, -0.025, -0.5, steel, 0); // bípode plegado
  } else if (type === 'grenade') {
    cyl(0.04, 0.34, 0, 0.02, -0.2, olive, 16);                     // tubo
    cyl(0.046, 0.04, 0, 0.02, -0.38, red, 16);                     // banda roja de boca
    cyl(0.062, 0.1, 0, 0.0, 0.0, dark, 12);                        // tambor
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; cyl(0.009, 0.102, Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.0, steel, 8); }
    box(0.05, 0.08, 0.14, 0, 0.0, 0.1, dark);                      // armazón
    box(0.034, 0.1, 0.045, 0, -0.08, 0.1, poly, -0.25);            // empuñadura
    box(0.03, 0.1, 0.04, 0, -0.075, -0.22, poly);                  // agarre frontal
    box(0.012, 0.012, 0.2, 0, 0.0, 0.26, steel); box(0.012, 0.07, 0.012, 0, -0.03, 0.36, steel); // culata de alambre
    box(0.03, 0.05, 0.012, 0, 0.074, 0.02, steel);                 // mira plegable
    box(0.008, 0.02, 0.008, 0, 0.07, -0.34, red);
  } else { // bazuca
    cyl(0.07, 0.95, 0, 0.0, -0.4, olive, 18); cyl(0.088, 0.1, 0, 0, -0.9, dark, 18); cyl(0.088, 0.1, 0, 0, 0.07, dark, 18);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 14), M(0xc23b22, 0.5, 0.2)); cone.rotation.x = -Math.PI / 2; cone.position.set(0, 0, -1.05); g.add(cone);
    box(0.04, 0.12, 0.05, 0, -0.1, -0.35, dark); box(0.025, 0.05, 0.08, 0, 0.09, -0.5, dark);
  }
  return g;
}

// textura "matcap" para el arma en primera persona: se ve con volumen sin depender de las luces (la linterna la quemaba)
let _matcap = null;
function matcapTex() {
  if (_matcap) return _matcap;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(46, 38, 4, 64, 64, 66);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#e4e4ea'); gr.addColorStop(0.85, '#a0a0aa'); gr.addColorStop(1, '#62626c');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  _matcap = new THREE.CanvasTexture(c); _matcap.colorSpace = THREE.SRGBColorSpace; return _matcap;
}

// distancia de dibujado automática según el equipo
function autoDist() { const c = navigator.hardwareConcurrency || 4; return isTouch ? 70 : c <= 4 ? 90 : c <= 8 ? 130 : 190; }

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
    this.kb = { ...DEFAULT_KEYS }; this.perf = { ...DEFAULT_PERF }; this.extra = { ...DEFAULT_EXTRA }; this.runLatch = false; this.fpsCap = 0; this.dist = 0;
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
  // ¿esta tecla es la asignada a la acción? (Shift izquierdo y derecho cuentan igual)
  kbIs(code, act) { const k = this.kb[act]; return code === k || (act === 'run' && k.startsWith('Shift') && code.startsWith('Shift')); }
  held(act) { const k = this.kb[act]; return this.keys.has(k) || (act === 'run' && k.startsWith('Shift') && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))); }

  bindInput() {
    window.addEventListener('keydown', e => {
      if (this.state === 'menu') return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', this.kb.board, this.kb.jump].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      const is = a => this.kbIs(e.code, a);
      if (is('light') && this.flash) { this.flash.visible = !this.flash.visible; this.onEvent('stat', { k: 'light' }); }
      if (is('board')) this.showBoard(true);
      if (is('jump') && this.player && !this.player.alive) this.cycleSpectate();
      if (is('jump') && this.player && this.player.alive) this.jumpReq = true;
      if (is('run') && this.extra.runToggle) this.runLatch = !this.runLatch;
      for (let i = 1; i <= 6; i++) if (is('slot' + i) && this.state === 'playing' && this.player && this.player.alive && this.inv) this.equip(i - 1);
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); if (this.kbIs(e.code, 'board')) this.showBoard(false); });
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== this.canvas || this.state === 'menu') return;
      const s = this.sens * (this.sensMul || 1);
      this.yaw -= e.movementX * s; this.pitch = clamp(this.pitch + (this.extra.invert ? 1 : -1) * e.movementY * s, -1.45, 1.45);
    });
    document.addEventListener('pointerlockchange', () => {
      this.fireHeld = false;
      if (document.pointerLockElement !== this.canvas && (this.state === 'playing' || this.state === 'dead') && !isTouch) this.onEvent('pause');
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !isTouch && this.state === 'playing') this.onEvent('pause'); });

    // táctil
    const joy = $('joy'), knob = $('knob');
    let jid = null, jc = null;
    const jmove = e => {
      const k = jc.k || 1, R = 50 * k; // el joystick puede estar escalado desde Opciones
      const dx = clamp(e.clientX - jc.x, -R, R), dy = clamp(e.clientY - jc.y, -R, R);
      this.joy.x = dx / R; this.joy.y = dy / R;
      knob.style.transform = `translate(${dx / k}px,${dy / k}px)`;
    };
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2, k: r.width / 130 }; jmove(e); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
    const jend = e => { if (e.pointerId !== jid) return; jid = null; this.joy.x = this.joy.y = 0; knob.style.transform = ''; };
    joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
    let lid = null, lx = 0, ly = 0;
    this.canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || lid !== null) return; lid = e.pointerId; lx = e.clientX; ly = e.clientY; });
    this.canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== lid) return;
      const ts = this.touchSens || 1; this.yaw -= (e.clientX - lx) * this.sens * 1.6 * ts; this.pitch = clamp(this.pitch + (this.extra.invert ? 1 : -1) * (e.clientY - ly) * this.sens * 1.6 * ts, -1.45, 1.45);
      lx = e.clientX; ly = e.clientY;
    });
    const lend = e => { if (e.pointerId === lid) lid = null; };
    this.canvas.addEventListener('pointerup', lend); this.canvas.addEventListener('pointercancel', lend);
    $('btnRun').addEventListener('pointerdown', () => { this.sprintBtn = true; });
    $('btnRun').addEventListener('pointerup', () => { this.sprintBtn = false; });
    $('btnRun').addEventListener('pointerleave', () => { this.sprintBtn = false; });
    $('btnLight').addEventListener('pointerdown', () => { if (this.flash) { this.flash.visible = !this.flash.visible; this.onEvent('stat', { k: 'light' }); } });
    $('btnJump').addEventListener('pointerdown', () => { this.jumpReq = true; });
    $('btnFire').addEventListener('pointerdown', () => { this.fireReq = true; this.fireHeld = true; });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('btnFire').addEventListener(ev, () => { this.fireHeld = false; });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('btnRevive').addEventListener(ev, () => { this.reviveBtn = false; });
    $('btnRevive').addEventListener('pointerdown', () => { this.reviveBtn = true; });
    document.addEventListener('wheel', e => { if (document.pointerLockElement === this.canvas && this.state === 'playing' && this.inv && this.player.alive) this.cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
    this.slotEls = [0, 1, 2, 3, 4, 5].map(i => {
      const d = document.createElement('div'); d.className = 'slot empty'; d.innerHTML = `<i>${i + 1}</i><b></b><span></span>`;
      d.addEventListener('pointerdown', () => { if (this.state === 'playing' && this.inv) this.equip(i); });
      $('hotbar').appendChild(d); return d;
    });
    document.addEventListener('mousedown', e => {
      if (document.pointerLockElement !== this.canvas || this.state !== 'playing') return;
      const fb = this.extra.mouse === 'right' ? 2 : 0, ab = fb === 0 ? 2 : 0;
      if (e.button === fb) { this.fireReq = true; this.fireHeld = true; } else if (e.button === ab) this.aiming = this.extra.aimToggle ? !this.aiming : true;
    });
    document.addEventListener('mouseup', e => { if (e.button === (this.extra.mouse === 'right' ? 2 : 0)) this.fireHeld = false; const ab = this.extra.mouse === 'right' ? 0 : 2; if (e.button === ab && !this.extra.aimToggle) this.aiming = false; });
    document.addEventListener('contextmenu', e => { if (this.state === 'playing' || this.state === 'dead') e.preventDefault(); });
    $('btnAim').addEventListener('pointerdown', () => { this.aiming = !this.aiming; });
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

  applyScale(s) {
    this.curScale = s; const pr = this.baseDpr * s;
    this.renderer.setPixelRatio(pr);
    if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(window.innerWidth, window.innerHeight); }
  }

  /* ------------------------------ INICIO ------------------------------ */
  async start(opts, memePool) {
    this.stop();
    this.opts = opts;
    const def = this.def = opts.def || MAP_DEFS[opts.map];
    const q = this.q = { ...(Q[opts.quality] || Q.med) };
    const P = this.perf = { ...DEFAULT_PERF, ...(opts.perf || {}) }, X = this.extra = { ...DEFAULT_EXTRA, ...(opts.extra || {}) };
    this.kb = { ...DEFAULT_KEYS, ...(opts.keys || {}) }; this.runLatch = false;
    if (P.shadows === 'off') { q.shadows = false; q.cpuShadows = false; }
    if (P.lights === 'few') { q.lamps = Math.min(q.lamps, 1); q.botLights = Math.min(q.botLights, 1); }
    this.fpsCap = +P.fps || 0; this.dist = +P.dist < 0 ? autoDist() : (+P.dist || 0); this.autoRes = !!P.auto; this._fAcc = 0; this._fN = 0;
    this.baseDpr = Math.min(window.devicePixelRatio || 1, q.dpr); this.curScale = clamp(P.scale / 100, 0.4, 1);
    document.body.classList.toggle('noMini', !X.minimap); document.body.classList.toggle('noFeed', !X.feed);
    $('fpsBox').classList.toggle('hidden', !P.showFps);
    document.documentElement.style.setProperty('--cc', X.crossColor); document.documentElement.style.setProperty('--cs', (X.crossSize / 100).toFixed(2));
    this.sfx.setVolume(X.volume / 100);
    this.stopMusic();
    if (opts.music) { // música de fondo del jefe
      const a = this.music = new Audio(opts.music); a.loop = true; a.volume = Math.min(1, X.volume / 100 * 0.8); a.play().catch(() => {});
      if (opts.vocal) { const v = this.music2 = new Audio(opts.vocal); v.loop = true; v.volume = 0; v.play().catch(() => {}); } // voces: suenan al acercarte al jefe
    }
    this.sens = 0.0022 * opts.sens;
    const seed = opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0;
    this.guest = !!(opts.coop && opts.coop.role === 'guest'); this.coopHost = !!(opts.coop && opts.coop.role === 'host'); this.hold = false; this.snap = null; this.peerModel = null;
    setMapSize(opts.size || 48);
    this.map = generateMap(def, seed);
    this.world = new World(this.map);
    const r = this.renderer;
    r.setPixelRatio(this.baseDpr * this.curScale);
    r.shadowMap.enabled = q.shadows; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera.fov = this.baseFov = opts.fov; this.camera.far = this.dist ? this.dist + 30 : 260; this.camera.updateProjectionMatrix(); this.aiming = false; this.aimK = 0; this.sensMul = 1; this.fireHeld = false;
    this.buildScene();
    await this.setupPost();
    await this.buildMemes(opts.plan);
    this.intro = null; this.tele = []; this.darkT = 0; this._dark = null; this.spawnEntities();
    if (this.cheat('allWeapons')) for (const t of Object.keys(WEAPONS)) this.giveWeapon(t);
    this.camera.position.set(this.player.x, 1.65, this.player.z); this.updateChunks(true);
    this.buildMini();
    this.sfx.init(def.drone);
    this.freePick = true; this.chocoUsed = false; this.bossDead = false; this.time = 0; this.round = opts.dur; this.endShown = false; this.kills = 0; this.specIdx = 0;
    this.sceneT = 0; this.lampT = 0; this.stepT = 0;
    this.state = 'playing';
    this.resize();
    $('vignette').style.opacity = 0;
    if (!opts.intro) this.toast(opts.boss ? (opts.bossMsg || '🍫 ¡BOSS FIGHT! Derrota a ODIO EL CHOCOLATE con tus 100 CPUs') : '¡CORRE! Los nextbots llegan pronto…', 3500);
    if (this.coopHost) this.hold = true; // el anfitrión espera a que el amigo termine de cargar
    this.last = performance.now();
    this.raf = requestAnimationFrame(t => this.loop(t));
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.stopMusic();
    this.state = 'menu';
    if (this.composer) { try { this.composer.dispose(); } catch { /* nada */ } this.composer = null; }
    if (this.scene) {
      this.scene.traverse(o => {
        if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of ms) { if (m.userData.keep) continue; for (const k of ['map', 'emissiveMap', 'bumpMap']) if (m[k] && !m[k].userData.keep) m[k].dispose(); m.dispose(); }
      });
      if (this.scene.environment) this.scene.environment.dispose();
    }
    if (this.memes) { for (const m of this.memes.values()) { if (m.dispose) m.dispose(); if (m.tex) m.tex.dispose(); } this.memes = null; }
    this.animated = [];
    for (const o of [this.flash, this.flash && this.flash.target, this.muzzle, this.fpModel]) if (o) this.camera.remove(o);
    this.muzzle = null; this.fpModel = null; this.weapon = null; this.pickups = []; this.fx = []; this.inv = null; this.sel = -1;
    this.scene = null; this.cpus = []; this.bots = []; this.bossBot = null; this.flash = null;
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
    const hemi = this.hemi = new THREE.HemisphereLight(def.hemi[0], def.hemi[1], def.hemi[2]); scene.add(hemi);
    const size = N * CELL;
    const rt = !!q.rt;

    // suelo
    const ft = TEX[def.tex.floor[0]](...def.tex.floor.slice(1));
    ft.repeat.set(size / ft.userData.tileW, size / ft.userData.tileH);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: ft, roughness: rt ? 0.38 : 0.92, metalness: rt ? 0.15 : 0 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(size / 2, 0, size / 2); floor.receiveShadow = true;
    scene.add(floor); this.floorTex = ft;

    // techo (solo interiores)
    if (def.indoor) {
      const ct = TEX[def.tex.ceil[0]](...def.tex.ceil.slice(1));
      ct.repeat.set(size / ct.userData.tileW, size / ct.userData.tileH);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.95 }));
      ceil.rotation.x = Math.PI / 2; ceil.position.set(size / 2, def.ceilH, size / 2);
      scene.add(ceil);
    }

    // mapa glitch: trozos de suelo con las texturas de otros mapas
    if (map.texs) {
      const pg = new THREE.PlaneGeometry(CELL, CELL); pg.rotateX(-Math.PI / 2);
      map.srcDefs.forEach((sd, si) => {
        const cells = []; for (let i = 0; i < N * N; i++) if (map.texs[i] === si && map.grid[i] !== 1) cells.push(i);
        if (!cells.length) return;
        const t = TEX[sd.tex.floor[0]](...sd.tex.floor.slice(1)); t.repeat.set(CELL / t.userData.tileW, CELL / t.userData.tileH);
        const inst = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 }), cells.length);
        const d = new THREE.Object3D();
        cells.forEach((i, k) => { d.position.set(((i % N) + 0.5) * CELL, 0.02, (((i / N) | 0) + 0.5) * CELL); d.updateMatrix(); inst.setMatrixAt(k, d.matrix); });
        inst.receiveShadow = true; scene.add(inst);
      });
    }

    // paredes y objetos repartidos en chunks (trozos de CH×CH celdas): solo se construyen y dibujan los cercanos
    const wt = TEX[def.tex.wall[0]](...def.tex.wall.slice(1));
    const CH = 12, dummy = new THREE.Object3D(), col = new THREE.Color();
    this.CH = CH; this.chunkMap = new Map();
    const getChunk = (cx, cz) => {
      const k = cz * 1000 + cx; let c = this.chunkMap.get(k);
      if (!c) { c = { cx, cz, x: (cx + 0.5) * CH * CELL, z: (cz + 0.5) * CH * CELL, walls: new Map(), props: new Map(), group: null, built: false }; this.chunkMap.set(k, c); }
      return c;
    };
    for (let i = 0; i < N * N; i++) {
      if (map.grid[i] !== 1) continue;
      const x = i % N, z = (i / N) | 0;
      const solid = (a, b) => a < 0 || b < 0 || a >= N || b >= N || map.grid[b * N + a] === 1;
      if (solid(x + 1, z) && solid(x - 1, z) && solid(x, z + 1) && solid(x, z - 1)) continue;
      const key = Math.round(map.hgt[i] * 10) + (map.texs && map.texs[i] >= 0 ? ':' + map.texs[i] : '');
      const ch = getChunk((x / CH) | 0, (z / CH) | 0);
      if (!ch.walls.has(key)) ch.walls.set(key, []);
      ch.walls.get(key).push(i);
    }
    const wtCache = new Map(), wallStuff = new Map();
    const wallFor = key => { // material y geometría compartidos por todos los chunks
      let st = wallStuff.get(key); if (st) return st;
      const [hs, ts] = String(key).split(':'), h = +hs / 10;
      let wt0 = wt, indoor0 = def.indoor;
      if (ts !== undefined) { const sd = map.srcDefs[+ts]; wt0 = wtCache.get(ts) || TEX[sd.tex.wall[0]](...sd.tex.wall.slice(1)); wtCache.set(ts, wt0); indoor0 = sd.indoor; }
      const t = wt0.clone(); t.needsUpdate = true;
      t.repeat.set(CELL / wt0.userData.tileW, indoor0 ? 1 : h / wt0.userData.tileH);
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
      if (wt0.userData.emissive) {
        const e = wt0.userData.emissive.clone(); e.needsUpdate = true; e.repeat.copy(t.repeat);
        m.emissiveMap = e; m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 1.3;
      }
      st = { h, m, geo: new THREE.BoxGeometry(CELL, h, CELL) }; wallStuff.set(key, st); return st;
    };

    // objetos (cajas, árboles, coches, lámparas…) agrupados por forma
    const GEOS = {
      box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
      cone: new THREE.ConeGeometry(0.5, 1, 10), sphere: new THREE.SphereGeometry(0.5, 14, 10),
    };
    for (const p of map.props) {
      const cs = Math.cos(p.rot), sn = Math.sin(p.rot), ch = getChunk(Math.min(N - 1, Math.max(0, (p.x / CELL) | 0)) / CH | 0, Math.min(N - 1, Math.max(0, (p.z / CELL) | 0)) / CH | 0);
      for (const pt of p.parts) {
        const key = pt.s + (pt.e ? 'E' : '');
        if (!ch.props.has(key)) ch.props.set(key, []);
        ch.props.get(key).push({ p, pt, cs, sn });
      }
    }
    const propMats = new Map();
    const q4 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), pos = new THREE.Vector3(), mtx = new THREE.Matrix4();
    this.buildChunk = ch => {
      const g = new THREE.Group();
      for (const [key, list] of ch.walls) {
        const st = wallFor(key), inst = new THREE.InstancedMesh(st.geo, st.m, list.length);
        list.forEach((i, k) => {
          dummy.position.set(((i % N) + 0.5) * CELL, st.h / 2, (((i / N) | 0) + 0.5) * CELL);
          dummy.updateMatrix(); inst.setMatrixAt(k, dummy.matrix);
          const v = 0.82 + Math.random() * 0.18; inst.setColorAt(k, col.setRGB(v, v, v));
        });
        inst.castShadow = q.shadows; inst.receiveShadow = true; g.add(inst);
      }
      for (const [key, items] of ch.props) {
        const emi = key.endsWith('E'), shape = emi ? key.slice(0, -1) : key;
        let mat = propMats.get(key); if (!mat) { mat = emi ? new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }) : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }); propMats.set(key, mat); }
        const inst = new THREE.InstancedMesh(GEOS[shape], mat, items.length);
        items.forEach(({ p, pt, cs, sn }, k) => {
          pos.set(p.x + pt.dx * cs + pt.dz * sn, pt.dy, p.z - pt.dx * sn + pt.dz * cs);
          q4.setFromAxisAngle(up, p.rot); sc.set(pt.sx, pt.sy, pt.sz);
          mtx.compose(pos, q4, sc); inst.setMatrixAt(k, mtx); inst.setColorAt(k, col.setHex(pt.c));
        });
        inst.castShadow = !emi && q.shadows; inst.receiveShadow = !emi; g.add(inst);
      }
      scene.add(g); ch.group = g; ch.built = true;
    };
    this.chunkR = this.dist > 0 ? this.dist + 25 : (N > 100 ? 170 : Infinity); // distancia de dibujado (m)

    // animales muertos (sprites del mapa Green Hills .EXE): los de pie miran siempre a la cámara, los caídos van en el suelo
    if (map.sprites && map.sprites.length) {
      const loader = new THREE.TextureLoader(), texs = [];
      const AN = [[60, 72, 1.0], [60, 52, 0.8], [72, 80, 1.1], [80, 80, 1.0], [72, 80, 1.1], [80, 176, 2.0], [136, 196, 1.9], [196, 76, 1.5], [188, 100, 1.6]]; // ancho, alto (px), alto en metros
      for (const sp of map.sprites) {
        const [pw, ph, hm] = AN[sp.k] || AN[0];
        if (!texs[sp.k]) { const t = loader.load(`assets/exe/a${sp.k}.png`); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; texs[sp.k] = t; }
        const w = hm * pw / ph;
        if (sp.k >= 7) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hm), new THREE.MeshBasicMaterial({ map: texs[sp.k], transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xcc9a90 }));
          m.rotation.set(-Math.PI / 2, 0, sp.rot); m.position.set(sp.x, 0.07, sp.z); scene.add(m);
        } else {
          const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: texs[sp.k], alphaTest: 0.4, color: 0xcc9a90 }));
          m.center.set(0.5, 0); m.scale.set(w, hm, 1); m.position.set(sp.x, 0, sp.z); scene.add(m);
        }
      }
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
    this.fxLights = []; // luces de explosión reutilizables (siempre en la escena para no cambiar el nº de luces)
    for (let i = 0; i < 3; i++) { const L = new THREE.PointLight(0xff9040, 0, 40, 2); L.position.set(0, -50, 0); scene.add(L); this.fxLights.push(L); }
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
      const m = { id: e.id, name: e.name, aspect: e.aspect || 1, scare: e.thumb, update: null, dispose: null, tex: null };
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
  createBots(o) {
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
    this.bossBot = null;
    // ODIO EL CHOCOLATE (donde esté en el plan) es un jefe gigante con vida; tamaño y vida salen de las opciones
    const cc = o.choco || { size: 9, hp: BOSS_HP };
    for (const b of this.bots) if (b.meme && b.meme.id === 'secret-choco') this.makeBoss(b, cc.size, cc.hp);
    // Sonic.exe y sus amigos: jefes con 5000 de vida y el tamaño de un nextbot normal
    for (const b of this.bots) if (b.meme && String(b.meme.id).startsWith('secret-exe-')) { this.makeBoss(b, 2.6, EXE_HP * (o.hpMul || 1)); b.bw = clamp(2.6 * (b.meme.aspect || 0.7), 1.2, 4.2); }
    for (const b of this.bots) if (b.meme && b.meme.id === 'secret-verity') this.makeBoss(b, VERITY_SIZE, VERITY_HP * (o.hpMul || 1)); // Verity
    this.bossBot = this.bots.find(b => b.boss) || null;
    if (o.boss) this.bots.filter(b => b.boss).forEach((b, i) => { b.spawnAt = 6 + i * 3 + (o.bossDelay || 0); });
  }

  spawnEntities() {
    if (this.guest) return this.spawnGuest();
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
      const model = createHumanoid(this.q.cpuShadows && !o.boss);
      const tag = makeNameTag(name); model.add(tag);
      model.position.set(w.x, 0, w.z); this.scene.add(model);
      const skill = o.boss ? rand(0.65, 1) : rand(0.3, 1); // en los jefes los CPUs son más listos
      this.cpus.push({ type: 'cpu', name, x: w.x, z: w.z, r: 0.4, alive: true, model, tag, skill, reactTime: rand(0.15, 0.8) * (1.4 - skill),
        react: 0, mode: 'wander', path: null, pi: 0, repath: 0, idle: Math.random() * 2, stamina: 1, tired: false, yaw: Math.random() * 6.28, spd: 0, lx: w.x, lz: w.z, stuckT: 0,
        gun: null, gunModel: null, aim: 0, lostT: 0 });
    }

    this.createBots(o);
    if (this.coopHost) this.addRemoteCpu();
    if (o.intro) this.setupIntro();
    this.placeBought();
    if (o.boss) { // CPUs armados
      this.cpus.forEach((c, i) => {
        if (c.remote) return;
        const type = o.allBazooka ? 'bazooka' : o.armStrong ? (i < 25 ? 'bazooka' : i < 45 ? 'grenade' : i < 65 ? 'sniper' : 'shotgun') : i < 5 ? 'bazooka' : i < 12 ? 'grenade' : i < 22 ? 'sniper' : i < 40 ? 'shotgun' : i < 62 ? 'smg' : 'revolver';
        c.gun = { type, ammo: WEAPONS[type].ammo * (o.allBazooka ? 6 : o.armStrong ? 4 : 2), cd: 0.6 + Math.random() }; this.setCpuGunModel(c, type);
      });
    }
  }


  /* ============================ COOPERATIVO ============================ */
  coopSend(m) { if (this.net) this.net.send(m); }
  makeCpuObj(name, x, z) {
    const model = createHumanoid(false), tag = makeNameTag(name); model.add(tag);
    model.position.set(x, 0, z); this.scene.add(model);
    return { type: 'cpu', name, x, z, r: 0.4, alive: true, model, tag, skill: 0.5, reactTime: 1, react: 0, mode: 'wander', path: null, pi: 0, repath: 0, idle: 0, stamina: 1, tired: false, yaw: 0, spd: 0, lx: x, lz: z, stuckT: 0, gun: null, gunModel: null, aim: 0, lostT: 0 };
  }
  addRemoteCpu() {
    const P = this.player, sp = this.freeSpotNear(P.x, P.z, 2) || { x: P.x + 1, z: P.z };
    const c = this.makeCpuObj(this.opts.coop.friend || 'Amigo', sp.x, sp.z);
    c.remote = true; this.cpus.push(c);
  }
  coopPk() { return this.pickups.map(p => [p.type, Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100, p.taken ? 1 : 0, p.ammo, p.dropped ? 1 : 0]); }
  coopInit() {
    const rc = this.cpus.find(c => c.remote), P = this.player;
    return { names: this.cpus.map(c => c.name), self: this.cpus.indexOf(rc), sx: rc.x, sz: rc.z, yaw: this.yaw, hostName: P.name, pk: this.coopPk() };
  }
  setPickups(list) {
    list.forEach((e, i) => {
      let pk = this.pickups[i];
      if (!pk) { pk = this.makePickup(e[0], e[1], e[2], e[4]); pk.dropped = !!e[5]; this.pickups.push(pk); }
      pk.taken = !!e[3]; pk.mesh.visible = !pk.taken;
    });
  }
  spawnGuest() {
    const o = this.opts, I = o.coopInit;
    this.player = { type: 'player', name: o.name || 'Jugador', x: I.sx, z: I.sz, r: 0.35, alive: true, stamina: 1, tired: false, bob: 0, y: 0, vy: 0 };
    this.yaw = I.yaw; this.pitch = 0;
    this.weapon = null; this.pickups = []; this.fx = []; this.inv = [null, null, null, null, null, null]; this.sel = -1; this.emptyT = undefined; this._hbSig = '';
    this.reviveT = 0; this.reviveTarget = null; this.reviveBtn = false;
    this.setPickups(I.pk);
    this.cpus = I.names.map((n, i) => { const c = this.makeCpuObj(n, I.sx, I.sz); if (i === I.self) c.self = true; return c; });
    this.createBots(o);
    const pm = createHumanoid(false); pm.add(makeNameTag(I.hostName || 'Anfitrión')); pm.position.set(I.sx, 0, I.sz); pm.visible = false; this.scene.add(pm);
    this.peerModel = { m: pm, x: I.sx, z: I.sz, yaw: 0, alive: true, spd: 0 };
  }
  coopTick(dt) { // anfitrión: manda el estado del mundo ~15 veces por segundo
    if (!this.coopHost || !this.net) return;
    this._ct = (this._ct || 0) + dt; if (this._ct < 1 / 15) return; this._ct = 0;
    const r = v => Math.round(v * 100) / 100, c = [];
    for (const e of this.cpus) c.push(r(e.x), r(e.z), r(e.yaw || 0), e.alive ? 1 : 0, r(e.spd || 0));
    const b = this.bots.map(x => [x.active ? 1 : 0, r(x.x), r(x.z), Math.round(x.hp || 0), x.stun > 0 ? 1 : 0, x.state === 'chase' ? 1 : x.state === 'search' ? 2 : 0, x.dead ? 1 : 0]);
    const P = this.player;
    this.net.send({ t: 's', tm: r(this.time), c, b, h: [r(P.x), r(P.z), r(this.yaw), P.alive ? 1 : 0] });
    const sig = this.pickups.length + ':' + this.pickups.map(p => p.taken ? 1 : 0).join('');
    if (sig !== this._pkSig) { this._pkSig = sig; this.net.send({ t: 'pk', l: this.coopPk() }); }
  }
  coopSendPos(dt) { // invitado: manda su posición ~20 veces por segundo
    this._cp = (this._cp || 0) + dt; if (this._cp < 0.05) return;
    const p = this.player, r = v => Math.round(v * 100) / 100, sp = Math.hypot(p.x - (this._lpx ?? p.x), p.z - (this._lpz ?? p.z)) / this._cp;
    this._lpx = p.x; this._lpz = p.z; this._cp = 0;
    this.coopSend({ t: 'p', x: r(p.x), z: r(p.z), yaw: r(this.yaw), s: r(Math.min(sp, 12)) });
  }
  coopMsg(m) {
    const rc = this.cpus && this.cpus.find(c => c.remote);
    if (this.coopHost) {
      if (m.t === 'p' && rc && rc.alive) { rc.x = m.x; rc.z = m.z; rc.yaw = m.yaw + Math.PI; rc.spd = m.s; }
      else if (m.t === 'fire') this.coopFire(m);
      else if (m.t === 'leave' && rc && rc.alive) { rc.alive = false; rc.tag.visible = false; this.feed(`🔌 ${rc.name} salió de la partida`); }
    } else if (this.guest) {
      if (m.t === 's') this.snap = m;
      else if (m.t === 'pk') this.setPickups(m.l);
      else if (m.t === 'give') this.giveWeapon(m.type, m.ammo);
      else if (m.t === 'feed') this.feed(m.m);
      else if (m.t === 'toast') this.toast(m.m, m.ms || 2200);
      else if (m.t === 'dead') this.coopDead(m);
      else if (m.t === 'end') this.coopEnd(m);
    }
  }
  coopFire(m) { // el invitado disparó: el anfitrión aplica el efecto
    const rc = this.cpus.find(c => c.remote); if (!rc || !rc.alive) return;
    if (m.k === 'blast') { const def = WEAPONS[m.w]; if (def && def.blast) this.explode(m.x, m.y, m.z, def, rc.name); }
    else if (m.k === 'boss') { const b = this.bots[m.i]; if (b && b.boss) this.hitBoss(b, Math.min(200, +m.dmg || 0)); }
    else if (m.k === 'stun') { const b = this.bots[m.i]; if (b && !b.boss) { const was = b.stun > 0; this.stunBot(b, Math.min(8, +m.s || 3)); if (!was) this.feed(`⚡ ${rc.name} aturdió a ${b.name}`); } }
  }
  coopDead(m) {
    const bot = this.bots.find(b => b.name === m.by) || this.bots[0];
    this.player.alive = false; this.state = 'dead'; this.killer = bot; this.place = m.place;
    this.feed(`💀 Te atrapó ${m.by}`, true); this.sfx.scare(); this.sfx.setThreat(0);
    const img = $('scareImg'); img.src = bot.meme.scare;
    $('scare').classList.remove('hidden'); $('vignette').style.opacity = 0; this.showBoard(false); this.specIdx = 0;
    setTimeout(() => { $('scare').classList.add('hidden'); if (this.state === 'dead' || this.state === 'ended') this.onEvent('dead', { by: m.by, place: m.place, total: this.cpus.length + 1, time: this.time }); }, 1700);
  }
  coopEnd(m) {
    if (this.endShown) return; this.endShown = true; this.stopMusic(); this.bossDead = !!m.bd; this.state = 'ended';
    if (m.ty === 'win') { this.sfx.win(); this.onEvent('win', m.d); } else this.onEvent('end', m.d);
  }
  coopApply(dt) { // invitado: aplica la última foto del mundo con suavizado
    const s = this.snap; if (!s) return;
    const k = Math.min(1, dt * 14), ang = (a, b) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };
    this.time = s.tm;
    this.cpus.forEach((c, i) => {
      const o = i * 5; if (o + 4 >= s.c.length) return;
      const tx = s.c[o], tz = s.c[o + 1];
      if (!c.init) { c.x = tx; c.z = tz; c.init = true; } else { c.x += (tx - c.x) * k; c.z += (tz - c.z) * k; }
      c.yaw = ang(c.yaw, s.c[o + 2]); c.alive = !!s.c[o + 3]; c.spd = s.c[o + 4];
      if (!c.alive) { c.tag.visible = false; animateHumanoid(c.model, dt, 0, true); }
    });
    s.b.forEach((e, i) => {
      const b = this.bots[i]; if (!b) return;
      const was = b.dead; b.active = !!e[0] && !e[6]; b.dead = !!e[6]; b.hp = e[3]; b.stun = e[4] ? 1 : 0; b.state = e[5] === 1 ? 'chase' : e[5] === 2 ? 'search' : 'patrol';
      if (e[0] && !b.init) { b.x = e[1]; b.z = e[2]; b.init = true; } else { b.x += (e[1] - b.x) * k; b.z += (e[2] - b.z) * k; }
      b.mesh.visible = b.active; b.halo.visible = b.active;
      if (b.dead && !was) { this.explode(b.x, (b.bh || 2.5) / 2, b.z, { blast: 0, stun: 0, dmg: 0 }, b.name); this.sfx.win(); this.toast('🏆 ¡JEFE DERROTADO!', 3000); }
    });
    const pm = this.peerModel, h = s.h;
    if (pm) {
      const dx = h[0] - pm.x, dz = h[1] - pm.z; pm.spd = Math.min(10, Math.hypot(dx, dz) * 15); pm.x += dx * k; pm.z += dz * k; pm.yaw = ang(pm.yaw, h[2] + Math.PI); pm.alive = !!h[3];
      pm.m.visible = pm.alive; pm.m.position.set(pm.x, 0, pm.z); pm.m.rotation.y = pm.yaw; animateHumanoid(pm.m, dt, pm.spd, false);
    }
  }
  updateGuest(dt) {
    this.updatePlayer(dt); this.updateWeapons(dt); this.coopApply(dt);
    this.updateVisuals(dt); this.updateHud(); this.coopSendPos(dt);
  }

  // construye/oculta chunks según la distancia a la cámara (force: construye todos los cercanos de golpe)
  updateChunks(force = false) {
    if (!this.chunkMap) return;
    const c = this.camera.position, R = this.chunkR, half = this.CH * CELL * 0.72; let budget = force ? 1e9 : 3;
    for (const ch of this.chunkMap.values()) {
      const d = Math.hypot(ch.x - c.x, ch.z - c.z) - half, vis = d < R;
      if (vis && !ch.built && budget > 0) { this.buildChunk(ch); budget--; }
      else if (!vis && ch.built && d > R * 1.8) { ch.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); this.scene.remove(ch.group); ch.group = null; ch.built = false; } // lejísimos: se descarga
      if (ch.group) ch.group.visible = vis;
    }
  }

  // armas compradas en la tienda: aparecen en el suelo alrededor del jugador
  placeBought() {
    const list = this.opts.bought || []; if (!list.length) return;
    const P = this.player, W = this.world; let k = 0;
    for (const type of list) {
      for (let t = 0; t < 40; t++, k++) {
        const ang = k * 2.4, rad = 2.2 + Math.floor(k / 8) * 1.2, x = P.x + Math.cos(ang) * rad, z = P.z + Math.sin(ang) * rad;
        if (W.collides(x, z, 0.4)) continue;
        this.pickups.push(this.makePickup(type, x, z, null, true)); k++; break;
      }
    }

  }

  // intro del jefe final: el jugador mira a los jefes "solo"; llegan los CPUs con bazucas y le regalan una
  setupIntro() {
    const P = this.player, m = N >> 1, C = m * CELL + CELL / 2;
    P.x = C; P.z = (m - 8) * CELL + CELL / 2; this.yaw = Math.PI; this.pitch = 0.04;
    const spots = [[-6, 20], [0, 18], [6, 20], [-11, 30], [11, 26]]; // x relativo, metros por delante
    const ex = this.bots.filter(b => String(b.meme.id).startsWith('secret-exe-')), others = this.bots.filter(b => !String(b.meme.id).startsWith('secret-exe-'));
    const order = [...ex, ...others];
    order.forEach((b, i) => {
      const [dx, dz] = spots[i % spots.length];
      b.x = C + dx; b.z = P.z + dz; b.lx = b.x; b.lz = b.z; b.active = true; b.mesh.visible = true; b.halo.visible = true; b.state = 'patrol'; b.stateT = 0;
    });
    this.cpus.forEach((c, i) => {
      const col = i % 16, row = Math.floor(i / 16);
      c.x = C + (col - 7.5) * 1.4; c.z = P.z - 40 - row * 1.8; c.yaw = 0; c.spd = 0; c.lx = c.x; c.lz = c.z;
      if (i === 0) { c.x = C + 1; c.z = P.z - 30; }
      c.slotX = C + (col - 7.5) * 1.9; c.slotZ = P.z - 2.2 - row * 2.0;
      if (i === 0) { c.slotX = C + 2.2; c.slotZ = P.z - 0.6; }
      c.sp = 9.5 + Math.random() * 2; c.go = 4 + Math.random() * 1.2; c.done = false;
    });
    this.intro = { t: 0, C, f: {} };
  }

  updateIntro(dt) {
    const I = this.intro, P = this.player, t = I.t += dt, ease = x => x * x * (3 - 2 * x), cl = (x, a, b) => Math.min(b, Math.max(a, x));
    this.fireReq = false; this.fireHeld = false;
    let yaw = Math.PI;
    if (t >= 12) yaw = Math.PI * ease(cl((t - 12) / 1.4, 0, 1));
    else if (t >= 5) yaw = Math.PI * (1 - ease(cl((t - 5) / 1.6, 0, 1)));
    this.yaw = yaw; this.pitch = 0.04;
    const once = (k, fn) => { if (!I.f[k]) { I.f[k] = 1; fn(); } };
    if (t > 0.6) once('a', () => this.toast('😰 Estás solo… contra TODOS los jefes', 4000));
    if (t > 5.3) once('b', () => this.toast('…¿o no? 👀', 2500));
    for (const c of this.cpus) {
      if (!c.alive || t < c.go) { continue; }
      const g = this.cpus[0] === c, tx = g && !I.f.gift ? P.x + 0.3 : c.slotX, tz = g && !I.f.gift ? P.z - 2.2 : c.slotZ;
      const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
      if (d > 0.3) {
        const st = Math.min(d, c.sp * dt); c.x += dx / d * st; c.z += dz / d * st;
        const ty = Math.atan2(dx, dz); let da = ty - c.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); c.yaw += da * Math.min(1, dt * 12);
        c.spd += (c.sp - c.spd) * Math.min(1, dt * 8);
      } else {
        c.spd += (0 - c.spd) * Math.min(1, dt * 8);
        const ty = g && !I.f.gift ? Math.atan2(P.x - c.x, P.z - c.z) : 0; let da = ty - c.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); c.yaw += da * Math.min(1, dt * 8);
        if (g && !I.f.gift && t > 7) { I.f.gift = t; this.giveWeapon('bazooka', 6); this.feed(`🎁 ${c.name} le regaló una BAZUCA a ${P.name}`, true); this.toast(`🎁 ¡${c.name} te regaló una BAZUCA!`, 3000); }
      }
    }
    if (I.f.gift && t > I.f.gift + 3.5) once('c', () => this.toast('🚀 ¡TODOS TIENEN BAZUCA!', 2500));
    if (I.f.gift && t > I.f.gift + 5.5 && t > 13.4) this.endIntro();
    this.updateVisuals(dt); this.updateHud();
  }

  endIntro() {
    this.intro = null; this.yaw = Math.PI; this.pitch = 0;
    for (const c of this.cpus) { c.mode = 'wander'; c.path = null; c.idle = 0; c.react = 0; c.lx = c.x; c.lz = c.z; c.spd = 0; }
    for (const b of this.bots) { b.target = null; b.retarget = 0; }
    this.toast(this.opts.bossMsg || '¡BOSS FIGHT!', 3500);
  }

  // 1 bazuca en todo el mapa + 8 armas más (5 revólveres y 3 escopetas)
  spawnPickups(pick, pw) {
    const W = this.world;
    this.weapon = null; this.pickups = []; this.fx = []; this.inv = [null, null, null, null, null, null]; this.sel = -1; this.emptyT = undefined; this._hbSig = '';
    this.reviveT = 0; this.reviveTarget = null; this.reviveBtn = false;
    const k = Math.min(6, (N / 48) ** 2); // más mapa = más armas (con tope)
    const n = (t, c) => Array(Math.round(c)).fill(t);
    const list = this.opts.boss ? [...n('bazooka', 3), ...n('revolver', 8), ...n('smg', 6), ...n('shotgun', 8), ...n('sniper', 4), ...n('grenade', 4)]
      : ['bazooka', ...n('revolver', 10 * k), ...n('smg', 5 * k), ...n('shotgun', 8 * k), ...n('sniper', 3 * k), ...n('grenade', 3 * k)];
    const wl = this.opts.weapons; if (wl && !wl.length) setTimeout(() => this.toast('🔒 Aún no tienes armas: desbloquéalas comprándolas en 🛒 Tienda', 4500), 4000);
    // solo aparecen las armas desbloqueadas en la tienda
    for (const type of wl ? list.filter(t => wl.includes(t)) : list) {
      let spot = null;
      for (let t = 0; t < 80 && !spot; t++) {
        const c = W.cellWorld(pick());
        const minP = type === 'bazooka' ? 22 : 7;
        if (Math.hypot(c.x - pw.x, c.z - pw.z) < minP) continue;
        if (this.pickups.some(p => Math.hypot(p.x - c.x, p.z - c.z) < 6)) continue;
        spot = c;
      }
      if (!spot) spot = W.cellWorld(pick());
      this.pickups.push(this.makePickup(type, spot.x, spot.z));
    }
  }

  // arma en el suelo con su rayo de luz. 'ammo' solo se indica en armas soltadas por un CPU
  makePickup(type, x, z, ammo = null, free = false) {
    const def = WEAPONS[type], mesh = new THREE.Group();
    const model = weaponModel(type); model.scale.setScalar(def.pk); model.position.y = 1.0; mesh.add(model);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 8, 1, true), new THREE.MeshBasicMaterial({ color: def.beam, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    beam.position.y = 2.6; mesh.add(beam);
    const price = !free && ammo === null && this.opts.priced ? Shop.FLOOR_PRICE[type] || 0 : 0;
    if (price) { const tag = makeNameTag('🪙 ' + price); tag.position.y = 2.4; tag.scale.set(1.2, 0.3, 1); mesh.add(tag); }
    mesh.position.set(x, 0, z); this.scene.add(mesh);
    return { type, x, z, mesh, model, taken: false, ph: Math.random() * 6, ammo, dropped: ammo !== null, price };
  }

  // un CPU que muere con arma la deja a su lado, con la munición que le quedaba
  dropCpuGun(c) {
    const all = this.cpuGuns(c).filter(g => g.ammo > 0); c.gun = null; c.stash = []; this.setCpuGunModel(c, null);
    if (!all.length) return;
    const offs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7]];
    all.forEach((g, i) => {
      let x = c.x, z = c.z;
      for (let k = 0; k < offs.length; k++) {
        const [dx, dz] = offs[(i + k) % offs.length], m = 1 + Math.floor(i / 8) * 0.6;
        if (!this.world.collides(c.x + dx * m, c.z + dz * m, 0.3)) { x = c.x + dx * m; z = c.z + dz * m; break; }
      }
      this.pickups.push(this.makePickup(g.type, x, z, g.ammo));
    });
    this.feed(`🔫 ${c.name} soltó ${all.length > 1 ? all.length + ' armas' : 'su ' + WEAPONS[all[0].type].name}`);
  }

  showWeaponModel(type) {
    if (this.fpModel) { this.camera.remove(this.fpModel); this.fpModel = null; }
    this.rainbowMats = [];
    if (!type) return;
    const m = this.fpModel = weaponModel(type);
    m.traverse(o => { // material con volumen que no depende de las luces
      if (!o.isMesh) return;
      const old = o.material, em = old.emissive && old.emissive.getHex() ? old.emissive.clone() : null;
      o.material = new THREE.MeshMatcapMaterial({ color: old.color.clone().multiplyScalar(em ? 1 : 2.3), matcap: matcapTex(), depthTest: false, depthWrite: false, transparent: true });
      if (em) o.material.color.lerp(em, 0.6);
      const sk = this.opts && this.opts.skin; // skin comprada en la tienda
      if (sk && (sk.tint || sk.rainbow) && !em) { if (sk.tint) o.material.color.lerp(new THREE.Color(sk.tint), 0.75); else (this.rainbowMats = this.rainbowMats || []).push(o.material); }
      o.renderOrder = 999; old.dispose();
    });
    this.fpBase = new THREE.Vector3(...WEAPONS[type].fp);
    m.position.copy(this.fpBase); m.rotation.y = 0.05;
    this.camera.add(m);
  }

  // recoger: si ya tienes ese arma se suma munición (máx. x3); si no, va al primer slot libre y se equipa
  // mantén E (o el botón 💚) cerca del cuerpo de un CPU para revivirlo
  updateRevive(dt) {
    const p = this.player; let target = null, bd = REVIVE_RANGE;
    if (p.alive && !this.guest) for (const c of this.cpus) {
      if (c.alive || c.remote) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bd) { bd = d; target = c; }
    }
    if (target !== this.reviveTarget) this.reviveT = 0;
    this.reviveTarget = target;
    if (target && (this.held('revive') || this.reviveBtn)) {
      this.reviveT += dt;
      if (this.reviveT >= REVIVE_TIME) { this.revive(target); this.reviveT = 0; this.reviveTarget = null; }
    } else this.reviveT = Math.max(0, this.reviveT - dt * 2);
  }

  revive(c) {
    c.alive = true; c.invuln = 3; c.mode = 'wander'; c.path = null; c.idle = 0.6; c.react = 0; c.lostT = 0;
    c.stamina = 1; c.tired = false; c.spd = 0; c.aim = 0; c.gun = null; c.stash = []; this.setCpuGunModel(c, null);
    c.model.userData.fall = 0; c.model.rotation.x = 0; c.model.position.y = 0; c.tag.visible = true;
    this.onEvent('stat', { k: 'revive' });
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
    this.onEvent('stat', { k: 'pickup', type, count: this.inv.filter(Boolean).length });
  }

  // equipar un slot (pulsar el mismo slot otra vez guarda el arma)
  equip(i, force = false) {
    const s = this.inv[i]; if (!s) return;
    if (this.sel === i && !force) { this.sel = -1; this.weapon = null; this.showWeaponModel(null); return; }
    this.sel = i; this.weapon = s; s.cd = Math.max(s.cd, 0.25); this.recoil = 0.6; this.emptyT = undefined;
    this.showWeaponModel(s.type);
  }

  cycleWeapon(dir) {
    const idx = this.inv.map((_, i) => i).filter(i => this.inv[i]); if (!idx.length) return;
    const cur = idx.indexOf(this.sel);
    this.equip(cur < 0 ? (dir > 0 ? idx[0] : idx[idx.length - 1]) : idx[(cur + dir + idx.length) % idx.length], true);
  }

  fire() {
    const w = this.weapon, def = w && WEAPONS[w.type], p = this.player, cam = this.camera;
    if (!w || !p.alive || w.cd > 0 || w.ammo <= 0) return;
    if (!this.cheat('ammo')) w.ammo--; w.cd = def.cd; this.recoil = 1; // cheat: munición infinita
    this.onEvent('stat', { k: 'shot', type: w.type, aiming: this.aimK > 0.5 });
    const d = cam.getWorldDirection(this._wd || (this._wd = new THREE.Vector3()));
    // impacto contra nextbots (la mira se tolera según el arma)
    let best = null, bt = def.range;
    for (const b of this.bots) {
      if (!b.active) continue;
      const vx = b.x - cam.position.x, vy = (b.boss ? b.bh / 2 : 1.45) - cam.position.y, vz = b.z - cam.position.z;
      const t = vx * d.x + vy * d.y + vz * d.z;
      if (t < 0 || t > def.range) continue;
      const dist = Math.hypot(vx - d.x * t, vy - d.y * t, vz - d.z * t);
      if (dist > def.tol * (1 - 0.35 * (this.aimK || 0)) + def.grow * t + (b.boss ? b.bw * 0.4 : 0)) continue;
      if (!this.world.los(p.x, p.z, b.x, b.z, 0.1)) continue;
      if (t < bt) { bt = t; best = b; }
    }
    // distancia hasta la primera pared
    let wt = def.range;
    for (let t = 0.6; t < def.range; t += 0.5) {
      const y = cam.position.y + d.y * t;
      if (y < 0.05 || this.world.collides(cam.position.x + d.x * t, cam.position.z + d.z * t, 0.05)) { wt = t; break; }
    }
    const loud = !!def.blast;
    this.sfx.burst(loud ? 0.5 : 0.18, loud ? 260 : 1400, loud ? 0.9 : 0.8, 0.7, loud ? 'lowpass' : 'bandpass');
    this.muzzleT = 0.07;
    if (loud) {
      const t = Math.min(wt, bt);
      const ex = cam.position.x + d.x * t, ey = Math.max(0.3, cam.position.y + d.y * t), ez = cam.position.z + d.z * t;
      if (this.guest) this.coopSend({ t: 'fire', k: 'blast', w: w.type, x: ex, y: ey, z: ez });
      this.explode(ex, ey, ez, def);
    } else if (best && bt <= wt) {
      if (this.guest) this.coopSend(best.boss ? { t: 'fire', k: 'boss', i: this.bots.indexOf(best), dmg: def.dmg } : { t: 'fire', k: 'stun', i: this.bots.indexOf(best), s: def.stun });
      if (best.boss) this.hitBoss(best, def.dmg);
      else { const was = best.stun > 0; this.stunBot(best, def.stun); if (!was) { this.toast(`¡${best.name.toUpperCase()} aturdido!`, 1200); this.onEvent('stat', { k: 'stun' }); } }
    }
    if (w.ammo <= 0) this.emptyT = 0.6;
  }

  stunBot(b, secs) { if (b.boss || this.guest) return; b.stun = secs; b.path = null; }

  banish(b, secs) {
    if (this.guest) return;
    const free = this.map.free, W = this.world, P = this.player;
    let best = null, bd = -1;
    for (let k = 0; k < 30; k++) {
      const c = W.cellWorld(free[Math.floor(Math.random() * free.length)]);
      const d = Math.hypot(c.x - P.x, c.z - P.z);
      if (d > bd) { bd = d; best = c; }
    }
    b.spawnedAt = this.time; b.x = best.x; b.z = best.z; b.lx = b.x; b.lz = b.z; b.path = null; b.stun = secs; b.state = 'patrol'; b.goalX = null; b.target = null;
    if (b.boss) b.stun = Math.min(secs, 2);
  }

  explode(x, y, z, def, by = null) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat); s.position.set(x, y, z);
    const L = (this.fxLights || []).find(l => !l.userData.busy);
    if (L) { L.userData.busy = true; L.position.set(x, y + 0.5, z); L.intensity = 200; }
    this.scene.add(s); this.fx.push({ s, L, t: 0 });
    this.sfx.burst(1.3, 110, by ? Math.max(0.08, 1 - Math.hypot(x - this.player.x, z - this.player.z) / 60) : 1.0, 0.6, 'lowpass');
    let hit = 0;
    for (const b of this.bots) {
      if (!b.active) continue;
      if (b.boss) { if (Math.hypot(b.x - x, b.z - z) < def.blast + b.bw / 2 && def.dmg) this.hitBoss(b, def.dmg); continue; }
      if (Math.hypot(b.x - x, b.z - z) < def.blast) { this.banish(b, def.stun); hit++; this.feed(by ? `💥 ${by} desterró a ${b.name}` : `💥 ${b.name} fue desterrado por la bazuca`, !by); }
    }
    if (!by) this.toast(hit ? `¡BOOM! ${hit} nextbot${hit > 1 ? 's' : ''} desterrado${hit > 1 ? 's' : ''}` : '¡BOOM!', 1500);
  }

  updateWeapons(dt) {
    const p = this.player, w = this.weapon;
    // recogida de armas
    const rcp = this.coopHost && this.cpus.find(c => c.remote && c.alive);
    if (rcp) for (const pk of this.pickups) if (!pk.taken && Math.hypot(pk.x - rcp.x, pk.z - rcp.z) < 1.5) { pk.taken = true; pk.takenAt = this.time; pk.mesh.visible = false; this.coopSend({ t: 'give', type: pk.type, ammo: pk.ammo }); }
    if (p.alive && !this.guest) for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - p.x, pk.z - p.z) < 1.5) {
        if (pk.price && !this.freePick) { if (!Shop.spend(pk.price)) { if (this.time - (this._poorT || -9) > 2) { this._poorT = this.time; this.toast(`🪙 Te faltan monedas: cuesta ${pk.price} 🪙 (tienes ${Shop.coins()})`, 2000); } continue; } this.toast(`-${pk.price} 🪙 · ${WEAPONS[pk.type].name}`, 1500); }
        else if (pk.price) { this.freePick = false; this.toast('🎁 ¡Tu primera arma de la ronda es gratis!', 2200); }
        pk.taken = true; pk.takenAt = this.time; pk.mesh.visible = false; this.giveWeapon(pk.type, pk.ammo); }
    }
    if (!this.guest) for (const pk of this.pickups) if (pk.taken && !pk.dropped && (pk.type !== 'bazooka' || this.opts.boss) && this.time - pk.takenAt >= (this.opts.boss ? 20 : PICKUP_RESPAWN)) this.respawnPickup(pk);
    for (const pk of this.pickups) if (!pk.taken) { pk.ph += dt * 2; pk.model.rotation.y += dt * 1.6; pk.model.position.y = 1.0 + Math.sin(pk.ph) * 0.12; }
    // disparo
    if (this.fireHeld && w && WEAPONS[w.type].auto && p.alive) this.fireReq = true; // armas automáticas: mantener para disparar
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
      const a = this.aimK || 0; // al apuntar, el arma se centra en la pantalla
      this.fpModel.position.set(this.fpBase.x * (1 - a), this.fpBase.y + 0.045 * a + bob * (1 - a) - this.recoil * 0.02, this.fpBase.z - 0.04 * a + this.recoil * 0.12);
      this.fpModel.rotation.x = this.recoil * 0.25;
    }
    // apuntar (clic derecho / botón 🎯): zoom, menos sensibilidad y más precisión
    const aimOn = !!(this.aiming && this.weapon && p.alive && this.state === 'playing');
    if (!aimOn && this.aiming && (!this.weapon || !p.alive)) this.aiming = false;
    this.aimK = (this.aimK || 0) + ((aimOn ? 1 : 0) - (this.aimK || 0)) * Math.min(1, dt * 14);
    if (Math.abs(this.aimK) < 0.003) this.aimK = 0;
    const zm = this.weapon ? WEAPONS[this.weapon.type].zoom : 0, z = 1 + this.aimK * zm;
    this.sensMul = 1 / z;
    const nf = this.baseFov / z;
    if (Math.abs(this.camera.fov - nf) > 0.05) { this.camera.fov = nf; this.camera.updateProjectionMatrix(); }
    const cr = $('cross'); cr.classList.toggle('armed', !!this.weapon); cr.classList.toggle('aim', this.aimK > 0.5);
    const scoped = !!(this.weapon && WEAPONS[this.weapon.type].scope && this.aimK > 0.85);
    $('scope').classList.toggle('hidden', !scoped); if (this.fpModel) this.fpModel.visible = !scoped; if (scoped) cr.classList.remove('aim', 'armed');
    if (this.muzzle) { this.muzzleT = Math.max(0, (this.muzzleT || 0) - dt); this.muzzle.intensity = this.muzzleT > 0 ? 40 : 0; }
    // explosiones
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.t += dt;
      const k = f.t / 0.5;
      f.s.scale.setScalar(0.5 + k * 8); f.s.material.opacity = Math.max(0, 0.9 * (1 - k)); if (f.L) f.L.intensity = Math.max(0, 200 * (1 - k));
      if (k >= 1) { this.scene.remove(f.s); if (f.L) { f.L.userData.busy = false; f.L.intensity = 0; f.L.position.y = -50; } f.s.geometry.dispose(); f.s.material.dispose(); this.fx.splice(i, 1); }
    }
  }

  activateBot(b) {
    const free = this.map.free, W = this.world, P = this.player;
    const ref = P.alive ? P : (this.cpus.find(c => c.alive) || P);
    let best = null, bd = -1;
    for (let k = 0; k < 30; k++) {
      const c = W.cellWorld(free[Math.floor(Math.random() * free.length)]);
      let d = Math.hypot(c.x - ref.x, c.z - ref.z);
      if (this.opts.boss) d = -Math.abs(d - 22); // en los boss fights aparece cerca (~22 m) para que sea fácil encontrarlo
      if (!best || d > bd) { bd = d; best = c; }
    }
    b.x = best.x; b.z = best.z; b.lx = b.x; b.lz = b.z; b.active = true; b.mesh.visible = true; b.halo.visible = true;
    b.state = 'patrol'; b.goalX = null; b.stateT = 0;
    this.toast(`¡${b.name.toUpperCase()} apareció!`, 2200); this.coopSend({ t: 'toast', m: `¡${b.name.toUpperCase()} apareció!` });
    this.sfx.spawn();
  }

  // cheats: solo en partidas normales sin cooperativo ni jefes (y solo si se desbloquearon)
  cheat(k) { const o = this.opts; return !!(o && o.cheats && o.cheats[k] && !o.boss && !o.coop); }
  botSpeed() { return (this.cheat('slow') ? 0.5 : 1) * 6.0 * DIFF[this.opts.diff] * (1 + 0.35 * Math.min(1, this.time / this.round)); }

  alive() { return (this.guest ? ((this.snap && this.snap.h[3]) ? 1 : 0) : (this.player.alive ? 1 : 0)) + this.cpus.filter(c => c.alive).length; }

  /* ------------------------------ BUCLE ------------------------------ */
  loop(now) {
    this.raf = requestAnimationFrame(t => this.loop(t));
    if (this.fpsCap && now - this.last < 1000 / this.fpsCap - 3) return; // límite de FPS
    const raw = now - this.last, dt = Math.min(0.05, raw / 1000); this.last = now;
    this._fAcc += raw; this._fN++;
    if (this._fAcc >= 1000) { // medición de FPS (cada ~1 s) y resolución automática
      const fps = this._fN * 1000 / this._fAcc; this._fAcc = 0; this._fN = 0;
      if (this.perf.showFps) $('fpsBox').textContent = Math.round(fps) + ' FPS' + (this.curScale < 0.995 ? ` · ${Math.round(this.curScale * 100)}%` : '');
      if (this.autoRes && (this.state === 'playing' || this.state === 'dead')) {
        const target = this.fpsCap || 60;
        if (fps < target * 0.55 && this.curScale > 0.5) this.applyScale(Math.max(0.5, this.curScale - 0.1));
        else if (fps > target * 0.93 && this.curScale < this.perf.scale / 100 - 0.001) this.applyScale(Math.min(this.perf.scale / 100, this.curScale + 0.05));
      }
    }
    if (this.state === 'playing' || this.state === 'dead') this.update(dt);
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    if (this.state === 'paused' || this.hold) return;
    this.time += dt;
    if (this.def.glitch && this.scene) { // mapa final: colores y suelo parpadean
      this.glT = (this.glT || 0) - dt;
      if (this.glT <= 0) {
        this.glT = 0.15 + Math.random() * 0.5;
        const col = new THREE.Color().setHSL(Math.random(), 0.9, 0.3 + Math.random() * 0.3);
        this.scene.background = col; this.scene.fog.color.copy(col); if (this.hemi) this.hemi.color.setHSL(Math.random(), 0.8, 0.7);
        if (this.floorTex) this.floorTex.offset.set(Math.random(), Math.random());
      }
    }
    this.chunkT = (this.chunkT || 0) - dt; if (this.chunkT <= 0 && this.scene) { this.chunkT = 0.25; this.updateChunks(); }
    if (this.rainbowMats && this.rainbowMats.length) { const h = (this.time * 0.35) % 1; for (const m of this.rainbowMats) m.color.setHSL(h, 0.9, 0.55); }
    if (this.guest) { this.updateGuest(dt); return; }
    if (this.tele && this.tele.length) this.updateTele(dt);
    if (this.darkT !== undefined && this.scene) { // apagón de Verity
      const dk = this.darkT > 0; if (dk) this.darkT -= dt;
      if (dk && !this._dark) { this._dark = { f: this.scene.fog.density, h: this.hemi.intensity }; }
      if (this._dark) { const k = this.darkT > 0 ? 1 : 0; this.scene.fog.density += ((k ? this._dark.f * 5 : this._dark.f) - this.scene.fog.density) * Math.min(1, dt * 3); this.hemi.intensity += ((k ? this._dark.h * 0.2 : this._dark.h) - this.hemi.intensity) * Math.min(1, dt * 3); if (!k && Math.abs(this.scene.fog.density - this._dark.f) < 1e-4) { this.scene.fog.density = this._dark.f; this.hemi.intensity = this._dark.h; this._dark = null; } }
    }
    if (this.intro) { this.time -= dt; this.updateIntro(dt); return; }
    if (this.player.invuln > 0) this.player.invuln -= dt;
    this.updatePlayer(dt);
    this.updateWeapons(dt);
    this.updateRevive(dt);
    for (const c of this.cpus) this.updateCpu(c, dt);
    for (const b of this.bots) this.updateBot(b, dt);
    this.separate();
    this.updateVisuals(dt);
    this.updateHud();
    this.coopTick(dt);
    if (!this.endShown && this.time >= this.round) this.endRound();
  }

  updatePlayer(dt) {
    const p = this.player, k = this.keys;
    if (!p.alive) return;
    const K = this.kb;
    let f = (k.has(K.fwd) || k.has('ArrowUp') ? 1 : 0) - (k.has(K.back) || k.has('ArrowDown') ? 1 : 0) - this.joy.y;
    let s = (k.has(K.right) || k.has('ArrowRight') ? 1 : 0) - (k.has(K.left) || k.has('ArrowLeft') ? 1 : 0) + this.joy.x;
    const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    const moving = len > 0.05;
    if (!moving) this.runLatch = false; // correr «alternar»: se suelta al detenerte
    const wantRun = (this.held('run') || this.runLatch || this.sprintBtn) && moving;
    let speed = this.cheat('speed') ? 8.0 : 5.0;
    if (wantRun && p.stamina > 0 && !p.tired) { speed = this.cheat('speed') ? 16 : 10.2; p.stamina -= dt * 0.1; if (p.stamina <= 0) { p.tired = true; this.onEvent('stat', { k: 'tired' }); } }
    else { p.stamina = Math.min(1, p.stamina + dt * (moving ? 0.1 : 0.2)); if (p.tired && p.stamina > 0.3) p.tired = false; }
    const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw);
    const dx = (-sn * f + cs * s) * speed * dt, dz = (-cs * f - sn * s) * speed * dt;
    this.world.move(p, dx, dz);
    // salto
    if (this.jumpReq && p.y === 0) { p.vy = 5.4; this.sfx.thud(0.12); this.onEvent('stat', { k: 'jump' }); }
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
    m.scale.setScalar(WEAPONS[type].cpu); m.rotation.y = Math.PI; m.position.set(0.24, 1.12, 0.18);
    c.model.userData.body.add(m); c.gunModel = m;
  }

  // los CPUs pueden llevar varias armas (hasta 6 espacios, como el jugador): c.gun es la activa y c.stash el resto
  cpuGuns(c) { return c.gun ? [c.gun, ...(c.stash || [])] : (c.stash || []); }
  cpuWants(c, type) {
    const all = this.cpuGuns(c), same = all.find(g => g.type === type);
    if (same) return same.ammo < WEAPONS[type].ammo * 2;
    return all.length < 6;
  }
  cpuPick(c) { // equipa la mejor arma con munición
    const all = this.cpuGuns(c).filter(g => g.ammo > 0).sort((a, b) => RANK[b.type] - RANK[a.type]);
    const prev = c.gun && c.gun.type; c.gun = all[0] || null; c.stash = all.slice(1);
    if ((c.gun && c.gun.type) !== prev) this.setCpuGunModel(c, c.gun ? c.gun.type : null);
  }
  cpuTake(c, pk) {
    const def = WEAPONS[pk.type], got = pk.ammo ?? def.ammo;
    pk.taken = true; pk.takenAt = this.time; pk.mesh.visible = false;
    const same = this.cpuGuns(c).find(g => g.type === pk.type);
    if (same) same.ammo = Math.min(def.ammo * 3, same.ammo + got);
    else { (c.stash = c.stash || []).push({ type: pk.type, ammo: Math.min(def.ammo * 3, got), cd: 0.6 }); }
    this.cpuPick(c);
    this.feed(`🔫 ${c.name} recogió ${def.name}`);
  }

  cpuFire(c, b, d) {
    const g = c.gun, def = WEAPONS[g.type];
    g.ammo--; g.cd = def.cd * (1.0 + (1 - c.skill) * 0.4); c.aim = 0;
    const dp = Math.hypot(c.x - this.player.x, c.z - this.player.z);
    if (dp < 45) this.sfx.burst(def.blast ? 0.4 : 0.15, def.blast ? 260 : 1400, clamp(1 - dp / 45, 0.05, 1) * 0.6, 0.7, def.blast ? 'lowpass' : 'bandpass');
    const p = clamp(1.0 - d * 0.009 * (1.3 - c.skill), 0.45, 0.97); // más precisión cuanto más hábil y más cerca
    if (Math.random() < (b.boss ? Math.min(0.95, p + 0.25) : p)) {
      if (b.boss && !def.blast) this.hitBoss(b, def.dmg);
      else if (def.blast) this.explode(b.x, b.boss ? 3 : 1.4, b.z, def, c.name);
      else { this.stunBot(b, def.stun); this.feed(`🔫 ${c.name} aturdió a ${b.name}`); }
    }
    if (g.ammo <= 0) this.cpuPick(c); // se le acabó: pasa a otra arma si tiene
  }

  // busca el arma más cercana que le interese (solo si no hay nextbots cerca)
  cpuLoot(c) {
    if (this.time < CPU_LOOT_DELAY) return false; // al iniciar, los CPU esperan antes de buscar armas
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
    if (c.remote) { if (!c.alive) animateHumanoid(c.model, dt, 0, true); return; } // el amigo lo controla él mismo
    if (!c.alive) { animateHumanoid(c.model, dt, 0, true); return; }
    if (c.invuln > 0) c.invuln -= dt;
    // esquiva las zonas de peligro marcadas en el suelo (meteoritos de chocolate, pisotones)
    const hz = this.tele && this.tele.length ? this.tele.find(e => e.danger && Math.hypot(e.x - c.x, e.z - c.z) < e.r + 1.5) : null;
    if (hz) {
      c.hzT = (c.hzT || 0) + dt;
      if (c.hzT > (1 - c.skill) * 0.3) {
        let dx = c.x - hz.x, dz = c.z - hz.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
        const sp = 8.5 + c.skill * 3, ox = c.x, oz = c.z;
        W.move(c, dx * sp * dt, dz * sp * dt);
        if (Math.hypot(c.x - ox, c.z - oz) < sp * dt * 0.3) W.move(c, -dz * sp * dt, dx * sp * dt); // bloqueado: se escapa de lado
        let da = Math.atan2(dx, dz) - c.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); c.yaw += da * Math.min(1, dt * 12);
        c.spd += (sp - c.spd) * Math.min(1, dt * 8); c.path = null; c.mode = 'flee';
        return;
      }
    } else c.hzT = 0;
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
      if (sd >= (def.blast ? 6 : 0) && sd <= def.range * 0.95 && !(sd < (seen.boss ? 9 : 4) && g.cd > 0)) { // dispara a cualquier distancia; si está muy cerca y recargando, corre
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
    if (this.time >= CPU_LOOT_DELAY) for (const pk of this.pickups) if (!pk.taken && Math.hypot(pk.x - c.x, pk.z - c.z) < 1.4 && this.cpuWants(c, pk.type)) { this.cpuTake(c, pk); break; }
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
    if (b.dead) return; // jefe derrotado: no vuelve
    if (!b.active) { if (this.time >= b.spawnAt) this.activateBot(b); return; }
    if (b.stun > 0) { b.stun -= dt; return; }
    if (b.boss) return this.updateBoss(b, dt);
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

  makeBoss(b, size, hp) {
    size = clamp(+size || 9, 2, 40); hp = clamp(Math.round(+hp || BOSS_HP), 1, 10000000);
    Object.assign(b, { boss: true, hpMax: hp, hp, bw: size, bh: size, r: Math.min(1.2, 0.35 + 0.09 * size), killR: Math.max(1.2, size * 0.42), flash: 0 });
    b.halo.scale.set(size * 1.45, size * 1.45, 1);
  }

  // jefe: persigue al jugador/CPU más cercano (no necesita verlo), se enfurece al perder vida
  updateBoss(b, dt) {
    const P = this.player; let sp = 6.8 + (1 - b.hp / b.hpMax) * 2.8;
    if (this.opts.bossRamp) sp *= Math.min(1, 0.45 + 0.55 * (this.time - (b.spawnedAt || 0)) / this.opts.bossRamp); // arranca lento para que los CPUs puedan organizarse
    b.retarget -= dt;
    if (b.retarget <= 0 || !b.target || !b.target.alive) {
      b.retarget = 0.6; let best = null, bd = 1e9;
      for (const e of [P, ...this.cpus]) { if (!e.alive) continue; const d = Math.hypot(e.x - b.x, e.z - b.z); if (d < bd) { bd = d; best = e; } }
      b.target = best;
    }
    b.state = 'chase';
    const busy = this.bossPhase(b, dt);
    if (!busy && b.target) { b.lastX = b.target.x; b.lastZ = b.target.z; this.botGo(b, b.target.x, b.target.z, sp * (this.darkT > 0 ? 1.25 : 1), dt); }
    for (const e of [P, ...this.cpus]) {
      if (e.alive && Math.hypot(e.x - b.x, e.z - b.z) < b.killR + e.r) this.kill(e, b);
    }
  }

  /* ---- fases y ataques propios de cada jefe (se activan al 66 % y al 33 % de vida) ---- */
  addTele(x, z, r, T, fn, col = 0xff2020, danger = false) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.07, z); m.scale.set(r, r, 1); this.scene.add(m);
    this.tele.push({ m, x, z, r, t: 0, T, fn, danger });
  }
  updateTele(dt) {
    for (let i = this.tele.length - 1; i >= 0; i--) {
      const e = this.tele[i]; e.t += dt;
      e.m.material.opacity = 0.2 + 0.3 * Math.abs(Math.sin(e.t * 9)); e.m.scale.setScalar(e.r * (0.4 + 0.6 * Math.min(1, e.t / e.T)));
      if (e.t >= e.T) { this.scene.remove(e.m); e.m.geometry.dispose(); e.m.material.dispose(); this.tele.splice(i, 1); e.fn(e); }
    }
  }
  killIn(x, z, r, by) { for (const e of [this.player, ...this.cpus]) if (e.alive && Math.hypot(e.x - x, e.z - z) < r + e.r) this.kill(e, by); }
  freeSpotNear(x, z, rad) {
    for (let t = 0; t < 30; t++) { const a = Math.random() * 6.28, px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad; if (!this.world.collides(px, pz, 0.8)) return { x: px, z: pz }; }
    return null;
  }
  bossPhase(b, dt) {
    const ratio = b.hp / b.hpMax, ph = ratio < 0.33 ? 3 : ratio < 0.66 ? 2 : 1;
    if (ph !== (b.fase || 1)) { b.fase = ph; b.atkT = 2.5; b.flash = 0.6; this.toast(`⚠️ ${b.name}: ¡FASE ${ph}!`, 2600); this.feed(`⚠️ ${b.name} entró en la FASE ${ph}`, true); this.sfx.spawn(); }
    if ((b.fase || 1) < 2) return false;
    const id = b.meme && b.meme.id, tg = b.target;
    if (b.busy > 0) { // en pleno ataque: no persigue
      b.busy -= dt;
      if (b.dash > 0) { b.dash -= dt; const sp = 30 * dt; this.world.move(b, b.dx * sp, b.dz * sp); }
      return true;
    }
    b.atkT = (b.atkT == null ? 3 : b.atkT) - dt;
    if (b.atkT > 0 || !tg) return false;
    const hard = ph === 3;
    if (id === 'secret-exe-sonic') { // DASH: se carga y atraviesa el mapa en línea recta
      const dx = tg.x - b.x, dz = tg.z - b.z, d = Math.hypot(dx, dz) || 1; b.dx = dx / d; b.dz = dz / d; b.busy = 1.4; b.dash = 0.5; b.atkT = hard ? 3.5 : 6;
      b.mesh.material.color.setHex(0xff4040);
      this.addTele(b.x + b.dx * 7, b.z + b.dz * 7, 3, 0.9, () => {}, 0xff2020);
      b.dash = 0; setTimeout(() => { if (!b.dead) b.dash = 0.5; }, 900);
      this.feed('💨 ¡SONIC.EXE va a embestir!');
    } else if (id === 'secret-exe-tails') { // TELETRANSPORTE detrás de su objetivo
      const sp = this.freeSpotNear(tg.x, tg.z, 3.5); b.atkT = hard ? 4 : 7; if (!sp) return false;
      b.busy = 1.0; this.addTele(sp.x, sp.z, 1.8, 0.95, () => { if (!b.dead) { b.x = sp.x; b.z = sp.z; b.lx = b.x; b.lz = b.z; b.flash = 0.3; b.path = null; } }, 0x40a0ff);
    } else if (id === 'secret-exe-knuckles') { // PISOTÓN con área
      const R = hard ? 8.5 : 6.5; b.busy = 1.3; b.atkT = hard ? 5 : 8;
      this.addTele(b.x, b.z, R, 1.2, e => { this.explode(e.x, 0.5, e.z, { blast: 0, stun: 0, dmg: 0 }, b.name); this.killIn(e.x, e.z, R, b); }, 0xff7a20, true);
      this.feed('👊 ¡KNUCKLES.EXE va a pisotear el suelo!');
    } else if (id === 'secret-verity') { // APAGÓN: luces fuera y más veloz
      b.atkT = hard ? 11 : 16; this.darkT = hard ? 10 : 7; this.toast('💡 ¡Verity apagó las luces!', 2500);
    } else if (id === 'secret-choco') { // LLUVIA de chocolate: zonas marcadas que explotan
      b.atkT = hard ? 3.0 : 4.2; const n = hard ? 4 : 3;
      const pool = [this.player, ...this.cpus.filter(c => c.alive)].filter(e => e.alive);
      for (let i = 0; i < n && pool.length; i++) {
        const e = pool[Math.floor(Math.random() * pool.length)];
        this.addTele(e.x + (Math.random() - 0.5) * 4, e.z + (Math.random() - 0.5) * 4, 3.0, 1.8, t => { this.explode(t.x, 0.5, t.z, { blast: 0, stun: 0, dmg: 0 }, b.name); this.killIn(t.x, t.z, 3.0, b); }, 0x7a4a20, true);
      }
    } else b.atkT = 6;
    return false;
  }

  hitBoss(b, dmg) {
    if (this.guest) { b.flash = 0.12; return; }
    if (!b.active || b.hp <= 0) return;
    b.hp = Math.max(0, b.hp - dmg); b.flash = 0.12;
    if (b.hp <= 0) this.bossDie(b);
  }

  bossDie(b) {
    b.active = false; b.dead = true; b.mesh.visible = false; b.halo.visible = false;
    this.explode(b.x, b.bh / 2, b.z, { blast: 0, stun: 0, dmg: 0 });
    const m = b.meme; if (m && m.video && !this.bots.some(o => o !== b && o.active && o.meme === m)) m.video.pause();
    this.sfx.win();
    const ico = bossIco(b);
    this.feed(`${ico} ¡${b.name} fue derrotado!`, true); this.toast(`${ico} ¡JEFE DERROTADO!`, 3500);
    if (this.opts.boss && this.bots.every(x => !x.boss || x.dead)) { this.bossDead = true; this.sfx.setThreat(0); setTimeout(() => this.endRound(), 1800); } // en el boss fight termina la ronda
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
    if (e.type === 'player' && this.cheat('god')) return; // cheat: modo dios
    e.alive = false;
    if (e.type === 'cpu') {
      e.tag.visible = false; this.sfx.thud(clamp(1 - Math.hypot(e.x - this.player.x, e.z - this.player.z) / 40, 0.03, 0.5));
      this.dropCpuGun(e);
      this.feed(`💀 ${e.name} fue atrapado por ${bot.name}`);
      if (e.remote) this.coopSend({ t: 'dead', by: bot.name, place: this.cpus.filter(c => c.alive).length + (this.player.alive ? 1 : 0) + 1 });
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

  // revive al jugador (botón "Odio el chocolate"): una sola vez por partida
  revivePlayer() {
    const p = this.player;
    if (p.alive || this.chocoUsed || this.state === 'ended') return false;
    this.chocoUsed = true;
    p.alive = true; p.invuln = 5; p.stamina = 1; p.tired = false; p.y = 0; p.vy = 0;
    this.state = 'playing'; this.killer = null;
    for (const b of this.bots) if (b.active && Math.hypot(b.x - p.x, b.z - p.z) < 30) this.banish(b, 6); // los nextbots cercanos se van
    $('scare').classList.add('hidden'); $('vignette').style.opacity = 0;
    this.sfx.revive(); this.toast('🍫 ¡Reviviste! Tienes 5 s de protección', 2500); this.feed('🍫 Reviviste con "Odio el chocolate"', true);
    return true;
  }

  endRound() {
    if (this.endShown) return; this.endShown = true;
    this.stopMusic();
    const survivors = this.alive();
    if (this.player.alive) { this.state = 'ended'; this.sfx.win(); this.onEvent('win', { survivors, total: this.cpus.length + 1, time: this.time }); }
    else { this.state = 'ended'; this.onEvent('end', { survivors, total: this.cpus.length + 1 }); }
    if (this.coopHost) { const rc = this.cpus.find(c => c.remote); this.coopSend({ t: 'end', ty: rc && rc.alive ? 'win' : 'end', bd: this.bossDead, d: { survivors, total: this.cpus.length + 1, time: this.time } }); }
  }

  cycleSpectate() { this.specIdx++; }

  /* ------------------------------ VISUALES ------------------------------ */
  updateVisuals(dt) {
    const cam = this.camera, p = this.player, t = this.time;
    let fx = p.x, fz = p.z;
    if (p.alive) {
      const bk = this.extra.bob ? 1 : 0;
      cam.position.set(p.x, 1.65 + p.y + Math.sin(p.bob) * (p.running ? 0.06 : 0.035) * (p.moving ? 1 : 0) * bk, p.z);
      cam.rotation.set(this.pitch, this.yaw, Math.sin(p.bob * 0.5) * 0.004 * (p.moving ? 1 : 0) * bk);
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
      const d = Math.hypot(c.x - cam.position.x, c.z - cam.position.z), far = this.dist > 0 && d > this.dist;
      c.model.visible = !far && !c.self; // lejos: no se dibuja ni se anima (más FPS)
      if (far) continue;
      c.model.position.x = c.x; c.model.position.z = c.z;
      if (c.alive) { c.model.position.y = 0; c.model.rotation.y = c.yaw; animateHumanoid(c.model, dt, c.spd, false); }
      if (c.alive) c.tag.visible = this.extra.names && d < 26 && !c.self;
    }
    const nowMs = performance.now();
    for (const m of this.animated || []) if (nowMs - (m.last || 0) > 50) { m.last = nowMs; m.update(); }
    // nextbots
    let nearest = 1e9; const act = [];
    for (const b of this.bots) {
      if (!b.active) continue;
      b.phase += dt * 7;
      if (b.flash > 0) b.flash -= dt;
      b.mesh.material.color.setHex(b.flash > 0 ? 0xff7070 : b.stun > 0 ? 0x6f9bff : 0xffffff);
      const bh = b.bh || 2.5, cy = b.boss ? bh / 2 + 0.3 : 1.45;
      b.halo.material.opacity = b.state === 'chase' ? 1 : b.state === 'search' ? 0.6 : 0.3;
      const ang = Math.atan2(cam.position.x - b.x, cam.position.z - b.z);
      const sc = 1 + Math.sin(b.phase * 1.3) * 0.05;
      b.mesh.position.set(b.x, cy + Math.sin(b.phase) * 0.08, b.z);
      b.mesh.rotation.set(0, ang, Math.sin(b.phase * 0.7) * 0.06); b.mesh.scale.set(b.bw * sc, bh * sc, 1);
      const dir = new THREE.Vector3(b.x - cam.position.x, 0, b.z - cam.position.z).normalize().multiplyScalar(0.12);
      b.halo.position.set(b.x + dir.x, cy, b.z + dir.z);
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
    const bb = $('bossBar'); let bo = null, bd = 1e9; // barra del jefe activo más cercano
    for (const b of this.bots) if (b.boss && b.active && b.hp > 0) { const d = Math.hypot(b.x - this.player.x, b.z - this.player.z); if (d < bd) { bd = d; bo = b; } }
    if (this.music2) { // las voces suben de volumen al acercarte al jefe (≈4 m: a tope · 26 m: nada)
      const vol = Math.min(1, this.extra.volume / 100 * 0.9), t = bo ? Math.max(0, Math.min(1, 1 - (bd - 4) / 22)) : 0;
      this.music2.volume = vol * t * t * (3 - 2 * t);
      if (this.music && Math.abs(this.music2.currentTime - this.music.currentTime) > 0.2) { try { this.music2.currentTime = this.music.currentTime; } catch { /* nada */ } }
    }
    if (bo) { bb.classList.remove('hidden'); $('bossFill').style.width = (bo.hp / bo.hpMax * 100).toFixed(1) + '%'; $('bossHp').textContent = `${Math.ceil(bo.hp).toLocaleString('es')} / ${bo.hpMax.toLocaleString('es')}`; $('bossNm').textContent = bo.name;
      { const dx = bo.x - this.player.x, dz = bo.z - this.player.z, fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rel = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz); $('bossArrow').style.transform = `rotate(${rel}rad)`; $('bossDist').textContent = Math.round(Math.hypot(dx, dz)) + ' m'; } $('bossIco').textContent = bossIco(bo); }
    else bb.classList.add('hidden');
    $('hudTime').textContent = fmt(Math.max(0, this.round - this.time));
    $('hudAlive').textContent = `👥 ${this.alive()} / ${this.cpus.length + 1}`;
    const sig = this.inv ? this.inv.map((s, i) => (s ? s.type + s.ammo : '-') + (i === this.sel ? '*' : '')).join('|') : '';
    if (sig !== this._hbSig) {
      this._hbSig = sig;
      this.slotEls.forEach((el, i) => {
        const s = this.inv && this.inv[i];
        el.classList.toggle('empty', !s); el.classList.toggle('sel', !!s && i === this.sel);
        el.querySelector('b').textContent = s ? (WEAPONS[s.type].tag || WEAPONS[s.type].name) : ''; el.querySelector('span').textContent = s ? s.ammo : '';
      });
    }
    $('btnFire').style.visibility = this.weapon ? 'visible' : 'hidden'; $('btnAim').style.visibility = this.weapon ? 'visible' : 'hidden';
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
    if (this.coopHost && !this._noFwd) this.coopSend({ t: 'feed', m: msg });
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
      if (b.active && b.boss && b.hp > 0) { x.strokeStyle = '#ffd24d'; x.lineWidth = 2; x.beginPath(); x.arc(b.x * k, b.z * k, 6, 0, 6.3); x.stroke(); } // los jefes siempre se ven en el minimapa
      if (!b.active || (!b.boss && Math.hypot(b.x - p.x, b.z - p.z) > 30)) continue;
      x.fillStyle = b.state === 'chase' ? '#ff2a3d' : '#a8602a'; x.beginPath(); x.arc(b.x * k, b.z * k, 3, 0, 6.3); x.fill();
    }
    for (const c of this.cpus) if (!c.alive && Math.hypot(c.x - p.x, c.z - p.z) < 45) { x.fillStyle = '#3ddc84'; x.fillRect(c.x * k - 2, c.z * k - 2, 4, 4); }
    for (const pk of this.pickups || []) {
      if (pk.taken) continue;
      const big = WEAPONS[pk.type].blast ? 6 : 4; x.fillStyle = WEAPONS[pk.type].mini;
      x.fillRect(pk.x * k - big / 2, pk.z * k - big / 2, big, big);
    }
    const px = p.x * k, pz = p.z * k, a = Math.atan2(-Math.cos(this.yaw), -Math.sin(this.yaw));
    x.save(); x.translate(px, pz); x.rotate(a); x.fillStyle = p.alive ? '#7fe3ff' : '#888';
    x.beginPath(); x.moveTo(6, 0); x.lineTo(-4, 4); x.lineTo(-4, -4); x.closePath(); x.fill(); x.restore();
  }

  stopMusic() {
    for (const k of ['music', 'music2']) if (this[k]) { this[k].pause(); this[k] = null; }
  }

  pause() {
    if (this.state === 'playing' || this.state === 'dead') {
      this.prevState = this.state; this.state = 'paused'; this.sfx.suspend(); if (this.music) this.music.pause(); if (this.music2) this.music2.pause();
      for (const m of this.memes ? this.memes.values() : []) if (m.video) m.video.pause();
    }
  }
  unpause() {
    if (this.state === 'paused') {
      this.state = this.prevState || 'playing'; this.sfx.resume(); this.last = performance.now(); if (this.music) this.music.play().catch(() => {}); if (this.music2) this.music2.play().catch(() => {});
      for (const m of this.memes ? this.memes.values() : []) if (m.video) m.video.play().catch(() => {});
    }
  }
}
