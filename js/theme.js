// Оформление «Маэстро — концертный зал»: бархат, тёплый свет, золото, ноты.

export const C = {
  night: '#0c0608',
  surface: 'rgba(24,10,13,0.88)',
  surfaceHi: 'rgba(48,18,24,0.94)',
  line: 'rgba(212,168,75,0.45)',
  gold: '#d4a84b',
  cream: '#f3e6cf',
  muted: '#b9a58a',
  velvet: '#5a0f1c',
  danger: '#e0664f',
  ok: '#b9d3a0',
};

export const TITLE_FONT = '"Playfair Display", Georgia, serif';
export const BODY_FONT = 'Manrope, system-ui, sans-serif';

// Контурные значки инструментов (24×24, линия).
export const INSTRUMENTS = {
  violin: [
    'M12 2v7', 'M10.5 2h3',
    'M9.5 9c-2 0-3.3 1.5-3.3 3.2 0 1.3.9 2 .9 2.8s-.9 1.5-.9 2.8c0 1.7 2.4 4.2 5.8 4.2s5.8-2.5 5.8-4.2c0-1.3-.9-2-.9-2.8s.9-1.5.9-2.8c0-1.7-1.3-3.2-3.3-3.2z',
    'M11 10v9', 'M13 10v9', 'M10.3 15.5h3.4',
  ],
  cello: [
    'M12 1v6', 'M10.5 1h3',
    'M9 7c-2.4 0-4 1.8-4 3.8 0 1.5 1.1 2.3 1.1 3.3S5 15.9 5 17.4C5 19.4 7.9 22 12 22s7-2.6 7-4.6c0-1.5-1.1-2.3-1.1-3.3s1.1-1.8 1.1-3.3C19 8.8 17.4 7 15 7z',
    'M11 8v11.5', 'M13 8v11.5', 'M10.2 15h3.6', 'M12 22v1.6',
  ],
  flute: ['M2 15.5 22 10', 'M2.6 17.5 22.6 12', 'M8.5 14.3v.01', 'M12 13.4v.01', 'M15.5 12.5v.01', 'M19 11.6v.01'],
  trumpet: ['M2 10.5v3', 'M2 12h11', 'M5 12V8', 'M8 12V8', 'M11 12V8', 'M4 8h8', 'M13 12l8-5v10z', 'M5 12a3 3 0 0 0 6 0'],
  timpani: [
    'M3 10a9 2.5 0 1 0 18 0a9 2.5 0 1 0-18 0',
    'M3 10c0 5 4 8.5 9 8.5s9-3.5 9-8.5',
    'M7 17.5 5 22', 'M17 17.5l2 4.5',
    'M8 2l3 5.5', 'M16 2l-3 5.5',
  ],
};

const cache = {};
/** Рисует контурный значок: центр (x, y), размер size. */
export function drawGlyph(ctx, name, x, y, size, color = C.cream, width = 1.5) {
  cache[name] ??= INSTRUMENTS[name].map(d => new Path2D(d));
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of cache[name]) ctx.stroke(p);
  ctx.restore();
}

// Бархатный занавес по краям сцены и ламбрекен сверху.
export function drawCurtains(ctx, W, H, time) {
  const cw = Math.min(W * 0.09, 120);
  for (const side of [0, 1]) {
    const x0 = side ? W - cw : 0;
    const g = ctx.createLinearGradient(x0, 0, x0 + cw, 0);
    const folds = 5;
    for (let i = 0; i <= folds; i++) {
      const t = i / folds;
      g.addColorStop(t, i % 2 ? '#2a060d' : '#6b1424');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    const sway = Math.sin(time * 0.6 + side) * 3;
    if (side) {
      ctx.moveTo(W, 0);
      ctx.lineTo(W - cw, 0);
      ctx.quadraticCurveTo(W - cw * 0.8 + sway, H * 0.6, W - cw * 0.55, H);
      ctx.lineTo(W, H);
    } else {
      ctx.moveTo(0, 0);
      ctx.lineTo(cw, 0);
      ctx.quadraticCurveTo(cw * 0.8 + sway, H * 0.6, cw * 0.55, H);
      ctx.lineTo(0, H);
    }
    ctx.closePath();
    ctx.fill();
  }
  // ламбрекен с золотой кромкой
  const vh = Math.max(14, H * 0.025);
  ctx.fillStyle = '#4a0b17';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, vh);
  const n = Math.ceil(W / 60);
  for (let i = n; i >= 0; i--) ctx.quadraticCurveTo((i + 0.5) * 60, vh * 1.8, i * 60, vh);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.gold;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}
