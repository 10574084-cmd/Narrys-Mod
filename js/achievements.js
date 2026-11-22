// Logros: se guardan en localStorage; los que requieren códigos secretos se muestran como «???» hasta desbloquearlos
const AKEY = 'narrysmod_ach_v1', SKEY = 'narrysmod_stats_v1';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* nada */ } };
let done = load(AKEY, {}), stats = load(SKEY, {});
let notify = () => {};
export const onAchievement = fn => { notify = fn; };

// stat: contador acumulado (goal = meta); set: nº de valores distintos (goal = meta); secret: se muestra como «???»
export const ACH = [
  // partidas
  { id: 'first_game', icon: '🎮', name: 'Bienvenido', desc: 'Inicia tu primera partida.' },
  { id: 'games10', icon: '🕹️', name: 'Veterano', desc: 'Juega 10 partidas.', stat: 'games', goal: 10 },
  { id: 'games50', icon: '💾', name: 'Sin vida social', desc: 'Juega 50 partidas.', stat: 'games', goal: 50 },
  { id: 'first_death', icon: '💀', name: 'Primer tropiezo', desc: 'Que te atrape un nextbot por primera vez.' },
  { id: 'deaths10', icon: '🍽️', name: 'Comida de nextbot', desc: 'Muere 10 veces.', stat: 'deaths', goal: 10 },
  { id: 'deaths50', icon: '⚰️', name: 'Cliente frecuente', desc: 'Muere 50 veces.', stat: 'deaths', goal: 50 },
  { id: 'win1', icon: '🏆', name: 'Superviviente', desc: 'Sobrevive una ronda completa.' },
  { id: 'win5', icon: '🥈', name: 'Imparable', desc: 'Sobrevive 5 rondas.', stat: 'wins', goal: 5 },
  { id: 'win25', icon: '🥇', name: 'Leyenda', desc: 'Sobrevive 25 rondas.', stat: 'wins', goal: 25 },
  { id: 'win_hard', icon: '😤', name: 'Sin miedo', desc: 'Sobrevive una ronda en dificultad Difícil o más.' },
  { id: 'win_nightmare', icon: '👹', name: 'Pesadilla superada', desc: 'Sobrevive una ronda en dificultad Pesadilla.' },
  { id: 'win_long', icon: '⏳', name: 'Maratón', desc: 'Sobrevive una ronda de 10 minutos.' },
  { id: 'win_huge', icon: '🗺️', name: 'Territorio enorme', desc: 'Sobrevive en un mapa de tamaño Enorme.' },
  { id: 'crowd', icon: '👥', name: 'Multitud', desc: 'Empieza una partida con 60 jugadores CPU.' },
  { id: 'solo', icon: '🧍', name: 'Lobo solitario', desc: 'Empieza una partida sin ningún CPU.' },
  { id: 'memes10', icon: '🌧️', name: 'Lluvia de memes', desc: 'Empieza una partida con 10 nextbots o más.' },
  // mapas
  { id: 'maps5', icon: '🧭', name: 'Turista', desc: 'Juega en 5 mapas distintos.', set: 'maps', goal: 5 },
  { id: 'maps12', icon: '🌍', name: 'Trotamundos', desc: 'Juega en 12 mapas distintos.', set: 'maps', goal: 12 },
  { id: 'maps22', icon: '📍', name: 'Cartógrafo', desc: 'Juega en los 22 mapas normales.', set: 'maps', goal: 22 },
  // armas y movimiento
  { id: 'first_shot', icon: '🔫', name: 'Gatillo fácil', desc: 'Dispara un arma por primera vez.' },
  { id: 'shots100', icon: '💥', name: 'Lluvia de plomo', desc: 'Dispara 100 veces.', stat: 'shots', goal: 100 },
  { id: 'shots1000', icon: '🔥', name: 'Cargador infinito', desc: 'Dispara 1000 veces.', stat: 'shots', goal: 1000 },
  { id: 'stun1', icon: '😵', name: 'Primer aturdimiento', desc: 'Aturde a un nextbot.' },
  { id: 'stun50', icon: '⚡', name: 'Aturdidor profesional', desc: 'Aturde 50 nextbots.', stat: 'stuns', goal: 50 },
  { id: 'arsenal', icon: '🎒', name: 'Arsenal completo', desc: 'Ten las 6 armas a la vez en una partida.' },
  { id: 'bazooka', icon: '🚀', name: 'Destructor', desc: 'Consigue la bazuca.' },
  { id: 'scope', icon: '🎯', name: 'Ojo de águila', desc: 'Dispara el francotirador mirando por la mira.' },
  { id: 'grenades10', icon: '🧨', name: 'Fuegos artificiales', desc: 'Lanza 10 granadas.', stat: 'grenades', goal: 10 },
  { id: 'jump100', icon: '🦘', name: 'Saltarín', desc: 'Salta 100 veces.', stat: 'jumps', goal: 100 },
  { id: 'tired', icon: '😮‍💨', name: 'Sin aliento', desc: 'Agota por completo tu aguante.' },
  { id: 'light', icon: '🔦', name: 'Se hizo la luz', desc: 'Usa la linterna.' },
  // social y opciones
  { id: 'revive1', icon: '💚', name: 'Buen samaritano', desc: 'Revive a un jugador CPU.' },
  { id: 'revive10', icon: '🩺', name: 'Médico de guardia', desc: 'Revive a 10 jugadores CPU.', stat: 'revives', goal: 10 },
  { id: 'rebind', icon: '⌨️', name: 'A mi manera', desc: 'Cambia una tecla en los controles.' },
  { id: 'upload', icon: '🖼️', name: 'Artista del meme', desc: 'Sube tu propio nextbot.' },
  { id: 'optimize', icon: '⚡', name: 'Optimizador', desc: 'Usa el botón de mejorar el rendimiento.' },
  // secretos (códigos): se muestran como ??? hasta desbloquearlos
  { id: 'code_choco', icon: '🍫', name: 'Código del chocolate', desc: 'Descubre el primer código secreto.', secret: true },
  { id: 'boss_choco', icon: '👑', name: 'Rey del chocolate', desc: 'Derrota al jefe ODIO EL CHOCOLATE.', secret: true },
  { id: 'choco_revive', icon: '😋', name: 'Odio el chocolate (pero me salvó)', desc: 'Revive con el botón «Odio el chocolate».', secret: true },
  { id: 'troll', icon: '🤡', name: 'Caíste', desc: 'Pulsa el botón troll de la pantalla de derrota.', secret: true },
  { id: 'code_exe', icon: '💻', name: 'Código .EXE', desc: 'Descubre el segundo código secreto.', secret: true },
  { id: 'boss_exe', icon: '🦔', name: 'Fin de la colina', desc: 'Derrota a SONIC.EXE y sus amigos.', secret: true },
  { id: 'code_verity', icon: '🏠', name: 'Visita a casa', desc: 'Descubre el tercer código secreto.', secret: true },
  { id: 'boss_verity', icon: '🙂', name: 'La sonrisa se apagó', desc: 'Derrota a VERITY en su casa.', secret: true },
  { id: 'master', icon: '🔓', name: 'Maestro de los secretos', desc: 'Desbloquea a todos los jefes secretos.', secret: true },
  { id: 'rush_final', icon: '👾', name: '???', desc: 'Derrota a todos los jefes juntos en la Zona Glitch.', secret: true },
  { id: 'platinum', icon: '💎', name: 'Platino', desc: 'Consigue todos los demás logros.', secret: true },
];
const BY = Object.fromEntries(ACH.map(a => [a.id, a]));

export const has = id => !!done[id];
export const count = () => ACH.filter(a => done[a.id]).length;
export const stat = k => (Array.isArray(stats[k]) ? stats[k].length : stats[k] || 0);

export function unlock(id) {
  const a = BY[id]; if (!a || done[id]) return false;
  done[id] = Date.now(); store(AKEY, done); notify(a);
  if (id !== 'master' && id !== 'platinum') {
    if (done.boss_choco && done.boss_exe && done.boss_verity) unlock('master');
    if (ACH.every(x => x.id === 'platinum' || done[x.id])) unlock('platinum');
  }
  return true;
}
function check(k) { for (const a of ACH) if ((a.stat === k || a.set === k) && stat(k) >= a.goal) unlock(a.id); }
export function add(k, n = 1) { stats[k] = (+stats[k] || 0) + n; store(SKEY, stats); check(k); }
export function addToSet(k, v) { const s = Array.isArray(stats[k]) ? stats[k] : []; if (!s.includes(v)) { s.push(v); stats[k] = s; store(SKEY, stats); check(k); } }

// eventos del motor de juego
export function onGameStat(d) {
  switch (d.k) {
    case 'shot': add('shots'); unlock('first_shot'); if (d.type === 'grenade') add('grenades'); if (d.type === 'sniper' && d.aiming) unlock('scope'); break;
    case 'pickup': if (d.type === 'bazooka') unlock('bazooka'); if (d.count >= 6) unlock('arsenal'); break;
    case 'stun': add('stuns'); unlock('stun1'); break;
    case 'revive': add('revives'); unlock('revive1'); break;
    case 'jump': add('jumps'); break;
    case 'tired': unlock('tired'); break;
    case 'light': unlock('light'); break;
  }
}

/* ---------- interfaz ---------- */
export function render(box, head) {
  box.innerHTML = '';
  const n = count(); head.textContent = `${n} / ${ACH.length} logros`;
  for (const a of ACH) {
    const got = !!done[a.id], hide = a.secret && !got;
    const d = document.createElement('div'); d.className = 'ach' + (got ? ' got' : '') + (hide ? ' secret' : '');
    let prog = '';
    if (!got && (a.stat || a.set)) { const v = Math.min(a.goal, stat(a.stat || a.set)); prog = `<div class="prog"><i style="width:${v / a.goal * 100}%"></i></div><small>${v} / ${a.goal}</small>`; }
    d.innerHTML = `<div class="ic">${hide ? '❓' : a.icon}</div><div class="tx"><b></b><span></span>${prog}</div>`;
    d.querySelector('b').textContent = hide ? '???' : a.name;
    d.querySelector('span').textContent = hide ? 'Logro secreto: se desbloquea con un código secreto.' : a.desc;
    box.appendChild(d);
  }
}
