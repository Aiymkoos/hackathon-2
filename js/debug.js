// Режим разработчика (?debug): тело дирижёра имитируется мышью и клавишами,
// чтобы проверять приложение без камеры. Жюри этот режим не нужен.
//   мышь — правая рука (водите вверх-вниз, чтобы дирижировать)
//   1 / 2 / 3 — левая рука указывает на трубы / флейты / литавры
//   B — левая рука поднята, но согнута в локте
//   U — обе руки вверх (фермата); отпустить — руки резко вниз (снятие)

const KEY_TARGET = { Digit1: 'brass', Digit2: 'flutes', Digit3: 'timpani' };

export class DebugBody {
  constructor(getSections) {
    this.getSections = getSections;
    this.x = innerWidth * 0.62;
    this.y = innerHeight * 0.7;
    this.keys = new Set();
    addEventListener('pointermove', e => { this.x = e.clientX; this.y = e.clientY; });
    addEventListener('keydown', e => this.keys.add(e.code));
    addEventListener('keyup', e => this.keys.delete(e.code));
  }

  // Точки в том же формате, что readBody() получает от MediaPipe.
  landmarks() {
    const W = innerWidth, H = innerHeight;
    const pt = (x, y) => ({ x, y, visibility: 1 });
    const sw = Math.min(W, H) * 0.28;
    const ls = pt(W / 2 - sw / 2, H * 0.62), rs = pt(W / 2 + sw / 2, H * 0.62);
    const nose = pt(W / 2, H * 0.62 - sw * 0.8);
    let lw = pt(ls.x - sw * 0.2, ls.y + sw * 1.3);
    let le = pt(ls.x - sw * 0.2, ls.y + sw * 0.7);
    let rw = pt(this.x, this.y);
    let re = pt((rs.x + this.x) / 2 + sw * 0.2, (rs.y + this.y) / 2);

    const key = Object.keys(KEY_TARGET).find(k => this.keys.has(k));
    const target = key && this.getSections().find(s => s.id === KEY_TARGET[key]);
    if (target) {
      const dx = target.x - ls.x, dy = target.y - ls.y, l = Math.hypot(dx, dy);
      lw = pt(ls.x + (dx / l) * sw * 1.4, ls.y + (dy / l) * sw * 1.4);
      le = pt(ls.x + (dx / l) * sw * 0.7, ls.y + (dy / l) * sw * 0.7);
    } else if (this.keys.has('KeyB')) {
      le = pt(ls.x - sw * 0.7, ls.y);
      lw = pt(ls.x - sw * 0.6, ls.y - sw * 0.6);
    }
    if (this.keys.has('KeyU')) {
      lw = pt(ls.x - sw * 0.2, nose.y - sw * 0.6);
      rw = pt(rs.x + sw * 0.2, nose.y - sw * 0.6);
      le = pt(ls.x - sw * 0.3, ls.y - sw * 0.4);
      re = pt(rs.x + sw * 0.3, rs.y - sw * 0.4);
    }
    const lm = Array.from({ length: 33 }, () => pt(0, 0));
    Object.assign(lm, { 0: nose, 11: ls, 12: rs, 13: le, 14: re, 15: lw, 16: rw, 20: rw });
    return lm;
  }
}
