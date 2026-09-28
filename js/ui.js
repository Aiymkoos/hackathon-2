// Общие элементы интерфейса: текст, подсказки, кнопки «наведи и держи».

import { C, BODY_FONT, TITLE_FONT } from './theme.js';

export const FONT = BODY_FONT;

export function font(ctx, size, weight = 600, family = FONT) {
  ctx.font = `${weight} ${Math.round(size)}px ${family}`;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function label(ctx, str, x, y, { size = 24, color = C.cream, weight = 700, align = 'center', outline = true, title = false, italic = false } = {}) {
  font(ctx, size, weight, title ? TITLE_FONT : FONT);
  if (italic) ctx.font = `italic ${ctx.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(12,4,6,0.8)';
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

const TOAST_STYLE = {
  error: { bg: 'rgba(30,8,10,0.92)', border: C.danger, icon: '✕' },
  warn: { bg: 'rgba(32,20,8,0.92)', border: C.gold, icon: '!' },
  success: { bg: 'rgba(16,24,12,0.92)', border: C.ok, icon: '✦' },
  info: { bg: C.surface, border: C.line, icon: '♪' },
};

// Подсказки внизу экрана. Одинаковый текст не дублируется, а продлевается.
export class Toaster {
  constructor() {
    this.items = [];
  }

  show(text, kind = 'info', ttl = 2.6) {
    const same = this.items.find(t => t.text === text);
    if (same) {
      same.life = Math.max(same.life, ttl);
      return;
    }
    this.items.unshift({ text, kind, life: ttl });
    if (this.items.length > 2) this.items.length = 2;
  }

  clear() {
    this.items.length = 0;
  }

  update(dt) {
    for (const t of this.items) t.life -= dt;
    this.items = this.items.filter(t => t.life > 0);
  }

  // bottom — нижняя граница, над которой складываются подсказки
  render(ctx, W, H, minDim, bottom = H - 12) {
    const size = Math.max(15, Math.min(26, minDim * 0.032));
    let y = bottom - 8;
    ctx.save();
    for (const t of this.items) {
      const st = TOAST_STYLE[t.kind] ?? TOAST_STYLE.info;
      font(ctx, size, 600);
      const lines = wrap(ctx, `${st.icon}  ${t.text}`, Math.min(W - 48, 900));
      const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + size * 1.6;
      const h = lines.length * size * 1.3 + size * 0.9;
      ctx.globalAlpha = Math.min(1, t.life * 3);
      roundRect(ctx, (W - w) / 2, y - h, w, h, 8);
      ctx.fillStyle = st.bg;
      ctx.fill();
      ctx.strokeStyle = st.border;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = st.border === C.line ? C.gold : st.border;
      ctx.fillRect((W - w) / 2, y - h + 8, 2, h - 16);
      ctx.fillStyle = C.cream;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, W / 2, y - h + size * 0.45 + size * 1.3 * (i + 0.5)));
      y -= h + 10;
    }
    ctx.restore();
  }
}

// Кнопка без мыши: наведи правую руку и подержи.
// Кнопки, видимые сейчас на экране: по ним работает запасной клик мышью или касание.
const visible = new Set();
addEventListener('pointerup', e => {
  for (const b of visible) {
    const r = b.rect;
    if (e.clientX > r.x && e.clientX < r.x + r.w && e.clientY > r.y && e.clientY < r.y + r.h) b.clicked = true;
  }
});

export class DwellButton {
  constructor(text, onFire, { hold = 1.1, color = C.gold } = {}) {
    this.text = text;
    this.onFire = onFire;
    this.hold = hold;
    this.color = color;
    this.progress = 0;
    this.hover = false;
    this.rect = { x: 0, y: 0, w: 0, h: 0 };
  }

  place(x, y, w, h) {
    this.rect = { x, y, w, h };
  }

  update(dt, tip, onHover) {
    const r = this.rect;
    const pad = 24; // запас: рука немного дрожит
    this.hover = !!tip && tip.x > r.x - pad && tip.x < r.x + r.w + pad && tip.y > r.y - pad && tip.y < r.y + r.h + pad;
    if (this.clicked) {
      this.clicked = false;
      this.onFire();
      return true;
    }
    if (this.hover) {
      if (this.progress === 0) onHover?.();
      this.progress += dt / this.hold;
      if (this.progress >= 1) {
        this.progress = 0;
        this.onFire();
        return true;
      }
    } else this.progress = Math.max(0, this.progress - dt * 0.7);
    return false;
  }

  render(ctx) {
    visible.add(this);
    this.seen = performance.now();
    for (const b of visible) if (performance.now() - b.seen > 300) visible.delete(b);
    const { x, y, w, h } = this.rect;
    const r = Math.min(8, h / 4);
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = this.hover ? C.surfaceHi : C.surface;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = C.gold;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(x, y, w * this.progress, h);
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x, y + h - 2, w * this.progress, 2);
    ctx.restore();
    ctx.strokeStyle = this.hover ? C.gold : C.line;
    ctx.lineWidth = this.hover ? 1.6 : 1;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    ctx.restore();
    label(ctx, this.text, x + w / 2, y + h / 2, { size: h * 0.38, weight: 600, outline: false, title: true });
  }
}
