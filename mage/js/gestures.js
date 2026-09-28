// Поза руки по 21 точке MediaPipe — собственные правила команды.
// Для «почти правильных» поз возвращаем конкретную подсказку,
// какой палец согнуть или выпрямить.

export const POSE = {
  NONE: 'NONE',   // руки нет в кадре
  POINT: 'POINT', // указательный палец — рисуем руны
  PALM: 'PALM',   // открытая ладонь — заряд маны
  FIST: 'FIST',   // кулак — щит
  THUMB: 'THUMB', // большой палец вверх — «да / старт»
  OTHER: 'OTHER',
};

const FINGERS = [
  { name: 'указательный палец', mcp: 5, pip: 6, dip: 7, tip: 8 },
  { name: 'средний палец', mcp: 9, pip: 10, dip: 11, tip: 12 },
  { name: 'безымянный палец', mcp: 13, pip: 14, dip: 15, tip: 16 },
  { name: 'мизинец', mcp: 17, pip: 18, dip: 19, tip: 20 },
];

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function list(names) {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`;
}

const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) });
function angle3(u, v) {
  const dot = u.x * v.x + u.y * v.y + u.z * v.z;
  const l = Math.hypot(u.x, u.y, u.z) * Math.hypot(v.x, v.y, v.z) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, dot / l))) * 180) / Math.PI;
}

/**
 * Состояние каждого пальца. Если есть 3D-точки (world — в метрах), палец
 * прямой по углу сгиба в суставах: так он распознаётся, даже когда смотрит
 * прямо в камеру и на картинке выглядит коротким. Без 3D — запасной способ
 * по расстояниям на экране.
 */
export function fingerStates(lm, world) {
  if (world) {
    return FINGERS.map(f => {
      const bend = angle3(sub3(world[f.pip], world[f.mcp]), sub3(world[f.tip], world[f.pip]));
      return bend < 40 ? 'ext' : bend > 75 ? 'curl' : 'half';
    });
  }
  const wrist = lm[0];
  return FINGERS.map(f => {
    const r = d(lm[f.tip], wrist) / d(lm[f.pip], wrist);
    return r > 1.15 ? 'ext' : r < 1.08 ? 'curl' : 'half';
  });
}

/** lm — 21 точка в пикселях экрана, world — те же точки в 3D. Возвращает { pose, near, hint }. */
export function classifyHand(lm, world = null) {
  const scale = d(lm[0], lm[9]) || 1;
  const st = fingerStates(lm, world);
  const [index, ...others] = st;
  const nExt = st.filter(s => s === 'ext').length;
  const nCurl = st.filter(s => s === 'curl').length;
  const thumbOut = d(lm[4], lm[9]) / scale > 0.72;
  const namesWhere = test => FINGERS.filter((_, i) => test(st[i], i)).map(f => f.name);

  // Правила с запасом: живая рука редко сгибает пальцы идеально.
  if (nExt === 4 || (nExt === 3 && nCurl === 0)) return { pose: POSE.PALM };
  if (index === 'ext' && others.every(s => s !== 'ext') && others.filter(s => s === 'curl').length >= 2) return { pose: POSE.POINT };
  if (nExt === 0 && nCurl >= 3) {
    const thumbUp = thumbOut && lm[4].y < lm[5].y - 0.35 * scale && lm[4].y < lm[3].y;
    return { pose: thumbUp ? POSE.THUMB : POSE.FIST };
  }

  // Почти-позы: говорим, что именно исправить.
  if (index === 'ext') {
    const bad = namesWhere((s, i) => i > 0 && s !== 'curl');
    return { pose: POSE.OTHER, near: POSE.POINT, hint: `Чтобы рисовать, согни ${list(bad)} — вытянут только указательный` };
  }
  if (index === 'half' && others.every(s => s === 'curl')) {
    return { pose: POSE.OTHER, near: POSE.POINT, hint: 'Выпрями указательный палец до конца — это твоя волшебная палочка' };
  }
  if (nExt >= 2 && nCurl === 0) {
    return { pose: POSE.OTHER, near: POSE.PALM, hint: `Раскрой ладонь полностью — выпрями ${list(namesWhere(s => s !== 'ext'))}` };
  }
  if (nCurl >= 2) {
    return { pose: POSE.OTHER, near: POSE.FIST, hint: `Сожми кулак плотнее — согни ${list(namesWhere(s => s !== 'curl'))}` };
  }
  return { pose: POSE.OTHER };
}

export const POSE_NAMES = {
  [POSE.POINT]: 'палец — рисую',
  [POSE.PALM]: 'ладонь',
  [POSE.FIST]: 'кулак',
  [POSE.THUMB]: 'большой палец вверх',
  [POSE.OTHER]: 'жест не распознан',
  [POSE.NONE]: 'руки не видно',
};
