// Звуки синтезируются в браузере (Web Audio) — никаких аудиофайлов.

export class Sfx {
  constructor() {
    this.ctx = null;
  }

  unlock() {
    try {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, dur, { type = 'sine', vol = 0.15, to = null, delay = 0 } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.2, freq = 1200, delay = 0 } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t);
  }

  cast(runeId) {
    const base = { circle: 660, triangle: 440, zigzag: 880, vee: 550 }[runeId] ?? 600;
    this.tone(base, 0.25, { type: 'triangle', to: base * 2 });
    this.tone(base * 1.5, 0.3, { type: 'sine', vol: 0.08, delay: 0.05 });
    if (runeId === 'zigzag') this.noise(0.25, { vol: 0.15, freq: 4000 });
  }
  kill() { this.noise(0.3, { vol: 0.25, freq: 1800 }); this.tone(300, 0.2, { type: 'square', vol: 0.05, to: 80 }); }
  error() { this.tone(180, 0.18, { type: 'sawtooth', vol: 0.08 }); this.tone(140, 0.22, { type: 'sawtooth', vol: 0.08, delay: 0.12 }); }
  hurt() { this.noise(0.4, { vol: 0.35, freq: 600 }); this.tone(120, 0.4, { type: 'square', vol: 0.1, to: 50 }); }
  block() { this.tone(900, 0.15, { type: 'triangle', vol: 0.12 }); this.noise(0.15, { vol: 0.15, freq: 5000 }); }
  warn() { this.tone(520, 0.12, { type: 'square', vol: 0.06 }); this.tone(520, 0.12, { type: 'square', vol: 0.06, delay: 0.18 }); }
  click() { this.tone(700, 0.08, { type: 'triangle', vol: 0.1 }); }
  charge(level) { this.tone(200 + level * 500, 0.06, { type: 'sine', vol: 0.04 }); }
  boom() { this.noise(1.2, { vol: 0.5, freq: 900 }); this.tone(90, 1, { type: 'sine', vol: 0.3, to: 30 }); }
  success() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.12, delay: i * 0.09 })); }
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.12, delay: i * 0.12 })); }
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, { type: 'sawtooth', vol: 0.06, delay: i * 0.18 })); }
}
