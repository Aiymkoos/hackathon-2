// Битва: волны жынов, босс Айдаһар, щит кулаком и взрыв маны ладонью.
import { POSE } from '../gestures.js';
import { RUNES, RUNE_IDS, recognize } from '../runes.js';
import { FRAMING_HINTS } from '../input.js';
import { label, roundRect } from '../ui.js';
import { drawBoss, drawCore, drawFireball, drawManaOrb, drawSpirit } from '../sprites.js';

const WAVES = [
  { title: 'Волна 1', sub: 'Жыны приближаются!', count: 5, len: [1, 1], speed: 0.07, every: 2.8, pool: ['circle', 'vee'] },
  { title: 'Волна 2', sub: 'Все четыре руны', count: 7, len: [1, 2], speed: 0.08, every: 2.6, pool: RUNE_IDS },
  { title: 'Волна 3', sub: 'Жыны с цепочками рун', count: 7, len: [2, 3], speed: 0.075, every: 3.2, pool: RUNE_IDS },
  { title: 'Босс: Айдаһар', sub: 'Летит огонь — сожми кулак!', boss: true },
];

const HEARTS = 5;
const MANA_PER_KILL = 20;
const SHOT_TIME = 2.4;

function randomRunes(n, pool) {
  const out = [];
  while (out.length < n) {
    const id = pool[Math.floor(Math.random() * pool.length)];
    if (id !== out[out.length - 1] || pool.length === 1) out.push(id);
  }
  return out;
}

export class BattleScene {
  constructor(app) {
    this.app = app;
  }

  enter() {
    this.hearts = HEARTS;
    this.score = 0;
    this.combo = 0;
    this.mana = 0;
    this.charge = 0;
    this.monsters = [];
    this.shots = [];
    this.boss = null;
    this.waveIdx = -1;
    this.over = 0;
    this.stats = { attempts: 0, hits: 0, errors: {}, blocks: 0, maxCombo: 0, ults: 0, start: performance.now() };
    this.app.toast.clear();
    this.app.feedback.clear();
    this.nextWave();
  }

  get wave() {
    return WAVES[this.waveIdx];
  }

  get core() {
    return { x: this.app.W / 2, y: this.app.H * 0.58 };
  }

  get coreR() {
    return this.app.minDim * 0.1;
  }

  nextWave() {
    this.waveIdx++;
    if (this.waveIdx >= WAVES.length) return this.finish(true);
    this.phase = 'intro';
    this.phaseT = 2.4;
    this.spawned = 0;
    this.spawnT = 0.3;
  }

  finish(win) {
    if (this.over) return;
    this.over = 1.6;
    this.win = win;
    if (win) {
      this.app.sfx.win();
      this.score += this.hearts * 200;
    } else this.app.sfx.lose();
  }

  spawnMonster(len, speed, pool) {
    const { W, H, minDim } = this.app;
    const r = minDim * 0.055;
    const m = r * 2.5;
    // появляемся за краем экрана: сверху или сбоку
    const side = Math.random();
    let x, y;
    if (side < 0.5) { x = m + Math.random() * (W - 2 * m); y = -m; }
    else { x = side < 0.75 ? -m : W + m; y = m + Math.random() * H * 0.45; }
    this.monsters.push({ x, y, r, speed: speed * minDim, runes: randomRunes(len, pool), idx: 0, wob: Math.random() * 10, hitFlash: 0 });
    this.spawned++;
  }

  spawnBoss() {
    const { W, minDim } = this.app;
    this.boss = { x: W / 2, y: -minDim * 0.3, r: minDim * 0.1, queue: randomRunes(7, RUNE_IDS), fireT: 3.5, minionT: 6, hitFlash: 0, t: 0 };
  }

  damage() {
    this.hearts--;
    this.combo = 0;
    this.app.sfx.hurt();
    this.app.fx.flash('#ff1f4b', 0.35);
    this.app.fx.shake(16, 0.35);
    if (this.hearts <= 0) this.finish(false);
  }

  gainMana(n) {
    const was = this.mana;
    this.mana = Math.min(100, this.mana + n);
    if (was < 100 && this.mana >= 100) {
      this.app.toast.show('Мана заполнена! Раскрой ладонь 🖐 и толкни её к камере', 'success', 3);
      this.app.sfx.success();
    }
  }

  kill(m, points = 100 + 20 * this.combo) {
    const color = RUNES[m.runes[m.runes.length - 1]].color;
    this.monsters = this.monsters.filter(o => o !== m);
    this.app.fx.burst(m.x, m.y, color, 40, 380);
    this.app.fx.text(m.x, m.y - m.r, `+${points}`, color);
    this.score += points;
    this.gainMana(MANA_PER_KILL);
    this.app.sfx.kill();
  }

  castRune(rune, pts) {
    const { fx, feedback } = this.app;
    const color = RUNES[rune].color;
    feedback.success(pts, color);
    const c = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
    this.stats.hits++;
    this.combo++;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    this.app.sfx.cast(rune);
    fx.text(c.x, c.y, this.combo > 1 ? `${RUNES[rune].spell}! ×${this.combo}` : `${RUNES[rune].spell}!`, color, 30);

    for (const m of [...this.monsters]) {
      if (m.runes[m.idx] !== rune) continue;
      fx.beam(c.x, c.y, m.x, m.y, color);
      m.idx++;
      m.hitFlash = 0.15;
      if (m.idx >= m.runes.length) this.kill(m);
      else {
        this.score += 30;
        fx.burst(m.x, m.y, color, 12, 200);
      }
    }
    const b = this.boss;
    if (b && b.queue[0] === rune) {
      fx.beam(c.x, c.y, b.x, b.y, color);
      fx.burst(b.x, b.y, color, 30, 400);
      fx.shake(8, 0.2);
      b.queue.shift();
      b.hitFlash = 0.2;
      this.score += 150;
      if (!b.queue.length) this.killBoss();
    }
  }

  killBoss() {
    const b = this.boss;
    this.app.fx.burst(b.x, b.y, '#ffd166', 120, 700, 1.4);
    this.app.fx.burst(b.x, b.y, '#ff5a36', 80, 500, 1.2);
    this.app.fx.shake(25, 0.8);
    this.app.fx.flash('#fff3c4', 0.6);
    this.app.sfx.boom();
    this.score += 1000;
    this.boss = null;
    this.shots = [];
    for (const m of [...this.monsters]) this.kill(m, 50);
    this.finish(true);
  }

  ult() {
    const { fx, sfx } = this.app;
    sfx.boom();
    fx.flash('#ffd166', 0.6);
    fx.shake(24, 0.6);
    fx.ring(this.core.x, this.core.y, '#ffd166', Math.max(this.app.W, this.app.H), 0.8);
    for (const m of [...this.monsters]) this.kill(m, 60);
    this.shots = [];
    if (this.boss) {
      this.boss.queue.splice(0, 2);
      this.boss.hitFlash = 0.3;
      if (!this.boss.queue.length) this.killBoss();
    }
    this.mana = 0;
    this.charge = 0;
    this.stats.ults++;
  }

  countError(code) {
    this.stats.errors[code] = (this.stats.errors[code] ?? 0) + 1;
  }

  handleStroke(pts) {
    const { toast, feedback, sfx, minDim } = this.app;
    const expected = [...new Set([...this.monsters.map(m => m.runes[m.idx]), ...(this.boss ? [this.boss.queue[0]] : [])])];
    this.stats.attempts++;
    const res = recognize(pts, { minSize: minDim * 0.14, expected: expected.length ? expected : RUNE_IDS });
    if (res.ok && expected.includes(res.rune)) return this.castRune(res.rune, pts);
    if (res.ok) {
      feedback.success(pts, RUNES[res.rune].color);
      toast.show('Руна верная, но жынов сейчас нет — жди следующих', 'info');
      return;
    }
    this.countError(res.error.code);
    this.combo = 0;
    feedback.fail(res);
    toast.show(res.error.hint, 'error', 3.2);
    sfx.error();
  }

  handlePush() {
    const { toast, sfx } = this.app;
    if (this.mana < 100) {
      toast.show(`Маны пока ${this.mana}% — побеждай жынов, чтобы накопить взрыв`, 'info');
    } else if (this.charge < 1) {
      this.countError('earlyPush');
      toast.show('Рано! Держи ладонь раскрытой, пока шар не зарядится полностью', 'error');
      sfx.error();
    } else this.ult();
  }

  update(dt, now, events) {
    const { input, toast, fx, sfx, minDim } = this.app;

    if (this.over) {
      this.over -= dt;
      if (this.over <= 0) this.app.go('results', { win: this.win, score: this.score, hearts: this.hearts, stats: this.stats });
      return;
    }

    // Рука пропала — время замедляется, чтобы не проиграть из-за камеры.
    const gdt = input.present ? dt : dt * 0.25;
    const core = this.core;
    const wave = this.wave;

    if (this.phase === 'intro') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.phase = 'fight';
        if (wave.boss) this.spawnBoss();
      }
    } else if (!wave.boss) {
      if (this.spawned < wave.count) {
        this.spawnT -= gdt;
        if (this.spawnT <= 0) {
          const [a, b] = wave.len;
          this.spawnMonster(a + Math.floor(Math.random() * (b - a + 1)), wave.speed, wave.pool);
          this.spawnT = wave.every;
        }
      } else if (!this.monsters.length) this.nextWave();
    }

    // босс: влетает, стреляет огнём, призывает жынов
    const b = this.boss;
    if (b) {
      b.t += gdt;
      const targetY = this.app.H * 0.2;
      b.y += (targetY - b.y) * Math.min(1, gdt * 2);
      b.x = this.app.W / 2 + Math.sin(b.t * 0.6) * this.app.W * 0.2;
      b.hitFlash -= dt;
      b.fireT -= gdt;
      b.minionT -= gdt;
      if (b.fireT <= 0) {
        this.shots.push({ x0: b.x, y0: b.y + b.r * 0.4, t: 0 });
        b.fireT = 5 + Math.random() * 1.5;
        sfx.warn();
      }
      if (b.minionT <= 0) {
        this.spawnMonster(1, 0.08, RUNE_IDS);
        b.minionT = 7;
      }
    }

    for (const m of [...this.monsters]) {
      const dx = core.x - m.x, dy = core.y - m.y;
      const d = Math.hypot(dx, dy);
      m.hitFlash -= dt;
      if (d < this.coreR) {
        this.monsters = this.monsters.filter(o => o !== m);
        fx.burst(m.x, m.y, '#ff3355', 30, 300);
        this.damage();
        continue;
      }
      m.x += (dx / d) * m.speed * gdt;
      m.y += (dy / d) * m.speed * gdt;
    }

    const shielded = input.pose === POSE.FIST;
    for (const s of [...this.shots]) {
      s.t += gdt / SHOT_TIME;
      if (s.t < 1) continue;
      this.shots = this.shots.filter(o => o !== s);
      if (shielded) {
        this.stats.blocks++;
        this.score += 50;
        this.gainMana(10);
        sfx.block();
        fx.ring(core.x, core.y, '#c77dff', this.coreR * 3);
        fx.text(core.x, core.y - this.coreR * 1.8, 'Блок! +50', '#c77dff');
      } else {
        fx.burst(core.x, core.y, '#ff9f1a', 50, 400);
        this.damage();
      }
    }

    // заряд маны на раскрытой ладони
    if (input.pose === POSE.PALM && this.mana >= 100) {
      const before = this.charge;
      this.charge = Math.min(1, this.charge + dt / 0.8);
      if (Math.floor(before * 8) !== Math.floor(this.charge * 8)) sfx.charge(this.charge);
      if (this.charge >= 1) toast.show('Заряжено! Резко толкни ладонь к камере', 'success', 0.5);
    } else this.charge = Math.max(0, this.charge - dt * 1.5);

    for (const e of events) {
      if (e.type === 'stroke') this.handleStroke(e.pts);
      else if (e.type === 'push') this.handlePush();
      else if (e.type === 'weakPush' && this.charge >= 1) {
        toast.show('Толчок слишком слабый — двигай ладонь к камере резче и ближе', 'error');
        sfx.error();
      }
    }

    this.contextHints(now);
  }

  // Подсказки о позе руки — только когда они нужны прямо сейчас.
  contextHints(now) {
    const { input, toast } = this.app;
    if (!input.present) return toast.show('Покажи руку — время замедлено', 'info', 0.4);
    if (this.shots.length && input.pose !== POSE.FIST) {
      if (input.near === POSE.FIST && input.hint) return toast.show(input.hint, 'error', 0.4);
      return toast.show('Летит огонь! Сожми кулак — поставь щит', 'warn', 0.4);
    }
    if (input.framing && input.poseTime(now) > 1) return toast.show(FRAMING_HINTS[input.framing], 'info', 0.6);
    if (input.pose === POSE.OTHER && input.hint && input.poseTime(now) > 0.6) {
      if (input.near === POSE.POINT || (input.near === POSE.PALM && this.mana >= 100)) toast.show(input.hint, 'error', 0.6);
    }
    if (input.pose === POSE.PALM && this.mana < 100 && input.poseTime(now) > 0.5) {
      toast.show(`Маны пока ${this.mana}% — побеждай жынов, чтобы накопить взрыв`, 'info', 0.6);
    }
  }

  render(ctx) {
    const { minDim, time, input } = this.app;
    const core = this.core;
    drawCore(ctx, core, this.coreR, time, input.pose === POSE.FIST);

    // самый опасный жын подсвечивается красным
    let nearest = null, nd = Infinity;
    for (const m of this.monsters) {
      const d = Math.hypot(core.x - m.x, core.y - m.y);
      if (d < nd) { nd = d; nearest = m; }
    }
    for (const m of this.monsters) drawSpirit(ctx, m, core, time, m === nearest && nd < minDim * 0.35);
    if (this.boss) drawBoss(ctx, this.boss, core, time);

    for (const s of this.shots) {
      const x = s.x0 + (core.x - s.x0) * s.t;
      const y = s.y0 + (core.y - s.y0) * s.t;
      drawFireball(ctx, x, y, minDim * 0.025, time);
      if (Math.random() < 0.6) this.app.fx.sparkle(x, y, '#ff9f1a');
    }

    if (input.present && this.charge > 0) drawManaOrb(ctx, input.palm.x, input.palm.y, this.charge, minDim, time);
  }

  renderOverlay(ctx) {
    const { W, H, minDim } = this.app;
    const s = Math.max(16, minDim * 0.035);

    // сердца
    for (let i = 0; i < HEARTS; i++) label(ctx, i < this.hearts ? '❤' : '♡', 20 + s * 0.6 + i * s * 1.3, 20 + s * 0.6, { size: s, color: i < this.hearts ? '#ff4d6d' : 'rgba(255,255,255,0.4)', align: 'center' });
    label(ctx, `${this.score}`, W - 20, 20 + s * 0.6, { size: s * 1.2, weight: 800, align: 'right' });
    if (this.combo > 1) label(ctx, `комбо ×${this.combo}`, W - 20, 20 + s * 1.9, { size: s * 0.7, color: '#ffd166', align: 'right' });
    label(ctx, this.wave?.title ?? '', W / 2, 20 + s * 0.6, { size: s * 0.8, color: '#cfc4ff' });

    // мана
    const bw = Math.min(260, W * 0.35), bh = s * 0.55;
    const bx = 20, by = 20 + s * 1.6;
    roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = 'rgba(15,8,40,0.8)';
    ctx.fill();
    roundRect(ctx, bx, by, Math.max(bh, (bw * this.mana) / 100), bh, bh / 2);
    ctx.fillStyle = this.mana >= 100 ? '#ffd166' : '#8b7dff';
    ctx.fill();
    label(ctx, this.mana >= 100 ? '🖐 Взрыв готов' : 'Мана', bx + bw / 2, by + bh / 2, { size: bh * 0.75, outline: false });

    if (this.phase === 'intro') {
      const k = Math.min(1, (2.4 - this.phaseT) * 3, this.phaseT * 3);
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      label(ctx, this.wave.title, W / 2, H * 0.4, { size: minDim * 0.1, weight: 800, color: this.wave.boss ? '#ff8a3d' : '#f3e8ff' });
      label(ctx, this.wave.sub, W / 2, H * 0.4 + minDim * 0.08, { size: minDim * 0.035, color: '#cfc4ff' });
      ctx.restore();
    }
  }
}
