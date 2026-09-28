// Отрисовка интерфейса: руны, рука, след пальца, подсказки, кнопки «наведи и держи».
import { RUNES } from './runes.js';
import { POSE } from './gestures.js';

export const FONT = 'Rubik, sans-serif';

export function font(ctx, size, weight = 600) {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`;
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

export function label(ctx, str, x, y, { size = 24, color = '#fff', weight = 700, align = 'center', outline = true } = {}) {
  font(ctx, size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(8,4,24,0.75)';
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
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
  [POSE.POINT]: '#9fe8ff',
  [POSE.PALM]: '#ffd166',
  [POSE.FIST]: '#c77dff',
  [POSE.THUMB]: '#7dff9b',
  [POSE.OTHER]: 'rgba(255,255,255,0.6)',
  [POSE.NONE]: 'rgba(255,255,255,0.6)',
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
export function drawTrail(ctx, pts, color = '#bff3ff', alpha = 1) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, a, c] of [[18, 0.15, color], [8, 0.5, color], [3, 1, '#ffffff']]) {
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
  error: { bg: 'rgba(120,10,40,0.88)', border: '#ff4d6d', icon: '⚠' },
  warn: { bg: 'rgba(120,60,0,0.88)', border: '#ffb020', icon: '🔥' },
  success: { bg: 'rgba(10,90,50,0.88)', border: '#3dff9b', icon: '✦' },
  info: { bg: 'rgba(30,20,80,0.85)', border: '#8b7dff', icon: '☝' },
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

  render(ctx, W, H, minDim) {
    const size = Math.max(15, Math.min(26, minDim * 0.032));
    let y = H - size * 2.2;
    ctx.save();
    for (const t of this.items) {
      const st = TOAST_STYLE[t.kind] ?? TOAST_STYLE.info;
      font(ctx, size, 600);
      const lines = wrap(ctx, `${st.icon}  ${t.text}`, Math.min(W - 48, 900));
      const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + size * 1.6;
      const h = lines.length * size * 1.3 + size * 0.9;
      ctx.globalAlpha = Math.min(1, t.life * 3);
      roundRect(ctx, (W - w) / 2, y - h, w, h, size * 0.7);
      ctx.fillStyle = st.bg;
      ctx.fill();
      ctx.strokeStyle = st.border;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, W / 2, y - h + size * 0.45 + size * 1.3 * (i + 0.5)));
      y -= h + 10;
    }
    ctx.restore();
  }
}

// Кнопка без мыши: наведи указательный палец и подержи.
export class DwellButton {
  constructor(text, onFire, { hold = 1.1, color = '#8b7dff' } = {}) {
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
    this.hover = !!tip && tip.x > r.x && tip.x < r.x + r.w && tip.y > r.y && tip.y < r.y + r.h;
    if (this.hover) {
      if (this.progress === 0) sfx?.click();
      this.progress += dt / this.hold;
      if (this.progress >= 1) {
        this.progress = 0;
        this.onFire();
        return true;
      }
    } else this.progress = Math.max(0, this.progress - dt * 2);
    return false;
  }

  render(ctx) {
    const { x, y, w, h } = this.rect;
    ctx.save();
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = this.hover ? 'rgba(60,40,140,0.9)' : 'rgba(20,12,50,0.8)';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, y, w * this.progress, h);
    ctx.restore();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.hover ? 4 : 2;
    if (this.hover) {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 20;
    }
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.stroke();
    ctx.restore();
    label(ctx, this.text, x + w / 2, y + h / 2, { size: h * 0.36, outline: false });
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
      if (it.target) drawRune(ctx, it.target, f.bbox.cx, f.bbox.cy, Math.max(f.size, 80), { color: '#ffffff', alpha: 0.5, width: 3, dash: [10, 10], glow: false });
      ctx.strokeStyle = '#ff4d6d';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#ff4d6d';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      f.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.shadowBlur = 0;
      const pulse = 1 + 0.25 * Math.sin(time * 10);
      for (const m of it.marks) {
        if (m.type === 'gap') {
          ctx.setLineDash([8, 8]);
          ctx.strokeStyle = '#ffd166';
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
          label(ctx, 'разрыв', (m.a.x + m.b.x) / 2, (m.a.y + m.b.y) / 2 - 22, { size: 18, color: '#ffd166' });
        } else if (m.type === 'corner') {
          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(m.x, m.y, 16 * pulse, 0, Math.PI * 2);
          ctx.stroke();
        } else if (m.type === 'size') {
          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 2;
          const s = Math.max(f.size * 2.5, 160);
          ctx.strokeRect(f.bbox.cx - s / 2, f.bbox.cy - s / 2, s, s);
          ctx.setLineDash([]);
          label(ctx, 'нужно примерно так', f.bbox.cx, f.bbox.cy - s / 2 - 16, { size: 18, color: '#ffd166' });
        }
      }
      ctx.restore();
    }
  }
}
