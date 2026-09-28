// Итоги: счёт, точность, частая ошибка с советом и таблица рекордов.
import { C, drawGem, drawIcon } from '../theme.js';
import { POSE } from '../gestures.js';
import { ERRORS } from '../runes.js';
import { DwellButton, label, roundRect } from '../ui.js';
import { store } from '../store.js';

export class ResultsScene {
  constructor(app) {
    this.app = app;
    this.buttons = [
      new DwellButton('Ещё раз', () => app.go('battle'), { color: C.amber }),
      new DwellButton('Меню', () => app.go('menu'), { color: C.gold }),
    ];
  }

  enter(data) {
    this.data = data;
    const { stats } = data;
    this.rank = store.addRecord({ score: data.score, win: data.win, date: new Date().toISOString().slice(0, 10) });
    this.records = store.records().slice(0, 5);
    this.accuracy = stats.attempts ? Math.round((stats.hits / stats.attempts) * 100) : 0;
    const top = Object.entries(stats.errors).sort((a, b) => b[1] - a[1])[0];
    this.topError = top ? { ...ERRORS[top[0]], count: top[1] } : null;
    this.time = Math.round((performance.now() - stats.start) / 1000);
    this.app.toast.clear();
  }

  update(dt, now, events) {
    const { input, W, H, minDim } = this.app;
    const bw = Math.min((W - 60) / 2, minDim * 0.4);
    const bh = Math.max(52, minDim * 0.09);
    this.buttons.forEach((b, i) => b.place(W / 2 - bw - 10 + i * (bw + 20), H - bh - minDim * 0.14, bw, bh));
    for (const b of this.buttons) if (b.update(dt, input.present ? input.tip : null, this.app.sfx)) return;
    if (events.some(e => e.type === 'pose' && e.pose === POSE.THUMB)) this.app.go('battle');
    this.app.toast.show('Наведи палец на кнопку и подержи · большой палец вверх — ещё раз', 'info', 0.5);
  }

  render(ctx) {
    const { W, H, minDim } = this.app;
    const { win, score, stats } = this.data;
    const s = minDim * 0.035;

    const pw = Math.min(W - 32, minDim * 1.05);
    const px = (W - pw) / 2;
    const py = minDim * 0.04;
    const ph = H - py - minDim * 0.3;
    roundRect(ctx, px, py, pw, ph, 10);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.stroke();

    let y = py + s * 1.6;
    label(ctx, win ? 'Айдаһар повержен' : 'Печать пала', W / 2, y, { size: s * 1.5, weight: 700, title: true, color: win ? C.teal : C.danger });
    y += s * 2;
    label(ctx, `${score}`, W / 2, y, { size: s * 1.3, weight: 700, title: true, color: C.amber });
    if (this.rank === 1) label(ctx, '★ Новый рекорд!', W / 2, y + s * 1.2, { size: s * 0.8, color: C.amber });
    y += s * 2.4;

    const col = [
      [`${this.accuracy}%`, 'точность рун'],
      [`×${stats.maxCombo}`, 'лучшее комбо'],
      [`${stats.blocks}`, 'блоков щитом'],
      [`${this.time} с`, 'время'],
    ];
    const cw = pw / col.length;
    col.forEach(([v, t], i) => {
      label(ctx, v, px + cw * (i + 0.5), y, { size: s * 1.1, weight: 700, title: true, outline: false });
      label(ctx, t, px + cw * (i + 0.5), y + s * 1.1, { size: s * 0.6, weight: 500, color: C.muted, outline: false });
    });
    y += s * 2.8;

    if (this.topError) {
      label(ctx, `Частая ошибка: ${this.topError.label} (${this.topError.count})`, W / 2, y, { size: s * 0.75, color: C.danger, outline: false });
      label(ctx, `Совет: ${this.topError.advice}`, W / 2, y + s * 1.1, { size: s * 0.7, weight: 500, outline: false });
    } else {
      label(ctx, 'Ни одной ошибки — ты настоящий Сиқыршы!', W / 2, y, { size: s * 0.8, color: C.teal, outline: false });
    }
    y += s * 2.6;

    label(ctx, 'Летопись рекордов', W / 2, y, { size: s * 0.8, color: C.amber, outline: false });
    this.records.forEach((r, i) => {
      const mine = i + 1 === this.rank;
      label(ctx, `${i + 1}. ${r.score}${r.win ? ' · победа' : ''} · ${r.date}`, W / 2, y + s * 1.1 * (i + 1), { size: s * 0.65, weight: mine ? 800 : 500, color: mine ? C.amber : '#fff', outline: false });
    });

    for (const b of this.buttons) b.render(ctx);
  }
}
