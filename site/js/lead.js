/*
  «Оставить заявку» — кнопка в шапке, в меню и на странице товара.

  Форма — карточка в духе ленты на главной: слева описание, справа поля,
  между ними тонкая белая линия. Появляется так же, как едут карточки
  ленты: влетает справа по той же волне глубины, на скорости края
  приподнимаются и закручиваются, у места карточка тормозит и
  выпрямляется. Закрывается — уезжает влево.

  Как это сделано: пока карточка в движении, вместо неё видны её копии,
  нарезанные на вертикальные полосы. Каждую полосу CSS 3D ставит на её
  точку волны — формулы и числа те же, что в js/ribbon.js. Когда карточка
  встала, полосы убираются и на месте остаётся обычная форма.

  Отправка: ACTIMED.leadEndpoint в js/data.js — адрес, куда уходит заявка
  (POST, JSON). Пока он пустой, форма только показывает «Заявка принята».
*/
(function () {
  'use strict';

  var D = window.ACTIMED;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ---------- Разметка ---------- */
  var arrow = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12 28 28 12M15 12h13v13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function field(name, label, control) {
    return '<div class="lead__field">' +
      '<label class="lead__label" for="lead-' + name + '">' + label + '</label>' + control +
      '<span class="lead__hint" id="lead-' + name + '-hint"></span>' +
    '</div>';
  }

  var root = document.createElement('div');
  root.className = 'lead';
  root.hidden = true;
  root.tabIndex = -1;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'lead-title');
  root.innerHTML =
    '<div class="lead__backdrop" data-lead-backdrop></div>' +
    '<div class="lead__stage" aria-hidden="true" inert></div>' +
    '<div class="lead__wrap">' +
      '<section class="lead__card lead__card--live">' +
        '<button class="lead__close" type="button" data-lead-close aria-label="Закрыть"></button>' +
        '<div class="lead__info">' +
          '<p class="lead__caps"><span class="lead__ring" aria-hidden="true"></span>Заявка</p>' +
          '<h2 class="lead__title" id="lead-title"><span>Оставьте</span> <em>заявку</em></h2>' +
          '<p class="lead__text">Фармацевт перезвонит в течение 15 минут, поможет подобрать препарат и оформит доставку по Ташкенту.</p>' +
          '<p class="lead__contact"><span>Или позвоните</span><a href="' + D.phoneHref + '">' + D.phone + '</a></p>' +
        '</div>' +
        '<div class="lead__side">' +
          '<form class="lead__form" novalidate>' +
            field('name', 'Как к вам обращаться',
              '<input id="lead-name" name="name" type="text" autocomplete="name" maxlength="60" required placeholder="Имя" aria-describedby="lead-name-hint">') +
            field('phone', 'Телефон',
              '<input id="lead-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" required placeholder="+998 __ ___-__-__" aria-describedby="lead-phone-hint">') +
            field('message', 'Что нужно',
              '<textarea id="lead-message" name="message" rows="3" maxlength="600" placeholder="Название препарата или вопрос фармацевту"></textarea>') +
            '<div class="lead__row">' +
              '<button class="lead__submit" type="submit"><span data-lead-label>Отправить заявку</span><span class="lead__go">' + arrow + '</span></button>' +
              '<p class="lead__note">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>' +
            '</div>' +
            '<p class="lead__fail" role="alert" data-lead-fail></p>' +
          '</form>' +
          '<div class="lead__done" tabindex="-1" hidden>' +
            '<span class="lead__check" aria-hidden="true"></span>' +
            '<p class="lead__done-title">Заявка принята</p>' +
            '<p class="lead__done-text" data-lead-done-text></p>' +
            '<button class="lead__submit lead__submit--plain" type="button" data-lead-close><span>Хорошо</span></button>' +
          '</div>' +
        '</div>' +
      '</section>' +
    '</div>';
  document.body.appendChild(root);

  var card = root.querySelector('.lead__card--live');
  var stage = root.querySelector('.lead__stage');
  var form = root.querySelector('.lead__form');
  var done = root.querySelector('.lead__done');
  var doneText = root.querySelector('[data-lead-done-text]');
  var fail = root.querySelector('[data-lead-fail]');
  var submit = form.querySelector('.lead__submit');
  var submitLabel = root.querySelector('[data-lead-label]');
  var nameInput = form.elements.name;
  var phoneInput = form.elements.phone;
  var messageInput = form.elements.message;

  /* ---------- Телефон: +998 XX XXX-XX-XX ---------- */
  function phoneDigits(value) {
    var d = value.replace(/\D/g, '');
    if (d.length <= 3 && '998'.indexOf(d) === 0) return '';     // пока только код страны
    if (d.indexOf('998') === 0) d = d.slice(3);
    return d.slice(0, 9);
  }
  function formatPhone(d) {
    var out = '+998';
    if (d.length) out += ' ' + d.slice(0, 2);
    if (d.length > 2) out += ' ' + d.slice(2, 5);
    if (d.length > 5) out += '-' + d.slice(5, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    return out;
  }
  phoneInput.addEventListener('focus', function () {
    if (!phoneInput.value) phoneInput.value = '+998 ';
  });
  phoneInput.addEventListener('blur', function () {
    var d = phoneDigits(phoneInput.value);
    phoneInput.value = d ? formatPhone(d) : '';
  });
  phoneInput.addEventListener('input', function () {
    // форматируем, только когда курсор в конце — правка в середине номера не прыгает
    if (phoneInput.selectionStart === phoneInput.value.length) {
      var d = phoneDigits(phoneInput.value);
      if (d) phoneInput.value = formatPhone(d);
    }
    if (phoneDigits(phoneInput.value).length === 9) setHint(phoneInput, '');
  });
  nameInput.addEventListener('input', function () {
    if (nameInput.value.trim().length >= 2) setHint(nameInput, '');
  });

  function setHint(input, text) {
    root.querySelector('#' + input.id + '-hint').textContent = text;
    if (text) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  /* ---------- Отправка ---------- */
  function send(data) {
    if (!D.leadEndpoint) return new Promise(function (resolve) { setTimeout(resolve, 450); });
    return fetch(D.leadEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = nameInput.value.trim();
    var digits = phoneDigits(phoneInput.value);
    setHint(nameInput, name.length < 2 ? 'Напишите, как к вам обращаться.' : '');
    setHint(phoneInput, digits.length !== 9 ? 'Нужен номер: 9 цифр после +998.' : '');
    if (name.length < 2) { nameInput.focus(); return; }
    if (digits.length !== 9) { phoneInput.focus(); return; }

    submit.disabled = true;
    submitLabel.textContent = 'Отправляем…';
    fail.textContent = '';
    send({
      name: name,
      phone: '+998' + digits,
      message: messageInput.value.trim(),
      product: product ? product.id : '',
      productName: product ? product.name : '',
      page: location.href,
      sentAt: new Date().toISOString()
    }).then(function () {
      doneText.textContent = name + ', фармацевт перезвонит на ' + formatPhone(digits) + ' в течение 15 минут.';
      form.hidden = true;
      done.hidden = false;
      done.focus({ preventScroll: true });
    }, function () {
      fail.textContent = 'Не получилось отправить заявку. Позвоните нам: ' + D.phone + '.';
    }).then(function () {
      submit.disabled = false;
      submitLabel.textContent = 'Отправить заявку';
    });
  });

  function resetForm() {
    form.reset();
    form.hidden = false;
    done.hidden = true;
    fail.textContent = '';
    setHint(nameInput, '');
    setHint(phoneInput, '');
    product = null;
    prefilled = '';
  }

  /* ---------- Товар, с которого открыли форму ---------- */
  var product = null;
  var prefilled = '';
  function setProduct(p) {
    product = p || product;
    if (!p) return;
    var text = p.name + ' — ' + p.form.charAt(0).toLowerCase() + p.form.slice(1);
    // своё сообщение посетителя не трогаем
    if (!messageInput.value.trim() || messageInput.value === prefilled) {
      messageInput.value = text;
      prefilled = text;
    }
  }

  /* ---------- Открыть / закрыть ---------- */
  var state = 'closed';            // closed | opening | open | closing
  var returnFocus = null;

  function open(opts) {
    opts = opts || {};
    if (state === 'opening' || state === 'open') return;
    if (state === 'closed') {
      returnFocus = opts.from || document.activeElement;
      if (!done.hidden) resetForm();
    }
    setProduct(opts.product);
    state = 'opening';
    root.hidden = false;
    document.documentElement.classList.add('is-locked');
    void root.offsetWidth;                       // чтобы фон плавно проявился
    root.classList.add('is-open');
    root.focus({ preventScroll: true });
    if (reduceMotion) settle();
    else move(+1);
  }

  function close() {
    if (state === 'closed' || state === 'closing') return;
    state = 'closing';
    root.classList.remove('is-open');
    if (reduceMotion) hide();
    else move(-1);
  }

  function settle() {
    state = 'open';
    var target = !done.hidden ? done : (finePointer ? nameInput : root);
    target.focus({ preventScroll: true });
  }

  function hide() {
    state = 'closed';
    root.hidden = true;
    document.documentElement.classList.remove('is-locked');
    var back = returnFocus;
    if (!back || !document.contains(back) || !back.offsetParent) back = document.querySelector('.site-header [data-lead-open]');
    if (back) back.focus({ preventScroll: true });
  }

  /* ---------- Движение по волне, как в ленте ---------- */
  // Числа из js/ribbon.js; там ширина карточки — 36 единиц.
  // Из движений ленты взяты изгиб в глубину, подъём краёв и наклон на
  // скорости; закрутки (twist) нет — с ней полосы перестают быть плоскими
  // и текст на стыках полос расходится.
  var CARD = 36;
  var AMP = 6.5, K = Math.PI * 0.9 / 33;
  var REAR_Y = 2.2, REAR_Z = 2.0, LEAN = 0.025;

  var motion = null;
  var raf = 0;

  function smooth(t) {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
  }

  // Точки волны на границах полос; x — в единицах, 0 — место карточки
  function wavePoints(m, x0, vel, pts) {
    var speed = Math.abs(vel);
    var amp = AMP * smooth(Math.abs(x0) / 26);      // у места волна гаснет — карточка ровная
    for (var j = 0; j <= m.n; j++) {
      var x = x0 + (j / m.n - 0.5) * CARD;
      var phase = Math.max(-Math.PI, Math.min(Math.PI, K * x));
      var edge = smooth((Math.abs(x) / m.half - 0.25) / 0.75);
      var p = pts[j] || (pts[j] = {});
      p.x = x;
      p.z = amp * (Math.cos(phase) - 1) + REAR_Z * speed * edge;
      p.y = REAR_Y * speed * edge;
    }
    return pts;
  }

  // Где карточка целиком за краем экрана: side = 1 справа, -1 слева
  function offscreen(m, side) {
    var pts = [];
    for (var x0 = CARD / 2; x0 < 400; x0 += 1) {
      wavePoints(m, side * x0, 0.95, pts);
      var p = side > 0 ? pts[0] : pts[m.n];
      var sx = m.cx + p.x * m.s * m.P / (m.P - p.z * m.s);
      if (side > 0 ? sx > m.vw + 24 : sx < -24) return x0;
    }
    return 400;
  }

  function build() {
    var r = card.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    var W = r.width, H = r.height;
    var n = Math.max(10, Math.min(36, Math.round(W / 32)));
    var s = W / CARD;                                   // пикселей в единице
    // камера — как у ленты на этом же экране
    var aspect = vw / vh;
    var portrait = aspect < 1;
    var tanHalf = Math.tan((portrait ? 60 : 75) * Math.PI / 360);
    var camZ = Math.max(27, CARD * (portrait ? 0.5 : 0.6) / (tanHalf * aspect));
    var m = {
      n: n, s: s, vw: vw, w: W / n, H: H,
      cx: r.left + W / 2, cy: r.top + H / 2,           // место карточки — центр «камеры»
      P: (camZ - 3) * s,                                // расстояние до камеры; 3 — гребень волны
      half: Math.max(34, camZ * tanHalf * aspect),
      strips: [], pts: [], yaw: [], top: [], bottom: []
    };

    var proto = card.cloneNode(true);
    proto.className = 'lead__card lead__card--copy';
    proto.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
    proto.querySelectorAll('[name]').forEach(function (el) { el.removeAttribute('name'); });
    var fields = card.querySelectorAll('input, textarea');
    var w = W / n;
    var radius = getComputedStyle(card).borderTopLeftRadius;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var strip = document.createElement('div');
      strip.className = 'lead__strip';
      // +3 px внахлёст — между полосами не видно щелей
      strip.style.cssText = 'width:' + (w + (i < n - 1 ? 3 : 0)) + 'px;height:' + H + 'px';
      var copy = proto.cloneNode(true);
      copy.style.cssText = 'left:' + (-i * w) + 'px;width:' + W + 'px;height:' + H + 'px';
      var copies = copy.querySelectorAll('input, textarea');
      for (var k = 0; k < copies.length; k++) copies[k].value = fields[k].value;
      var shade = document.createElement('span');
      shade.className = 'lead__shade';
      if (i === 0) shade.style.borderRadius = radius + ' 0 0 ' + radius;
      if (i === n - 1) shade.style.borderRadius = '0 ' + radius + ' ' + radius + ' 0';
      strip.appendChild(copy);
      strip.appendChild(shade);
      frag.appendChild(strip);
      m.strips.push({ el: strip, shade: shade });
    }
    stage.appendChild(frag);
    m.enter = offscreen(m, 1);
    m.exit = offscreen(m, -1);
    return m;
  }

  // Перспектива: точка (x, y, z) в пикселях от места карточки → экран
  function project(m, x, y, z, out) {
    var k = m.P / (m.P - z);
    out.x = m.cx + x * k;
    out.y = m.cy + y * k;
    return out;
  }

  // Полоса w×H натягивается на четырёхугольник a-b-c-d (по часовой, от левого
  // верхнего угла) проективным matrix3d. Каждая полоса — плоский прямоугольник
  // в пространстве, соседние делят общий край, поэтому сходятся точно —
  // без щелей и ступенек.
  function quad(w, h, a, b, c, d) {
    var dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x;
    var dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y;
    var den = dx1 * dy2 - dx2 * dy1;
    if (!den) return '';
    var g = (dx3 * dy2 - dx2 * dy3) / den;
    var hh = (dx1 * dy3 - dx3 * dy1) / den;
    return 'matrix3d(' +
      (b.x - a.x + g * b.x) / w + ',' + (b.y - a.y + g * b.y) / w + ',0,' + g / w + ',' +
      (d.x - a.x + hh * d.x) / h + ',' + (d.y - a.y + hh * d.y) / h + ',0,' + hh / h + ',' +
      '0,0,1,0,' + a.x + ',' + a.y + ',0,1)';
  }

  function place(m) {
    var pts = wavePoints(m, m.x, m.vel, m.pts);
    var s = m.s, half = m.H / 2;
    var lean = LEAN * m.vel;
    // углы на границах полос: глубина волны, подъём краёв и лёгкий наклон
    // верха вперёд (lean) — как в шейдере ленты; затем перспектива
    for (var j = 0; j <= m.n; j++) {
      var p = pts[j];
      var x = p.x * s, lift = p.y * s, z = p.z * s;
      m.top[j] = project(m, x + lean * half, -(half + lift), z, m.top[j] || {});
      m.bottom[j] = project(m, x - lean * half, half - lift, z, m.bottom[j] || {});
    }
    var yaw = m.yaw;
    for (var i = 0; i < m.n; i++) yaw[i] = -Math.atan2(pts[i + 1].z - pts[i].z, pts[i + 1].x - pts[i].x);
    for (i = 0; i < m.n; i++) {
      var strip = m.strips[i];
      strip.el.style.transform = quad(m.w, m.H, m.top[i], m.top[i + 1], m.bottom[i + 1], m.bottom[i]);
      // повёрнутое от нас темнее — как в шейдере ленты; тень считаем на
      // границах полос, внутри полосы она плавно переходит — без «жалюзи»
      var left = shadeAt(i > 0 ? (yaw[i - 1] + yaw[i]) / 2 : yaw[i]);
      var right = shadeAt(i < m.n - 1 ? (yaw[i] + yaw[i + 1]) / 2 : yaw[i]);
      strip.shade.style.background = 'linear-gradient(90deg,rgba(2,19,22,' + left + ') 0,rgba(2,19,22,' + right + ') ' + m.w.toFixed(1) + 'px)';
    }
  }

  function shadeAt(yaw) {
    var f = Math.cos(yaw);
    return (0.34 * (1 - f * f * f)).toFixed(3);
  }

  // dir = 1: из-за правого края на место; dir = -1: с места за левый край
  function move(dir) {
    if (!motion) {
      motion = build();
      motion.x = dir > 0 ? motion.enter : 0;
      motion.prev = motion.x;
      // влетает уже на скорости — сразу с приподнятыми краями
      motion.vel = dir > 0 ? Math.tanh(7 * motion.enter / 240) : 0;
      place(motion);
    }
    motion.target = dir > 0 ? 0 : -(motion.exit + 10);
    motion.rate = dir > 0 ? 7 : 6;
    motion.last = 0;
    root.classList.add('is-moving');
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    raf = 0;
    var m = motion;
    var dt = m.last ? Math.min(0.05, (now - m.last) / 1000) : 1 / 60;
    m.last = now;
    m.x += (m.target - m.x) * (1 - Math.exp(-dt * m.rate));
    var raw = -(m.x - m.prev) / dt;                     // как в ленте: плюс — движение влево
    m.prev = m.x;
    m.vel += (Math.tanh(raw / 240) - m.vel) * (1 - Math.exp(-dt * 6));

    var arrived = state === 'closing'
      ? m.x <= -m.exit
      : Math.abs(m.x) < 0.03 && Math.abs(m.vel) < 0.01;
    if (arrived) {
      motion = null;
      stage.textContent = '';
      root.classList.remove('is-moving');
      if (state === 'closing') hide(); else settle();
      return;
    }
    place(m);
    raf = requestAnimationFrame(tick);
  }

  /* ---------- События ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-lead-open]');
    if (!btn) return;
    e.preventDefault();
    if (window.actimedMenu && window.actimedMenu.isOpen()) window.actimedMenu.close(false);
    var id = btn.getAttribute('data-lead-product');
    open({ from: btn, product: id ? D.products.find(function (p) { return p.id === id; }) : null });
  });

  root.addEventListener('click', function (e) {
    if (e.target.closest('[data-lead-close]')) close();
    else if (e.target.hasAttribute('data-lead-backdrop') && state === 'open') close();
  });

  // Пока форма открыта, колесо, свайпы и клавиши не доходят до ленты и StringTune
  ['wheel', 'touchmove'].forEach(function (type) {
    root.addEventListener(type, function (e) { e.stopPropagation(); }, { passive: true });
  });
  root.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    // фокус не выходит из формы
    var items = Array.prototype.filter.call(
      card.querySelectorAll('a[href], button:not([disabled]), input, textarea, [tabindex="0"]'),
      function (el) { return el.offsetParent !== null && !root.classList.contains('is-moving'); }
    );
    if (!items.length) { e.preventDefault(); return; }
    var i = items.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && (i === -1 || i === items.length - 1)) { e.preventDefault(); items[0].focus(); }
  });

  window.actimedLead = {
    open: open,
    close: close,
    isOpen: function () { return state !== 'closed'; }
  };
})();
