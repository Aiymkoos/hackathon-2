// Общие элементы интерфейса: текст, подсказки, кнопки «наведи и держи».

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
  info: { bg: 'rgba(30,20,80,0.85)', border: '#8b7dff', icon: '♪' },
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
