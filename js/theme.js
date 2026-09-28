// Оформление «Сиқыршы — хранитель древней степи»: палитра, шрифты, значки.

export const C = {
  night: '#070c0e',
  surface: 'rgba(9,17,19,0.88)',
  surfaceHi: 'rgba(18,32,34,0.94)',
  line: 'rgba(201,168,106,0.45)',
  gold: '#c9a86a',
  ivory: '#efe6d2',
  muted: '#9aaba5',
  teal: '#5fd3c4',
  amber: '#e8a54b',
  danger: '#d0634e',
  sage: '#a9c98b',
};

export const TITLE_FONT = '"Cormorant Garamond", Georgia, serif';
export const BODY_FONT = 'Manrope, system-ui, sans-serif';

// Контурные значки жестов (24×24, линия). Основаны на наборе Lucide (ISC).
export const ICONS = {
  point: [
    'M22 14a8 8 0 0 1-8 8',
    'M18 11v-1a2 2 0 0 0-4 0',
    'M14 10V9a2 2 0 0 0-4 0v1',
    'M10 9.5V4a2 2 0 0 0-4 0v10',
    'M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
  ],
  palm: [
    'M18 11V6a2 2 0 0 0-4 0',
    'M14 10V4a2 2 0 0 0-4 0v2',
    'M10 10.5V6a2 2 0 0 0-4 0v8',
    'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
  ],
  fist: [
    'M18 11.5V9a2 2 0 0 0-4 0v1.4',
    'M14 10V8a2 2 0 0 0-4 0v2',
    'M10 9.9V9a2 2 0 0 0-4 0v5',
    'M6 14a2 2 0 0 0-4 0',
    'M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0',
  ],
  thumb: [
    'M7 10v12',
    'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z',
  ],
};

const paths = {};
/** Рисует значок жеста на canvas: центр (x, y), размер size. */
export function drawIcon(ctx, name, x, y, size, color = C.ivory, width = 1.6) {
  paths[name] ??= ICONS[name].map(d => new Path2D(d));
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of paths[name]) ctx.stroke(p);
  ctx.restore();
}

// Ромбик — единица «прочности печати» вместо сердечек.
export function drawGem(ctx, x, y, s, filled, color = C.teal) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.7, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s * 0.7, y);
  ctx.closePath();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = filled ? color : 'rgba(239,230,210,0.3)';
  if (filled) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.stroke();
  ctx.restore();
}
