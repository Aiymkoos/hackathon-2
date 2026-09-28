// Проверка логики дирижёра на синтетических движениях: node tests/conductor.test.mjs
import { Baton, TempoTracker, armPointing, aimAt, dynamicOf, Finale } from '../js/conductor.js';

let fail = 0;
function check(name, ok, info = '') {
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`);
}

let seed = 3;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const SW = 250; // ширина плеч в пикселях

// Рука «отскакивает» от нижней точки каждую долю: y = низ − A·|sin(πt/T)|.
function conduct({ bpm, amp, seconds = 6, jitter = 3, accel = 0 }) {
  const baton = new Baton();
  const tempo = new TempoTracker();
  const beats = [];
  let phase = 0;
  for (let t = 0; t < seconds; t += 1 / 30) {
    const T = 60 / (bpm * (1 + accel * t));
    phase += (1 / 30) / T;
    const y = 500 - amp * SW * Math.abs(Math.sin(Math.PI * phase)) + (rand() - 0.5) * jitter;
    const ev = baton.update(t, { x: 600, y }, SW);
    if (ev) {
      beats.push(ev);
      tempo.add(t);
    }
  }
  return { beats, tempo };
}

{
  const { beats, tempo } = conduct({ bpm: 100, amp: 0.8 });
  check('100 уд/мин: ~10 долей за 6 с', beats.length >= 9 && beats.length <= 11, `${beats.length} долей`);
  check('темп определён ≈100', Math.abs(tempo.bpm - 100) < 8, `${tempo.bpm?.toFixed(1)}`);
  check('размах ≈0.8 → mf', dynamicOf(beats[3].amp) === 'mf', beats[3].amp.toFixed(2));
  check('ровные взмахи', tempo.unevenness < 0.1, tempo.unevenness.toFixed(3));
}
{
  const { beats } = conduct({ bpm: 80, amp: 0.4 });
  check('маленький взмах → p', beats.length >= 6 && dynamicOf(beats[3].amp) === 'p', `${beats.length} долей, ${beats[3]?.amp.toFixed(2)}`);
}
{
  const { beats } = conduct({ bpm: 110, amp: 1.4 });
  check('широкий взмах → f', dynamicOf(beats[3].amp) === 'f', beats[3].amp.toFixed(2));
}
{
  const { beats } = conduct({ bpm: 100, amp: 0.03, jitter: 6 });
  check('дрожание руки — не доли', beats.length === 0, `${beats.length}`);
}
{
  const { tempo } = conduct({ bpm: 80, amp: 0.8, seconds: 8, accel: 0.12 });
  check('ускорение замечено', tempo.trend === 'faster', `${tempo.trend}`);
}

// Левая рука: плечо (400,400), sw=250
const body = (lw, le) => ({ ls: { x: 400, y: 400 }, le, lw, sw: SW });
{
  const p = armPointing(body({ x: 400 - 380, y: 400 - 30 }, { x: 400 - 190, y: 400 - 15 }));
  check('прямая рука влево — указывает', p.active, `локоть ${p.elbowDeg.toFixed(0)}°`);
  const hit = aimAt(p, [{ id: 'brass', x: 50, y: 360 }, { id: 'flutes', x: 150, y: 80 }]);
  check('попадание в трубы', hit?.id === 'brass', JSON.stringify(hit));
}
{
  const p = armPointing(body({ x: 330, y: 300 }, { x: 250, y: 420 }));
  check('согнутая рука — не указывает', !p.active && !p.straight, `локоть ${p.elbowDeg.toFixed(0)}°`);
}
{
  const p = armPointing(body({ x: 420, y: 760 }, { x: 410, y: 580 }));
  check('опущенная рука — не поднята', !p.raised);
}

// Фермата и снятие
{
  const f = new Finale();
  const base = { nose: { x: 500, y: 300 }, ls: { x: 400, y: 400 }, rs: { x: 600, y: 400 }, sw: SW, leftOk: true, rightOk: true };
  const up = { ...base, lw: { x: 380, y: 150 }, rw: { x: 620, y: 150 } };
  const down = { ...base, lw: { x: 380, y: 600 }, rw: { x: 620, y: 600 } };
  const evs = [];
  for (let t = 0; t < 1; t += 0.033) evs.push(...f.update(t, up));
  evs.push(...f.update(1.0, { ...base, lw: { x: 380, y: 350 }, rw: { x: 620, y: 350 } }));
  evs.push(...f.update(1.3, down));
  check('фермата + резкое снятие', evs.map(e => e.type).join(',') === 'fermata,cutoff', evs.map(e => e.type).join(','));
}

console.log(fail ? `\n${fail} провал(ов)` : '\nВсе тесты пройдены');
process.exit(fail ? 1 : 0);
