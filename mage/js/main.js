// Точка входа: камера → MediaPipe → поза руки → события → сцена → отрисовка.
import { classifyHand, POSE, POSE_NAMES } from './gestures.js';
import { Input } from './input.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Toaster, StrokeFeedback, drawHand, drawTrail, POSE_COLORS, roundRect, label } from './ui.js';
import { Steppe } from './scenery.js';
import { C, drawIcon } from './theme.js';
import { DebugHand } from './debug.js';
import { preload } from './loader.js';
import { MenuScene } from './scenes/menu.js';
import { AcademyScene } from './scenes/academy.js';
import { BattleScene } from './scenes/battle.js';
import { ResultsScene } from './scenes/results.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const video = document.getElementById('video');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');
const DEBUG = new URLSearchParams(location.search).has('debug');

const app = {
  W: 0, H: 0, minDim: 0, time: 0,
  input: new Input(),
  fx: new Effects(),
  sfx: new Sfx(),
  toast: new Toaster(),
  feedback: new StrokeFeedback(),
  steppe: new Steppe(),
  pip: { x: 16, y: 0, w: 0, h: 0, k: 1 },
  scene: null,
  scenes: {},
  go(name, data) {
    this.scene = this.scenes[name];
    this.scene.enter?.(data);
  },
};
app.scenes = {
  menu: new MenuScene(app),
  academy: new AcademyScene(app),
  battle: new BattleScene(app),
  results: new ResultsScene(app),
};

// Видео растягивается «с обрезкой» на весь экран и отражается как зеркало.
let view = { ox: 0, oy: 0, dw: 1, dh: 1 };
function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  app.W = innerWidth;
  app.H = innerHeight;
  app.minDim = Math.min(app.W, app.H);
  canvas.width = app.W * dpr;
  canvas.height = app.H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
  const s = Math.max(app.W / vw, app.H / vh);
  view = { dw: vw * s, dh: vh * s, ox: (app.W - vw * s) / 2, oy: (app.H - vh * s) / 2 };
  app.steppe.resize(app.W, app.H, dpr, { x: app.W / 2, y: app.H * 0.58 });
}
addEventListener('resize', resize);

function buildObs(res) {
  if (!res.landmarks?.length) {
    rawHand = null;
    return { present: false };
  }
  rawHand = res.landmarks[0];
  const lm = res.landmarks[0].map(p => ({ x: view.ox + (1 - p.x) * view.dw, y: view.oy + p.y * view.dh }));
  const hand = classifyHand(lm);
  const palmIds = [0, 5, 9, 13, 17];
  const palm = {
    x: palmIds.reduce((s, i) => s + lm[i].x, 0) / palmIds.length,
    y: palmIds.reduce((s, i) => s + lm[i].y, 0) / palmIds.length,
  };
  const scale = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) / app.minDim;
  return { present: true, landmarks: lm, ...hand, tip: lm[8], palm, scale };
}

let rawHand = null; // точки руки в координатах кадра камеры (0..1)

// Окно камеры в углу: видно, попадает ли рука в кадр. Если руки нет
// или она у края — окно увеличивается.
function drawCameraWindow(dt) {
  const { W, H, input, pip } = app;
  const want = !input.present || input.framing ? 1 : 0;
  pip.k += (want - pip.k) * Math.min(1, dt * 4);
  const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
  pip.w = Math.min(W * 0.2, 240) + (Math.min(W * 0.34, 420) - Math.min(W * 0.2, 240)) * pip.k;
  pip.h = (pip.w * vh) / vw;
  pip.x = 16;
  pip.y = H - pip.h - 16;
  const { x, y, w, h } = pip;
  ctx.save();
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = C.night;
  ctx.fill();
  ctx.clip();
  if (video.videoWidth) {
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
  } else label(ctx, 'камера (отладка)', x + w / 2, y + h / 2, { size: 12, color: C.muted, outline: false });
  if (rawHand) drawHand(ctx, rawHand.map(p => ({ x: x + (1 - p.x) * w, y: y + p.y * h })), POSE_COLORS[input.pose]);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = input.present ? C.line : C.danger;
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8);
  ctx.stroke();
  ctx.restore();
  const known = input.present && input.pose !== POSE.OTHER;
  label(ctx, input.present ? POSE_NAMES[input.pose] : 'подними руку', x + 10, y + 13, { size: 12, weight: 700, color: known ? C.teal : input.present ? C.amber : C.danger, align: 'left' });
}

// Курсор руки на сцене: кольцо цвета позы и значок жеста рядом.
const POSE_ICON = { [POSE.PALM]: 'palm', [POSE.FIST]: 'fist', [POSE.THUMB]: 'thumb' };
function drawCursor() {
  const { input, time } = app;
  if (!input.present) return;
  const color = POSE_COLORS[input.pose];
  const p = input.pose === POSE.PALM || input.pose === POSE.FIST ? input.palm : input.tip;
  ctx.save();
  const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
  halo.addColorStop(0, 'rgba(95,211,196,0.35)');
  halo.addColorStop(1, 'rgba(95,211,196,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(p.x - 26, p.y - 26, 52, 52);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 10 + Math.sin(time * 5) * 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = C.ivory;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const icon = POSE_ICON[input.pose];
  if (icon) drawIcon(ctx, icon, p.x + 28, p.y - 22, 22, color);
}

// В отладке кадры идут и в скрытой вкладке (для автопроверки).
const nextFrame = cb => (DEBUG && document.hidden ? setTimeout(() => cb(performance.now()), 16) : requestAnimationFrame(cb));

let tracker = null;
let debugHand = null;
let lastObs = { present: false };
let last = performance.now();

function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  app.time += dt;

  if (debugHand) lastObs = debugHand.obs(now);
  else if (tracker) {
    const res = tracker.detect(video, now);
    if (res) lastObs = buildObs(res);
  }
  const events = app.input.update(lastObs, now, app.minDim);
  const { input, fx } = app;
  if (input.present && input.pose === POSE.POINT) fx.sparkle(input.tip.x, input.tip.y, C.teal);

  app.scene.update(dt, now, events);
  fx.update(dt);
  app.toast.update(dt);
  app.feedback.update(dt);
  app.steppe.update(dt);

  app.steppe.render(ctx, app.time);
  const shake = fx.offset();
  ctx.save();
  ctx.translate(shake.x, shake.y);
  app.scene.render(ctx);
  app.feedback.render(ctx, app.time);
  fx.render(ctx);
  ctx.restore();

  if (input.stroke) drawTrail(ctx, input.stroke.pts);
  drawCursor();
  app.scene.renderOverlay?.(ctx);
  drawCameraWindow(dt);
  app.toast.render(ctx, app.W, app.H, app.minDim, { bottom: app.H - 16, maxWidth: app.W - 2 * (app.pip.w + 40) });
  fx.renderFlash(ctx, app.W, app.H);

  if (!app.manual) nextFrame(frame);
}

// Движок и модель начинают качаться сразу при открытии страницы.
const loadBar = document.getElementById('loadBar');
const loadText = document.getElementById('loadText');
let ready = false;
const showProgress = p => {
  loadBar.style.width = `${Math.round(p * 100)}%`;
  if (!ready) loadText.textContent = `Загружаю распознавание рук: ${Math.round(p * 100)}%`;
};
const trackerModule = DEBUG ? null : import('./tracker.js');
const assets = DEBUG ? null : preload(showProgress);
assets?.then(() => {
  ready = true;
  loadText.textContent = 'Всё загружено — можно начинать';
}, () => {
  loadText.textContent = 'Не удалось загрузить модель. Проверь интернет и обнови страницу.';
});

async function start() {
  startBtn.disabled = true;
  app.sfx.unlock();
  try {
    statusEl.textContent = 'Запрашиваю доступ к камере…';
    const { startCamera, createHandTracker } = DEBUG ? await import('./tracker.js') : await trackerModule;
    try {
      await startCamera(video);
    } catch (e) {
      if (!DEBUG) throw new Error('camera');
    }
    resize();
    if (DEBUG) {
      debugHand = new DebugHand();
      Object.assign(window, { debugHand, stepFrame: frame }); // пошаговая автопроверка
    } else {
      statusEl.textContent = ready ? 'Запускаю распознавание…' : 'Камера готова. Дожидаюсь загрузки модели…';
      const loaded = await preload(showProgress);
      statusEl.textContent = 'Запускаю распознавание…';
      tracker = await createHandTracker(loaded);
    }
  } catch (e) {
    console.error(e);
    startBtn.disabled = false;
    statusEl.textContent = e.message === 'camera'
      ? 'Нет доступа к камере. Разреши камеру в адресной строке браузера и нажми кнопку ещё раз.'
      : 'Не удалось загрузить модель. Проверь интернет и нажми кнопку ещё раз.';
    return;
  }
  document.getElementById('start').hidden = true;
  app.go('menu');
  nextFrame(frame);
}

resize();
startBtn.addEventListener('click', start);
if (DEBUG) document.querySelector('.progress').hidden = true;
if (DEBUG) window.app = app; // для проверки из консоли
if (DEBUG) statusEl.textContent = 'Режим отладки: мышь — палец, F — кулак, P — ладонь, U — 👍, пробел — толчок.';
