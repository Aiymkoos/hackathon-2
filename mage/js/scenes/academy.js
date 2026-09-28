// Академия: пошаговое обучение каждому жесту с подсказками об ошибках.
import { C, drawGem, drawIcon } from '../theme.js';
import { POSE } from '../gestures.js';
import { RUNES, recognize } from '../runes.js';
import { FRAMING_HINTS } from '../input.js';
import { DwellButton, drawRune, label, roundRect } from '../ui.js';
import { drawManaOrb } from '../sprites.js';
import { store } from '../store.js';

const STEPS = [
  { kind: 'pose', pose: POSE.POINT, title: 'Волшебная палочка', text: 'Вытяни указательный палец, остальные согни' },
  { kind: 'rune', rune: 'circle', title: 'Руна льда — Круг', text: 'Вытяни палец и замри на миг — пойдёт линия. Нарисуй круг — руна сработает сама' },
  { kind: 'rune', rune: 'triangle', title: 'Руна огня — Треугольник', text: 'Три стороны и вернись в начало — углы можно чуть скруглить' },
  { kind: 'rune', rune: 'zigzag', title: 'Руна грозы — Молния', text: 'Сверху вниз: вправо, влево, вправо' },
  { kind: 'rune', rune: 'vee', title: 'Руна ветра — Галочка', text: 'Вниз и вверх: один острый угол внизу' },
  { kind: 'pose', pose: POSE.FIST, title: 'Щит', text: 'Сожми кулак — так ты закроешься от огня босса' },
  { kind: 'push', title: 'Взрыв маны', text: 'Раскрой ладонь, дождись полного заряда и толкни её к камере' },
];

const HOLD = 0.8;

export class AcademyScene {
  constructor(app) {
    this.app = app;
    this.doneButtons = [
      new DwellButton('В бой', () => app.go('battle'), { color: C.amber }),
      new DwellButton('Меню', () => app.go('menu'), { color: C.gold }),
    ];
  }

  enter() {
    this.step = 0;
    this.hold = 0;
    this.charge = 0;
    this.successT = 0;
    this.finished = false;
    this.app.toast.clear();
    this.app.feedback.clear();
  }

  // Руна засчитывается сразу, как только нарисована правильно.
  earlyCheck(pts) {
    const s = this.current;
    if (this.finished || this.successT > 0 || s?.kind !== 'rune') return false;
    return recognize(pts, { minSize: this.app.input.runeMinSize(this.app.minDim), expected: [s.rune] }).ok;
  }

  get current() {
    return STEPS[this.step];
  }

  pass() {
    this.successT = 1.1;
    this.app.sfx.success();
    const { W, H } = this.app;
    this.app.fx.burst(W / 2, H * 0.3, C.teal, 50, 400);
    this.app.toast.clear();
  }

  update(dt, now, events) {
    const { input, toast, minDim } = this.app;

    if (this.finished) {
      const bw = Math.min(this.app.W - 40, minDim * 0.5);
      const bh = Math.max(56, minDim * 0.1);
      this.doneButtons.forEach((b, i) => b.place((this.app.W - bw) / 2, this.app.H * 0.5 + i * (bh + 18), bw, bh));
      for (const b of this.doneButtons) if (b.update(dt, input.present ? input.tip : null, this.app.sfx)) return;
      if (events.some(e => e.type === 'pose' && e.pose === POSE.THUMB)) this.app.go('battle');
      return;
    }

    if (this.successT > 0) {
      this.successT -= dt;
      if (this.successT <= 0) {
        this.step++;
        this.hold = 0;
        this.charge = 0;
        if (this.step >= STEPS.length) {
          this.finished = true;
          store.setAcademyDone();
          this.app.sfx.win();
        }
      }
      return;
    }

    const s = this.current;
    if (!input.present) toast.show('Подними руку перед камерой', 'info', 0.5);
    else if (input.framing && input.poseTime(now) > 1) toast.show(FRAMING_HINTS[input.framing], 'info', 0.6);

    if (s.kind === 'pose') {
      if (input.pose === s.pose) {
        this.hold += dt;
        if (this.hold >= HOLD) this.pass();
      } else {
        this.hold = Math.max(0, this.hold - dt);
        if (input.near === s.pose && input.hint) toast.show(input.hint, 'error', 0.6);
      }
    }

    if (s.kind === 'rune') {
      if (input.pose === POSE.OTHER && input.near === POSE.POINT && input.hint && input.poseTime(now) > 0.5) toast.show(input.hint, 'error', 0.6);
      for (const e of events) {
        if (e.type !== 'stroke') continue;
        const res = recognize(e.pts, { minSize: this.app.input.runeMinSize(minDim), expected: [s.rune] });
        if (res.ok) {
          this.app.feedback.success(e.pts, RUNES[s.rune].color);
          this.app.feedback.items = this.app.feedback.items.filter(i => i.kind !== 'fail');
          this.pass();
        } else {
          this.app.feedback.fail(res);
          toast.show(res.error.hint, 'error', 3.2);
          this.app.sfx.error();
        }
      }
    }

    if (s.kind === 'push') {
      if (input.pose === POSE.PALM) {
        const before = this.charge;
        this.charge = Math.min(1, this.charge + dt / 0.9);
        if (Math.floor(before * 8) !== Math.floor(this.charge * 8)) this.app.sfx.charge(this.charge);
        if (this.charge >= 1) toast.show('Заряжено! Теперь резко толкни ладонь к камере', 'success', 0.6);
      } else {
        this.charge = Math.max(0, this.charge - dt * 1.5);
        if (input.near === POSE.PALM && input.hint) toast.show(input.hint, 'error', 0.6);
      }
      for (const e of events) {
        if (e.type === 'push') {
          if (this.charge >= 1) {
            this.app.sfx.boom();
            this.app.fx.flash(C.amber, 0.5);
            this.app.fx.shake(18, 0.4);
            this.pass();
          } else {
            toast.show('Рано! Держи ладонь раскрытой, пока шар не зарядится полностью', 'error', 2.5);
            this.app.sfx.error();
          }
        }
        if (e.type === 'weakPush' && this.charge >= 1) {
          toast.show('Толчок слишком слабый — двигай ладонь к камере резче и ближе', 'error', 2.5);
          this.app.sfx.error();
        }
      }
    }
  }

  render(ctx) {
    const { W, H, minDim, time, input } = this.app;
    if (this.finished) {
      label(ctx, 'Академия пройдена!', W / 2, H * 0.25, { size: minDim * 0.08, weight: 700, title: true, color: C.teal });
      label(ctx, 'Ты знаешь все руны. Пора в бой', W / 2, H * 0.25 + minDim * 0.08, { size: minDim * 0.035, color: C.muted });
      for (const b of this.doneButtons) b.render(ctx);
      return;
    }

    const s = this.current;
    // карточка задания сверху
    const cw = Math.min(W - 32, minDim * 1.1);
    const ch = minDim * 0.17;
    const cx = (W - cw) / 2;
    const cy = 16;
    roundRect(ctx, cx, cy, cw, ch, 10);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    label(ctx, `Шаг ${this.step + 1} из ${STEPS.length}`, cx + cw / 2, cy + ch * 0.2, { size: ch * 0.12, weight: 700, color: C.gold, outline: false });
    label(ctx, s.title, cx + cw / 2, cy + ch * 0.46, { size: ch * 0.22, weight: 700, title: true, outline: false });
    label(ctx, s.text, cx + cw / 2, cy + ch * 0.76, { size: Math.min(ch * 0.15, (cw / s.text.length) * 1.7), weight: 500, color: C.ivory, outline: false });

    // полоска прогресса по шагам
    const pw = cw / STEPS.length;
    STEPS.forEach((_, i) => {
      ctx.fillStyle = i < this.step ? C.teal : i === this.step ? C.gold : 'rgba(239,230,210,0.15)';
      ctx.fillRect(cx + i * pw + 3, cy + ch + 8, pw - 6, 3);
    });

    // образец справа: руна с «пишущим» огоньком или значок жеста
    const size = minDim * 0.16;
    const ox = W - size * 0.9 - 20;
    const oy = cy + ch + size * 0.85;
    roundRect(ctx, ox - size * 0.75, oy - size * 0.75, size * 1.5, size * 1.5, 10);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    label(ctx, 'ОБРАЗЕЦ', ox, oy - size * 0.6, { size: 11, weight: 700, color: C.gold, outline: false });
    if (s.kind === 'rune') {
      drawRune(ctx, s.rune, ox, oy + 6, size * 0.8, { alpha: 0.25, width: 2, glow: false });
      const p = (time * 0.5) % 1.2;
      const end = drawRune(ctx, s.rune, ox, oy + 6, size * 0.8, { width: 3, progress: Math.min(1, p) });
      ctx.fillStyle = C.ivory;
      ctx.beginPath();
      ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const icon = s.kind === 'push' ? 'palm' : s.pose === POSE.FIST ? 'fist' : 'point';
      // толчок показываем «приближением» значка
      const k = s.kind === 'push' ? 1 + 0.25 * Math.max(0, Math.sin(time * 3)) : 1;
      drawIcon(ctx, icon, ox, oy + 8, size * 0.75 * k, C.ivory, 1.4);
    }

    if (s.kind === 'pose' && this.hold > 0) {
      label(ctx, `${Math.round((this.hold / HOLD) * 100)}%`, W / 2, H * 0.55, { size: minDim * 0.08, weight: 700, title: true, color: C.teal });
    }
    if (s.kind === 'push' && input.present) drawManaOrb(ctx, input.palm.x, input.palm.y, this.charge, minDim, time);

    if (this.successT > 0) label(ctx, 'Отлично!', W / 2, H * 0.45, { size: minDim * 0.1, weight: 700, title: true, color: C.teal });
  }
}
