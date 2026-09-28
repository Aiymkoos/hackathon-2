// Точка входа: камера → MediaPipe → поза руки → события → сцена → отрисовка.
import { classifyHand, POSE } from './gestures.js';
import { Input } from './input.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Toaster, StrokeFeedback, drawHand, drawTrail, POSE_COLORS } from './ui.js';
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
}
addEventListener('resize', resize);

function buildObs(res) {
  if (!res.landmarks?.length) return { present: false };
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

function drawBackground() {
  const { W, H } = app;
  if (video.videoWidth) {
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, view.ox, view.oy, view.dw, view.dh);
    ctx.restore();
    ctx.fillStyle = 'rgba(14,6,40,0.55)';
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#120830';
    ctx.fillRect(0, 0, W, H);
  }
  const g = ctx.createRadialGradient(W / 2, H / 2, app.minDim * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,0,30,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

let tracker = null;
let debugHand = null;
let lastObs = { present: false };
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  app.time += dt;

  if (debugHand) lastObs = debugHand.obs(now);
  else if (tracker) {
    const res = tracker.detect(video, now);
    if (res) lastObs = buildObs(res);
  }
  const events = app.input.update(lastObs, now, app.minDim);
  const { input, fx } = app;
  if (input.present && input.pose === POSE.POINT) fx.sparkle(input.tip.x, input.tip.y, '#bff3ff');

  app.scene.update(dt, now, events);
  fx.update(dt);
  app.toast.update(dt);
  app.feedback.update(dt);

  drawBackground();
  const shake = fx.offset();
  ctx.save();
  ctx.translate(shake.x, shake.y);
  app.scene.render(ctx);
  app.feedback.render(ctx, app.time);
  fx.render(ctx);
  ctx.restore();

  if (input.landmarks) drawHand(ctx, input.landmarks, POSE_COLORS[input.pose]);
  if (input.stroke) drawTrail(ctx, input.stroke.pts);
  if (input.present && !input.landmarks) {
    // режим отладки: показываем «кончик пальца»
    ctx.fillStyle = POSE_COLORS[input.pose];
    ctx.beginPath();
    ctx.arc(input.tip.x, input.tip.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  app.scene.renderOverlay?.(ctx);
  app.toast.render(ctx, app.W, app.H, app.minDim);
  fx.renderFlash(ctx, app.W, app.H);

  requestAnimationFrame(frame);
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
  requestAnimationFrame(frame);
}

resize();
startBtn.addEventListener('click', start);
if (DEBUG) document.querySelector('.progress').hidden = true;
if (DEBUG) window.app = app; // для проверки из консоли
if (DEBUG) statusEl.textContent = 'Режим отладки: мышь — палец, F — кулак, P — ладонь, U — 👍, пробел — толчок.';
