// Humanoides 3D procedurales (cabeza, torso, brazos y piernas articulados con animación de caminar/correr)
import * as THREE from 'three';

const SKINS = [0xf1c9a5, 0xe0ac82, 0xc68a5e, 0x9a6440, 0x6e4529, 0x4a2e1c];
const SHIRTS = [0xc0392b, 0x2980b9, 0x27ae60, 0xf1c40f, 0x8e44ad, 0x16a085, 0xd35400, 0x2c3e50, 0xecf0f1, 0xe84393, 0x34495e, 0x7f8c8d];
const PANTS = [0x1f2a44, 0x2b2b2b, 0x3d5a80, 0x4b3b2a, 0x556270, 0x6b705c];
const HAIRS = [0x1a1109, 0x3b2412, 0x6b4423, 0xb8860b, 0xc9c9c9, 0x0d0d0d, 0x8b2d1a];
const pick = a => a[Math.floor(Math.random() * a.length)];

// tela con ruido sutil (bump) compartida
let fabric = null;
function fabricBump() {
  if (fabric) return fabric;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  for (let i = 0; i < 64; i += 2) for (let j = 0; j < 64; j += 2) { const v = 110 + Math.random() * 80; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, j, 2, 2); }
  fabric = new THREE.CanvasTexture(c); fabric.wrapS = fabric.wrapT = THREE.RepeatWrapping; fabric.repeat.set(3, 3);
  return fabric;
}

const cache = new Map();
function mat(color, rough = 0.8, bump = false) {
  const k = color + '_' + rough + '_' + bump;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02, bumpMap: bump ? fabricBump() : null, bumpScale: 0.6 }));
  return cache.get(k);
}

const GEO = {
  torso: new THREE.CapsuleGeometry(0.16, 0.3, 4, 12),
  pelvis: new THREE.CapsuleGeometry(0.15, 0.1, 4, 12),
  head: new THREE.SphereGeometry(0.115, 20, 14),
  hair: new THREE.SphereGeometry(0.123, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
  eye: new THREE.SphereGeometry(0.017, 8, 6),
  nose: new THREE.SphereGeometry(0.02, 8, 6),
  arm: new THREE.CapsuleGeometry(0.045, 0.24, 4, 8),
  fore: new THREE.CapsuleGeometry(0.04, 0.2, 4, 8),
  thigh: new THREE.CapsuleGeometry(0.07, 0.34, 4, 8),
  shin: new THREE.CapsuleGeometry(0.055, 0.34, 4, 8),
  shoe: new THREE.BoxGeometry(0.11, 0.07, 0.26),
};

function mesh(geo, material, x = 0, y = 0, z = 0, castShadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.castShadow = castShadow; m.receiveShadow = true;
  return m;
}

export function createHumanoid(castShadow = true) {
  const skin = mat(pick(SKINS), 0.55), shirt = mat(pick(SHIRTS), 0.9, true), pants = mat(pick(PANTS), 0.9, true);
  const hairM = mat(pick(HAIRS), 0.6), dark = mat(0x111111, 0.4), shoeM = mat(0x1b1b1b, 0.5);
  const root = new THREE.Group(); // pivote en los pies
  const body = new THREE.Group(); root.add(body);

  const pelvis = mesh(GEO.pelvis, pants, 0, 0.95, 0, castShadow); pelvis.scale.set(1.1, 1, 0.78); body.add(pelvis);
  const torso = mesh(GEO.torso, shirt, 0, 1.28, 0, castShadow); torso.scale.set(1.18, 1, 0.72); body.add(torso);
  const head = mesh(GEO.head, skin, 0, 1.64, 0, castShadow); head.scale.set(0.95, 1.12, 1); body.add(head);
  if (Math.random() < 0.85) { const hair = mesh(GEO.hair, hairM, 0, 1.655, -0.004, castShadow); hair.scale.set(1, 1, 1.03); body.add(hair); }
  body.add(mesh(GEO.eye, dark, -0.04, 1.655, 0.105, false), mesh(GEO.eye, dark, 0.04, 1.655, 0.105, false));
  body.add(mesh(GEO.nose, skin, 0, 1.62, 0.115, false));

  const limb = (x, y, upper, upperM, lower, lowerM, ul, ll, foot) => {
    const piv = new THREE.Group(); piv.position.set(x, y, 0);
    piv.add(mesh(upper, upperM, 0, -ul, 0, castShadow));
    const knee = new THREE.Group(); knee.position.set(0, -ul * 2, 0); piv.add(knee);
    knee.add(mesh(lower, lowerM, 0, -ll, 0, castShadow));
    if (foot) knee.add(mesh(GEO.shoe, shoeM, 0, -ll * 2 - 0.01, 0.05, castShadow));
    body.add(piv);
    return { piv, knee };
  };
  const aL = limb(-0.225, 1.42, GEO.arm, shirt, GEO.fore, skin, 0.15, 0.13, false);
  const aR = limb(0.225, 1.42, GEO.arm, shirt, GEO.fore, skin, 0.15, 0.13, false);
  const lL = limb(-0.09, 0.93, GEO.thigh, pants, GEO.shin, pants, 0.23, 0.23, true);
  const lR = limb(0.09, 0.93, GEO.thigh, pants, GEO.shin, pants, 0.23, 0.23, true);
  root.userData = { body, aL, aR, lL, lR, fall: 0, phase: Math.random() * 6 };
  return root;
}

// amt: 0 quieto .. 1 corriendo
export function animateHumanoid(h, dt, speed, dead) {
  const u = h.userData;
  if (dead) {
    u.fall = Math.min(1, u.fall + dt * 2.2);
    h.rotation.x = -u.fall * (Math.PI / 2 - 0.12);
    h.position.y = u.fall * 0.14;
    return;
  }
  const amt = Math.min(1, speed / 6);
  u.phase += dt * (3 + speed * 1.5);
  const s = Math.sin(u.phase) * amt;
  u.lL.piv.rotation.x = s * 0.95; u.lR.piv.rotation.x = -s * 0.95;
  u.lL.knee.rotation.x = Math.max(0, Math.sin(u.phase + 1.7)) * amt * 1.2;
  u.lR.knee.rotation.x = Math.max(0, Math.sin(u.phase + 1.7 + Math.PI)) * amt * 1.2;
  u.aL.piv.rotation.x = -s * 0.85; u.aR.piv.rotation.x = s * 0.85;
  u.aL.knee.rotation.x = -0.25 - amt * 0.9; u.aR.knee.rotation.x = -0.25 - amt * 0.9;
  u.body.position.y = Math.abs(Math.cos(u.phase)) * 0.035 * amt;
  u.body.rotation.x = amt * 0.12;
}

export function makeNameTag(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'bold 30px "Trebuchet MS", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.9)'; x.strokeText(name, 128, 34);
  x.fillStyle = '#fff'; x.fillText(name, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, fog: false, depthWrite: false }));
  s.scale.set(1.5, 0.375, 1); s.position.y = 2.0;
  return s;
}
