// Академия: пошаговое обучение каждому жесту с подсказками об ошибках.
import { POSE } from '../gestures.js';
import { RUNES, recognize } from '../runes.js';
import { FRAMING_HINTS } from '../input.js';
import { DwellButton, drawRune, label, roundRect } from '../ui.js';
import { drawManaOrb } from '../sprites.js';
import { store } from '../store.js';

const STEPS = [
  { kind: 'pose', pose: POSE.POINT, title: 'Волшебная палочка', text: 'Вытяни указательный палец, остальные согни' },
  { kind: 'rune', rune: 'circle', title: 'Руна льда — Круг', text: 'Нарисуй пальцем круг и замкни его. Закончил — замри на секунду' },
  { kind: 'rune', rune: 'triangle', title: 'Руна огня — Треугольник', text: 'Три резких угла и вернись в начало' },
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
      new DwellButton('⚔  В бой', () => app.go('battle'), { color: '#ff8a3d' }),
      new DwellButton('↩  Меню', () => app.go('menu'), { color: '#8b7dff' }),
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

  get current() {
    return STEPS[this.step];
  }

  pass() {
    this.successT = 1.1;
    this.app.sfx.success();
    const { W, H } = this.app;
    this.app.fx.burst(W / 2, H * 0.3, '#7dff9b', 50, 400);
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
        const res = recognize(e.pts, { minSize: minDim * 0.14, expected: [s.rune] });
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
            this.app.fx.flash('#ffd166', 0.5);
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
      label(ctx, 'Академия пройдена!', W / 2, H * 0.25, { size: minDim * 0.08, weight: 800, color: '#7dff9b' });
      label(ctx, 'Ты знаешь все руны. Пора в бой · 👍', W / 2, H * 0.25 + minDim * 0.08, { size: minDim * 0.035, color: '#cfc4ff' });
      for (const b of this.doneButtons) b.render(ctx);
      return;
    }

    const s = this.current;
    // карточка задания сверху
    const cw = Math.min(W - 32, minDim * 1.1);
    const ch = minDim * 0.17;
    const cx = (W - cw) / 2;
    const cy = 16;
    roundRect(ctx, cx, cy, cw, ch, 18);
    ctx.fillStyle = 'rgba(15,8,40,0.8)';
    ctx.fill();
    label(ctx, `Шаг ${this.step + 1} из ${STEPS.length}`, cx + cw / 2, cy + ch * 0.2, { size: ch * 0.14, color: '#8b7dff', outline: false });
    label(ctx, s.title, cx + cw / 2, cy + ch * 0.46, { size: ch * 0.22, weight: 800, outline: false });
    label(ctx, s.text, cx + cw / 2, cy + ch * 0.76, { size: Math.min(ch * 0.15, (cw / s.text.length) * 1.7), weight: 500, color: '#e6ddff', outline: false });

    // полоска прогресса по шагам
    const pw = cw / STEPS.length;
    STEPS.forEach((_, i) => {
      ctx.fillStyle = i < this.step ? '#7dff9b' : i === this.step ? '#8b7dff' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(cx + i * pw + 3, cy + ch + 8, pw - 6, 5);
    });

    // образец руны с «пишущим» огоньком
    if (s.kind === 'rune') {
      const size = minDim * 0.16;
      const ox = W - size * 0.9 - 20;
      const oy = cy + ch + size * 0.85;
      roundRect(ctx, ox - size * 0.75, oy - size * 0.75, size * 1.5, size * 1.5, 16);
      ctx.fillStyle = 'rgba(15,8,40,0.6)';
      ctx.fill();
      label(ctx, 'образец', ox, oy - size * 0.62, { size: 14, color: '#cfc4ff', outline: false });
      drawRune(ctx, s.rune, ox, oy + 6, size * 0.8, { alpha: 0.3, width: 3, glow: false });
      const p = (time * 0.5) % 1.2;
      const end = drawRune(ctx, s.rune, ox, oy + 6, size * 0.8, { width: 4, progress: Math.min(1, p) });
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (s.kind === 'pose' && this.hold > 0) {
      label(ctx, `${Math.round((this.hold / HOLD) * 100)}%`, W / 2, H * 0.55, { size: minDim * 0.08, weight: 800, color: '#7dff9b' });
    }
    if (s.kind === 'push' && input.present) drawManaOrb(ctx, input.palm.x, input.palm.y, this.charge, minDim, time);

    if (this.successT > 0) label(ctx, 'Отлично!', W / 2, H * 0.45, { size: minDim * 0.1, weight: 800, color: '#7dff9b' });
  }
}
