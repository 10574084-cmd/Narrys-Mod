// Monedas, tienda de skins de arma y armas que aparecen en el suelo al empezar la partida
const KEY = 'narrysmod_shop_v1';
export const SKINS = [
  { id: 'default', name: 'Normal', icon: '🔫', price: 0 },
  { id: 'gold', name: 'Dorada', icon: '🥇', price: 300, tint: 0xffc933 },
  { id: 'neon', name: 'Neón', icon: '🟢', price: 400, tint: 0x20ff90 },
  { id: 'blood', name: 'Sangre', icon: '🩸', price: 400, tint: 0xff2a2a },
  { id: 'ice', name: 'Hielo', icon: '🧊', price: 500, tint: 0x7fd8ff },
  { id: 'void', name: 'Vacío', icon: '🟣', price: 600, tint: 0x8a3dff },
  { id: 'rainbow', name: 'Arcoíris', icon: '🌈', price: 900, rainbow: true },
];
export const WEAPON_SHOP = [
  { type: 'revolver', name: 'Revólver', icon: '🔫', price: 40 },
  { type: 'smg', name: 'Subfusil', icon: '🔫', price: 80 },
  { type: 'shotgun', name: 'Escopeta', icon: '🔫', price: 90 },
  { type: 'grenade', name: 'Granadas', icon: '💣', price: 150 },
  { type: 'sniper', name: 'Francotirador', icon: '🎯', price: 150 },
  { type: 'bazooka', name: 'Bazuca', icon: '🚀', price: 250 },
];
let S = { coins: 0, owned: ['default'], skin: 'default', stock: {} };
try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r) S = { ...S, ...r }; } catch { /* nada */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* nada */ } };
export const state = () => S;
export const coins = () => S.coins;
export function addCoins(n) { n = Math.max(0, Math.round(n)); S.coins += n; save(); return n; }
export function buySkin(id) {
  const s = SKINS.find(x => x.id === id); if (!s) return 'no';
  if (S.owned.includes(id)) { S.skin = id; save(); return 'equipped'; }
  if (S.coins < s.price) return 'poor';
  S.coins -= s.price; S.owned.push(id); S.skin = id; save(); return 'bought';
}
export function buyWeapon(type) {
  const w = WEAPON_SHOP.find(x => x.type === type); if (!w) return 'no';
  if (S.coins < w.price) return 'poor';
  S.coins -= w.price; S.stock[type] = (S.stock[type] || 0) + 1; save(); return 'bought';
}
export const currentSkin = () => SKINS.find(s => s.id === S.skin) || SKINS[0];
// lista de armas compradas para esta partida (y se vacía el inventario de la tienda)
export function takeStock() {
  const list = []; for (const [t, n] of Object.entries(S.stock)) for (let i = 0; i < n; i++) list.push(t);
  S.stock = {}; save(); return list;
}
export function resetShop() { S = { coins: 0, owned: ['default'], skin: 'default', stock: {} }; save(); }
