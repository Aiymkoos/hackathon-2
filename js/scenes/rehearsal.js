// Репетиция: пошаговое обучение каждому движению с подсказками об ошибках.
import { FRAMING_HINTS, aimAt, dynamicOf } from '../conductor.js';
import { SECTIONS } from '../piece.js';
import { DwellButton, label, roundRect } from '../ui.js';
import { drawSection, drawBatonTrail, drawCueBeam } from '../stage.js';
import { store } from '../store.js';

const SCALE = [60, 62, 64, 65, 67, 69, 71, 72];

const STEPS = [
  { id: 'frame', title: 'Встань к пульту', text: 'В кадре должны быть голова, плечи и обе руки' },
  { id: 'beat', title: 'Доля', text: 'Правой рукой: вниз-вверх. Сделай 4 ровных взмаха — каждый взмах вниз это доля' },
  { id: 'forte', title: 'Forte — громко', text: 'Сделай 3 широких взмаха: от уровня головы до пояса' },
  { id: 'piano', title: 'Piano — тихо', text: 'Теперь 3 маленьких взмаха у груди' },
  { id: 'cue', title: 'Вступление', text: 'Укажи прямой левой рукой на флейты — так дают вступление группе' },
  { id: 'fermata', title: 'Фермата', text: 'Подними обе руки выше головы и держи — оркестр тянет аккорд' },
  { id: 'cutoff', title: 'Снятие', text: 'Резко опусти обе руки — оркестр замолчит' },
];

export class RehearsalScene {
  constructor(app) {
    this.app = app;
    this.doneButtons = [
      new DwellButton('🎼  На концерт', () => app.go('concert'), { color: '#ffd166' }),
      new DwellButton('↩  Меню', () => app.go('menu'), { color: '#8b7dff' }),
    ];
  }

  enter() {
    this.step = 0;
    this.count = 0;
    this.hold = 0;
    this.successT = 0;
    this.finished = false;
    this.note = 0;
    this.app.conductor.reset();
    this.app.toast.clear();
  }

  get current() {
    return STEPS[this.step];
  }

  pass() {
    const { orchestra, fx, W, H, toast } = this.app;
    this.successT = 1.1;
    [72, 76, 79].forEach(m => orchestra.play('flutes', m, 0.6));
    fx.burst(W / 2, H * 0.35, '#7dff9b', 50, 400);
    toast.clear();
  }

  playBeat(amp) {
    const { orchestra } = this.app;
    orchestra.setLevel(Math.min(1, amp / 1.3));
    orchestra.play('strings', SCALE[this.note++ % SCALE.length] + 12, 0.35);
    orchestra.play('timpani', 43, 0.3);
  }

  update(dt, now, events) {
    const { conductor, toast, body, orchestra, sections } = this.app;
    const tip = body?.rightOk ? body.pointer : null;

    if (this.finished) {
      const { W, H, minDim } = this.app;
      const bw = Math.min(W - 40, minDim * 0.5), bh = Math.max(52, minDim * 0.09);
      this.doneButtons.forEach((b, i) => b.place((W - bw) / 2, H * 0.5 + i * (bh + 16), bw, bh));
      for (const b of this.doneButtons) if (b.update(dt, tip, () => orchestra.blip(660))) return;
      return;
    }

    if (this.successT > 0) {
      this.successT -= dt;
      if (this.successT <= 0) {
        this.step++;
        this.count = 0;
        this.hold = 0;
        if (this.step >= STEPS.length) {
          this.finished = true;
          store.setAcademyDone();
          orchestra.applause(3, 0.6);
        }
      }
      return;
    }

    const s = this.current;
    if (conductor.framing && s.id !== 'frame') toast.show(FRAMING_HINTS[conductor.framing], 'info', 0.6);

    const beats = events.filter(e => e.type === 'beat');
    switch (s.id) {
      case 'frame':
        if (conductor.framing) {
          this.hold = 0;
          toast.show(FRAMING_HINTS[conductor.framing], 'error', 0.6);
        } else if ((this.hold += dt) > 1) this.pass();
        break;

      case 'beat':
        for (const b of beats) {
          this.playBeat(b.amp);
          this.count++;
          if (b.lowHand) toast.show('Рука слишком низко — дирижируй перед грудью', 'error', 2.5);
          else if (this.count >= 4 && conductor.tempo.unevenness > 0.2) {
            toast.show('Взмахи неровные — держи одинаковый ритм, как метроном', 'error', 2.5);
            this.count = 2;
          }
        }
        if (this.count >= 4) this.pass();
        break;

      case 'forte':
      case 'piano': {
        const want = s.id === 'forte' ? 'f' : 'p';
        for (const b of beats) {
          this.playBeat(b.amp);
          if (dynamicOf(b.amp) === want) this.count++;
          else if (want === 'f') toast.show('Шире! Веди руку от уровня головы до пояса', 'error', 2.5);
          else toast.show('Меньше! Маленькие взмахи у груди, как будто играешь тихо', 'error', 2.5);
        }
        if (this.count >= 3) this.pass();
        break;
      }

      case 'cue': {
        const p = conductor.pointing;
        const targets = sections.filter(x => x.cue);
        const hit = p?.active ? aimAt(p, targets) : null;
        if (hit?.id === 'flutes') {
          if ((this.hold += dt) > 0.4) this.pass();
        } else {
          this.hold = 0;
          if (hit) toast.show(`Это ${SECTIONS[hit.id].name.toLowerCase()}, а флейты — слева вверху`, 'error', 0.6);
          else if (p?.raised && !p.straight) toast.show('Выпрями левую руку в локте — так музыканты поймут, что это им', 'error', 0.6);
          else if (p?.raised && !p.extended) toast.show('Вытяни левую руку дальше от себя', 'error', 0.6);
          else if (p?.active) toast.show('Чуть точнее — наведи луч на флейты', 'info', 0.6);
        }
        break;
      }

      case 'fermata':
        if (events.some(e => e.type === 'fermata')) {
          [60, 64, 67, 72].forEach(m => orchestra.play('strings', m + 12, Infinity));
          orchestra.play('cellos', 36, Infinity);
          this.pass();
        } else if (conductor.finale.oneUp) toast.show('Подними и вторую руку выше головы', 'error', 0.6);
        break;

      case 'cutoff':
        if (events.some(e => e.type === 'cutoff')) {
          orchestra.release();
          this.pass();
        } else if (events.some(e => e.type === 'slowCutoff')) {
          orchestra.release();
          toast.show('Слишком медленно — опускай руки резко, одним движением. Подними их снова', 'error', 3);
          this.step = STEPS.findIndex(x => x.id === 'fermata');
        }
        break;
    }
  }

  render(ctx) {
    const { W, H, minDim, time, sections, conductor } = this.app;
    const s = this.current;
    for (const sec of sections) {
      const dueCue = !this.finished && s?.id === 'cue' && sec.id === 'flutes';
      drawSection(ctx, sec, { active: !sec.cue || this.step > 4, pulse: 0.3, due: dueCue, aimed: false }, time);
    }
    this.toastBottom = undefined;
    if (this.finished) {
      label(ctx, 'Репетиция пройдена!', W / 2, H * 0.32, { size: minDim * 0.08, weight: 800, color: '#7dff9b' });
      label(ctx, 'Оркестр готов. Пора на сцену', W / 2, H * 0.32 + minDim * 0.08, { size: minDim * 0.035, color: '#e6ddff' });
      for (const b of this.doneButtons) b.render(ctx);
      return;
    }

    drawBatonTrail(ctx, conductor.trail, time, conductor.dynamic, conductor.level);
    if (s.id === 'cue' && conductor.pointing?.raised) {
      const hit = conductor.pointing.active ? aimAt(conductor.pointing, sections.filter(x => x.cue)) : null;
      drawCueBeam(ctx, conductor.pointing, hit && sections.find(x => x.id === hit.id), W, H);
    }

    // карточка задания внизу, чтобы не закрывать дирижёра
    const cw = Math.min(W - 32, minDim * 0.95);
    const ch = Math.max(90, minDim * 0.17);
    const cx = (W - cw) / 2, cy = H - ch - 24;
    this.toastBottom = cy - 16;
    roundRect(ctx, cx, cy, cw, ch, 18);
    ctx.fillStyle = 'rgba(15,8,40,0.82)';
    ctx.fill();
    label(ctx, `Шаг ${this.step + 1} из ${STEPS.length}`, W / 2, cy + ch * 0.18, { size: ch * 0.13, color: '#8b7dff', outline: false });
    label(ctx, s.title, W / 2, cy + ch * 0.44, { size: ch * 0.22, weight: 800, outline: false });
    label(ctx, s.text, W / 2, cy + ch * 0.76, { size: Math.min(ch * 0.14, (cw / s.text.length) * 1.75), weight: 500, color: '#e6ddff', outline: false });
    const pw = cw / STEPS.length;
    STEPS.forEach((_, i) => {
      ctx.fillStyle = i < this.step ? '#7dff9b' : i === this.step ? '#8b7dff' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(cx + i * pw + 3, cy + ch - 9, pw - 6, 4);
    });
    const goal = { beat: 4, forte: 3, piano: 3 }[s.id];
    if (goal) label(ctx, `${this.count}/${goal}`, cx + cw - 16, cy + ch * 0.2, { size: ch * 0.18, weight: 800, color: '#ffd166', align: 'right', outline: false });

    if (this.successT > 0) label(ctx, 'Отлично!', W / 2, H * 0.45, { size: minDim * 0.1, weight: 800, color: '#7dff9b' });
  }
}
