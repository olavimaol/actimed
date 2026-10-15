/*
  Футер по образцу String-tune, на библиотеке StringTune (MIT).

  • StringTune включает плавную прокрутку на компьютере.
  • Прогресс футера: 0 — верх футера коснулся низа экрана, 1 — ушёл на 25%
    выше верха (как в оригинале). По нему рисуется тёмная «гора»:
    закреплённый слой во весь экран, вершина поднимается снизу и к концу
    раскрывается в прямоугольник, закрывая предыдущий блок.
    Прогресс считается по положению футера каждый кадр — так гора верна
    и после перезагрузки страницы внизу, и после мгновенного перехода.
  • Струна между заголовками дёргается, когда пересекает середину экрана,
    и затухает как пружина. Курсор её не трогает — анимаций при наведении нет.
  • Над восьмиугольником — объёмный знак Actimed (js/logo3d.js, three.js):
    при прокрутке плавно поворачивается и чуть «парит». Модуль грузится,
    только когда футер близко; без WebGL остаётся картинка.
*/
import StringTune, { StringProgress } from '../vendor/string-tune.mjs';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- StringTune ---------- */
const tune = StringTune.getInstance();
tune.scrollDesktopMode = reduceMotion ? 'default' : 'smooth';
tune.scrollMobileMode = 'default';
tune.use(StringProgress);
tune.start(0);
window.actimedTune = tune;

/* ---------- Тёмная гора ---------- */
const footer = document.querySelector('[data-footer]');
const shape = document.querySelector('[data-footer-shape]');
const f = (n) => (Math.round(n * 10000) / 10000).toString();

function drawMountain(progress) {
  if (!shape) return;
  const a = Math.min(1, Math.max(0, progress));
  const top = 1 - a;                       // высота вершины
  const half = Math.pow(a, 8) * 0.5;       // плоская вершина расширяется только в самом конце
  const pull = 1 - Math.pow(a, 4);         // плечи «стекают» к углам и распрямляются
  shape.setAttribute('d',
    `M ${f(0.5 - half)} ${f(top)}` +
    ` C ${f(0.3 * pull)} ${f(top)} ${f(0.4 * pull)} ${f(top)} 0 1` +
    ' L 1 1' +
    ` C ${f(1 - 0.4 * pull)} ${f(top)} ${f(1 - 0.3 * pull)} ${f(top)} ${f(0.5 + half)} ${f(top)} Z`
  );
}
let mountainRaf = 0;
function updateMountain() {
  mountainRaf = 0;
  const vh = window.innerHeight;
  const top = footer.getBoundingClientRect().top;
  drawMountain((vh - top) / (vh * 1.25));
}
const requestMountain = () => { if (!mountainRaf) mountainRaf = requestAnimationFrame(updateMountain); };

// Без анимаций (системная настройка) футер остаётся сплошным тёмным блоком.
if (footer && shape && !reduceMotion) {
  footer.classList.add('is-mountain');
  window.addEventListener('scroll', requestMountain, { passive: true });
  window.addEventListener('resize', requestMountain);
  updateMountain();
}

/* ---------- Струна ---------- */
const stringSvg = document.querySelector('[data-footer-string-svg]');
const stringPath = document.querySelector('[data-footer-string]');

const MAX_BEND = 0.45;   // доля высоты блока струны
let bend = 0;            // текущее отклонение
let bendVel = 0;
let springRaf = 0;
let lastT = 0;

function drawString() {
  const d = Math.max(-MAX_BEND, Math.min(MAX_BEND, bend));
  const peak = 0.5 + d;
  const shoulder = 0.5 + d * 0.6;
  stringPath.setAttribute('d',
    `M 0 0.5 C 0.22 ${f(shoulder)} 0.28 ${f(peak)} 0.5 ${f(peak)}` +
    ` C 0.72 ${f(peak)} 0.78 ${f(shoulder)} 1 0.5`
  );
}

function spring(now) {
  const dt = Math.min(2, lastT ? (now - lastT) / 16.67 : 1);   // в кадрах по 60 Гц
  lastT = now;
  bendVel -= 0.5 * bend * dt;
  bendVel *= Math.pow(0.92, dt);
  bend += bendVel * dt;
  drawString();
  if (Math.abs(bend) < 1e-4 && Math.abs(bendVel) < 1e-4) {
    bend = 0; bendVel = 0; drawString();
    springRaf = 0; lastT = 0;
    return;
  }
  springRaf = requestAnimationFrame(spring);
}

function pluck(strength) {
  if (reduceMotion) return;
  bendVel += strength;
  if (!springRaf) springRaf = requestAnimationFrame(spring);
}

if (stringSvg && stringPath) {
  drawString();
  let wasAbove = null;
  let lastPluck = -1e9;
  let ticking = false;

  const check = () => {
    ticking = false;
    const r = stringSvg.getBoundingClientRect();
    if (!r.height) return;
    const above = r.top + r.height / 2 < window.innerHeight / 2;
    const now = performance.now();
    // один щипок на пересечение середины экрана; пауза, чтобы щипки не гасили друг друга
    if (wasAbove !== null && above !== wasAbove && now - lastPluck > 600) {
      lastPluck = now;
      pluck(0.3);
    }
    wasAbove = above;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(check); }
  }, { passive: true });
  check();
}

/* ---------- Объёмный знак ---------- */
const figure = document.querySelector('[data-footer-figure]');
const desktop = window.matchMedia('(min-width: 1024px)');

if (figure && !reduceMotion) {
  const near = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting) || !desktop.matches) return;
    near.disconnect();
    import('./logo3d.js').then((m) => runFigure(m.createFigure)).catch(() => { /* остаётся картинка */ });
  }, { rootMargin: '900px 0px' });
  near.observe(figure);
}

function runFigure(createFigure) {
  const canvas = figure.querySelector('canvas');
  let fig;
  try { fig = createFigure(canvas); } catch (e) { return; }      // нет WebGL — остаётся картинка
  let size = 0, raf = 0, last = 0, visible = false, pose = null;
  const t0 = performance.now();

  function frame(now) {
    raf = 0;
    const s = Math.round(figure.clientWidth);
    if (!s) return;
    if (s !== size) { size = s; fig.resize(size, Math.min(2, window.devicePixelRatio || 1)); }
    // p: 0 — знак у нижнего края экрана, 1 — у верхнего
    const r = figure.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
    const t = (now - t0) / 1000;
    const target = {
      yaw: (p - 0.5) * 1.25 + Math.sin(t * 0.45) * 0.07,   // поворот вслед за прокруткой
      pitch: 0.18 - p * 0.14 + Math.sin(t * 0.6) * 0.025,
      roll: Math.sin(t * 0.5) * 0.02,
      lift: (0.5 - p) * 14 + Math.sin(t * 0.8) * 2.5        // лёгкий параллакс и «парение»
    };
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    if (!pose) pose = { ...target };
    const k = 1 - Math.exp(-dt * 3.2);                      // догоняет мягко, без рывков
    for (const key in target) pose[key] += (target[key] - pose[key]) * k;
    fig.render(pose.yaw, pose.pitch, pose.roll, pose.lift);
    figure.classList.add('is-live');
    if (visible) raf = requestAnimationFrame(frame);
  }

  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  }).observe(figure);
}
