// Спрайты: жыны-силуэты с дымом, босс Айдаһар, огненные шары, древняя печать.
import { RUNES } from './runes.js';
import { drawRune, roundRect } from './ui.js';
import { C } from './theme.js';

// Ряд рун над жыном: тёмные таблички с золотой рамкой, текущая подсвечена.
export function drawRuneChips(ctx, runes, idx, x, y, chip) {
  const gap = chip * 0.22;
  const total = runes.length * chip + (runes.length - 1) * gap;
  let cx = x - total / 2 + chip / 2;
  runes.forEach((id, i) => {
    const done = i < idx;
    const current = i === idx;
    ctx.save();
    ctx.globalAlpha = done ? 0.2 : 1;
    roundRect(ctx, cx - chip / 2, y - chip / 2, chip, chip, 4);
    ctx.fillStyle = current ? 'rgba(12,22,24,0.95)' : 'rgba(12,22,24,0.7)';
    ctx.fill();
    ctx.strokeStyle = current ? C.gold : C.line;
    ctx.lineWidth = current ? 1.5 : 1;
    ctx.stroke();
    ctx.restore();
    drawRune(ctx, id, cx, y, chip * 0.6, { width: current ? 2.5 : 1.8, alpha: done ? 0.2 : current ? 1 : 0.5, glow: current });
    cx += chip + gap;
  });
}

// Дымный силуэт: несколько колеблющихся тёмных «языков» вверх.
function smoke(ctx, x, y, r, time, seed, color) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const a = time * 1.5 + seed + i * 1.3;
    const ox = Math.sin(a) * r * 0.35 + (i - 2) * r * 0.25;
    const oy = -r * (0.7 + 0.3 * Math.sin(a * 1.3)) - i * r * 0.05;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.ellipse(x + ox, y + oy, r * 0.35, r * 0.6, Math.sin(a) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function eyes(ctx, x, y, r, look, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 0.5;
  ctx.fillStyle = color;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * r * 0.3 + look.x * r * 0.06, y - r * 0.15 + look.y * r * 0.06, r * 0.13, r * 0.06, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Жын — тёмный силуэт в дыму; глаза светятся цветом его текущей руны.
export function drawSpirit(ctx, m, core, time, danger) {
  const id = m.runes[Math.min(m.idx, m.runes.length - 1)];
  const color = RUNES[id].color;
  const r = m.r;
  const x = m.x, y = m.y + Math.sin(time * 2.5 + m.wob) * r * 0.1;
  const dx = core.x - x, dy = core.y - y;
  const dl = Math.hypot(dx, dy) || 1;

  smoke(ctx, x, y, r, time, m.wob, '#1c2a2c');
  ctx.save();
  const g = ctx.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, m.hitFlash > 0 ? 'rgba(239,230,210,0.9)' : '#162224');
  g.addColorStop(1, 'rgba(6,10,11,0.95)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.2);
  ctx.bezierCurveTo(x - r * 1.05, y - r * 0.9, x - r * 0.3, y - r * 1.25, x, y - r * 1.1);
  ctx.bezierCurveTo(x + r * 0.3, y - r * 1.25, x + r * 1.05, y - r * 0.9, x + r, y + r * 0.2);
  // рваный край снизу
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    ctx.lineTo(x + r - t * 2 * r, y + r * (0.55 + (i % 2 ? 0.35 : 0) + 0.1 * Math.sin(time * 6 + i + m.wob)));
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = danger ? C.danger : 'rgba(127,214,200,0.25)';
  ctx.lineWidth = danger ? 2 : 1;
  ctx.stroke();
  ctx.restore();
  eyes(ctx, x, y, r, { x: dx / dl, y: dy / dl }, danger ? C.danger : color);

  drawRuneChips(ctx, m.runes, m.idx, x, y - r * 1.75, Math.max(32, r * 0.9));
}

// Босс Айдаһар — огромный силуэт дракона с тлеющими глазами.
export function drawBoss(ctx, b, core, time) {
  const { x, y, r } = b;
  smoke(ctx, x, y + r * 0.3, r * 1.4, time, 3, '#1a1414');
  ctx.save();
  ctx.fillStyle = b.hitFlash > 0 ? 'rgba(239,230,210,0.85)' : '#0d0f10';
  for (const s of [-1, 1]) {
    const flap = Math.sin(time * 3) * r * 0.2;
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.5, y - r * 0.2);
    ctx.quadraticCurveTo(x + s * r * 1.6, y - r * 1.3 + flap, x + s * r * 2.3, y - r * 0.7 + flap);
    ctx.lineTo(x + s * r * 1.9, y - r * 0.1 + flap * 0.6);
    ctx.lineTo(x + s * r * 2.1, y + r * 0.3 + flap * 0.4);
    ctx.lineTo(x + s * r * 1.5, y + r * 0.15);
    ctx.lineTo(x + s * r * 1.5, y + r * 0.55);
    ctx.lineTo(x + s * r * 0.6, y + r * 0.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
  ctx.fill();
  // рога
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.3, y - r * 0.8);
    ctx.quadraticCurveTo(x + s * r * 0.8, y - r * 1.3, x + s * r * 0.55, y - r * 1.7);
    ctx.lineTo(x + s * r * 0.5, y - r * 0.75);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(224,145,63,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const dx = core.x - x, dy = core.y - y, dl = Math.hypot(dx, dy) || 1;
  eyes(ctx, x, y, r, { x: dx / dl, y: dy / dl }, C.amber);
  // тлеющая пасть
  ctx.save();
  ctx.strokeStyle = C.amber;
  ctx.globalAlpha = 0.6 + 0.3 * Math.sin(time * 4);
  ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.25, r * 0.3, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.restore();

  drawRuneChips(ctx, b.queue.slice(0, 7), 0, x, y + r * 1.35, Math.max(36, r * 0.4));
}

export function drawFireball(ctx, x, y, r, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
  g.addColorStop(0, '#fff1d0');
  g.addColorStop(0.35, C.amber);
  g.addColorStop(1, 'rgba(208,99,78,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * (2 + 0.15 * Math.sin(time * 30)), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Древняя печать, которую защищает игрок, и щит над ней.
export function drawCore(ctx, core, r, time, shield) {
  const { x, y } = core;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = C.gold;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.2;
  for (const k of [1, 0.72]) {
    ctx.beginPath();
    ctx.arc(0, 0, r * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  // медленно вращающиеся засечки и знаки по кругу
  ctx.rotate(time * 0.15);
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(r * 0.74, 0);
    ctx.lineTo(r * (i % 3 ? 0.84 : 0.98), 0);
    ctx.stroke();
  }
  ctx.rotate(-time * 0.3);
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  for (let i = 0; i <= 3; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    const px = Math.cos(a) * r * 0.5, py = Math.sin(a) * r * 0.5;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 1.2);
  glow.addColorStop(0, 'rgba(201,168,106,0.18)');
  glow.addColorStop(1, 'rgba(201,168,106,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);

  if (shield) {
    const R = r * 1.5 + Math.sin(time * 8) * 3;
    ctx.save();
    const g = ctx.createRadialGradient(x, y, R * 0.6, x, y, R);
    g.addColorStop(0, 'rgba(95,211,196,0)');
    g.addColorStop(1, 'rgba(95,211,196,0.3)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.teal;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

// Заряжаемый шар силы на ладони.
export function drawManaOrb(ctx, x, y, charge, minDim, time) {
  if (charge <= 0) return;
  const r = minDim * (0.02 + 0.07 * charge);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
  g.addColorStop(0, '#fff6e0');
  g.addColorStop(0.3, charge >= 1 ? C.amber : C.teal);
  g.addColorStop(1, 'rgba(95,211,196,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * (1.6 + 0.1 * Math.sin(time * 20)), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
