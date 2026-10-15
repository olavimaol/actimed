(function () {
  'use strict';

  var data = window.ACTIMED;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var catName = {};
  data.categories.forEach(function (c) { catName[c.id] = c.name; });

  /* ---------- Шапка: светлый фон после главного экрана ---------- */
  var header = document.querySelector('.header');
  var hero = document.querySelector('[data-hero]');

  /* ---------- Главный экран: упаковки и кольцо двигаются от прокрутки ---------- */
  var heroItems = Array.prototype.slice.call(document.querySelectorAll('.hero__item'));
  var ring = document.querySelector('[data-hero-ring]');

  function onScroll() {
    var y = window.scrollY;
    var heroH = hero.offsetHeight;
    header.classList.toggle('is-solid', y > heroH - 80);

    if (reduceMotion || y > heroH * 1.2) return;
    heroItems.forEach(function (el) {
      var speed = parseFloat(el.style.getPropertyValue('--speed')) || .5;
      el.style.setProperty('--ty', (-y * speed) + 'px');
      el.style.setProperty('--rot', (y * speed * .05) + 'deg');
    });
    if (ring) ring.style.transform = 'rotate(' + (y * .06) + 'deg)';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Каталог ---------- */
  var list = document.querySelector('[data-products]');
  var chipsBox = document.querySelector('[data-chips]');
  var emptyMsg = document.querySelector('[data-catalog-empty]');
  var searchForm = document.querySelector('[data-search]');
  var searchInput = searchForm.querySelector('input');
  var cartCount = document.querySelector('[data-cart-count]');

  var state = { cat: 'all', query: '', cart: 0 };

  function formatPrice(n) {
    return n.toLocaleString('ru-RU').replace(/,/g, ' ') + ' сум';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function packHtml(p) {
    var short = escapeHtml(p.name.split(' ').slice(0, 2).join(' '));
    if (p.type === 'bottle') {
      return '<div class="pack pack--bottle" style="--c:' + p.color + '">' +
        '<span class="pack__cap"></span><span class="pack__label">' +
        '<span class="pack__brand">Actimed</span><span class="pack__name">' + short + '</span>' +
        '</span></div>';
    }
    return '<div class="pack pack--box" style="--c:' + p.color + '">' +
      '<span class="pack__band"></span><span class="pack__brand">Actimed</span>' +
      '<span class="pack__name">' + short + '</span><span class="pack__cross"></span></div>';
  }

  function renderChips() {
    chipsBox.innerHTML = data.categories.map(function (c) {
      var active = c.id === state.cat;
      return '<button type="button" class="chip' + (active ? ' is-active' : '') + '" data-cat="' + c.id +
        '" aria-pressed="' + active + '">' + escapeHtml(c.name) + '</button>';
    }).join('');
  }

  function renderProducts() {
    var q = state.query.trim().toLowerCase();
    var items = data.products.filter(function (p) {
      var okCat = state.cat === 'all' || p.cat === state.cat;
      var okQ = !q || p.name.toLowerCase().indexOf(q) !== -1 || p.form.toLowerCase().indexOf(q) !== -1;
      return okCat && okQ;
    });
    emptyMsg.hidden = items.length > 0;
    list.innerHTML = items.map(function (p) {
      var idx = data.products.indexOf(p);
      return '<li class="product">' +
        '<div class="product__media">' + packHtml(p) +
          (p.rx ? '<span class="product__rx">По рецепту</span>' : '') +
        '</div>' +
        '<div class="product__body">' +
          '<div class="product__info">' +
            '<span class="product__cat">' + escapeHtml(catName[p.cat] || '') + '</span>' +
            '<h3 class="product__name">' + escapeHtml(p.name) + '</h3>' +
            '<span class="product__form">' + escapeHtml(p.form) + '</span>' +
          '</div>' +
          '<div class="product__foot">' +
            '<span class="product__price">' + formatPrice(p.price) + '</span>' +
            '<button type="button" class="btn btn--primary product__btn" data-add="' + idx + '">В корзину</button>' +
          '</div>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  function setCategory(id) {
    state.cat = id;
    renderChips();
    renderProducts();
  }

  chipsBox.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-cat]');
    if (btn) setCategory(btn.getAttribute('data-cat'));
  });

  list.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add]');
    if (!btn) return;
    state.cart += 1;
    cartCount.textContent = state.cart;
    btn.classList.add('is-added');
    btn.textContent = 'В корзине ✓';
  });

  searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    state.query = searchInput.value;
    state.cat = 'all';
    renderChips();
    renderProducts();
    document.getElementById('catalog').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  // Переключатель «Плитка / Список»
  document.querySelectorAll('[data-view]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var view = btn.getAttribute('data-view');
      list.classList.toggle('products--grid', view === 'grid');
      list.classList.toggle('products--list', view === 'list');
      document.querySelectorAll('[data-view]').forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on);
      });
    });
  });

  // Ссылки на категории из других блоков (карточки «О нас», лента)
  window.actimedOpenCategory = function (id) {
    state.query = '';
    searchInput.value = '';
    setCategory(id);
    document.getElementById('catalog').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  document.querySelectorAll('[data-filter-link]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      window.actimedOpenCategory(a.getAttribute('data-filter-link'));
    });
  });

  var yearEl = document.querySelector('[data-year-short]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear()).slice(-2);

  renderChips();
  renderProducts();
})();
