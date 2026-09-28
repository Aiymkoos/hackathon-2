// Главное меню: кнопка выбирается правой рукой (наведи и подержи).
import { C } from '../theme.js';
import { FRAMING_HINTS } from '../conductor.js';
import { DwellButton, label, roundRect } from '../ui.js';
import { drawSection } from '../stage.js';
import { store } from '../store.js';

export class MenuScene {
  constructor(app) {
    this.app = app;
    this.buttons = [
      new DwellButton('Концерт', () => app.go('concert'), { color: C.gold }),
      new DwellButton('Репетиция', () => app.go('rehearsal'), { color: '#a8c8dc' }),
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

    const t = minDim * 0.13;
    label(ctx, 'Маэстро', W / 2, H * 0.3, { size: t, weight: 700, title: true, italic: true, color: C.cream, outline: false });
    ctx.save();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 1;
    const oy = H * 0.3 + t * 0.55;
    ctx.beginPath();
    ctx.moveTo(W / 2 - t * 1.5, oy);
    ctx.lineTo(W / 2 + t * 1.5, oy);
    ctx.stroke();
    ctx.restore();
    label(ctx, 'Взмахни — и оркестр оживёт', W / 2, oy + t * 0.3, { size: Math.max(15, t * 0.22), weight: 500, title: true, italic: true, color: C.gold, outline: false });
    if (this.firstTime) label(ctx, 'Впервые? Начни с репетиции — это две минуты', W / 2, oy + t * 0.62, { size: Math.max(13, t * 0.15), weight: 500, color: C.muted, outline: false });

    for (const b of this.buttons) b.render(ctx);

    if (this.records.length) {
      const last = this.buttons[this.buttons.length - 1].rect;
      const size = Math.max(13, minDim * 0.022);
      const y0 = last.y + last.h + size * 1.8;
            label(ctx, 'ЛУЧШИЕ КОНЦЕРТЫ', W / 2, y0, { size: size * 0.8, weight: 700, color: C.gold, outline: false });
      this.records.forEach((r, i) => label(ctx, `${i + 1}. ${r.score} баллов · ${'★'.repeat(r.stars ?? 0)}`, W / 2, y0 + size * 1.4 * (i + 1), { size: size * 0.9, weight: 500, outline: false }));
    }
  }
}
