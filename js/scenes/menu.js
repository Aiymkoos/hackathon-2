// Главное меню: кнопка выбирается правой рукой (наведи и подержи).
import { FRAMING_HINTS } from '../conductor.js';
import { DwellButton, label, roundRect } from '../ui.js';
import { drawSection } from '../stage.js';
import { store } from '../store.js';

export class MenuScene {
  constructor(app) {
    this.app = app;
    this.buttons = [
      new DwellButton('🎼  Концерт', () => app.go('concert'), { color: '#ffd166' }),
      new DwellButton('🎓  Репетиция', () => app.go('rehearsal'), { color: '#6ee7ff' }),
    ];
  }

  enter() {
    this.app.toast.clear();
    this.records = store.records().slice(0, 3);
    this.firstTime = !store.academyDone();
  }

  update(dt) {
    const { W, H, minDim, conductor, body, orchestra, toast } = this.app;
    const bw = Math.min(W - 40, minDim * 0.5);
    const bh = Math.max(52, minDim * 0.09);
    this.buttons.forEach((b, i) => b.place((W - bw) / 2, H * 0.5 + i * (bh + 16), bw, bh));
    const tip = body?.pointer ?? null;
    for (const b of this.buttons) if (b.update(dt, tip, () => orchestra.blip(660))) return;
    if (conductor.framing && conductor.framing !== 'noRight') toast.show(FRAMING_HINTS[conductor.framing], 'info', 0.5);
    else toast.show('Наведи руку на кнопку и подержи', 'info', 0.5);
  }

  render(ctx) {
    const { W, H, minDim, time, sections } = this.app;
    for (const s of sections) drawSection(ctx, s, { active: true, pulse: 0.5 + 0.5 * Math.sin(time * 2 + s.x), due: false, aimed: false }, time);

    const t = minDim * 0.12;
    ctx.save();
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 40;
    label(ctx, 'МАЭСТРО', W / 2, H * 0.3, { size: t, weight: 800, color: '#fff4d6' });
    ctx.restore();
    label(ctx, 'Дирижируй настоящим оркестром — руками, через веб-камеру', W / 2, H * 0.3 + t * 0.72, { size: Math.max(14, t * 0.22), weight: 600, color: '#e6ddff' });
    if (this.firstTime) label(ctx, 'Впервые? Начни с репетиции — 2 минуты', W / 2, H * 0.3 + t * 1.15, { size: Math.max(13, t * 0.19), color: '#6ee7ff' });

    for (const b of this.buttons) b.render(ctx);

    if (this.records.length) {
      const last = this.buttons[this.buttons.length - 1].rect;
      const size = Math.max(13, minDim * 0.022);
      const y0 = last.y + last.h + size * 1.8;
      roundRect(ctx, W / 2 - size * 8, y0 - size, size * 16, size * 1.4 * (this.records.length + 1) + size * 0.4, 12);
      ctx.fillStyle = 'rgba(15,8,40,0.7)';
      ctx.fill();
      label(ctx, '🏆 Лучшие концерты', W / 2, y0, { size, color: '#ffd166', outline: false });
      this.records.forEach((r, i) => label(ctx, `${i + 1}. ${r.score} баллов · ${'★'.repeat(r.stars ?? 0)}`, W / 2, y0 + size * 1.4 * (i + 1), { size: size * 0.9, weight: 500, outline: false }));
    }
  }
}
