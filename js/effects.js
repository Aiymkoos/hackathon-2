// Частицы, лучи, всплывающий текст, тряска и вспышки экрана.

const MAX_PARTICLES = 600;

export class Effects {
  constructor() {
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.particles = [];
    this.texts = [];
    this.beams = [];
    this.rings = [];
    this.shakeT = 0;
    this.shakeMag = 0;
    this.flashT = 0;
    this.flashDur = 1;
    this.flashColor = '#fff';
  }

  burst(x, y, color, n = 30, speed = 320, life = 0.8) {
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, r: 2 + Math.random() * 3 });
    }
  }

  sparkle(x, y, color) {
    if (this.particles.length >= MAX_PARTICLES) return;
    const a = Math.random() * Math.PI * 2;
    this.particles.push({ x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 30, life: 0.5, max: 0.5, color, r: 1.5 + Math.random() * 2 });
  }

  text(x, y, str, color = '#fff', size = 28) {
    this.texts.push({ x, y, str, color, size, life: 1.1, max: 1.1 });
  }

  beam(x1, y1, x2, y2, color) {
    this.beams.push({ x1, y1, x2, y2, color, life: 0.35, max: 0.35 });
  }

  ring(x, y, color, maxR = 200, life = 0.6) {
    this.rings.push({ x, y, color, maxR, life, max: life });
  }

  shake(mag = 12, dur = 0.3) {
    if (this.reduced) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, dur);
  }

  flash(color = '#fff', dur = 0.3) {
    if (this.reduced) return;
    this.flashColor = color;
    this.flashT = dur;
    this.flashDur = dur;
  }

  offset() {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    return { x: (Math.random() - 0.5) * 2 * this.shakeMag, y: (Math.random() - 0.5) * 2 * this.shakeMag };
  }

  update(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy = p.vy * 0.96 + 60 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const list of [this.texts, this.beams, this.rings]) for (const e of list) e.life -= dt;
    this.texts = this.texts.filter(t => t.life > 0);
    this.beams = this.beams.filter(b => b.life > 0);
    this.rings = this.rings.filter(r => r.life > 0);
    this.shakeT -= dt;
    if (this.shakeT <= 0) this.shakeMag = 0;
    this.flashT = Math.max(0, this.flashT - dt);
  }

  render(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.beams) {
      const k = b.life / b.max;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = k;
      ctx.lineWidth = 10 * k;
      ctx.beginPath();
      // Слегка «ломаный» луч, как магический разряд
      ctx.moveTo(b.x1, b.y1);
      const steps = 6;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        ctx.lineTo(b.x1 + (b.x2 - b.x1) * t + (Math.random() - 0.5) * 24, b.y1 + (b.y2 - b.y1) * t + (Math.random() - 0.5) * 24);
      }
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    }
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.maxR * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.life / t.max;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = `700 ${t.size}px "Cormorant Garamond", Georgia, serif`;
      ctx.fillStyle = t.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      const y = t.y - (1 - k) * 50;
      ctx.strokeText(t.str, t.x, y);
      ctx.fillText(t.str, t.x, y);
    }
    ctx.restore();
  }

  renderFlash(ctx, W, H) {
    if (this.flashT <= 0) return;
    ctx.save();
    ctx.globalAlpha = (this.flashT / this.flashDur) * 0.45;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
