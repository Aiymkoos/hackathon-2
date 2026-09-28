// Проверка распознавателя рун на синтетических штрихах: node tests/runes.test.mjs
import { recognize, RUNES } from '../js/runes.js';

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Рисует ломаную «рукой»: интерполяция + дрожание, 30 точек в секунду.
function stroke(points, { size = 300, jitter = 4, perSeg = 14, cx = 500, cy = 400 } = {}) {
  const out = [];
  let t = 0;
  for (let s = 0; s < points.length - 1; s++) {
    const [ax, ay] = points[s], [bx, by] = points[s + 1];
    for (let i = 0; i < perSeg; i++) {
      const k = i / perSeg;
      out.push({
        x: cx + (ax + (bx - ax) * k) * size + (rand() - 0.5) * jitter,
        y: cy + (ay + (by - ay) * k) * size + (rand() - 0.5) * jitter,
        t: (t += 33),
      });
    }
  }
  const [lx, ly] = points[points.length - 1];
  out.push({ x: cx + lx * size, y: cy + ly * size, t: t + 33 });
  return out;
}

const arc = (from, to, n = 40, rx = 0.5, ry = 0.5) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [Math.cos(a) * rx, Math.sin(a) * ry];
  });

// Треугольник, у которого углы — дуги (как рисует рука в воздухе).
function roundTri(r = 0.12) {
  const v = [[0, -0.5], [0.5, 0.43], [-0.5, 0.43]];
  const out = [];
  for (let i = 0; i < 3; i++) {
    const [a, b, c] = [v[i], v[(i + 1) % 3], v[(i + 2) % 3]];
    const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    for (let t = r; t <= 1 - r; t += 0.05) out.push(lerp(a, b, t));
    const p0 = lerp(a, b, 1 - r), p2 = lerp(b, c, r);
    for (let t = 0; t <= 1; t += 0.2) {
      const q0 = lerp(p0, b, t), q1 = lerp(b, p2, t);
      out.push(lerp(q0, q1, t));
    }
  }
  out.push(out[0]);
  return out;
}

const cases = [
  ['круг', stroke(arc(0, Math.PI * 2), { perSeg: 2 }), 'circle'],
  ['круг с заходом', stroke(arc(0.3, Math.PI * 2.1), { perSeg: 2 }), 'circle'],
  ['эллипс', stroke(arc(0, Math.PI * 2, 40, 0.5, 0.35), { perSeg: 2 }), 'circle'],
  ['треугольник', stroke(RUNES.triangle.path), 'triangle'],
  ['треугольник с середины', stroke([[0.25, 0], [0.5, 0.43], [-0.5, 0.43], [0, -0.5], [0.22, -0.05]]), 'triangle'],
  ['скруглённый треугольник', stroke(roundTri(), { perSeg: 1, jitter: 6 }), 'triangle'],
  ['кривой треугольник, недотянут', stroke([[0, -0.5], [0.45, 0.4], [-0.5, 0.45], [-0.12, -0.25]]), 'triangle'],
  ['молния', stroke(RUNES.zigzag.path), 'zigzag'],
  ['галочка', stroke(RUNES.vee.path), 'vee'],
  ['незамкнутый круг', stroke(arc(0, Math.PI * 1.35), { perSeg: 2 }), null, 'open', ['circle']],
  ['плоский круг', stroke(arc(0, Math.PI * 2, 40, 0.5, 0.18), { perSeg: 2 }), null, 'squashed', ['circle']],
  ['треугольник-дуга', stroke(arc(0, Math.PI * 2), { perSeg: 2 }), null, 'wrongRune', ['triangle']],
  ['открытый треугольник', stroke([[0, -0.5], [0.5, 0.43], [-0.5, 0.43], [-0.2, -0.1]]), null, 'open', ['triangle']],
  ['молния с 1 изломом', stroke([[-0.3, -0.5], [0.3, 0], [-0.3, 0.5]]), null, 'noCorners', ['zigzag']],
  ['перевёрнутая галочка', stroke([[-0.45, 0.4], [0, -0.45], [0.45, 0.4]]), null, 'cornerNotLow', ['vee']],
  ['маленькая руна', stroke(RUNES.vee.path, { size: 40 }), null, 'small', ['vee']],
];

let fail = 0;
for (const [name, pts, want, wantErr, expected] of cases) {
  const r = recognize(pts, { minSize: 100, expected });
  const got = r.ok ? r.rune : null;
  const good = got === want && (!wantErr || r.error?.code === wantErr);
  if (!good) fail++;
  console.log(`${good ? 'OK  ' : 'FAIL'} ${name}: ${got ?? '—'}${r.error ? ` [${r.error.code}] ${r.error.hint}` : ''}`);
}
// Случайные каракули не должны засчитываться ни как одна руна.
function scribble(n = 40) {
  const pts = [[0, 0]];
  let a = rand() * Math.PI * 2;
  for (let i = 1; i < n; i++) {
    a += (rand() - 0.5) * 2.2;
    pts.push([pts[i - 1][0] + Math.cos(a) * 0.06, pts[i - 1][1] + Math.sin(a) * 0.06]);
  }
  return pts;
}
for (const strict of [false, true]) {
  let hits = 0;
  const total = 200;
  for (let k = 0; k < total; k++) {
    const r = recognize(stroke(scribble(), { perSeg: 3 }), { minSize: 50, strict });
    if (r.ok) hits++;
  }
  const limit = strict ? 2 : 6;
  const good = hits <= limit;
  if (!good) fail++;
  console.log(`${good ? 'OK  ' : 'FAIL'} каракули (${strict ? 'строго' : 'обычно'}): засчитано ${hits} из ${total} (допустимо ≤ ${limit})`);
}
const junk = [
  ['туда-обратно', [[-0.5, 0], [0.5, 0], [-0.45, 0.02]]],
  ['двойная петля', arc(0, Math.PI * 4)],
  ['волна', Array.from({ length: 30 }, (_, i) => [i / 30 - 0.5, Math.sin(i / 3) * 0.2])],
];
for (const [name, path] of junk) {
  const r = recognize(stroke(path, { perSeg: 3 }), { minSize: 50 });
  if (r.ok) fail++;
  console.log(`${r.ok ? 'FAIL' : 'OK  '} мусор «${name}»: ${r.ok ? r.rune : 'не засчитан'}`);
}

// Нормальные руны дрожащей рукой: должны проходить и обычную, и строгую проверку.
for (const [name, path, want] of [
  ['круг', arc(0, Math.PI * 2), 'circle'],
  ['треугольник', roundTri(0.1), 'triangle'],
  ['молния', RUNES.zigzag.path, 'zigzag'],
  ['галочка', RUNES.vee.path, 'vee'],
]) {
  for (const strict of [false, true]) {
    let ok = 0;
    for (let k = 0; k < 20; k++) {
      const r = recognize(stroke(path, { perSeg: path.length > 10 ? 2 : 14, jitter: 10 }), { minSize: 50, strict });
      if (r.ok && r.rune === want) ok++;
    }
    const need = strict ? 14 : 18;
    if (ok < need) fail++;
    console.log(`${ok >= need ? 'OK  ' : 'FAIL'} дрожащая ${name} (${strict ? 'строго' : 'обычно'}): ${ok}/20`);
  }
}

console.log(fail ? `\n${fail} провал(ов)` : '\nВсе тесты пройдены');
process.exit(fail ? 1 : 0);
