// Ночная степь: небо, луна, горы, каменный круг, туман и редкие искры.
// Неподвижные слои рисуются один раз в отдельный canvas, подвижные — каждый кадр.
import { C } from './theme.js';

// Детерминированный «случайный» генератор, чтобы пейзаж не менялся при перерисовке.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function ridge(ctx, W, baseY, amp, step, seed, color) {
  step = Math.max(8, step); // при нулевой ширине окна шаг не должен стать 0
  const r = rng(seed);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  let y = baseY;
  for (let x = 0; x <= W + step; x += step) {
    y = baseY - amp * (0.35 + 0.65 * r()) * (0.6 + 0.4 * Math.sin(x / (W * 0.23) + seed));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, ctx.canvas.height);
  ctx.lineTo(0, ctx.canvas.height);
  ctx.closePath();
  ctx.fill();
}

export class Steppe {
  constructor() {
    this.static = document.createElement('canvas');
    this.embers = [];
    this.fog = Array.from({ length: 5 }, (_, i) => ({ x: Math.random(), y: 0.66 + i * 0.05, w: 0.5 + Math.random() * 0.4, v: 0.004 + Math.random() * 0.006 }));
  }

  // Центр каменного круга (там стоит печать).
  resize(W, H, dpr, center) {
    W = Math.max(1, W);
    H = Math.max(1, H);
    this.W = W;
    this.H = H;
    this.center = center;
    const c = this.static;
    c.width = W * dpr;
    c.height = H * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const minDim = Math.min(W, H);

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#04070a');
    sky.addColorStop(0.55, '#0a1719');
    sky.addColorStop(0.72, '#10272a');
    sky.addColorStop(1, '#060b0c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const r = rng(7);
    for (let i = 0; i < 140; i++) {
      const x = r() * W, y = r() * H * 0.6;
      ctx.globalAlpha = 0.15 + r() * 0.5;
      ctx.fillStyle = C.ivory;
      ctx.fillRect(x, y, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1);
    }
    ctx.globalAlpha = 1;

    // луна
    const mx = W * 0.8, my = H * 0.17, mr = minDim * 0.045;
    const halo = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 6);
    halo.addColorStop(0, 'rgba(239,230,210,0.16)');
    halo.addColorStop(1, 'rgba(239,230,210,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
    ctx.fillStyle = '#e9e0cb';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,150,130,0.25)';
    for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.05, 0.35, 0.12]]) {
      ctx.beginPath();
      ctx.arc(mx + dx * mr, my + dy * mr, rr * mr, 0, Math.PI * 2);
      ctx.fill();
    }

    // горы и холмы
    ridge(ctx, W, H * 0.6, H * 0.14, W / 18, 3, '#0c1a1c');
    ridge(ctx, W, H * 0.68, H * 0.07, W / 26, 11, '#091315');
    const ground = ctx.createLinearGradient(0, H * 0.7, 0, H);
    ground.addColorStop(0, '#081012');
    ground.addColorStop(1, '#040708');
    ctx.fillStyle = ground;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    // каменный круг вокруг печати
    const { x: cx, y: cy } = center;
    const rx = minDim * 0.42, ry = minDim * 0.11;
    const stones = [];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.05 + (i / 8) * 0.9);
      stones.push({ x: cx + Math.cos(a + Math.PI) * rx, y: cy + minDim * 0.1 + Math.sin(a + Math.PI) * ry, h: minDim * (0.1 + 0.06 * Math.sin(i * 1.7) ** 2) });
    }
    const pool = ctx.createRadialGradient(cx, cy + minDim * .1, 0, cx, cy + minDim * .1, minDim * .42);
    pool.addColorStop(0, 'rgba(94,213,190,.13)'); pool.addColorStop(1, 'rgba(94,213,190,0)');
    ctx.fillStyle = pool; ctx.fillRect(cx - minDim * .5, cy - minDim * .4, minDim, minDim);
    ctx.strokeStyle = 'rgba(111,177,158,.18)'; ctx.lineWidth = 1;
    for (const k of [1,.88]) { ctx.beginPath(); ctx.ellipse(cx, cy + minDim * .1, rx * k, ry * k, 0, 0, Math.PI * 2); ctx.stroke(); }
    stones.sort((a, b) => a.y - b.y);
    for (const s of stones) {
      const w = s.h * 0.38;
      const material = ctx.createLinearGradient(s.x - w / 2, 0, s.x + w / 2, 0);
      material.addColorStop(0, '#071116'); material.addColorStop(1, '#284548');
      ctx.fillStyle = material;
      ctx.beginPath();
      ctx.moveTo(s.x - w / 2, s.y);
      ctx.lineTo(s.x - w * 0.42, s.y - s.h * 0.85);
      ctx.quadraticCurveTo(s.x, s.y - s.h * 1.05, s.x + w * 0.4, s.y - s.h * 0.9);
      ctx.lineTo(s.x + w / 2, s.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(138,207,181,.18)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(145,210,182,.3)';
      ctx.beginPath(); ctx.moveTo(s.x, s.y - s.h * .7); ctx.lineTo(s.x - w * .15, s.y - s.h * .5); ctx.lineTo(s.x + w * .15, s.y - s.h * .4); ctx.stroke();
    }
    ctx.strokeStyle = '#02080b'; ctx.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = H * (.94 + r() * .06), h = minDim * (.012 + r() * .045);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 3, y - h / 2, x + (r() - .5) * 30, y - h); ctx.stroke();
    }
  }

  // Тёплые искры, медленно поднимающиеся от печати.
  update(dt) {
    if (this.embers.length < 26 && Math.random() < dt * 4) {
      this.embers.push({
        x: this.center.x + (Math.random() - 0.5) * this.W * 0.5,
        y: this.H * (0.72 + Math.random() * 0.2),
        v: 10 + Math.random() * 20,
        life: 5 + Math.random() * 4,
        age: 0,
        teal: Math.random() < 0.6,
      });
    }
    for (const e of this.embers) {
      e.age += dt;
      e.y -= e.v * dt;
      e.x += Math.sin(e.age * 1.3 + e.v) * 6 * dt;
    }
    this.embers = this.embers.filter(e => e.age < e.life);
    for (const f of this.fog) f.x = (f.x + f.v * dt) % 1.6;
  }

  render(ctx, time) {
    const { W, H } = this;
    ctx.drawImage(this.static, 0, 0, W, H);

    // облако, проплывающее у луны
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#0a1316';
    const cx = ((time * 8) % (W + 600)) - 300;
    for (const [dx, dy, r] of [[0, 0, 60], [55, 10, 45], [-50, 12, 40], [100, 18, 30]]) {
      ctx.beginPath();
      ctx.ellipse(cx + dx, H * 0.19 + dy, r * 1.8, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // туман над землёй
    for (const f of this.fog) {
      const x = (f.x - 0.3) * W, y = f.y * H, w = f.w * W;
      const g = ctx.createRadialGradient(x, y, 0, x, y, w / 2);
      g.addColorStop(0, 'rgba(120,160,155,0.07)');
      g.addColorStop(1, 'rgba(120,160,155,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, y - w / 4, w, w / 2);
    }

    ctx.save();
    for (const e of this.embers) {
      const k = Math.sin((e.age / e.life) * Math.PI);
      ctx.globalAlpha = 0.7 * k;
      ctx.fillStyle = e.teal ? C.teal : C.amber;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
