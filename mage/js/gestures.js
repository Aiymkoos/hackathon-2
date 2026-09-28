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
  { name: 'указательный палец', pip: 6, tip: 8 },
  { name: 'средний палец', pip: 10, tip: 12 },
  { name: 'безымянный палец', pip: 14, tip: 16 },
  { name: 'мизинец', pip: 18, tip: 20 },
];

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function list(names) {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`;
}

// Палец выпрямлен, если кончик заметно дальше от запястья, чем средний сустав.
export function fingerStates(lm) {
  const wrist = lm[0];
  return FINGERS.map(f => {
    const r = d(lm[f.tip], wrist) / d(lm[f.pip], wrist);
    return r > 1.18 ? 'ext' : r < 1.05 ? 'curl' : 'half';
  });
}

/** lm — 21 точка в пикселях экрана. Возвращает { pose, near, hint }. */
export function classifyHand(lm) {
  const scale = d(lm[0], lm[9]) || 1;
  const st = fingerStates(lm);
  const [index, ...others] = st;
  const nExt = st.filter(s => s === 'ext').length;
  const nCurl = st.filter(s => s === 'curl').length;
  const thumbOut = d(lm[4], lm[9]) / scale > 0.72;
  const namesWhere = test => FINGERS.filter((_, i) => test(st[i], i)).map(f => f.name);

  if (nExt === 4) return { pose: POSE.PALM };
  if (index === 'ext' && others.every(s => s === 'curl')) return { pose: POSE.POINT };
  if (nCurl === 4) {
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
