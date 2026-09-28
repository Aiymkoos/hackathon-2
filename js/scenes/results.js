// Итоги концерта: звёзды, разбор по навыкам, частая ошибка с советом, рекорды.
import { C } from '../theme.js';
import { DwellButton, label, roundRect } from '../ui.js';
import { ERRORS } from './concert.js';
import { store } from '../store.js';

const CRITIC = [
  [90, '«Оркестр дышал вместе с дирижёром. Незабываемо!»'],
  [70, '«Уверенная рука и живая музыка. Браво!»'],
  [50, '«Неплохо, но оркестр иногда терялся»'],
  [0, '«Музыканты старались, но дирижёру нужна репетиция»'],
];

export class ResultsScene {
  constructor(app) {
    this.app = app;
    this.buttons = [
      new DwellButton('Ещё раз', () => app.go('concert'), { color: C.gold }),
      new DwellButton('Меню', () => app.go('menu'), { color: C.gold }),
    ];
  }

  enter(data) {
    this.data = data;
    this.rank = store.addRecord({ score: data.total, stars: data.stars, date: new Date().toISOString().slice(0, 10) });
    this.records = store.records().slice(0, 3);
    const top = Object.entries(data.stats.errors).sort((a, b) => b[1] - a[1])[0];
    this.topError = top && ERRORS[top[0]] ? { ...ERRORS[top[0]], count: top[1] } : null;
    this.critic = CRITIC.find(([min]) => data.total >= min)[1];
    this.shown = 0;
    this.app.toast.clear();
  }

  update(dt) {
    const { W, H, minDim, body, orchestra, toast } = this.app;
    this.shown = Math.min(1, this.shown + dt * 0.8);
    const bw = Math.min((W - 60) / 2, minDim * 0.4);
    const bh = Math.max(50, minDim * 0.085);
    this.buttons.forEach((b, i) => b.place(W / 2 - bw - 10 + i * (bw + 20), H - bh - 20, bw, bh));
    for (const b of this.buttons) if (b.update(dt, body?.pointer ?? null, () => orchestra.blip(660))) return;
    toast.show('Наведи руку на кнопку и подержи', 'info', 0.5);
  }

  render(ctx) {
    const { W, H, minDim } = this.app;
    const { total, stars, parts } = this.data;
    const s = Math.max(14, minDim * 0.036);
    const pw = Math.min(W - 32, minDim * 1.1);
    const px = (W - pw) / 2;
    const py = 16;
    const bottom = this.buttons[0].rect.y - 16;
    this.toastBottom = bottom;
    roundRect(ctx, px, py, pw, bottom - py - 60, 20);
    ctx.fillStyle = C.surface;
    ctx.fill();

    let y = py + s * 1.8;
    label(ctx, `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`, W / 2, y, { size: s * 1.8, color: C.gold, outline: false });
    y += s * 2.1;
    label(ctx, `${Math.round(total * this.shown)} баллов из 100`, W / 2, y, { size: s * 1.3, weight: 700, title: true, outline: false });
    if (this.rank === 1) label(ctx, '★ Лучший концерт!', W / 2, y + s * 1.2, { size: s * 0.75, color: C.gold, outline: false });
    y += s * 2.2;
    label(ctx, `Критик: ${this.critic}`, W / 2, y, { size: s * 0.75, weight: 500, color: C.cream, outline: false });
    y += s * 1.6;

    const rows = [
      ['Темп и ровность', parts.tempo, '#a8c8dc'],
      ['Динамика (громко/тихо)', parts.dynamics, '#c9a0b0'],
      ['Вступления групп', parts.cues, C.ok],
      ['Фермата и снятие', parts.finale, C.gold],
    ];
    const bw = pw * 0.42, bx = W / 2 + 10, bh = s * 0.7;
    for (const [name, v, color] of rows) {
      label(ctx, name, W / 2 - 10, y, { size: s * 0.72, weight: 500, align: 'right', outline: false });
      roundRect(ctx, bx, y - bh / 2, bw, bh, bh / 2);
      ctx.fillStyle = 'rgba(243,230,207,0.1)';
      ctx.fill();
      roundRect(ctx, bx, y - bh / 2, Math.max(bh, bw * v * this.shown), bh, bh / 2);
      ctx.fillStyle = color;
      ctx.fill();
      label(ctx, `${Math.round(v * 100)}%`, bx + bw + 8, y, { size: s * 0.65, align: 'left', outline: false });
      y += s * 1.35;
    }
    y += s * 0.5;
    if (this.topError) {
      label(ctx, `Частая ошибка: ${this.topError.label} (${this.topError.count})`, W / 2, y, { size: s * 0.72, color: C.danger, outline: false });
      label(ctx, `Совет: ${this.topError.advice}`, W / 2, y + s * 1.1, { size: s * 0.66, weight: 500, outline: false });
    } else label(ctx, 'Без единой ошибки — настоящий маэстро!', W / 2, y, { size: s * 0.8, color: C.ok, outline: false });
    y += s * 2.4;

    if (this.records.length && y + s * 1.1 * this.records.length < bottom - 60) {
      label(ctx, 'Лучшие концерты', W / 2, y, { size: s * 0.72, color: C.gold, outline: false });
      this.records.forEach((r, i) => {
        const mine = i + 1 === this.rank;
        label(ctx, `${i + 1}. ${r.score} баллов · ${'★'.repeat(r.stars)} · ${r.date}`, W / 2, y + s * 1.05 * (i + 1), { size: s * 0.62, weight: mine ? 800 : 500, color: mine ? C.gold : C.cream, outline: false });
      });
    }

    for (const b of this.buttons) b.render(ctx);
  }
}
