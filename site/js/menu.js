/*
  Шапка и меню в духе Agrumea — общие для всех страниц.
  Разметку вставляет этот скрипт в <div data-site-header>.
    data-theme="dark"  — светлые надписи (главная с тёмной лентой)
    data-theme="light" — бирюзовые надписи (страница товара)
    data-back          — слева кнопка «назад к ленте» вместо телефона
  Меню открывается по клику: слой во весь экран, крупные пункты лесенкой.
  Анимаций при наведении нет.
*/
(function () {
  'use strict';

  var D = window.ACTIMED;
  var host = document.querySelector('[data-site-header]');
  if (!host) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var theme = host.getAttribute('data-theme') || 'light';
  var withBack = host.hasAttribute('data-back');

  /* ---------- Корзина (в браузере посетителя) ---------- */
  var CART_KEY = 'actimed-cart';
  function readCart() {
    try { return Math.max(0, parseInt(localStorage.getItem(CART_KEY), 10) || 0); } catch (e) { return 0; }
  }
  var cartCount = readCart();
  function renderCart() {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) { el.textContent = cartCount; });
    document.querySelectorAll('[data-cart-label]').forEach(function (el) {
      el.setAttribute('aria-label', 'В корзине товаров: ' + cartCount);
    });
  }
  window.actimedCart = {
    add: function (n) {
      cartCount += n || 1;
      try { localStorage.setItem(CART_KEY, String(cartCount)); } catch (e) { /* без сохранения */ }
      renderCart();
      return cartCount;
    },
    count: function () { return cartCount; }
  };

  /* ---------- Активный пункт ---------- */
  var params = new URLSearchParams(location.search);
  var activeGroup = host.getAttribute('data-group') || params.get('group') || 'all';

  /* ---------- Разметка ---------- */
  var arrowLeft = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var phoneIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5h3l1.4 4.2-2 1.4a12 12 0 0 0 5.9 5.9l1.4-2 4.2 1.4v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" fill="currentColor"/></svg>';

  var left = withBack
    ? '<a class="round-btn" href="index.html" aria-label="Назад к ленте товаров">' + arrowLeft + '</a>'
    : '<a class="round-btn" href="' + D.phoneHref + '" aria-label="Позвонить: ' + D.phone + '">' + phoneIcon + '</a>';

  host.outerHTML =
    '<header class="site-header site-header--' + theme + '" data-header>' +
      '<div class="site-header__side">' + left +
        '<span class="round-btn round-btn--fill" role="status" data-cart-label><span data-cart-count>0</span></span>' +
      '</div>' +
      '<a class="brand" href="index.html" aria-label="Actimed — на главную">' +
        '<span class="brand__mark" aria-hidden="true"></span>' +
        '<span class="brand__name">Actimed</span>' +
      '</a>' +
      '<div class="site-header__side site-header__side--right">' +
        '<button class="menu-btn" type="button" data-menu-toggle aria-expanded="false" aria-controls="site-menu">' +
          '<span class="menu-btn__label" data-menu-label>Меню</span>' +
          '<span class="menu-btn__dot" aria-hidden="true"><span class="menu-btn__diamond"></span><span class="menu-btn__cross"></span></span>' +
        '</button>' +
      '</div>' +
    '</header>' +
    '<div class="site-menu" id="site-menu" role="dialog" aria-modal="true" aria-label="Меню" hidden data-menu>' +
      '<nav class="site-menu__nav" aria-label="Разделы">' +
        D.groups.map(function (g, i) {
          var href = g.id === 'all' ? 'index.html' : 'index.html?group=' + g.id;
          var on = g.id === activeGroup;
          return '<a class="site-menu__item site-menu__item--' + (i + 1) + (on ? ' is-active' : '') + '" href="' + href + '"' +
            (on ? ' aria-current="page"' : '') + ' style="--i:' + i + '"><span>' + g.name + '</span></a>';
        }).join('') +
      '</nav>' +
      '<div class="site-menu__foot">' +
        '<a href="' + D.phoneHref + '">' + D.phone + '</a>' +
        '<a href="' + D.telegram + '" target="_blank" rel="noopener">Telegram ↗</a>' +
        '<span>Корзина · <span data-cart-count>0</span></span>' +
      '</div>' +
    '</div>';

  renderCart();

  /* ---------- Открыть / закрыть ---------- */
  var header = document.querySelector('[data-header]');
  var menu = document.querySelector('[data-menu]');
  var toggle = document.querySelector('[data-menu-toggle]');
  var label = document.querySelector('[data-menu-label]');
  var isOpen = false;
  var closeTimer = 0;

  function lockScroll(lock) {
    document.documentElement.classList.toggle('is-locked', lock);
    var tune = window.actimedTune;
    if (tune) { if (lock) tune.lockPageScroll(); else tune.unlockPageScroll(); }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    clearTimeout(closeTimer);
    menu.hidden = false;
    void menu.offsetWidth;                      // чтобы сработал переход
    menu.classList.add('is-open');
    header.classList.add('is-menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    label.textContent = 'Закрыть';
    lockScroll(true);
    var first = menu.querySelector('a');
    if (first) first.focus({ preventScroll: true });
  }

  function close(returnFocus) {
    if (!isOpen) return;
    isOpen = false;
    menu.classList.remove('is-open');
    header.classList.remove('is-menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    label.textContent = 'Меню';
    lockScroll(false);
    closeTimer = setTimeout(function () { menu.hidden = true; }, reduceMotion ? 0 : 650);
    if (returnFocus) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', function () { if (isOpen) close(true); else open(); });

  document.addEventListener('keydown', function (e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (e.key === 'Tab') {
      // фокус не выходит за пределы меню и кнопки «Закрыть»
      var items = [toggle].concat(Array.prototype.slice.call(menu.querySelectorAll('a')));
      var i = items.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    }
  });

  // Пункт текущей страницы просто закрывает меню
  menu.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a || !a.classList.contains('is-active')) return;
    if (location.pathname.indexOf('product') === -1) { e.preventDefault(); close(true); }
  });

  window.actimedMenu = { open: open, close: close, isOpen: function () { return isOpen; } };
})();
