// Рекорды и прогресс в localStorage. Если хранилище недоступно, игра работает без него.

const KEY = 'maestro.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* приватный режим — просто не сохраняем */
  }
}

export const store = {
  records() {
    return load().records ?? [];
  },

  // Возвращает место в таблице (1..10) или 0, если не попал.
  addRecord(rec) {
    const data = load();
    const list = [...(data.records ?? []), rec].sort((a, b) => b.score - a.score).slice(0, 10);
    data.records = list;
    save(data);
    return list.indexOf(rec) + 1;
  },

  academyDone() {
    return !!load().academyDone;
  },

  setAcademyDone() {
    const data = load();
    data.academyDone = true;
    save(data);
  },
};
