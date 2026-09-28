// Анализ движений дирижёра — собственная логика команды.
// Точки тела MediaPipe Pose → доли (взмахи), темп, громкость, указание
// левой рукой на группу оркестра, фермата и снятие.
// Все расстояния меряются в «ширинах плеч» (sw) — так логика не зависит
// от того, далеко человек от камеры или близко.

import { OneEuro } from './filters.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const deg = rad => (rad * 180) / Math.PI;

// Индексы точек MediaPipe Pose (лево/право — самого человека)
const NOSE = 0, L_SHOULDER = 11, R_SHOULDER = 12, L_ELBOW = 13, R_ELBOW = 14, L_WRIST = 15, R_WRIST = 16, R_INDEX = 20;

const L_INDEX = 19;
function pickPointer(lm, vis) {
  const hands = [[R_WRIST, R_INDEX], [L_WRIST, L_INDEX]].filter(([w]) => vis(w));
  if (!hands.length) return null;
  const [w, i] = hands.sort((a, b) => lm[a[0]].y - lm[b[0]].y)[0];
  return vis(i) ? lm[i] : lm[w];
}

/** lm — 33 точки в пикселях экрана с полем visibility. */
export function readBody(lm) {
  const vis = i => (lm[i].visibility ?? 1) > 0.5;
  return {
    lm,
    nose: lm[NOSE],
    ls: lm[L_SHOULDER], rs: lm[R_SHOULDER],
    le: lm[L_ELBOW], re: lm[R_ELBOW],
    lw: lm[L_WRIST], rw: lm[R_WRIST],
    // курсор для кнопок — та рука, что поднята выше (любая)
    pointer: pickPointer(lm, vis),
    shouldersOk: vis(L_SHOULDER) && vis(R_SHOULDER),
    leftOk: vis(L_WRIST) && vis(L_ELBOW),
    rightOk: vis(R_WRIST),
    sw: Math.max(1, dist(lm[L_SHOULDER], lm[R_SHOULDER])),
  };
}

// Громкость по размаху взмаха (в ширинах плеч).
export function dynamicOf(amp) {
  return amp < 0.55 ? 'p' : amp > 0.95 ? 'f' : 'mf';
}

/**
 * Доля — нижняя точка взмаха правой руки («иктус»): рука шла вниз
 * и развернулась вверх. Возвращает событие beat с размахом взмаха.
 */
export class Baton {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = 'idle';
    this.prev = null;
    this.vy = 0;
    this.topY = null;
    this.bottom = null;
  }

  update(t, p, sw) {
    if (!this.prev) {
      this.prev = { y: p.y, t };
      this.topY = p.y;
      return null;
    }
    const dt = Math.max(1e-3, t - this.prev.t);
    const v = (p.y - this.prev.y) / dt / sw; // ширин плеч в секунду, «+» — вниз
    this.vy = this.vy * 0.4 + v * 0.6;
    this.prev = { y: p.y, t };

    if (this.state !== 'down') {
      this.topY = Math.min(this.topY, p.y);
      if (this.vy > 0.8) {
        this.state = 'down';
        this.bottom = { x: p.x, y: p.y };
      }
      return null;
    }
    if (p.y > this.bottom.y) this.bottom = { x: p.x, y: p.y };
    if (this.vy > -0.5) return null;

    const amp = (this.bottom.y - this.topY) / sw;
    this.state = 'up';
    this.topY = p.y;
    return amp >= 0.2 ? { type: 'beat', t, amp, x: this.bottom.x, y: this.bottom.y } : null;
  }
}

/** Темп и ровность по времени долей. */
export class TempoTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.times = [];
  }

  add(t) {
    this.times.push(t);
    if (this.times.length > 8) this.times.shift();
  }

  intervals(n) {
    const out = [];
    for (let i = 1; i < this.times.length; i++) {
      const d = this.times[i] - this.times[i - 1];
      if (d > 0.25 && d < 2) out.push(d);
    }
    return out.slice(-n);
  }

  get bpm() {
    const iv = this.intervals(3).sort((a, b) => a - b);
    return iv.length ? 60 / iv[Math.floor(iv.length / 2)] : null;
  }

  // Коэффициент вариации последних интервалов: 0 — идеально ровно.
  get unevenness() {
    const iv = this.intervals(4);
    if (iv.length < 3) return 0;
    const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
    const sd = Math.sqrt(iv.reduce((a, b) => a + (b - mean) ** 2, 0) / iv.length);
    return sd / mean;
  }

  // 'faster' / 'slower', если темп стабильно уходит.
  get trend() {
    const iv = this.intervals(4);
    if (iv.length < 4) return null;
    // интервалы кратны кадру камеры, поэтому допускаем маленькие откаты
    const dec = iv.every((d, i) => i === 0 || d < iv[i - 1] * 1.03);
    const inc = iv.every((d, i) => i === 0 || d > iv[i - 1] * 0.97);
    const change = (iv[iv.length - 1] - iv[0]) / iv[0];
    if (dec && change < -0.15) return 'faster';
    if (inc && change > 0.15) return 'slower';
    return null;
  }
}

/** Левая рука: указывает ли она прямой рукой и куда. */
export function armPointing(body) {
  const { ls, le, lw, sw } = body;
  const u = { x: ls.x - le.x, y: ls.y - le.y };
  const v = { x: lw.x - le.x, y: lw.y - le.y };
  const elbowDeg = deg(Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / ((Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)) || 1)))));
  const reach = dist(ls, lw) / sw;
  const len = dist(ls, lw) || 1;
  const dir = { x: (lw.x - ls.x) / len, y: (lw.y - ls.y) / len };
  const raised = dir.y < 0.45 && lw.y < ls.y + 0.6 * sw; // не опущена вниз
  const straight = elbowDeg > 145;
  const extended = reach > 1.05;
  return { raised, straight, extended, active: raised && straight && extended, dir, from: ls, tip: lw, elbowDeg, reach };
}

/** На какую цель (секцию оркестра) показывает луч от плеча через запястье. */
export function aimAt(pointing, targets, maxDeg = 20) {
  let best = null;
  for (const t of targets) {
    const tx = t.x - pointing.from.x, ty = t.y - pointing.from.y;
    const l = Math.hypot(tx, ty) || 1;
    const cos = (tx * pointing.dir.x + ty * pointing.dir.y) / l;
    const err = deg(Math.acos(Math.max(-1, Math.min(1, cos))));
    if (err < maxDeg && (!best || err < best.err)) best = { id: t.id, err };
  }
  return best;
}

/** Фермата (обе руки над головой) и снятие (резко опустить обе руки). */
export class Finale {
  constructor() {
    this.reset();
  }

  reset() {
    this.upSince = null;
    this.fermata = false;
    this.leftAt = null;
    this.oneUp = false;
  }

  update(t, body) {
    const events = [];
    const { lw, rw, nose, ls, rs, sw } = body;
    const above = w => w.y < nose.y - 0.1 * sw;
    const upL = body.leftOk && above(lw);
    const upR = body.rightOk && above(rw);
    this.oneUp = upL !== upR;

    if (upL && upR) {
      this.upSince ??= t;
      if (!this.fermata && t - this.upSince > 0.3) {
        this.fermata = true;
        events.push({ type: 'fermata' });
      }
      return events;
    }
    this.upSince = null;
    if (this.fermata) {
      this.fermata = false;
      this.leftAt = t;
    }
    if (this.leftAt !== null) {
      const shoulderY = Math.max(ls.y, rs.y);
      if (lw.y > shoulderY && rw.y > shoulderY) {
        events.push({ type: t - this.leftAt <= 0.45 ? 'cutoff' : 'slowCutoff' });
        this.leftAt = null;
      } else if (t - this.leftAt > 3) this.leftAt = null;
    }
    return events;
  }
}

export const FRAMING_HINTS = {
  noBody: 'Встань в кадр так, чтобы были видны голова, плечи и руки',
  far: 'Подойди ближе к камере',
  near: 'Отодвинься от камеры — рукам нужно место для взмахов',
  noRight: 'Правая рука вне кадра — дирижируй перед грудью',
};

/** Собирает всё вместе: вызывается каждый кадр, возвращает события. */
export class Conductor {
  constructor() {
    this.baton = new Baton();
    this.tempo = new TempoTracker();
    this.finale = new Finale();
    this.fx = new OneEuro(2, 0.02);
    this.fy = new OneEuro(2, 0.02);
    this.reset();
  }

  reset() {
    this.baton.reset();
    this.tempo.reset();
    this.finale.reset();
    this.body = null;
    this.pointing = null;
    this.trail = [];
    this.level = 0.5;
    this.lastBeatT = -10;
    this.lastAmp = null;
    this.framing = 'noBody';
  }

  get dynamic() {
    return dynamicOf(this.level);
  }

  update(body, t, minDim) {
    const events = [];
    this.body = body;
    this.trail = this.trail.filter(p => t - p.t < 0.7);
    if (!body || !body.shouldersOk) {
      this.framing = 'noBody';
      this.pointing = null;
      return events;
    }
    this.framing = body.sw < 0.12 * minDim ? 'far' : body.sw > 0.6 * minDim ? 'near' : !body.rightOk ? 'noRight' : null;

    if (body.rightOk) {
      const p = { x: this.fx.filter(body.rw.x, t), y: this.fy.filter(body.rw.y, t) };
      this.hand = p;
      this.trail.push({ ...p, t });
      const beat = this.baton.update(t, p, body.sw);
      if (beat) {
        this.tempo.add(t);
        this.lastBeatT = t;
        this.lastAmp = beat.amp;
        this.level = this.level * 0.4 + beat.amp * 0.6;
        beat.lowHand = beat.y > Math.max(body.ls.y, body.rs.y) + 2.2 * body.sw;
        events.push(beat);
      }
    }
    // без взмахов громкость постепенно спадает
    if (t - this.lastBeatT > 1.5) this.level += (0.3 - this.level) * 0.02;

    this.pointing = body.leftOk ? armPointing(body) : null;
    events.push(...this.finale.update(t, body));
    return events;
  }
}
