// Главное меню: кнопки выбираются пальцем (наведи и держи), большой палец вверх — быстрый старт.
import { C, drawGem, drawIcon } from '../theme.js';
import { POSE } from '../gestures.js';
import { DwellButton, label, roundRect } from '../ui.js';
import { drawCore } from '../sprites.js';
import { store } from '../store.js';

export class MenuScene {
  constructor(app) {
    this.app = app;
    this.buttons = [
      new DwellButton('В бой', () => app.go('battle'), { color: C.amber }),
      new DwellButton('Академия магов', () => app.go('academy'), { color: C.teal }),
    ];
  }

  enter() {
    this.app.toast.clear();
    this.records = store.records().slice(0, 5);
    this.firstTime = !store.academyDone();
  }

  update(dt, now, events) {
    const { input, W, H, minDim } = this.app;
    const bw = Math.min(W - 40, minDim * 0.5);
    const bh = Math.max(50, minDim * 0.085);
    this.buttons.forEach((b, i) => b.place((W - bw) / 2, H * 0.44 + i * (bh + 14), bw, bh));
    const tip = input.present ? input.tip : null;
    for (const b of this.buttons) if (b.update(dt, tip, this.app.sfx)) return;
    if (events.some(e => e.type === 'pose' && e.pose === POSE.THUMB)) {
      this.app.go(this.firstTime ? 'academy' : 'battle');
      return;
    }
    if (!input.present) this.app.toast.show('Подними руку перед камерой', 'info', 0.5);
    else this.app.toast.show('Наведи палец на кнопку и подержи · большой палец вверх — быстрый старт', 'info', 0.5);
  }

  render(ctx) {
    const { W, H, minDim, time } = this.app;
    drawCore(ctx, { x: W / 2, y: H * 0.58 }, minDim * 0.1, time, false);

    const t = minDim * 0.13;
    label(ctx, 'Сиқыршы', W / 2, H * 0.17, { size: t, weight: 700, title: true, color: C.ivory, outline: false });
    // тонкий золотой орнамент под названием
    ctx.save();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 1;
    const oy = H * 0.17 + t * 0.55;
    ctx.beginPath();
    ctx.moveTo(W / 2 - t * 1.6, oy);
    ctx.lineTo(W / 2 - 8, oy);
    ctx.moveTo(W / 2 + 8, oy);
    ctx.lineTo(W / 2 + t * 1.6, oy);
    ctx.stroke();
    ctx.restore();
    drawGem(ctx, W / 2, oy, 4, true, C.gold);
    label(ctx, 'Хранитель древней степи', W / 2, oy + t * 0.28, { size: Math.max(14, t * 0.2), weight: 600, color: C.muted, outline: false });
    if (this.firstTime) label(ctx, 'Впервые? Начни с Академии — это две минуты', W / 2, H * 0.44 - 18, { size: Math.max(13, t * 0.15), weight: 500, color: C.teal, outline: false });

    for (const b of this.buttons) b.render(ctx);

    if (this.records.length) {
      const last = this.buttons[this.buttons.length - 1].rect;
      const size = Math.max(13, minDim * 0.021);
      const y0 = last.y + last.h + size * 2;
      label(ctx, 'ЛЕТОПИСЬ', W / 2, y0, { size: size * 0.8, weight: 700, color: C.gold, outline: false });
      this.records.slice(0, 3).forEach((r, i) => {
        label(ctx, `${r.score} · ${r.win ? 'победа' : 'печать пала'}`, W / 2, y0 + size * 1.4 * (i + 1), { size: size * 0.9, weight: 500, color: C.ivory, outline: false });
      });
    }
  }
}
