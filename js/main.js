// Точка входа: камера → MediaPipe Pose → анализ дирижёра → сцена → отрисовка.
import { Conductor, readBody } from './conductor.js';
import { Orchestra } from './music.js';
import { Effects } from './effects.js';
import { Toaster } from './ui.js';
import { layoutSections, drawArms } from './stage.js';
import { DebugBody } from './debug.js';
import { MenuScene } from './scenes/menu.js';
import { RehearsalScene } from './scenes/rehearsal.js';
import { ConcertScene } from './scenes/concert.js';
import { ResultsScene } from './scenes/results.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const video = document.getElementById('video');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');
const DEBUG = new URLSearchParams(location.search).has('debug');

const app = {
  W: 0, H: 0, minDim: 0, time: 0,
  conductor: new Conductor(),
  fx: new Effects(),
  toast: new Toaster(),
  orchestra: null,
  body: null,
  sections: [],
  scene: null,
  scenes: {},
  go(name, data) {
    this.scene = this.scenes[name];
    this.scene.enter?.(data);
  },
};
app.scenes = {
  menu: new MenuScene(app),
  rehearsal: new RehearsalScene(app),
  concert: new ConcertScene(app),
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
  app.sections = layoutSections(app.W, app.H, app.minDim);
}
addEventListener('resize', resize);

const toScreen = p => ({ x: view.ox + (1 - p.x) * view.dw, y: view.oy + p.y * view.dh, visibility: p.visibility });

// Затемнённое видео и «луч прожектора» на дирижёре.
function drawBackground() {
  const { W, H, minDim, body } = app;
  if (video.videoWidth) {
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, view.ox, view.oy, view.dw, view.dh);
    ctx.restore();
  } else {
    ctx.fillStyle = '#1a0f3a';
    ctx.fillRect(0, 0, W, H);
  }
  const cx = body?.shouldersOk ? body.nose.x : W / 2;
  const cy = body?.shouldersOk ? body.nose.y : H * 0.45;
  const g = ctx.createRadialGradient(cx, cy, minDim * 0.15, cx, cy, Math.max(W, H) * 0.7);
  g.addColorStop(0, 'rgba(20,8,50,0.25)');
  g.addColorStop(0.5, 'rgba(14,6,40,0.62)');
  g.addColorStop(1, 'rgba(6,2,20,0.88)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Курсор правой руки для кнопок «наведи и держи».
function drawPointer() {
  const { body, time } = app;
  if (!body?.rightOk || app.scene === app.scenes.concert) return;
  const p = body.pointer;
  ctx.save();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 14 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// В отладке кадры идут и в скрытой вкладке (для автопроверки).
const nextFrame = cb => (DEBUG && document.hidden ? setTimeout(() => cb(performance.now()), 16) : requestAnimationFrame(cb));

let tracker = null;
let debugBody = null;
let last = performance.now();

function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  app.time += dt;

  if (debugBody) app.body = readBody(debugBody.landmarks());
  else if (tracker) {
    const res = tracker.detect(video, now);
    if (res) app.body = res.landmarks?.length ? readBody(res.landmarks[0].map(toScreen)) : null;
  }
  const events = app.conductor.update(app.body, now / 1000, app.minDim);

  app.scene.update(dt, now, events);
  app.fx.update(dt);
  app.toast.update(dt);

  drawBackground();
  const shake = app.fx.offset();
  ctx.save();
  ctx.translate(shake.x, shake.y);
  app.scene.render(ctx);
  app.fx.render(ctx);
  ctx.restore();
  if (app.body?.shouldersOk) drawArms(ctx, app.body);
  drawPointer();
  app.scene.renderOverlay?.(ctx);
  app.toast.render(ctx, app.W, app.H, app.minDim, app.scene.toastBottom ?? app.H - 12);
  app.fx.renderFlash(ctx, app.W, app.H);

  if (!app.manual) nextFrame(frame);
}

async function start() {
  startBtn.disabled = true;
  try {
    app.orchestra = new Orchestra(new AudioContext());
    statusEl.textContent = 'Запрашиваю доступ к камере…';
    const { startCamera, createPoseTracker } = await import('./tracker.js');
    try {
      await startCamera(video);
    } catch {
      if (!DEBUG) throw new Error('camera');
    }
    resize();
    if (DEBUG) {
      debugBody = new DebugBody(() => app.sections);
      Object.assign(window, { debugBody, stepFrame: frame }); // пошаговая автопроверка
    }
    else {
      statusEl.textContent = 'Загружаю модель распознавания движений…';
      tracker = await createPoseTracker();
    }
  } catch (e) {
    console.error(e);
    startBtn.disabled = false;
    statusEl.textContent = e.message === 'camera'
      ? 'Нет доступа к камере. Разреши камеру в адресной строке браузера и нажми кнопку ещё раз.'
      : 'Не удалось загрузить модель. Проверь интернет и обнови страницу.';
    return;
  }
  document.getElementById('start').hidden = true;
  app.go('menu');
  nextFrame(frame);
}

resize();
startBtn.addEventListener('click', start);
if (DEBUG) {
  window.app = app; // для проверки из консоли
  statusEl.textContent = 'Режим отладки: мышь — правая рука, 1/2/3 — указать на группу, B — согнутая рука, U — фермата.';
}
