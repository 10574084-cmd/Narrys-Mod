// Conexión entre dos jugadores: WebRTC con PeerJS (sin servidor propio). ?nettest=bc usa BroadcastChannel (solo para pruebas).
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar PeerJS (revisa tu conexión)')); document.head.appendChild(s);
  });
}
export class Net {
  constructor() { this.onmsg = () => {}; this.onclose = () => {}; this.conn = null; this.open = false; this.bc = /[?&]nettest=bc/.test(location.search); this.id = Math.random().toString(36).slice(2); }
  _setConn(c, resolve) {
    this.conn = c;
    c.on('open', () => { this.open = true; if (resolve) resolve(); });
    c.on('data', m => this.onmsg(m));
    c.on('close', () => { this.open = false; this.onclose(); });
    c.on('error', () => { this.open = false; this.onclose(); });
    if (c.open) { this.open = true; if (resolve) resolve(); }
  }
  // anfitrión: devuelve el código y llama onconn cuando entra el amigo
  async host(onconn) {
    const code = newCode(); this.code = code;
    if (this.bc) {
      this.ch = new BroadcastChannel('narrysmod-' + code);
      this.ch.onmessage = e => {
        const d = e.data; if (d.from === this.id) return;
        if (d.hello && !this.peerId) { this.peerId = d.from; this.open = true; this.ch.postMessage({ from: this.id, to: d.from, welcome: 1 }); onconn(); }
        else if (d.to === this.id && d.m) this.onmsg(d.m);
      };
      return code;
    }
    await loadPeerJS();
    await new Promise((res, rej) => {
      this.peer = new window.Peer('narrysmod-' + code);
      this.peer.on('open', res); this.peer.on('error', e => rej(new Error('No se pudo crear la sala: ' + (e.type || e))));
      this.peer.on('connection', c => { if (this.conn && this.open) { c.close(); return; } this._setConn(c, onconn); });
    });
    return code;
  }
  async join(code) {
    code = String(code || '').trim().toUpperCase(); this.code = code;
    if (this.bc) {
      this.ch = new BroadcastChannel('narrysmod-' + code);
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('No se encontró la sala')), 3000);
        this.ch.onmessage = e => {
          const d = e.data; if (d.from === this.id) return;
          if (d.welcome && d.to === this.id) { clearTimeout(t); this.peerId = d.from; this.open = true; res(); }
          else if (d.to === this.id && d.m) this.onmsg(d.m);
        };
        this.ch.postMessage({ from: this.id, hello: 1 });
      });
      return;
    }
    await loadPeerJS();
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('No se encontró la sala (revisa el código)')), 12000);
      this.peer = new window.Peer();
      this.peer.on('error', e => { clearTimeout(t); rej(new Error(e.type === 'peer-unavailable' ? 'No existe esa sala' : 'Error de conexión: ' + (e.type || e))); });
      this.peer.on('open', () => { this._setConn(this.peer.connect('narrysmod-' + code, { serialization: 'json', reliable: true }), () => { clearTimeout(t); res(); }); });
    });
  }
  send(m) {
    try { if (this.bc) { if (this.ch && this.open) this.ch.postMessage({ from: this.id, to: this.peerId, m }); } else if (this.conn && this.open) this.conn.send(m); } catch { /* nada */ }
  }
  close() { try { this.open = false; if (this.ch) this.ch.close(); if (this.conn) this.conn.close(); if (this.peer) this.peer.destroy(); } catch { /* nada */ } this.conn = this.peer = this.ch = null; }
}
