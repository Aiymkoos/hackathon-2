// Главное меню: кнопки выбираются пальцем (наведи и держи), 👍 — быстрый старт.
import { POSE } from '../gestures.js';
import { RUNE_IDS } from '../runes.js';
import { DwellButton, drawRune, label, roundRect } from '../ui.js';
import { store } from '../store.js';

export class MenuScene {
  constructor(app) {
    this.app = app;
    this.buttons = [
      new DwellButton('⚔  В бой', () => app.go('battle'), { color: '#ff8a3d' }),
      new DwellButton('📖  Академия магов', () => app.go('academy'), { color: '#6ee7ff' }),
    ];
  }

  enter() {
    this.app.toast.clear();
    this.records = store.records().slice(0, 5);
    this.firstTime = !store.academyDone();
  }

  update(dt, now, events) {
    const { input, W, H, minDim } = this.app;
    const bw = Math.min(W - 40, minDim * 0.62);
    const bh = Math.max(56, minDim * 0.1);
    this.buttons.forEach((b, i) => b.place((W - bw) / 2, H * 0.5 + i * (bh + 18), bw, bh));
    const tip = input.present ? input.tip : null;
    for (const b of this.buttons) if (b.update(dt, tip, this.app.sfx)) return;
    if (events.some(e => e.type === 'pose' && e.pose === POSE.THUMB)) {
      this.app.go(this.firstTime ? 'academy' : 'battle');
      return;
    }
    if (!input.present) this.app.toast.show('Подними руку перед камерой', 'info', 0.5);
    else this.app.toast.show('Наведи указательный палец на кнопку и подержи · 👍 — быстрый старт', 'info', 0.5);
  }

  render(ctx) {
    const { W, H, minDim, time } = this.app;
    // парящие руны на фоне
    RUNE_IDS.forEach((id, i) => {
      const a = time * 0.3 + (i * Math.PI) / 2;
      drawRune(ctx, id, W / 2 + Math.cos(a) * W * 0.36, H * 0.3 + Math.sin(a) * H * 0.12, minDim * 0.1, { alpha: 0.35, width: 3 });
    });
    const t = minDim * 0.13;
    ctx.save();
    ctx.shadowColor = '#8b7dff';
    ctx.shadowBlur = 40;
    label(ctx, 'СИҚЫРШЫ', W / 2, H * 0.2, { size: t, weight: 800, color: '#f3e8ff' });
    ctx.restore();
    label(ctx, 'Маг рун: колдуй жестами через веб-камеру', W / 2, H * 0.2 + t * 0.75, { size: t * 0.25, weight: 600, color: '#cfc4ff' });
    if (this.firstTime) label(ctx, 'Впервые? Начни с Академии — 2 минуты', W / 2, H * 0.44, { size: t * 0.22, color: '#6ee7ff' });

    for (const b of this.buttons) b.render(ctx);

    if (this.records.length) {
      const last = this.buttons[this.buttons.length - 1].rect;
      const size = Math.max(14, minDim * 0.024);
      const y0 = last.y + last.h + size * 2;
      if (y0 + size * 1.5 * (this.records.length + 1) < H - size * 4) {
        roundRect(ctx, W / 2 - size * 9, y0 - size, size * 18, size * 1.5 * (this.records.length + 1) + size * 0.5, 14);
        ctx.fillStyle = 'rgba(15,8,40,0.7)';
        ctx.fill();
        label(ctx, '🏆 Рекорды', W / 2, y0, { size, color: '#ffd166' });
        this.records.forEach((r, i) => {
          label(ctx, `${i + 1}. ${r.score} очков${r.win ? ' · победа' : ''}`, W / 2, y0 + size * 1.5 * (i + 1), { size: size * 0.9, weight: 500, outline: false });
        });
      }
    }
  }
}
