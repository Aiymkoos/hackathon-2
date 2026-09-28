// Превращает кадры с рукой в игровые события:
//  stroke    — закончен штрих пальцем (руна)
//  pose      — поза руки сменилась (после стабилизации)
//  push      — ладонь резко толкнули к камере
//  weakPush  — толчок был, но слишком слабый

import { POSE } from './gestures.js';
import { OneEuro } from './filters.js';

const STABLE_FRAMES = 3;   // столько кадров подряд поза должна держаться
const LOST_MS = 250;       // рука пропала дольше — считаем, что её нет
const STILL_MS = 350;      // палец замер на столько — штрих закончен
const ARM_MS = 220;        // замри на столько — начнём рисовать
const PUSH_RATIO = 1.3;    // во сколько раз должна вырасти ладонь при толчке
const WEAK_RATIO = 1.12;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class Input {
  constructor() {
    this.fx = new OneEuro();
    this.fy = new OneEuro();
    this.present = false;
    this.pose = POSE.NONE;
    this.poseSince = 0;
    this.near = null;
    this.hint = null;
    this.framing = null;
    this.tip = null;
    this.palm = null;
    this.scale = 0;
    this.landmarks = null;
    this.stroke = null;
    this.lostAt = 0;
    this.poseHist = [];
    this.waitMove = null;
    this.scaleHist = [];
    this.pushPeak = 1;
    this.pushCooldown = 0;
  }

  update(obs, now, minDim) {
    const events = [];

    if (!obs || !obs.present) {
      if (this.present) this.lostAt = now;
      this.present = false;
      this.drawState = 'none';
      this.landmarks = null;
      if (now - this.lostAt > LOST_MS) {
        if (this.stroke) this.finishStroke(events, minDim);
        this.setPose(POSE.NONE, now, events);
        this.poseHist.length = 0;
        this.fx.reset();
        this.fy.reset();
      }
      return events;
    }

    this.present = true;
    this.landmarks = obs.landmarks;
    this.palm = obs.palm;
    this.scale = obs.scale;
    this.near = obs.near ?? null;
    this.hint = obs.hint ?? null;
    const t = now / 1000;
    this.tip = { x: this.fx.filter(obs.tip.x, t), y: this.fy.filter(obs.tip.y, t) };
    this.framing = this.checkFraming(obs, minDim);

    this.poseHist.push(obs.pose);
    if (this.poseHist.length > STABLE_FRAMES) this.poseHist.shift();
    if (this.poseHist.length === STABLE_FRAMES && this.poseHist.every(p => p === obs.pose)) {
      this.setPose(obs.pose, now, events);
    }

    this.updateStroke(now, minDim, events);
    this.updatePush(now, events);
    return events;
  }

  setPose(pose, now, events) {
    if (pose === this.pose) return;
    events.push({ type: 'pose', pose, prev: this.pose });
    this.pose = pose;
    this.poseSince = now;
  }

  // Сколько секунд держится текущая поза.
  poseTime(now) {
    return (now - this.poseSince) / 1000;
  }

  checkFraming(obs, minDim) {
    if (obs.scale < 0.045) return 'far';
    if (obs.scale > 0.42) return 'near';
    const m = minDim * 0.03;
    const { x, y } = obs.tip;
    if (x < m || y < m || x > innerWidth - m || y > innerHeight - m) return 'edge';
    return null;
  }

  // Размер руки на экране (запястье → основание среднего пальца), px.
  handPx(minDim) {
    return this.scale * minDim;
  }

  // Минимальный размер руны: примерно полторы ладони, но не больше 14% экрана.
  // Если человек сидит далеко и рука маленькая — хватит и маленькой руны.
  runeMinSize(minDim) {
    return Math.min(minDim * 0.14, Math.max(minDim * 0.05, this.handPx(minDim) * 1.4));
  }

  // Рисование: вытянул палец → замер на миг (старт) → рисуешь → замер (конец).
  // Так в руну не попадает движение руки к месту, откуда начинаешь.
  updateStroke(now, minDim, events) {
    const unit = Math.max(minDim * 0.012, this.handPx(minDim) * 0.12); // «неподвижно» — в долях ладони
    if (this.pose !== POSE.POINT) {
      if (this.stroke) this.finishStroke(events, minDim);
      this.waitMove = null;
      this.arm = [];
      this.drawState = this.present ? 'idle' : 'none';
      return;
    }
    // После остановки новый штрих начинается, только когда палец снова двинулся.
    if (this.waitMove) {
      if (dist(this.tip, this.waitMove) < unit * 3) {
        this.drawState = 'checking';
        return;
      }
      this.waitMove = null;
      this.arm = [];
    }
    const p = { x: this.tip.x, y: this.tip.y, t: now };

    if (!this.stroke) {
      this.arm = (this.arm ?? []).filter(q => now - q.t <= ARM_MS);
      this.arm.push(p);
      const still = now - this.arm[0].t >= ARM_MS * 0.8 && this.arm.every(q => dist(q, p) < unit * 1.5);
      if (!still) {
        this.drawState = 'arming';
        return;
      }
      this.stroke = { pts: [], len: 0, startedAt: now };
      this.arm = [];
    }
    this.drawState = 'drawing';

    const pts = this.stroke.pts;
    if (pts.length) this.stroke.len += dist(pts[pts.length - 1], p);
    pts.push(p);

    // Палец замер после рисования — штрих закончен.
    if (this.stroke.len > unit * 8 && now - pts[0].t > STILL_MS) {
      let spread = 0;
      let covered = false;
      for (let i = pts.length - 1; i >= 0 && now - pts[i].t <= STILL_MS; i--) {
        spread = Math.max(spread, dist(pts[i], p));
        covered = now - pts[i].t >= STILL_MS * 0.8;
      }
      if (covered && spread < unit * 1.5) {
        this.finishStroke(events, minDim);
        this.waitMove = { x: p.x, y: p.y };
      }
    }
  }

  finishStroke(events, minDim) {
    const s = this.stroke;
    this.stroke = null;
    if (s && s.pts.length >= 6 && s.len > minDim * 0.03) events.push({ type: 'stroke', pts: s.pts });
  }

  // Толчок ладонью: видимый размер руки быстро растёт.
  updatePush(now, events) {
    if (this.pose !== POSE.PALM) {
      this.scaleHist.length = 0;
      this.pushPeak = 1;
      return;
    }
    this.scaleHist.push({ t: now, s: this.scale });
    while (this.scaleHist.length && now - this.scaleHist[0].t > 600) this.scaleHist.shift();
    if (now < this.pushCooldown) return;

    const minS = Math.min(...this.scaleHist.map(h => h.s));
    const ratio = this.scale / minS;
    if (ratio > PUSH_RATIO) {
      events.push({ type: 'push', ratio });
      this.pushCooldown = now + 900;
      this.scaleHist.length = 0;
      this.pushPeak = 1;
      return;
    }
    this.pushPeak = Math.max(this.pushPeak, ratio);
    if (this.pushPeak > WEAK_RATIO && ratio < this.pushPeak - 0.06) {
      events.push({ type: 'weakPush', ratio: this.pushPeak });
      this.pushCooldown = now + 600;
      this.scaleHist.length = 0;
      this.pushPeak = 1;
    }
  }
}

export const FRAMING_HINTS = {
  far: 'Поднеси руку ближе к камере',
  near: 'Отодвинь руку чуть дальше от камеры',
  edge: 'Рука у края кадра — держи её ближе к центру',
};
