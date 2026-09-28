// Распознавание рун — собственная логика команды (без готовых распознавателей).
// Траектория пальца → геометрические признаки (замкнутость, углы и их
// направление, пропорции) → руна. Если руна не получилась, diagnose()
// объясняет, что именно не так, и возвращает метки для подсветки ошибки.

const N = 48;                            // точек после ресемплинга
const K = 3;                             // шаг для оценки угла поворота
const CORNER_RAD = (55 * Math.PI) / 180; // поворот больше — это угол
const STRONG_RAD = (75 * Math.PI) / 180; // «настоящий» острый угол
const CLOSED_GAP = 0.35;                 // разрыв (доля размера), при котором фигура ещё замкнута

function circlePath(n = 32) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    pts.push([Math.cos(a) * 0.5, Math.sin(a) * 0.5]);
  }
  return pts;
}

export const RUNES = {
  circle:   { id: 'circle',   name: 'Круг',        spell: 'Лёд',   color: '#6ee7ff', path: circlePath() },
  triangle: { id: 'triangle', name: 'Треугольник', spell: 'Огонь', color: '#ff8a3d', path: [[0, -0.5], [0.5, 0.43], [-0.5, 0.43], [0, -0.5]] },
  zigzag:   { id: 'zigzag',   name: 'Молния',      spell: 'Гроза', color: '#ffe14d', path: [[-0.3, -0.5], [0.3, -0.17], [-0.3, 0.17], [0.3, 0.5]] },
  vee:      { id: 'vee',      name: 'Галочка',     spell: 'Ветер', color: '#7dff9b', path: [[-0.45, -0.4], [0, 0.45], [0.45, -0.4]] },
};
export const RUNE_IDS = Object.keys(RUNES);

// Название ошибки и совет — для итогов игры.
export const ERRORS = {
  short:          { label: 'Слишком короткий штрих',   advice: 'Рисуй руну целиком одним движением' },
  small:          { label: 'Руна слишком маленькая',   advice: 'Рисуй крупнее, примерно с ладонь' },
  fast:           { label: 'Слишком быстро',           advice: 'Веди палец чуть медленнее, чтобы камера успевала' },
  open:           { label: 'Фигура не замкнута',       advice: 'Доводи палец до точки, где начал фигуру' },
  angular:        { label: 'Круг с углами',            advice: 'Веди круг плавно, без резких поворотов' },
  squashed:       { label: 'Круг сплющен',             advice: 'Рисуй круг одинаковым в ширину и в высоту' },
  noCorners:      { label: 'Нет чётких углов',         advice: 'На каждом углу делай резкий поворот, а не дугу' },
  tooManyCorners: { label: 'Лишние углы',              advice: 'Рисуй ровными линиями, без лишних изломов' },
  closedZigzag:   { label: 'Молния замкнута',          advice: 'Не возвращайся к началу молнии' },
  notAlternating: { label: 'Изломы не чередуются',     advice: 'Чередуй направление: вправо, влево, вправо' },
  cornerNotLow:   { label: 'Угол галочки не внизу',    advice: 'У галочки угол внизу, а концы вверху' },
  narrowVee:      { label: 'Узкая галочка',            advice: 'Разводи концы галочки шире' },
  wrongRune:      { label: 'Не та руна',               advice: 'Смотри на руну над жыном перед тем, как рисовать' },
  unclear:        { label: 'Неразборчивая руна',       advice: 'Сравни свою руну с образцом в Академии' },
  earlyPush:      { label: 'Толчок без заряда',        advice: 'Дождись полного заряда шара перед толчком' },
};

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const turn = (u, v) => Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y);

function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
  return len;
}

function smooth(pts, r = 2) {
  return pts.map((_, i) => {
    let sx = 0, sy = 0, n = 0;
    for (let j = Math.max(0, i - r); j <= Math.min(pts.length - 1, i + r); j++) {
      sx += pts[j].x; sy += pts[j].y; n++;
    }
    return { x: sx / n, y: sy / n };
  });
}

// Равномерно расставляет n точек вдоль траектории.
function resample(pts, n) {
  const step = pathLength(pts) / (n - 1);
  const out = [{ x: pts[0].x, y: pts[0].y }];
  let acc = 0;
  let prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i];
    let d = dist(prev, cur);
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d;
      const q = { x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) };
      out.push(q);
      prev = q;
      d = dist(prev, cur);
      acc = 0;
    }
    acc += d;
    prev = cur;
  }
  while (out.length < n) out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
  return out;
}

// Находит углы: точки, где направление резко меняется. Соседние
// «угловые» точки объединяются, берётся самая острая.
function findCorners(pts) {
  const corners = [];
  let group = null;
  for (let i = K; i < pts.length - K; i++) {
    const a = turn(sub(pts[i], pts[i - K]), sub(pts[i + K], pts[i]));
    if (Math.abs(a) < CORNER_RAD) continue;
    if (group && i === group.last + 1 && Math.sign(a) === Math.sign(group.angle)) {
      group.last = i;
      if (Math.abs(a) > Math.abs(group.angle)) Object.assign(group, { i, angle: a });
    } else {
      group = { i, last: i, angle: a };
      corners.push(group);
    }
  }
  return corners.map(c => ({ i: c.i, x: pts[c.i].x, y: pts[c.i].y, angle: c.angle }));
}

export function analyzeStroke(raw) {
  if (!raw || raw.length < 6) return null;
  const sm = smooth(raw);
  if (pathLength(sm) < 1) return null;
  const pts = resample(sm, N);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX, h = maxY - minY;
  const size = Math.max(w, h, 1);
  const start = pts[0], end = pts[N - 1];
  const gap = dist(start, end) / size;
  const corners = findCorners(pts);

  let totalTurn = 0;
  for (let i = 1; i < N - 1; i++) totalTurn += turn(sub(pts[i], pts[i - 1]), sub(pts[i + 1], pts[i]));

  const c = corners[0];
  return {
    pts, size, w, h, gap,
    bbox: { x: minX, y: minY, w, h, cx: minX + w / 2, cy: minY + h / 2 },
    start, end,
    closed: gap < CLOSED_GAP,
    corners,
    strong: corners.filter(k => Math.abs(k.angle) > STRONG_RAD).length,
    totalTurn,
    aspect: Math.min(w, h) / size,
    alternating: corners.every((k, i) => i === 0 || Math.sign(k.angle) !== Math.sign(corners[i - 1].angle)),
    cornerLow: corners.length === 1 && c.y > Math.max(start.y, end.y) + 0.3 * size,
    spread: Math.abs(end.x - start.x) / size,
    duration: raw[0].t != null ? (raw[raw.length - 1].t - raw[0].t) / 1000 : 0,
  };
}

export function classify(f) {
  const nc = f.corners.length;
  if (f.closed) {
    if (f.strong >= 2 && nc <= 4) return 'triangle';
    if (f.strong <= 1 && f.aspect > 0.5) return 'circle';
    return null;
  }
  if (nc === 1 && f.cornerLow && f.spread > 0.3) return 'vee';
  if ((nc === 2 || nc === 3) && f.alternating) return 'zigzag';
  return null;
}

// Насколько штрих похож на руну — чтобы понять, что человек пытался нарисовать.
function similarity(f, id) {
  const nc = f.corners.length;
  const loop = Math.abs(f.totalTurn) / (2 * Math.PI); // ≈1 для замкнутой фигуры
  switch (id) {
    case 'circle':   return 2 - Math.abs(loop - 1) * 2 - Math.max(0, f.strong - 1) * 0.7 + (f.closed ? 0.5 : 0);
    case 'triangle': return 2 - Math.abs(loop - 1) * 2 - Math.abs(nc - 2.5) * 0.4 + (f.strong >= 2 ? 0.6 : 0) + (f.closed ? 0.3 : 0);
    case 'zigzag':   return 2 - Math.abs(nc - 2) * 0.6 + (f.alternating && nc > 1 ? 1 : 0) - (f.closed ? 1 : 0) - loop * 0.5;
    case 'vee':      return 2 - Math.abs(nc - 1) * 0.8 + (f.cornerLow ? 0.6 : 0) - (f.closed ? 1 : 0) - loop * 0.5;
    default:         return -Infinity;
  }
}

const gapMark = f => ({ type: 'gap', a: f.start, b: f.end });
const cornerMarks = f => f.corners.map(c => ({ type: 'corner', x: c.x, y: c.y }));
const err = (code, hint, marks = []) => ({ code, hint, marks });

// Конкретная подсказка: что исправить, чтобы получилась руна id.
export function diagnose(f, id) {
  const nc = f.corners.length;
  switch (id) {
    case 'circle':
      if (!f.closed) return err('open', 'Круг не замкнут — доведи палец до точки, где начал', [gapMark(f)]);
      if (f.strong >= 2) return err('angular', 'Слишком угловато — веди палец по плавной дуге, без резких поворотов', cornerMarks(f));
      if (f.aspect <= 0.5) return err('squashed', 'Круг сплющен — рисуй одинаково в ширину и в высоту');
      break;
    case 'triangle':
      if (f.strong < 2) return err('noCorners', 'Не видно углов — на каждом углу делай резкий поворот, а не дугу');
      if (!f.closed) return err('open', 'Треугольник не замкнут — верни палец к первому углу', [gapMark(f)]);
      if (nc > 4) return err('tooManyCorners', `Слишком много углов (${nc}) — нужно ровно 3`, cornerMarks(f));
      break;
    case 'zigzag':
      if (f.closed) return err('closedZigzag', 'Молния не замыкается — веди сверху вниз: ↘ ↙ ↘', [gapMark(f)]);
      if (nc < 2) return err('noCorners', 'Нужно 2 излома: вправо-вниз, влево-вниз, вправо-вниз', cornerMarks(f));
      if (nc > 3) return err('tooManyCorners', `Слишком много изломов (${nc}) — нужно всего 2`, cornerMarks(f));
      if (!f.alternating) return err('notAlternating', 'Изломы должны чередоваться: вправо, влево, вправо', cornerMarks(f));
      break;
    case 'vee':
      if (f.closed) return err('open', 'Галочка не замыкается — вниз и снова вверх', [gapMark(f)]);
      if (nc === 0) return err('noCorners', 'Нужен острый угол внизу: вниз, резкий поворот, вверх');
      if (nc > 1) return err('tooManyCorners', `У галочки один угол, а у тебя ${nc} — рисуй двумя прямыми`, cornerMarks(f));
      if (!f.cornerLow) return err('cornerNotLow', 'Угол должен быть внизу, а оба конца — сверху', cornerMarks(f));
      if (f.spread <= 0.3) return err('narrowVee', 'Разведи концы галочки шире', [gapMark(f)]);
      break;
  }
  return err('unclear', `Почти! Сравни с образцом руны «${RUNES[id].name}»`);
}

/**
 * Главная функция: штрих → результат.
 * raw: [{x, y, t}] в пикселях экрана; minSize — минимальный размер руны в px;
 * expected — какие руны сейчас нужны (по ним строится подсказка).
 */
export function recognize(raw, { minSize = 0, expected = RUNE_IDS } = {}) {
  const f = analyzeStroke(raw);
  if (!f) return { ok: false, features: null, target: null, error: err('short', 'Слишком короткий штрих — нарисуй руну целиком') };
  if (f.size < minSize) {
    return { ok: false, features: f, target: null, error: err('small', 'Рисуй крупнее — руна должна быть примерно с твою ладонь', [{ type: 'size' }]) };
  }
  if (f.duration > 0 && f.duration < 0.25) {
    return { ok: false, features: f, target: null, error: err('fast', 'Слишком быстро — веди палец плавнее, камера не успевает') };
  }

  const wanted = expected.length ? expected : RUNE_IDS;
  const rune = classify(f);
  if (rune && wanted.includes(rune)) return { ok: true, rune, features: f };

  const target = wanted.reduce((best, id) => (similarity(f, id) > similarity(f, best) ? id : best), wanted[0]);
  if (rune) {
    const hint = wanted.length === 1
      ? `Это «${RUNES[rune].name}», а нужна руна «${RUNES[target].name}»`
      : `Это «${RUNES[rune].name}», но жынов с такой руной сейчас нет`;
    return { ok: false, rune, features: f, target, error: err('wrongRune', hint) };
  }
  return { ok: false, rune: null, features: f, target, error: diagnose(f, target) };
}
