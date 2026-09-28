// Сцена: оркестр дугой вокруг дирижёра, светящийся след палочки,
// луч вступления, зрители и лента партитуры.
import { SECTIONS, PIECE, barOf, markAt } from './piece.js';
import { label, roundRect } from './ui.js';
import { C, drawGlyph } from './theme.js';

// Дуга оркестра. Группы для вступлений — слева и сверху, чтобы на них
// было удобно указывать левой рукой.
const LAYOUT = {
  brass: [0.09, 0.44],
  flutes: [0.2, 0.2],
  timpani: [0.5, 0.13],
  strings: [0.8, 0.2],
  cellos: [0.91, 0.44],
};

export function layoutSections(W, H, minDim) {
  const r = Math.max(34, minDim * 0.075);
  return Object.entries(LAYOUT).map(([id, [fx, fy]]) => ({
    id, ...SECTIONS[id], r,
    x: Math.min(Math.max(fx * W, r + 8), W - r - 8),
    y: Math.max(fy * H, r + 24),
  }));
}

/** state: { active, pulse (0..1), due, aimed, confused } */
export function drawSection(ctx, s, state, time) {
  const { x, y, r, color } = s;
  const k = state.pulse;
  ctx.save();
  if (state.due) {
    // ждёт вступления — пульсирующее кольцо
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 8);
    ctx.beginPath();
    ctx.arc(x, y, r * (1.35 + 0.1 * Math.sin(time * 8)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * (1.2 + k * 0.4));
  g.addColorStop(0, state.active ? color : 'rgba(90,40,40,0.6)');
  g.addColorStop(1, 'rgba(20,6,8,0)');
  ctx.globalAlpha = state.active ? 0.55 + k * 0.45 : 0.45;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * (1.2 + k * 0.4), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(18,7,9,0.85)';
  ctx.fill();
  ctx.lineWidth = state.aimed ? 5 : 2.5;
  ctx.strokeStyle = state.active || state.aimed ? color : C.line;
  if (state.active || state.aimed) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 + k * 20;
  }
  ctx.stroke();
  ctx.restore();

  drawGlyph(ctx, s.icon, x, y - k * 3, r * 1.05, state.active ? C.cream : C.muted, 1.4);
  label(ctx, s.name, x, y + r + 14, { size: Math.max(14, r * 0.34), weight: 600, title: true, color: state.active ? C.cream : C.muted });
  if (!state.active && s.cue) label(ctx, state.due ? 'укажи на меня!' : 'ждёт вступления', x, y + r + 32, { size: Math.max(11, r * 0.24), weight: 500, color: state.due ? color : C.muted });
  if (state.confused) label(ctx, '?', x + r * 0.8, y - r * 0.8, { size: r * 0.6, weight: 700, title: true, color: C.gold });
}

const DYN_COLORS = { p: '#a8c8dc', mf: '#e6c98a', f: '#f0a24a' };

// След правой руки — светящаяся «лента» дирижёрской палочки.
// Рисуется несколькими кусками одной линией, чтобы яркость не накапливалась.
export function drawBatonTrail(ctx, trail, t, dynamic, level) {
  const pts = trail.filter(p => t - p.t < 0.45);
  if (pts.length < 2) return;
  const color = DYN_COLORS[dynamic] ?? C.cream;
  const chunks = 5;
  const per = Math.ceil(pts.length / chunks);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let c = 0; c < chunks; c++) {
    const part = pts.slice(Math.max(0, c * per - 1), (c + 1) * per);
    if (part.length < 2) continue;
    const k = (c + 1) / chunks; // ближе к руке — ярче и толще
    const path = new Path2D();
    part.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
    ctx.globalAlpha = 0.35 * k;
    ctx.strokeStyle = color;
    ctx.lineWidth = (8 + level * 14) * k;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20 * k;
    ctx.stroke(path);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.9 * k;
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = 2.5 * k;
    ctx.stroke(path);
  }
  ctx.restore();
}

// Руки дирижёра: плечо — локоть — запястье.
export function drawArms(ctx, body) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.7;
  const arm = (s, e, w, color) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.lineTo(w.x, w.y);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(w.x, w.y, 7, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.strokeStyle = 'rgba(243,230,207,0.4)';
  ctx.beginPath();
  ctx.moveTo(body.ls.x, body.ls.y);
  ctx.lineTo(body.rs.x, body.rs.y);
  ctx.stroke();
  if (body.leftOk) arm(body.ls, body.le, body.lw, '#a9cf9a');
  if (body.rightOk) arm(body.rs, body.re, body.rw, C.gold);
  ctx.restore();
}

// Луч от левой руки: куда показывает дирижёр.
export function drawCueBeam(ctx, pointing, target, W, H) {
  const { tip, dir } = pointing;
  const len = target ? Math.hypot(target.x - tip.x, target.y - tip.y) : Math.max(W, H);
  const ex = tip.x + dir.x * len, ey = tip.y + dir.y * len;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const color = target?.color ?? C.cream;
  for (const [w, a] of [[16, 0.15], [6, 0.5], [2, 1]]) {
    ctx.strokeStyle = w === 2 ? C.cream : color;
    ctx.globalAlpha = target ? a : a * 0.4;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

// Зрители внизу: качаются в такт, в финале встают и хлопают.
export function drawAudience(ctx, W, H, time, { sway = 0, standing = 0, clap = false, base = H + 10 } = {}) {
  const n = Math.max(8, Math.round(W / 70));
  ctx.save();
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < n; i++) {
      const x = ((i + (row ? 0.5 : 0)) / n) * W + 20;
      const seed = Math.sin(i * 12.9898 + row * 78.233) * 43758.5453;
      const rnd = seed - Math.floor(seed);
      const rise = standing * (30 + rnd * 20);
      const bob = Math.sin(time * 6 + i) * sway * 6;
      const y = base - row * 26 - rise + bob;
      const s = 26 + rnd * 8 - row * 4;
      ctx.fillStyle = row ? 'rgba(20,6,9,0.9)' : 'rgba(8,2,4,0.96)';
      ctx.beginPath();
      ctx.ellipse(x, y, s * 1.2, s * 0.9, 0, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - s * 1.15, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
      if (clap) {
        const c = Math.abs(Math.sin(time * 14 + i * 1.7)) * s * 0.3;
        ctx.fillStyle = 'rgba(60,24,28,0.95)';
        for (const d of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(x + d * (c + 4), y - s * 1.9, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  ctx.restore();
}

// Лента партитуры: такты, динамика, вступления и фермата бегут к метке «сейчас».
export const stripTop = (H, minDim) => H - Math.max(40, minDim * 0.07) - 12;

export function drawScoreStrip(ctx, W, H, pos, cuesDone, minDim) {
  const h = Math.max(40, minDim * 0.07);
  const y = stripTop(H, minDim);
  const x0 = 16, w = W - 32;
  const pxPerBeat = Math.max(18, w / 28);
  const nowX = x0 + w * 0.22;
  ctx.save();
  roundRect(ctx, x0, y, w, h, 12);
  ctx.fillStyle = 'rgba(16,6,8,0.88)';
  ctx.fill();
  ctx.clip();
  // нотный стан: пять тонких линеек
  ctx.strokeStyle = 'rgba(212,168,75,0.14)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 5; i++) {
    const ly = y + (h * i) / 6;
    ctx.beginPath();
    ctx.moveTo(x0, ly);
    ctx.lineTo(x0 + w, ly);
    ctx.stroke();
  }
  const beatX = b => nowX + (b - Math.max(0, pos)) * pxPerBeat;

  for (let bar = 1; bar <= PIECE.bars; bar++) {
    const bx = beatX((bar - 1) * 4);
    if (bx < x0 - 60 || bx > x0 + w + 10) continue;
    ctx.strokeStyle = 'rgba(212,168,75,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, y + 4);
    ctx.lineTo(bx, y + h - 4);
    ctx.stroke();
    label(ctx, `${bar}`, bx + 10, y + 11, { size: 11, color: C.muted, outline: false, align: 'left' });
    const mark = markAt((bar - 1) * 4);
    if (mark && markAt((bar - 2) * 4) !== mark) label(ctx, mark, bx + 8, y + h * 0.62, { size: h * 0.5, weight: 700, title: true, italic: true, color: DYN_COLORS[mark], outline: false, align: 'left' });
  }
  for (const cue of PIECE.cues) {
    const cx = beatX((cue.bar - 1) * 4);
    if (cx < x0 - 40 || cx > x0 + w + 40) continue;
    const s = SECTIONS[cue.section];
    ctx.globalAlpha = cuesDone.has(cue.section) ? 0.35 : 1;
    roundRect(ctx, cx + 48, y + h * 0.18, h * 1.3, h * 0.64, 6);
    ctx.fillStyle = 'rgba(16,6,8,0.9)';
    ctx.fill();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    drawGlyph(ctx, s.icon, cx + 48 + h * 0.65, y + h * 0.5, h * 0.5, s.color, 1.6);
    ctx.globalAlpha = 1;
  }
  // фермата над финальным аккордом
  const fx = beatX(PIECE.finalBeat);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(fx + 20, y + h * 0.7, h * 0.28, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.arc(fx + 20, y + h * 0.62, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // метка «сейчас»
  ctx.save();
  ctx.strokeStyle = C.cream;
  ctx.lineWidth = 3;
  ctx.shadowColor = C.cream;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(nowX, y - 4);
  ctx.lineTo(nowX, y + h + 4);
  ctx.stroke();
  ctx.restore();
  label(ctx, `${PIECE.title} · ${PIECE.composer} · такт ${Math.min(PIECE.bars, barOf(Math.max(0, pos)))}/${PIECE.bars}`, x0 + w - 8, y - 12, { size: 13, color: C.muted, align: 'right' });
  return y;
}

// Темп и доли такта в углу.
export function drawTempo(ctx, x, y, bpm, beatInBar, flash, minDim, range) {
  const s = Math.max(14, minDim * 0.028);
  const ok = !bpm || (bpm >= range[0] && bpm <= range[1]);
  label(ctx, bpm ? `${Math.round(bpm)}` : '—', x, y, { size: s * 1.6, weight: 700, title: true, align: 'left', color: ok ? C.cream : C.danger });
  label(ctx, 'ударов/мин', x, y + s * 1.2, { size: s * 0.6, weight: 500, align: 'left', color: C.muted });
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(x + 8 + i * s * 1.1, y + s * 2.2, s * 0.32 * (i === beatInBar ? 1 + flash * 0.5 : 1), 0, Math.PI * 2);
    ctx.fillStyle = i === beatInBar ? C.gold : 'rgba(243,230,207,0.22)';
    ctx.fill();
  }
}

export { DYN_COLORS };
