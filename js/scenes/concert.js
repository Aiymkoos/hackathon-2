// Концерт: дирижёр ведёт «Оду к радости» — темп, громкость, вступления,
// фермата и снятие. Режим «ошибка» — конкретные подсказки по каждому движению.
import { FRAMING_HINTS, aimAt, dynamicOf } from '../conductor.js';
import { PIECE, SECTIONS, MARK_NAMES, barOf, markAt } from '../piece.js';
import { Performance } from '../music.js';
import { label, roundRect } from '../ui.js';
import { drawAudience, drawBatonTrail, drawCueBeam, drawScoreStrip, drawSection, drawTempo, stripTop, DYN_COLORS } from '../stage.js';

// Коды ошибок → название и совет (для итогов).
export const ERRORS = {
  fast:     { label: 'Слишком быстрый темп',       advice: 'Дирижируй спокойнее — оркестру нужно время на каждую ноту' },
  slow:     { label: 'Слишком медленный темп',     advice: 'Взмахивай чаще, чтобы мелодия не разваливалась' },
  rushing:  { label: 'Ускорение',                  advice: 'Держи темп ровным от начала до конца' },
  dragging: { label: 'Замедление',                 advice: 'Не затягивай — держи темп ровным' },
  uneven:   { label: 'Неровные взмахи',            advice: 'Считай про себя «раз-два-три-четыре», как метроном' },
  loud:     { label: 'Громко там, где нужно тихо', advice: 'На piano делай маленькие взмахи у груди' },
  quiet:    { label: 'Тихо там, где нужно громко', advice: 'На forte веди руку широко — от головы до пояса' },
  lowHand:  { label: 'Рука слишком низко',         advice: 'Дирижируй перед грудью, а не у пояса' },
  bentArm:  { label: 'Согнутая рука при вступлении', advice: 'Показывай вступление прямой рукой' },
  missedCue:{ label: 'Пропущенное вступление',     advice: 'Смотри на ленту партитуры — там видно, кто вступает' },
  earlyCue: { label: 'Вступление раньше времени',  advice: 'Давай вступление, когда значок группы подходит к метке' },
  slowCutoff:{ label: 'Медленное снятие',          advice: 'В конце опускай обе руки резко, одним движением' },
};

const CUE_TARGETS = s => s.filter(x => x.cue);

export class ConcertScene {
  constructor(app) {
    this.app = app;
  }

  enter() {
    const { app } = this;
    app.conductor.reset();
    app.toast.clear();
    app.orchestra.release();
    this.perf = new Performance(PIECE, app.orchestra);
    this.pulse = {};
    this.perf.onNote = section => {
      this.pulse[section] = 1;
      const s = app.sections.find(x => x.id === section);
      if (s && Math.random() < 0.25) app.fx.text(s.x + (Math.random() - 0.5) * s.r, s.y - s.r, Math.random() < 0.5 ? '♪' : '♫', s.color, 26);
    };
    this.perf.onBeat = b => {
      this.beatFlash = 1;
      this.beatInBar = ((b % 4) + 4) % 4;
    };
    this.phase = 'ready';
    this.beatFlash = 0;
    this.beatInBar = 0;
    this.cueResult = {};
    this.aim = { id: null, t: 0 };
    this.waitT = 0;
    this.mismatch = 0;
    this.finaleT = 0;
    this.fermata = false;
    this.doneT = 0;
    this.stats = { beats: 0, tempoOk: 0, steady: 0, dynBeats: 0, dynHits: 0, errors: {}, fermata: false, cutoff: null, start: performance.now() };
  }

  err(code, hint, ttl = 2.6) {
    this.stats.errors[code] = (this.stats.errors[code] ?? 0) + 1;
    this.app.toast.show(hint, 'error', ttl);
  }

  // --- доля: темп, громкость, положение руки ------------------------------
  onBeat(ev) {
    const { conductor } = this.app;
    const st = this.stats;
    st.beats++;
    const bpm = conductor.tempo.bpm;
    const [lo, hi] = PIECE.tempoRange;
    if (bpm && bpm >= lo && bpm <= hi) st.tempoOk++;
    if (conductor.tempo.unevenness < 0.15) st.steady++;

    const mark = markAt(this.perf.pos);
    if (mark) {
      st.dynBeats++;
      const ok = mark === 'mf' ? ev.amp >= 0.35 && ev.amp <= 1.35 : dynamicOf(ev.amp) === mark;
      if (ok) {
        st.dynHits++;
        this.mismatch = 0;
      } else this.mismatch++;
    }

    // одна самая важная подсказка на долю
    if (ev.lowHand) return this.err('lowHand', 'Рука слишком низко — дирижируй перед грудью');
    if (bpm && bpm > hi) return this.err('fast', 'Слишком быстро — оркестр не успевает. Дирижируй спокойнее');
    if (bpm && bpm < lo && st.beats > 3) return this.err('slow', 'Слишком медленно — музыка разваливается. Взмахивай чаще');
    const trend = conductor.tempo.trend;
    if (trend === 'faster') return this.err('rushing', 'Ты ускоряешься — держи ровный темп');
    if (trend === 'slower') return this.err('dragging', 'Ты замедляешься — не затягивай');
    if (conductor.tempo.unevenness > 0.22) return this.err('uneven', 'Взмахи неровные — держи одинаковый ритм, как метроном');
    if (this.mismatch >= 2 && mark) {
      this.mismatch = 0;
      if (mark === 'p') return this.err('loud', 'Здесь piano (тихо) — делай маленькие взмахи у груди');
      if (mark === 'f') return this.err('quiet', 'Здесь forte (громко) — широкие взмахи от головы до пояса');
      return this.err(ev.amp < 0.35 ? 'quiet' : 'loud', ev.amp < 0.35 ? 'Чуть шире — здесь mezzo-forte' : 'Чуть спокойнее — здесь mezzo-forte, не forte');
    }
  }

  // --- вступления групп ----------------------------------------------------
  cueFor(id) {
    return PIECE.cues.find(c => c.section === id);
  }

  giveCue(id) {
    const { fx, sections, orchestra, toast } = this.app;
    const cue = this.cueFor(id);
    const s = sections.find(x => x.id === id);
    if (this.perf.enabled.has(id)) return;
    const due = (cue.bar - 1) * 4;
    if (this.perf.pos < due - 3) {
      this.warnOnce('earlyCue', `${s.name} вступают позже — в такте ${cue.bar}. Смотри на ленту партитуры`);
      return;
    }
    this.perf.enable(id);
    this.cueResult[id] = Math.abs(this.perf.pos - due) <= 3 ? 'ontime' : 'late';
    fx.burst(s.x, s.y, s.color, 50, 420);
    fx.ring(s.x, s.y, s.color, s.r * 3);
    fx.text(s.x, s.y + s.r * 1.9, this.cueResult[id] === 'ontime' ? 'Вовремя!' : 'Поздновато', s.color, 24);
    orchestra.blip(1200, 0.1, 0.05);
    toast.clear();
  }

  updateCues(dt) {
    const { conductor, sections, toast } = this.app;
    const p = conductor.pointing;
    const hit = p?.active ? aimAt(p, CUE_TARGETS(sections)) : null;
    if (hit?.id === this.aim.id) this.aim.t += dt;
    else this.aim = { id: hit?.id ?? null, t: 0 };
    if (this.aim.id && this.aim.t > 0.3 && !this.perf.enabled.has(this.aim.id)) this.giveCue(this.aim.id);

    // группа, которая сейчас должна вступить
    for (const cue of PIECE.cues) {
      if (this.perf.enabled.has(cue.section)) continue;
      const due = (cue.bar - 1) * 4;
      const name = SECTIONS[cue.section].name;
      if (this.perf.pos >= due - 4 && this.perf.pos < due) toast.show(`Приготовься: вступают ${name.toLowerCase()} — укажи на них левой рукой`, 'info', 0.4);
      if (this.perf.pos >= due + 2) {
        if (p?.raised && !p.straight) this.warnOnce('bentArm', `Выпрями левую руку — так ${name.toLowerCase()} поймут, что это им`);
        else if (hit && hit.id !== cue.section) toast.show(`Это ${SECTIONS[hit.id].name.toLowerCase()}, а вступают ${name.toLowerCase()} — укажи на них`, 'error', 0.4);
        else toast.show(`${name} ждут вступления! Укажи на них прямой левой рукой`, 'warn', 0.4);
        if (this.perf.pos >= due + 8 && !this.cueResult[cue.section]) {
          this.cueResult[cue.section] = 'missed';
          this.stats.errors.missedCue = (this.stats.errors.missedCue ?? 0) + 1;
        }
      }
      break;
    }
  }

  // Ошибка, которая считается один раз, пока держится.
  warnOnce(code, hint) {
    if (this.lastWarn !== code) {
      this.stats.errors[code] = (this.stats.errors[code] ?? 0) + 1;
      this.lastWarn = code;
      setTimeout(() => { if (this.lastWarn === code) this.lastWarn = null; }, 3000);
    }
    this.app.toast.show(hint, 'error', 0.4);
  }

  // --- финал ----------------------------------------------------------------
  end(cutoff) {
    const { orchestra, fx, W, H } = this.app;
    this.phase = 'done';
    this.doneT = 0;
    this.stats.cutoff = cutoff;
    orchestra.release();
    const result = this.result();
    this.resultData = result;
    orchestra.applause(5, 0.4 + result.total / 100);
    for (let i = 0; i < 6; i++) setTimeout(() => fx.burst(W * (0.15 + 0.7 * Math.random()), H * (0.2 + 0.3 * Math.random()), ['#ffd166', '#6ee7ff', '#ff5a7a', '#7dff9b'][i % 4], 60, 500, 1.4), i * 300);
  }

  result() {
    const st = this.stats;
    const b = Math.max(1, st.beats);
    const tempo = (st.tempoOk / b) * 0.5 + (st.steady / b) * 0.5;
    const dynamics = st.dynBeats ? st.dynHits / st.dynBeats : 0;
    const cues = PIECE.cues.reduce((a, c) => a + ({ ontime: 1, late: 0.5 }[this.cueResult[c.section]] ?? 0), 0) / PIECE.cues.length;
    const finale = (st.fermata ? 0.5 : 0) + ({ cutoff: 0.5, slow: 0.25 }[st.cutoff] ?? 0);
    const total = Math.round(100 * (0.35 * tempo + 0.25 * dynamics + 0.25 * cues + 0.15 * finale));
    return { total, stars: Math.max(1, Math.round(total / 20)), parts: { tempo, dynamics, cues, finale }, stats: st, cueResult: this.cueResult };
  }

  update(dt, now, events) {
    const { app } = this;
    const { conductor, orchestra, toast } = app;
    this.beatFlash = Math.max(0, this.beatFlash - dt * 3);
    for (const k in this.pulse) this.pulse[k] = Math.max(0, this.pulse[k] - dt * 4);

    if (this.phase === 'done') {
      if ((this.doneT += dt) > 4.5) app.go('results', this.resultData);
      return;
    }
    if (conductor.framing) toast.show(FRAMING_HINTS[conductor.framing], 'info', 0.5);

    const beats = events.filter(e => e.type === 'beat');
    if (this.phase === 'ready') {
      if (beats.length) {
        this.phase = 'playing';
        this.perf.ictus(now / 1000);
        orchestra.setLevel(0.4);
      } else if (!conductor.framing) toast.show('Подними правую руку и сделай первый взмах вниз — оркестр начнёт', 'info', 0.5);
      return;
    }

    if (this.phase === 'playing') {
      for (const b of beats) {
        this.perf.ictus(b.t);
        this.onBeat(b);
      }
      orchestra.setLevel((conductor.level - 0.2) / 1.1);
      this.perf.update(dt);
      this.waitT = this.perf.waiting ? this.waitT + dt : 0;
      if (this.waitT > 0.8) toast.show('Оркестр ждёт твоего взмаха', 'info', 0.4);
      this.updateCues(dt);
      if (this.perf.atFinal) {
        this.phase = 'finale';
        this.finaleT = 0;
      }
      return;
    }

    // фермата и снятие
    this.finaleT += dt;
    for (const e of events) {
      if (e.type === 'fermata') {
        this.fermata = true;
        this.stats.fermata = true;
        orchestra.setLevel(1);
      }
      if (e.type === 'cutoff') return this.end('cutoff');
      if (e.type === 'slowCutoff') {
        this.stats.errors.slowCutoff = 1;
        return this.end('slow');
      }
    }
    if (!this.fermata) {
      if (conductor.finale.oneUp) toast.show('Подними и вторую руку выше головы', 'error', 0.4);
      else toast.show('Фермата! Подними обе руки выше головы и держи', 'warn', 0.4);
    } else if (conductor.finale.fermata) {
      toast.show('Держи… а теперь резко опусти обе руки — сними оркестр', 'success', 0.4);
    }
    if (this.finaleT > 15) this.end(null);
  }

  render(ctx) {
    const { W, H, time, sections, conductor } = this.app;
    const p = conductor.pointing;
    const hit = p?.active ? aimAt(p, CUE_TARGETS(sections)) : null;
    const confused = this.perf.waiting && this.waitT > 0.8;

    for (const s of sections) {
      const cue = this.cueFor(s.id);
      const due = cue && !this.perf.enabled.has(s.id) && this.perf.pos >= (cue.bar - 1) * 4 - 4;
      drawSection(ctx, s, {
        active: this.perf.enabled.has(s.id) && (this.phase !== 'ready' || !s.cue),
        pulse: this.pulse[s.id] ?? 0,
        due,
        aimed: hit?.id === s.id,
        confused: confused && this.perf.enabled.has(s.id),
      }, time);
    }
    if (p?.raised) drawCueBeam(ctx, p, hit && sections.find(s => s.id === hit.id), W, H);
    drawBatonTrail(ctx, conductor.trail, time, conductor.dynamic, conductor.level);
  }

  renderOverlay(ctx) {
    const { W, H, minDim, time, conductor } = this.app;
    const done = this.phase === 'done';
    const steady = this.phase === 'playing' && conductor.tempo.unevenness < 0.15 && !this.perf.waiting;
    drawAudience(ctx, W, H, time, { sway: steady ? 1 : 0, standing: done ? Math.min(1, this.doneT * 2) : 0, clap: done, base: stripTop(H, minDim) + 26 });
    const stripY = drawScoreStrip(ctx, W, H, this.perf.pos, this.perf.enabled, minDim);
    this.toastBottom = stripY - 24;

    drawTempo(ctx, 18, 34, this.phase === 'ready' ? null : this.perf.bpm, this.beatInBar, this.beatFlash, minDim, PIECE.tempoRange);

    // громкость: сейчас / нужно
    const mark = markAt(Math.max(0, this.perf.pos));
    const s = Math.max(14, minDim * 0.028);
    const now = conductor.dynamic;
    label(ctx, now, W - 18, 34, { size: s * 1.6, weight: 800, align: 'right', color: DYN_COLORS[now] });
    label(ctx, mark && this.phase === 'playing' ? `нужно: ${MARK_NAMES[mark]}` : 'громкость', W - 18, 34 + s * 1.2, { size: s * 0.6, weight: 500, align: 'right', color: mark && dynamicOf(conductor.level) !== mark && mark !== 'mf' ? '#ff8fa3' : '#cfc4ff' });

    if (this.phase === 'ready') {
      label(ctx, 'Первый взмах вниз — начало', W / 2, H * 0.5, { size: minDim * 0.06, weight: 800, color: '#fff4d6' });
      label(ctx, `${PIECE.title} · ${PIECE.composer}`, W / 2, H * 0.5 + minDim * 0.06, { size: minDim * 0.03, color: '#cfc4ff' });
    }
    if (this.phase === 'finale' && !this.fermata) label(ctx, '🙌 Фермата!', W / 2, H * 0.45, { size: minDim * 0.08, weight: 800, color: '#ffd166' });
    if (done) {
      const k = Math.min(1, this.doneT * 2);
      ctx.save();
      ctx.globalAlpha = k;
      label(ctx, 'Браво!', W / 2, H * 0.42, { size: minDim * 0.14, weight: 800, color: '#ffd166' });
      label(ctx, '★'.repeat(this.resultData.stars) + '☆'.repeat(5 - this.resultData.stars), W / 2, H * 0.42 + minDim * 0.11, { size: minDim * 0.06, color: '#ffd166' });
      ctx.restore();
    }
    if (this.phase === 'playing' && barOf(this.perf.pos) === 1 && this.perf.pos < 3) {
      roundRect(ctx, W / 2 - 120, H * 0.5 - 22, 240, 44, 22);
      ctx.fillStyle = 'rgba(15,8,40,0.6)';
      ctx.fill();
      label(ctx, 'Оркестр играет!', W / 2, H * 0.5, { size: 20, color: '#7dff9b', outline: false });
    }
  }
}
