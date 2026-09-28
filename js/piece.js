// Партитура: «Ода к радости» (Бетховен, общественное достояние) для 5 групп оркестра.
// Каждая нота: { beat, section, midi, dur } — время и длительность в долях.

export const SECTIONS = {
  brass:   { name: 'Трубы',      icon: 'trumpet', color: '#e0a340', cue: true },
  flutes:  { name: 'Флейты',     icon: 'flute', color: '#a9cf9a', cue: true },
  timpani: { name: 'Литавры',    icon: 'timpani', color: '#d9745c', cue: true },
  strings: { name: 'Скрипки',    icon: 'violin', color: '#a8c8dc', cue: false },
  cellos:  { name: 'Виолончели', icon: 'cello', color: '#c9a0b0', cue: false },
};

const A = [[64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1], [60, 1], [60, 1], [62, 1], [64, 1], [64, 1.5], [62, 0.5], [62, 2]];
const A2 = [...A.slice(0, 12), [62, 1.5], [60, 0.5], [60, 2]];
const B = [[62, 1], [62, 1], [64, 1], [60, 1], [62, 1], [64, 0.5], [65, 0.5], [64, 1], [60, 1], [62, 1], [64, 0.5], [65, 0.5], [64, 1], [62, 1], [60, 1], [62, 1], [55, 2]];

// Гармония по полутактам (2 доли)
const H_A = ['C', 'C', 'G', 'G', 'C', 'C', 'G', 'G'];
const H_A2 = ['C', 'C', 'G', 'G', 'C', 'C', 'G', 'C'];
const H_B = ['G', 'G', 'G', 'C', 'G', 'G', 'C', 'G'];

const CHORDS = {
  C: { root: 48, triad: [64, 67, 72], timp: 43 },
  G: { root: 43, triad: [62, 67, 71], timp: 38 },
};

const PHRASES = [
  { melody: A, harmony: H_A },
  { melody: A2, harmony: H_A2 },
  { melody: B, harmony: H_B },
  { melody: A2, harmony: H_A2 },
  { melody: A2, harmony: H_A2, finale: true },
];

function build() {
  const notes = [];
  let beat = 0;
  for (const ph of PHRASES) {
    let b = beat;
    for (const [midi, dur] of ph.melody) {
      notes.push({ beat: b, section: 'strings', midi: midi + 12, dur });
      if (ph.finale) notes.push({ beat: b, section: 'brass', midi, dur });
      b += dur;
    }
    ph.harmony.forEach((name, i) => {
      const ch = CHORDS[name];
      const hb = beat + i * 2;
      notes.push({ beat: hb, section: 'cellos', midi: ch.root, dur: 2 });
      for (const m of ch.triad) notes.push({ beat: hb, section: 'flutes', midi: m, dur: 2 });
      notes.push({ beat: hb, section: 'timpani', midi: ch.timp, dur: 1 });
    });
    beat += 16;
  }
  // Финальный аккорд под фермату: звучит, пока дирижёр не снимет оркестр.
  const end = beat;
  for (const [section, midis] of Object.entries({ strings: [72, 76], cellos: [36, 48], flutes: [64, 67, 72], brass: [60, 64, 67], timpani: [36] })) {
    for (const midi of midis) notes.push({ beat: end, section, midi, dur: Infinity });
  }
  notes.sort((a, b) => a.beat - b.beat);
  return { notes, finalBeat: end };
}

const { notes, finalBeat } = build();

export const PIECE = {
  title: 'Ода к радости',
  composer: 'Л. ван Бетховен',
  tempo: 100,
  tempoRange: [72, 132],
  beatsPerBar: 4,
  notes,
  finalBeat,
  bars: finalBeat / 4 + 1,
  // Вступления: группа должна вступить в начале такта bar (такты с 1)
  cues: [
    { section: 'flutes', bar: 5 },
    { section: 'timpani', bar: 9 },
    { section: 'brass', bar: 17 },
  ],
  // Динамика по тактам: p — тихо, mf — средне, f — громко
  dynamics: [
    { from: 1, to: 8, mark: 'p' },
    { from: 9, to: 16, mark: 'mf' },
    { from: 17, to: 20, mark: 'f' },
  ],
};

export const barOf = beat => Math.floor(beat / 4) + 1;
export const markAt = beat => PIECE.dynamics.find(d => barOf(beat) >= d.from && barOf(beat) <= d.to)?.mark ?? null;

export const MARK_NAMES = { p: 'piano — тихо', mf: 'mezzo-forte — средне', f: 'forte — громко' };
