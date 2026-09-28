// Процедурные спрайты: жыны, босс Айдаһар, огненные шары, защитный круг.
import { RUNES } from './runes.js';
import { drawRune, roundRect } from './ui.js';

// Ряд рун над жыном: пройденные тусклые, текущая светится.
export function drawRuneChips(ctx, runes, idx, x, y, chip) {
  const gap = chip * 0.25;
  const total = runes.length * chip + (runes.length - 1) * gap;
  let cx = x - total / 2 + chip / 2;
  runes.forEach((id, i) => {
    const done = i < idx;
    const current = i === idx;
    ctx.save();
    ctx.globalAlpha = done ? 0.25 : 1;
    roundRect(ctx, cx - chip / 2, y - chip / 2, chip, chip, chip * 0.25);
    ctx.fillStyle = current ? 'rgba(20,10,50,0.92)' : 'rgba(20,10,50,0.6)';
    ctx.fill();
    if (current) {
      ctx.strokeStyle = RUNES[id].color;
      ctx.lineWidth = 3;
      ctx.shadowColor = RUNES[id].color;
      ctx.shadowBlur = 14;
      ctx.stroke();
    }
    ctx.restore();
    drawRune(ctx, id, cx, y, chip * 0.62, { width: current ? 3.5 : 2.5, alpha: done ? 0.25 : current ? 1 : 0.6, glow: current });
    cx += chip + gap;
  });
}

function eyes(ctx, x, y, r, look, color = '#fff') {
  for (const s of [-1, 1]) {
    const ex = x + s * r * 0.35;
    const ey = y - r * 0.1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(ex, ey, r * 0.18, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#12051f';
    ctx.beginPath();
    ctx.arc(ex + look.x * r * 0.08, ey + look.y * r * 0.08, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Жын — светящийся призрак цвета своей текущей руны.
export function drawSpirit(ctx, m, core, time, danger) {
  const id = m.runes[Math.min(m.idx, m.runes.length - 1)];
  const color = RUNES[id].color;
  const r = m.r * (1 + 0.05 * Math.sin(time * 6 + m.wob));
  const x = m.x, y = m.y + Math.sin(time * 3 + m.wob) * m.r * 0.12;
  const dx = core.x - x, dy = core.y - y;
  const dl = Math.hypot(dx, dy) || 1;

  ctx.save();
  ctx.shadowColor = danger ? '#ff3355' : color;
  ctx.shadowBlur = danger ? 30 : 20;
  const g = ctx.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r * 1.2);
  g.addColorStop(0, m.hitFlash > 0 ? '#ffffff' : color);
  g.addColorStop(1, 'rgba(30,10,60,0.9)');
  ctx.fillStyle = g;
  // тело-капля с «хвостом» из волн снизу
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI, 0);
  const waves = 4;
  for (let i = 0; i <= waves * 2; i++) {
    const t = i / (waves * 2);
    const wx = x + r - t * 2 * r;
    const wy = y + r * (0.7 + (i % 2 ? 0.25 : 0) + 0.08 * Math.sin(time * 8 + i + m.wob));
    ctx.lineTo(wx, wy);
  }
  ctx.closePath();
  ctx.fill();
  if (danger) {
    ctx.strokeStyle = '#ff3355';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
  eyes(ctx, x, y, r, { x: dx / dl, y: dy / dl });

  drawRuneChips(ctx, m.runes, m.idx, x, y - r * 1.75, Math.max(34, r * 0.95));
}

// Босс Айдаһар — большой дракон-дух с рядом рун.
export function drawBoss(ctx, b, core, time) {
  const { x, y, r } = b;
  ctx.save();
  ctx.shadowColor = '#ff5a36';
  ctx.shadowBlur = 40;
  // крылья
  ctx.fillStyle = 'rgba(120,20,40,0.85)';
  for (const s of [-1, 1]) {
    const flap = Math.sin(time * 4) * r * 0.25;
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.6, y - r * 0.2);
    ctx.lineTo(x + s * r * 2.1, y - r * 0.9 + flap);
    ctx.lineTo(x + s * r * 1.7, y + r * 0.1 + flap * 0.5);
    ctx.lineTo(x + s * r * 2.0, y + r * 0.5 + flap * 0.3);
    ctx.lineTo(x + s * r * 0.7, y + r * 0.4);
    ctx.closePath();
    ctx.fill();
  }
  const g = ctx.createRadialGradient(x, y - r * 0.4, r * 0.2, x, y, r * 1.1);
  g.addColorStop(0, b.hitFlash > 0 ? '#ffffff' : '#ff9f43');
  g.addColorStop(1, '#5a0a2a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // рога
  ctx.fillStyle = '#ffd166';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.45, y - r * 0.75);
    ctx.lineTo(x + s * r * 0.85, y - r * 1.45);
    ctx.lineTo(x + s * r * 0.7, y - r * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const dx = core.x - x, dy = core.y - y, dl = Math.hypot(dx, dy) || 1;
  eyes(ctx, x, y, r, { x: dx / dl, y: dy / dl }, '#ffe14d');
  // пасть
  ctx.strokeStyle = '#1a0010';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.25, r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  const chip = Math.max(38, r * 0.42);
  drawRuneChips(ctx, b.queue.slice(0, 7), 0, x, y + r * 1.35, chip);
}

export function drawFireball(ctx, x, y, r, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
  g.addColorStop(0, '#fff6c2');
  g.addColorStop(0.35, '#ff9f1a');
  g.addColorStop(1, 'rgba(255,40,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * (2 + 0.15 * Math.sin(time * 30)), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Точка, которую защищает игрок, и щит вокруг неё.
export function drawCore(ctx, core, r, time, shield) {
  ctx.save();
  ctx.strokeStyle = 'rgba(180,160,255,0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 10]);
  ctx.lineDashOffset = -time * 30;
  ctx.beginPath();
  ctx.arc(core.x, core.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (shield) {
    const R = r * 1.5 + Math.sin(time * 8) * 4;
    const g = ctx.createRadialGradient(core.x, core.y, R * 0.6, core.x, core.y, R);
    g.addColorStop(0, 'rgba(199,125,255,0)');
    g.addColorStop(1, 'rgba(199,125,255,0.45)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(core.x, core.y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c77dff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#c77dff';
    ctx.shadowBlur = 25;
    ctx.stroke();
  }
  ctx.restore();
}

// Заряжаемый шар маны на ладони.
export function drawManaOrb(ctx, x, y, charge, minDim, time) {
  if (charge <= 0) return;
  const r = minDim * (0.02 + 0.07 * charge);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, charge >= 1 ? '#ffd166' : '#8b7dff');
  g.addColorStop(1, 'rgba(120,80,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * (1.6 + 0.1 * Math.sin(time * 20)), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
