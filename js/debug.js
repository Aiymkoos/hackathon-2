// Режим разработчика (?debug): рука имитируется мышью и клавишами,
// чтобы проверять игру без камеры. Жюри этот режим не нужен.
//   зажатая кнопка мыши — указательный палец (рисование)
//   F — кулак, P — ладонь, U — большой палец вверх, пробел — толчок ладонью

import { POSE } from './gestures.js';

export class DebugHand {
  constructor() {
    this.x = innerWidth / 2;
    this.y = innerHeight / 2;
    this.down = false;
    this.keys = new Set();
    this.pushAt = -1e9;
    addEventListener('pointermove', e => { this.x = e.clientX; this.y = e.clientY; });
    addEventListener('pointerdown', () => { this.down = true; });
    addEventListener('pointerup', () => { this.down = false; });
    addEventListener('keydown', e => {
      this.keys.add(e.code);
      if (e.code === 'Space') this.pushAt = performance.now();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
  }

  obs(now) {
    let pose = POSE.OTHER;
    if (this.down) pose = POSE.POINT;
    if (this.keys.has('KeyF')) pose = POSE.FIST;
    if (this.keys.has('KeyP') || this.keys.has('Space')) pose = POSE.PALM;
    if (this.keys.has('KeyU')) pose = POSE.THUMB;
    const k = Math.min(1, Math.max(0, (now - this.pushAt) / 200));
    const scale = now - this.pushAt < 400 ? 0.15 + 0.1 * k : 0.15;
    const p = { x: this.x, y: this.y };
    return { present: true, pose, tip: p, palm: p, scale, landmarks: null };
  }
}
