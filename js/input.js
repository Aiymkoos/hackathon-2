// Превращает кадры с рукой в игровые события:
//  stroke    — закончен штрих пальцем (руна)
//  pose      — поза руки сменилась (после стабилизации)
//  push      — ладонь резко толкнули к камере
//  weakPush  — толчок был, но слишком слабый

import { POSE } from './gestures.js';
import { OneEuro } from './filters.js';

const STABLE_FRAMES = 2;   // столько кадров подряд поза должна держаться
const LOST_MS = 250;       // рука пропала дольше — считаем, что её нет
const LOST_DRAW_MS = 500;  // …а во время рисования ждём дольше
const STILL_MS = 420;      // палец замер на столько — штрих закончен (на углах рука замедляется, поэтому с запасом)
const ARM_MS = 140;        // замри на столько — начнём рисовать

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
    this.lastSample = -Infinity;
    this.armingProgress = 0;
    this.waitMove = null;
  }

  // Only fresh camera observations enter this method. A sample id makes the
  // contract explicit and prevents render-rate-dependent pose recognition.
  update(obs, now, minDim) {
    const events = [];
    if (obs?.sampleId != null && obs.sampleId === this.lastSample) return events;
    if (obs?.sampleId != null) this.lastSample = obs.sampleId;

    if (!obs || !obs.present) {
      if (this.present) this.lostAt = now;
      this.present = false;
      this.landmarks = null;
      // во время рисования камера может на миг потерять руку — линию не рвём
      const grace = this.stroke ? LOST_DRAW_MS : LOST_MS;
      if (now - this.lostAt > grace) {
        this.drawState = 'none';
        if (this.stroke) events.push({ type: 'trackingLost' });
        this.cancelStroke();
        this.setPose(POSE.NONE, now, events);
        this.poseHist.length = 0;
        this.fx.reset();
        this.fy.reset();
      }
      return events;
    }

    if (!this.present && this.stroke) {
      // Never connect two positions across a missing-camera interval.
      this.cancelStroke();
      this.fx.reset();
      this.fy.reset();
      events.push({ type: 'trackingLost' });
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

    // Пока рисуем, «неясный жест» (палец на миг согнулся, рука повернулась)
    // не обрывает руну — остановить её может только чёткий другой жест.
    const pose = this.stroke && obs.pose === POSE.OTHER ? POSE.POINT : obs.pose;
    this.poseHist.push(pose);
    if (this.poseHist.length > STABLE_FRAMES) this.poseHist.shift();
    if (this.poseHist.length === STABLE_FRAMES && this.poseHist.every(p => p === pose)) {
      this.setPose(pose, now, events);
    }

    this.updateStroke(now, minDim, events);
    // Palm power is charged by the scene; no depth/push estimate is required.
    return events;
  }

  cancelStroke() {
    this.stroke = null;
    this.arm = [];
    this.armAnchor = null;
    this.waitMove = null;
    this.armingProgress = 0;
    this.drawState = 'idle';
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
    this.armAnchor = null;
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
    this.armAnchor = null;
    }
    const p = { x: this.tip.x, y: this.tip.y, t: now };

    if (!this.stroke) {
      if (!this.armAnchor || dist(this.armAnchor, p) >= unit * 1.5) this.armAnchor = p;
      this.armingProgress = Math.min(1, (now - this.armAnchor.t) / ARM_MS);
      const still = this.armingProgress >= 1;
      if (!still) {
        this.drawState = 'arming';
        return;
      }
      this.stroke = { pts: [], len: 0, startedAt: now };
      this.arm = [];
    this.armAnchor = null;
    }
    this.drawState = 'drawing';
    this.armingProgress = 1;

    const pts = this.stroke.pts;
    if (pts.length) this.stroke.len += dist(pts[pts.length - 1], p);
    pts.push(p);
    if (pts.length > 600 || now - this.stroke.startedAt > 10000) {
      this.finishStroke(events, minDim);
      this.waitMove = { x: p.x, y: p.y };
      return;
    }

    // Руна засчитывается сразу, как только нарисована, — не дожидаясь остановки.
    if (this.earlyCheck && pts.length % 3 === 0 && this.stroke.len > unit * 8 && this.earlyCheck(pts)) {
      this.finishStroke(events, minDim);
      this.waitMove = { x: p.x, y: p.y };
      return;
    }

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


}

export const FRAMING_HINTS = {
  far: 'Поднеси руку ближе к камере',
  near: 'Отодвинь руку чуть дальше от камеры',
  edge: 'Рука у края кадра — держи её ближе к центру',
};
