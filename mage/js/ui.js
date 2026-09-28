// Отрисовка интерфейса: руны, рука, след пальца, подсказки, кнопки «наведи и держи».
import { RUNES } from './runes.js';
import { POSE } from './gestures.js';

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

export function label(ctx, str, x, y, { size = 24, color = C.ivory, weight = 700, align = 'center', outline = true, title = false } = {}) {
  font(ctx, size, weight, title ? TITLE_FONT : FONT);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(4,8,9,0.8)';
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Wrapped body copy: readable on narrow screens without shrinking to tiny text.
export function paragraph(ctx, text, x, y, maxWidth, { size = 15, color = C.ivory, align = 'center' } = {}) {
  font(ctx, size, 500);
  const lines = wrap(ctx, text, maxWidth);
  lines.forEach((line, i) => label(ctx, line, x, y + i * size * 1.4, { size, color, align, weight: 500, outline: false }));
  return lines.length * size * 1.4;
}

/**
 * Рисует руну по образцу. progress (0..1) — рисовать только часть пути;
 * возвращает точку конца нарисованной части (для анимации «пишущего» огонька).
 */
export function drawRune(ctx, id, cx, cy, size, { color = RUNES[id].color, width = 4, alpha = 1, glow = true, dash = null, progress = 1 } = {}) {
  const path = RUNES[id].path.map(([x, y]) => ({ x: cx + x * size, y: cy + y * size }));
  const segs = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    segs.push(l);
    total += l;
  }
  let left = total * progress;
  let end = path[0];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash(dash);
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = width * 3;
  }
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length && left > 0; i++) {
    const k = Math.min(1, left / segs[i - 1]);
    end = { x: path[i - 1].x + (path[i].x - path[i - 1].x) * k, y: path[i - 1].y + (path[i].y - path[i - 1].y) * k };
    ctx.lineTo(end.x, end.y);
    left -= segs[i - 1];
  }
  ctx.stroke();
  ctx.restore();
  return end;
}

const HAND_LINKS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

export const POSE_COLORS = {
  [POSE.POINT]: C.teal,
  [POSE.PALM]: C.amber,
  [POSE.FIST]: C.ivory,
  [POSE.THUMB]: C.sage,
  [POSE.OTHER]: 'rgba(239,230,210,0.55)',
  [POSE.NONE]: 'rgba(239,230,210,0.55)',
};

export function drawHand(ctx, lm, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [a, b] of HAND_LINKS) {
    ctx.moveTo(lm[a].x, lm[a].y);
    ctx.lineTo(lm[b].x, lm[b].y);
  }
  ctx.stroke();
  for (const p of lm) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Светящийся след пальца, пока рисуется руна.
export function drawTrail(ctx, pts, color = C.teal, alpha = 1) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, a, c] of [[16, 0.12, color], [7, 0.45, color], [2.5, 1, C.ivory]]) {
    ctx.globalAlpha = a * alpha;
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  ctx.restore();
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
  error: { bg: 'rgba(24,12,10,0.92)', border: C.danger, icon: '✕' },
  warn: { bg: 'rgba(26,18,8,0.92)', border: C.amber, icon: '!' },
  success: { bg: 'rgba(10,22,20,0.92)', border: C.teal, icon: '✦' },
  info: { bg: C.surface, border: C.line, icon: '·' },
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

  render(ctx, W, H, minDim, { bottom = H - 16, maxWidth = 900 } = {}) {
    const size = Math.max(14, Math.min(22, minDim * 0.028));
    let y = bottom;
    ctx.save();
    for (const t of this.items) {
      const st = TOAST_STYLE[t.kind] ?? TOAST_STYLE.info;
      font(ctx, size, 600);
      const lines = wrap(ctx, `${st.icon}  ${t.text}`, Math.min(W - 48, maxWidth));
      const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + size * 1.6;
      const h = lines.length * size * 1.3 + size * 0.9;
      ctx.globalAlpha = Math.min(1, t.life * 3);
      roundRect(ctx, (W - w) / 2, y - h, w, h, 8);
      ctx.fillStyle = st.bg;
      ctx.fill();
      ctx.strokeStyle = st.border;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = st.border === C.line ? C.ivory : st.border;
      ctx.fillRect((W - w) / 2, y - h + 8, 2, h - 16);
      ctx.fillStyle = C.ivory;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, W / 2, y - h + size * 0.45 + size * 1.3 * (i + 0.5)));
      y -= h + 10;
    }
    ctx.restore();
  }
}

// Кнопка без мыши: наведи указательный палец и подержи.
// Кнопки, видимые сейчас на экране: по ним работает запасной клик мышью или касание.
const visible = new Set();
addEventListener('pointerup', e => {
  for (const b of visible) {
    if (performance.now() - b.seen > 150) continue;
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

  update(dt, tip, sfx) {
    const r = this.rect;
    const pad = Math.min(8, r.h * 0.1); // запас: рука немного дрожит
    this.hover = !!tip && tip.x > r.x - pad && tip.x < r.x + r.w + pad && tip.y > r.y - pad && tip.y < r.y + r.h + pad;
    if (this.clicked) {
      this.clicked = false;
      this.onFire();
      return true;
    }
    if (this.hover) {
      if (this.progress === 0) sfx?.click();
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
    const r = Math.min(10, h / 4);
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = this.hover ? C.surfaceHi : C.surface;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.22;
    ctx.fillRect(x, y, w * this.progress, h);
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x, y + h - 2, w * this.progress, 2);
    ctx.restore();
    ctx.strokeStyle = this.hover ? this.color : C.line;
    ctx.lineWidth = this.hover ? 1.6 : 1;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    ctx.restore();
    label(ctx, this.text, x + w / 2, y + h / 2, { size: h * 0.42, weight: 600, outline: false, title: true });
  }
}

// Показ результата штриха: удачная руна вспыхивает, неудачная остаётся
// на экране красной, рядом — пунктирный образец и метки проблемных мест.
export class StrokeFeedback {
  constructor() {
    this.items = [];
  }

  success(pts, color) {
    this.items.push({ kind: 'ok', pts, color, life: 0.6, max: 0.6 });
  }

  fail(res) {
    this.items = this.items.filter(i => i.kind !== 'fail');
    if (!res.features) return;
    this.items.push({ kind: 'fail', f: res.features, target: res.target, marks: res.error.marks, life: 2.4, max: 2.4 });
  }

  clear() {
    this.items.length = 0;
  }

  update(dt) {
    for (const i of this.items) i.life -= dt;
    this.items = this.items.filter(i => i.life > 0);
  }

  render(ctx, time) {
    for (const it of this.items) {
      const a = Math.min(1, it.life / 0.5);
      if (it.kind === 'ok') {
        drawTrail(ctx, it.pts, it.color, a);
        continue;
      }
      const { f } = it;
      ctx.save();
      ctx.globalAlpha = a;
      if (it.target) drawRune(ctx, it.target, f.bbox.cx, f.bbox.cy, Math.max(f.size, 80), { color: C.ivory, alpha: 0.55, width: 2.5, dash: [8, 10], glow: false });
      ctx.strokeStyle = C.danger;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = C.danger;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      f.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.shadowBlur = 0;
      const pulse = 1 + 0.25 * Math.sin(time * 10);
      for (const m of it.marks) {
        if (m.type === 'gap') {
          ctx.setLineDash([8, 8]);
          ctx.strokeStyle = C.amber;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(m.a.x, m.a.y);
          ctx.lineTo(m.b.x, m.b.y);
          ctx.stroke();
          ctx.setLineDash([]);
          for (const p of [m.a, m.b]) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 10 * pulse, 0, Math.PI * 2);
            ctx.stroke();
          }
          label(ctx, 'разрыв', (m.a.x + m.b.x) / 2, (m.a.y + m.b.y) / 2 - 22, { size: 18, color: C.amber });
        } else if (m.type === 'corner') {
          ctx.strokeStyle = C.amber;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(m.x, m.y, 16 * pulse, 0, Math.PI * 2);
          ctx.stroke();
        } else if (m.type === 'size') {
          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = C.amber;
          ctx.lineWidth = 2;
          const s = Math.max(f.size * 2.5, 160);
          ctx.strokeRect(f.bbox.cx - s / 2, f.bbox.cy - s / 2, s, s);
          ctx.setLineDash([]);
          label(ctx, 'нужно примерно так', f.bbox.cx, f.bbox.cy - s / 2 - 16, { size: 18, color: C.amber });
        }
      }
      ctx.restore();
    }
  }
}
