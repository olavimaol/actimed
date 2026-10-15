/*
  Футер в духе String-tune:
  1) тёмный «купол» поднимается снизу при прокрутке и раскрывается на всю ширину;
  2) упругая струна под заголовком прогибается от скорости прокрутки;
  3) восьмиугольник с логотипом поворачивается по мере прокрутки.
  Наведение мыши ничего не анимирует.
*/
(function () {
  'use strict';

  var cap = document.querySelector('[data-footer-cap]');
  var shape = document.querySelector('[data-footer-shape]');
  var string = document.querySelector('[data-footer-string]');
  var octa = document.querySelector('[data-footer-octa]');
  if (!cap || !shape) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function f(n) { return n.toFixed(4); }

  // Купол: формула контура как у String-tune, в координатах блока 0..1.
  // a — насколько блок въехал в экран (0 — только показался, 1 — целиком виден).
  function drawCap(a) {
    var a4 = Math.pow(a, 4), a8 = Math.pow(a, 8);
    var halfTop = a8 * 0.5;
    var d =
      'M ' + f(0.5 - halfTop) + ' 0' +
      ' C ' + f(0.3 - a4 * 0.3) + ' 0 ' + f(0.4 - a4 * 0.4) + ' 0 0 ' + f(a) +
      ' L 0 1 L 1 1 L 1 ' + f(a) +
      ' C ' + f(0.6 + a4 * 0.4) + ' 0 ' + f(0.7 + a4 * 0.3) + ' 0 ' + f(0.5 + halfTop) + ' 0 Z';
    shape.setAttribute('d', d);
  }

  // Струна: пружина, которую толкает скорость прокрутки
  var bend = 0, bendVel = 0, lastY = window.scrollY;
  var TENSION = 0.08, FRICTION = 0.86, MAX = 55;

  function drawString() {
    if (!string) return;
    var mid = 60 + bend;
    string.setAttribute('d', 'M0,60 Q500,' + f(mid) + ' 1000,60');
  }

  function update() {
    var vh = window.innerHeight;
    var r = cap.getBoundingClientRect();
    var a = clamp((vh - r.top) / r.height, 0, 1);
    drawCap(reduceMotion ? 1 : a);

    if (octa && !reduceMotion) {
      var o = octa.getBoundingClientRect();
      var p = clamp((vh - o.top) / (vh + o.height), 0, 1);
      octa.style.transform = 'rotate(' + f((p - 0.5) * 90) + 'deg) scale(' + f(0.85 + p * 0.15) + ')';
    }
  }

  var running = false;
  function tick() {
    var y = window.scrollY;
    var dy = y - lastY;
    lastY = y;

    bendVel += clamp(dy, -60, 60) * 0.12;
    bendVel += -bend * TENSION;
    bendVel *= FRICTION;
    bend = clamp(bend + bendVel, -MAX, MAX);
    drawString();

    update();

    if (Math.abs(bend) > 0.05 || Math.abs(bendVel) > 0.05 || dy !== 0) {
      requestAnimationFrame(tick);
    } else {
      bend = 0; bendVel = 0; drawString();
      running = false;
    }
  }

  function kick() {
    if (reduceMotion) { update(); return; }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', update);
  update();
  drawString();
})();
