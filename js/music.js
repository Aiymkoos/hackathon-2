// Оркестр в браузере: синтез инструментов на Web Audio + «зал» (реверберация)
// и исполнение, которое следует за темпом дирижёра.

const freq = midi => 440 * 2 ** ((midi - 69) / 12);

// Импульс для реверберации: затухающий стереошум ≈ концертный зал.
function hallImpulse(ctx, seconds = 2.6, decay = 2.4) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

export class Orchestra {
  constructor(ctx) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);
    const reverb = ctx.createConvolver();
    reverb.buffer = hallImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.4;
    reverb.connect(wet).connect(comp);
    this.dyn = ctx.createGain();
    this.dyn.gain.value = 0.5;
    this.dyn.connect(this.master);
    this.dyn.connect(reverb);
    this.section = {};
    for (const id of ['strings', 'cellos', 'flutes', 'brass', 'timpani']) {
      const g = ctx.createGain();
      g.connect(this.dyn);
      this.section[id] = g;
    }
    this.holding = [];
  }

  // Громкость всего оркестра по размаху взмахов: 0 — тихо, 1 — громко.
  setLevel(level) {
    const v = 0.22 + 0.78 * Math.max(0, Math.min(1, level));
    this.dyn.gain.setTargetAtTime(v, this.ctx.currentTime, 0.12);
  }

  env(peak, attack, dur, release) {
    const c = this.ctx;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    if (Number.isFinite(dur)) {
      g.gain.setTargetAtTime(peak * 0.7, t + attack, dur * 0.4);
      g.gain.setTargetAtTime(0.0001, t + dur, release / 3);
    }
    return g;
  }

  osc(type, f, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    return o;
  }

  vibrato(target, rate = 5, depth = 6) {
    const lfo = this.osc('sine', rate);
    const g = this.ctx.createGain();
    g.gain.value = depth;
    lfo.connect(g).connect(target.detune);
    return lfo;
  }

  /** Играет ноту. dur в секундах; Infinity — держать, пока не вызовут release(). */
  play(section, midi, dur) {
    const c = this.ctx;
    const f = freq(midi);
    const out = this.section[section];
    const hold = !Number.isFinite(dur);
    const nodes = [];
    let env;
    let release = 0.3;

    if (section === 'timpani') {
      if (hold) return this.roll(midi);
      this.hit(f);
      return;
    }
    if (section === 'strings') {
      env = this.env(0.16, 0.06, dur, (release = 0.35));
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2600;
      for (const d of [-7, 7]) {
        const o = this.osc('sawtooth', f, d);
        nodes.push(o, this.vibrato(o, 5.5, 8));
        o.connect(filter);
      }
      filter.connect(env);
    } else if (section === 'cellos') {
      env = this.env(0.2, 0.05, dur, (release = 0.4));
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const o = this.osc('sawtooth', f);
      nodes.push(o, this.vibrato(o, 5, 5));
      o.connect(filter).connect(env);
    } else if (section === 'flutes') {
      env = this.env(0.07, 0.09, dur, (release = 0.3));
      const o = this.osc('sine', f);
      const o2 = this.osc('triangle', f * 2);
      const g2 = c.createGain();
      g2.gain.value = 0.15;
      nodes.push(o, o2, this.vibrato(o, 5, 10));
      o.connect(env);
      o2.connect(g2).connect(env);
    } else if (section === 'brass') {
      env = this.env(0.11, 0.04, dur, (release = 0.25));
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 3;
      filter.frequency.setValueAtTime(600, c.currentTime);
      filter.frequency.linearRampToValueAtTime(2200, c.currentTime + 0.08);
      const o = this.osc('sawtooth', f);
      const o2 = this.osc('square', f, 4);
      nodes.push(o, o2);
      o.connect(filter);
      o2.connect(filter);
      filter.connect(env);
    }
    env.connect(out);
    const t = c.currentTime;
    for (const n of nodes) {
      n.start(t);
      if (!hold) n.stop(t + dur + release * 2);
    }
    if (hold) this.holding.push({ env, nodes, release });
  }

  hit(f, vol = 0.5) {
    const c = this.ctx;
    const t = c.currentTime;
    const o = this.osc('sine', f * 1.6);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(this.section.timpani);
    o.start(t);
    o.stop(t + 1);
    // «удар колотушки» — короткий шум
    const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const n = c.createBufferSource();
    n.buffer = buf;
    const ng = c.createGain();
    ng.gain.value = vol * 0.4;
    n.connect(ng).connect(this.section.timpani);
    n.start(t);
  }

  roll(midi) {
    const f = freq(midi);
    const id = setInterval(() => this.hit(f, 0.18 + Math.random() * 0.08), 70);
    this.holding.push({ interval: id });
  }

  // Снять все выдержанные ноты (финальное снятие дирижёром).
  release() {
    const t = this.ctx.currentTime;
    for (const h of this.holding) {
      if (h.interval) {
        clearInterval(h.interval);
        continue;
      }
      h.env.gain.cancelScheduledValues(t);
      h.env.gain.setTargetAtTime(0.0001, t, h.release / 3);
      for (const n of h.nodes) n.stop(t + h.release * 3);
    }
    this.holding = [];
  }

  // Короткий звук интерфейса.
  blip(f = 880, dur = 0.08, vol = 0.08) {
    const c = this.ctx;
    const o = this.osc('triangle', f);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  // Аплодисменты: много коротких «хлопков» шума.
  applause(seconds = 4, intensity = 1) {
    const c = this.ctx;
    const count = Math.floor(seconds * 60 * intensity);
    for (let i = 0; i < count; i++) {
      const t = c.currentTime + Math.random() * seconds * (0.6 + 0.4 * Math.random());
      const len = 0.02 + Math.random() * 0.03;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length) ** 2;
      const src = c.createBufferSource();
      src.buffer = buf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1000 + Math.random() * 2000;
      const g = c.createGain();
      const fade = 1 - (t - c.currentTime) / seconds;
      g.gain.value = 0.25 * Math.max(0.2, fade);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t);
    }
  }
}

/**
 * Исполнение: позиция в долях двигается с темпом дирижёра. Оркестр не
 * убегает вперёд больше чем на долю от последнего взмаха — если дирижёр
 * остановился, музыка ждёт.
 */
export class Performance {
  constructor(piece, orchestra) {
    this.piece = piece;
    this.orchestra = orchestra;
    this.pos = -1;
    this.bpm = piece.tempo;
    this.started = false;
    this.lastBeatIdx = -1;
    this.lastT = 0;
    this.next = 0;
    this.enabled = new Set(['strings', 'cellos']);
    this.onNote = null; // (section) => void — для анимации
    this.onBeat = null; // (beatIdx) => void
    this.waiting = false;
  }

  get atFinal() {
    return this.pos >= this.piece.finalBeat;
  }

  // Группа вступает сразу: доигрывает ноты, которые уже должны звучать.
  enable(section) {
    if (this.enabled.has(section)) return;
    this.enabled.add(section);
    for (const n of this.piece.notes) {
      if (n.section !== section || n.beat > this.pos || !Number.isFinite(n.dur)) continue;
      const left = n.beat + n.dur - this.pos;
      if (left > 0.25) {
        this.orchestra.play(section, n.midi, (left * 60) / this.bpm);
        this.onNote?.(section, n);
      }
    }
  }

  // Взмах дирижёра (нижняя точка доли).
  ictus(t) {
    if (!this.started) {
      this.started = true;
      this.pos = 0;
      this.lastBeatIdx = 0;
      this.lastT = t;
      this.trigger(0.0001);
      return;
    }
    const interval = t - this.lastT;
    if (interval < 0.25) return;
    this.lastT = t;
    if (interval < 2) this.bpm = Math.max(40, Math.min(180, this.bpm * 0.4 + (60 / interval) * 0.6));
    const k = this.lastBeatIdx + 1;
    if (this.pos < k) this.trigger(k - this.pos); // оркестр отстал — догоняет
    this.lastBeatIdx = Math.max(k, Math.floor(this.pos));
  }

  update(dt) {
    if (!this.started || this.atFinal) return;
    const cap = this.lastBeatIdx + 1.25;
    const step = Math.max(0, Math.min(dt * (this.bpm / 60), cap - this.pos));
    this.waiting = step === 0;
    this.trigger(step);
  }

  trigger(step) {
    const from = this.pos;
    const to = Math.min(this.pos + step, this.piece.finalBeat + 0.001);
    const notes = this.piece.notes;
    while (this.next < notes.length && notes[this.next].beat < to) {
      const n = notes[this.next++];
      if (!this.enabled.has(n.section)) continue;
      this.orchestra.play(n.section, n.midi, Number.isFinite(n.dur) ? (n.dur * 60) / this.bpm : Infinity);
      this.onNote?.(n.section, n);
    }
    if (Math.floor(to) > Math.floor(from) || from === 0) this.onBeat?.(Math.floor(to));
    this.pos = to;
  }
}
