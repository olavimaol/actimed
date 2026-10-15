/*
  Страница товара в духе Agrumea: product.html?id=<id товара>.

  • Огромное название, по бокам — категория и форма выпуска.
  • Под названием — упаковка, она стоит неподвижно.
  • Описание с ромбами-разделителями, три колонки (как принимать, фасовка,
    срок годности), цена и «В корзину».
  • Лента картинок едет вбок при прокрутке, ниже — «Другие товары».
  Всё движение — от прокрутки; наведение ничего не анимирует.
*/
(function () {
  'use strict';

  var D = window.ACTIMED;
  var main = document.querySelector('[data-product]');
  var header = document.querySelector('[data-site-header]');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var yearEl = document.querySelector('[data-year-short]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear()).slice(-2);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // **жирный** → <strong>
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }
  function price(n) { return n.toLocaleString('ru-RU').replace(/ |,/g, ' ') + ' сум'; }
  function noDot(s) { return String(s).replace(/\.$/, ''); }
  var img = function (p) { return 'img/products/' + p.id + '.webp'; };
  var url = function (p) { return 'product.html?id=' + encodeURIComponent(p.id); };

  var id = new URLSearchParams(location.search).get('id');
  var p = D.products.filter(function (x) { return x.id === id; })[0];

  if (!p) {
    document.title = 'Товар не найден — Actimed';
    main.innerHTML =
      '<section class="pd-hero pd-hero--empty">' +
        '<h1 class="pd-hero__title"><span>Товар</span><span>не найден</span></h1>' +
        '<p class="pd-empty"><a class="pd-buy__btn" href="index.html">Вернуться к ленте товаров</a></p>' +
      '</section>';
    return;
  }

  var cat = D.categories[p.cat];
  var group = D.groups.filter(function (g) { return g.cats && g.cats.indexOf(p.cat) !== -1; })[0];
  if (header && group) header.setAttribute('data-group', group.id);
  document.title = p.name + ' — Actimed';
  var meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', p.name + '. ' + p.lead);
  main.style.setProperty('--c', p.color);

  // Другие товары: сначала из той же группы, потом остальные
  var same = D.products.filter(function (x) { return x !== p && group && group.cats.indexOf(x.cat) !== -1; });
  var rest = D.products.filter(function (x) { return x !== p && same.indexOf(x) === -1; });
  var others = same.concat(rest).slice(0, 8);

  var info = p.info.map(function (col) {
    var body = col.chips
      ? '<ul class="pd-chips">' + col.chips.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>'
      : '<p>' + esc(col.text) + '</p>';
    return '<div class="pd-info__col"><h2 class="pd-info__label">' + esc(col.label) + '</h2>' + body + '</div>';
  }).join('');

  main.innerHTML =
    '<section class="pd-hero" data-pd-hero>' +
      '<h1 class="pd-hero__title" data-pd-title><span>' + esc(p.title) + '</span><span>' + esc(noDot(p.accent)) + '</span></h1>' +
      '<p class="pd-hero__side pd-hero__side--l">' + esc(cat.name) + '</p>' +
      '<p class="pd-hero__side pd-hero__side--r">' + esc(p.form) + '</p>' +
      '<img class="pd-hero__product pd-hero__product--' + p.type + '" data-pd-product src="' + img(p) + '" alt="' + esc(p.name) + '">' +
    '</section>' +

    '<section class="pd-about">' +
      '<span class="pd-diamond" aria-hidden="true"></span>' +
      '<p class="pd-about__lead">' + esc(p.lead) + '</p>' +
      p.details.map(function (d) { return '<p class="pd-about__text">' + rich(d) + '</p>'; }).join('') +
      '<span class="pd-diamond" aria-hidden="true"></span>' +
    '</section>' +

    '<section class="pd-info" aria-label="Подробности">' + info + '</section>' +

    '<section class="pd-buy" aria-label="Купить">' +
      (p.rx ? '<p class="pd-buy__rx">Отпускается по рецепту врача</p>' : '') +
      '<p class="pd-buy__price">' + price(p.price) + '</p>' +
      '<button type="button" class="pd-buy__btn" data-add>В корзину</button>' +
      '<p class="pd-buy__note" data-add-note aria-live="polite">Перед применением прочитайте инструкцию.</p>' +
    '</section>' +

    '<section class="pd-gallery" data-pd-gallery aria-label="Как выглядит товар">' +
      '<div class="pd-gallery__track" data-pd-track>' +
        '<figure class="pd-tile pd-tile--zoom"><img src="' + img(p) + '" alt="" loading="lazy"></figure>' +
        '<figure class="pd-tile pd-tile--wide"><img src="' + img(p) + '" alt="" loading="lazy">' +
          '<figcaption><em>' + esc(p.short[0]) + '</em><br><em>' + esc(p.short[1]) + '</em></figcaption></figure>' +
        '<figure class="pd-tile pd-tile--color"><img src="' + img(p) + '" alt="" loading="lazy"></figure>' +
        '<figure class="pd-tile pd-tile--wide pd-tile--dots"><img src="' + img(p) + '" alt="" loading="lazy">' +
          '<figcaption><span class="pd-tile__label">' + esc(cat.name) + '</span>' + esc(p.form) + '</figcaption></figure>' +
        '<figure class="pd-tile pd-tile--zoom pd-tile--zoom2"><img src="' + img(p) + '" alt="" loading="lazy"></figure>' +
      '</div>' +
    '</section>' +

    '<section class="pd-others">' +
      '<h2 class="pd-others__title"><span>Другие</span><span>товары</span></h2>' +
      '<ul class="pd-others__list">' +
        others.map(function (o) {
          return '<li><a class="pd-card" href="' + url(o) + '" style="--c:' + o.color + '">' +
            '<span class="pd-card__img"><img src="' + img(o) + '" alt="" loading="lazy"></span>' +
            '<span class="pd-card__name">' + esc(o.name) + '</span>' +
            '<span class="pd-card__price">' + price(o.price) + '</span></a></li>';
        }).join('') +
      '</ul>' +
    '</section>';

  /* ---------- В корзину ---------- */
  var addBtn = main.querySelector('[data-add]');
  var addNote = main.querySelector('[data-add-note]');
  addBtn.addEventListener('click', function () {
    var n = window.actimedCart ? window.actimedCart.add(1) : 1;
    addBtn.textContent = 'Добавлено ✓';
    addBtn.classList.add('is-added');
    addNote.textContent = 'В корзине товаров: ' + n + '. Оформить заказ поможет фармацевт: ' + D.phone + '.';
  });

  /* ---------- Название подгоняем по ширине экрана ---------- */
  var title = main.querySelector('[data-pd-title]');
  function fitTitle() {
    title.style.fontSize = '';
    var max = title.clientWidth;
    var widest = 0;
    title.querySelectorAll('span').forEach(function (s) { widest = Math.max(widest, s.scrollWidth); });
    if (widest > max) {
      var size = parseFloat(getComputedStyle(title).fontSize);
      title.style.fontSize = Math.floor(size * max / widest) + 'px';
    }
  }
  fitTitle();
  if (document.fonts) document.fonts.ready.then(fitTitle);
  window.addEventListener('resize', fitTitle);

  /* ---------- Движение от прокрутки ---------- */
  var gallery = main.querySelector('[data-pd-gallery]');
  var track = main.querySelector('[data-pd-track]');
  var raf = 0;

  var footer = document.querySelector('[data-footer]');
  function updateHeader(vh) {
    var hdr = document.querySelector('[data-header]');
    if (!hdr) return;
    var footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
    // над тёмным футером шапка белая, над светлой страницей — с мягкой подложкой
    var mountain = footer && footer.classList.contains('is-mountain') && window.matchMedia('(min-width: 1024px)').matches;
    var onDark = footerTop < 90 && (mountain ? footerTop < -vh * 0.2 : true);
    hdr.classList.toggle('is-on-dark', onDark);
    hdr.classList.toggle('is-scrolled', !onDark && window.scrollY > 40);
  }

  function update() {
    raf = 0;
    var vh = window.innerHeight, vw = window.innerWidth;
    updateHeader(vh);

    // лента картинок едет вбок
    var r = gallery.getBoundingClientRect();
    if (r.bottom > -100 && r.top < vh + 100) {
      var q = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      var shift = Math.max(0, track.scrollWidth - vw * 0.8);
      track.style.transform = 'translate3d(' + (vw * 0.08 - q * shift) + 'px,0,0)';
    }
  }
  function request() { if (!raf) raf = requestAnimationFrame(update); }

  if (reduceMotion) {
    track.style.transform = 'none';
    gallery.classList.add('is-static');
    window.addEventListener('scroll', function () { updateHeader(window.innerHeight); }, { passive: true });
  } else {
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  }
})();
