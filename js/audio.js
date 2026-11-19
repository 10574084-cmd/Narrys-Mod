// Sonido 100% procedural con WebAudio (no necesita archivos)
export class Sfx {
  constructor() { this.ctx = null; }

  init(droneFreq = 50) {
    try {
      if (this.ctx) { this.ctx.resume(); this.setDrone(droneFreq); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0.7; this.master.connect(c.destination);
      const len = c.sampleRate * 2;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      // zumbido ambiente
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      const dg = c.createGain(); dg.gain.value = 0.06; lp.connect(dg); dg.connect(this.master);
      this.drones = [1, 1.012, 1.5].map(k => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = droneFreq * k; o.connect(lp); o.start(); return { o, k }; });

      // gruñido de amenaza (sube al acercarse un nextbot)
      this.gOsc = c.createOscillator(); this.gOsc.type = 'sawtooth'; this.gOsc.frequency.value = 70;
      const gf = c.createBiquadFilter(); gf.type = 'lowpass'; gf.frequency.value = 420;
      this.gGain = c.createGain(); this.gGain.gain.value = 0;
      this.gOsc.connect(gf); gf.connect(this.gGain); this.gGain.connect(this.master); this.gOsc.start();
      const lfo = c.createOscillator(); lfo.frequency.value = 7;
      const lg = c.createGain(); lg.gain.value = 18; lfo.connect(lg); lg.connect(this.gOsc.frequency); lfo.start();

      // pitido agudo
      this.hi = c.createOscillator(); this.hi.type = 'sine'; this.hi.frequency.value = 1900;
      this.hiGain = c.createGain(); this.hiGain.gain.value = 0;
      this.hi.connect(this.hiGain); this.hiGain.connect(this.master); this.hi.start();
    } catch { this.ctx = null; }
  }

  setDrone(f) { if (this.drones) this.drones.forEach(d => { d.o.frequency.value = f * d.k; }); }

  setThreat(t) {
    if (!this.ctx) return;
    const n = this.ctx.currentTime;
    this.gGain.gain.setTargetAtTime(t * t * 0.4, n, 0.15);
    this.gOsc.frequency.setTargetAtTime(55 + t * 90, n, 0.2);
    this.hiGain.gain.setTargetAtTime(t * t * t * 0.02, n, 0.2);
  }

  burst(dur, freq, gain, q = 1, type = 'bandpass') {
    if (!this.ctx) return;
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); const n = c.currentTime;
    g.gain.setValueAtTime(gain, n); g.gain.exponentialRampToValueAtTime(0.0008, n + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(n, Math.random()); s.stop(n + dur + 0.05);
  }

  step(sprint) { this.burst(sprint ? 0.09 : 0.07, sprint ? 520 : 380, sprint ? 0.22 : 0.14, 1.2); }

  thud(vol = 0.3) { this.burst(0.25, 120, vol, 0.8, 'lowpass'); }

  spawn() {
    if (!this.ctx) return;
    this.burst(1.2, 90, 0.5, 0.7, 'lowpass');
  }

  scare() {
    if (!this.ctx) return;
    const c = this.ctx, n = c.currentTime;
    this.burst(1.6, 1800, 0.9, 0.5);
    for (const f of [180, 233, 466, 933]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, n);
      o.frequency.exponentialRampToValueAtTime(f * 1.6, n + 1.2);
      const g = c.createGain(); g.gain.setValueAtTime(0.35, n); g.gain.exponentialRampToValueAtTime(0.001, n + 1.4);
      o.connect(g); g.connect(this.master); o.start(n); o.stop(n + 1.5);
    }
  }

  win() {
    if (!this.ctx) return;
    const c = this.ctx, n = c.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, n + i * 0.15); g.gain.exponentialRampToValueAtTime(0.25, n + i * 0.15 + 0.03); g.gain.exponentialRampToValueAtTime(0.001, n + i * 0.15 + 0.6);
      o.connect(g); g.connect(this.master); o.start(n + i * 0.15); o.stop(n + i * 0.15 + 0.7);
    });
  }

  mute(m) { if (this.master) this.master.gain.value = m ? 0 : 0.7; }
  suspend() { if (this.ctx) this.ctx.suspend(); }
  resume() { if (this.ctx) this.ctx.resume(); }
}
