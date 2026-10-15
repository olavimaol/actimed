/*
  Главная: лента товаров по мотивам Jesper Landberg.

  • Карточки стоят вплотную и едут сквозь неподвижную «волну» глубины.
    Волна меняет только z, поэтому контур карточки изгибается за счёт
    перспективы, без перекоса. Гребень волны левее центра.
  • Лента бесконечная. Управление: колесо и тачпад, свайп, перетаскивание,
    стрелки на клавиатуре. После остановки ближайшая карточка мягко
    встаёт на гребень.
  • При быстром движении края ленты слегка приподнимаются и закручиваются,
    в покое всё ровно.
  • Клик по карточке открывает страницу товара.
  • Наведение мыши ничего не анимирует — меняется только курсор.
*/
import * as THREE from '../vendor/three.module.min.js';

const D = window.ACTIMED;
const section = document.querySelector('[data-ribbon]');
const canvas = document.querySelector('[data-ribbon-canvas]');
const links = document.querySelector('[data-ribbon-links]');
const counter = document.querySelector('[data-ribbon-counter]');
const groupLabel = document.querySelector('[data-ribbon-group]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Какие товары показывать ---------- */
const groupId = new URLSearchParams(location.search).get('group') || 'all';
const group = D.groups.find((g) => g.id === groupId) || D.groups[0];
const products = group.cats ? D.products.filter((p) => group.cats.includes(p.cat)) : D.products.slice();
if (groupLabel) groupLabel.textContent = group.label;

// Для бесконечной ленты нужно хотя бы 8 карточек — короткий список повторяем
const items = [];
while (items.length < 8 || items.length % products.length) items.push(products[items.length % products.length]);

const cardImage = (p) => `img/cards/${p.id}.webp`;
const productUrl = (p) => `product.html?id=${encodeURIComponent(p.id)}`;
const pad = (n) => String(n).padStart(2, '0');

function go(p) {
  location.href = productUrl(p);
}

// Обычные ссылки на товары: для клавиатуры и экранного диктора, а без WebGL — видимая лента
function fillLinks() {
  links.innerHTML = products.map((p) =>
    `<li><a href="${productUrl(p)}"><img src="${cardImage(p)}" alt="${p.name}, ${p.form}" loading="lazy" width="1600" height="900"></a></li>`
  ).join('');
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

/* ---------- Параметры сцены ---------- */
const CARD_W = 36;
const CARD_H = CARD_W * 9 / 16;
const GAP = 0.9;
const STEP = CARD_W + GAP;
const TOTAL = STEP * items.length;
const CENTER_Y = -0.6;
const FLOOR_Y = -14;

const shape = {
  amp: 6.5,                 // глубина волны
  k: Math.PI * 0.9 / 33,    // одна длинная дуга на экран
  x0: -6,                   // гребень чуть левее центра
  depth: -3.5,
  slope: -0.06,             // вся лента чуть уходит вглубь вправо
  bank: -0.05,              // лёгкий наклон вдоль оси ленты
  half: 34,
  rearY: 2.2,               // реакция на скорость
  rearZ: 2.0,
  twist: 0.12,
  lean: 0.025
};

const vertexShader = /* glsl */ `
  uniform float uVel;
  uniform float uAmp;
  uniform float uK;
  uniform float uX0;
  uniform float uDepth;
  uniform float uSlope;
  uniform float uBank;
  uniform float uHalf;
  uniform float uRearY;
  uniform float uRearZ;
  uniform float uTwist;
  uniform float uLean;
  varying vec2 vUv;
  varying float vFacing;
  varying float vDist;

  float surfaceZ(float x) { return uDepth + uAmp * cos(uK * (x - uX0)) + uSlope * x; }
  float surfaceDz(float x) { return -uAmp * uK * sin(uK * (x - uX0)) + uSlope; }

  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    float dy = position.y;
    float side = w.x - uX0;
    float edge = smoothstep(0.25, 1.0, abs(side) / uHalf);
    float speed = abs(uVel);

    float x = w.x + uLean * uVel * dy;
    float theta = uBank * sin(uK * side) + uTwist * uVel * edge * sign(side);

    w.x = x;
    w.y = (w.y - dy) + dy * cos(theta) + uRearY * speed * edge;
    w.z = surfaceZ(x) - dy * sin(theta) + uRearZ * speed * edge;

    vFacing = normalize(vec3(-surfaceDz(x), 0.0, 1.0)).z;
    vec4 mv = viewMatrix * w;
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform vec3 uColor;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec2 vUv;
  varying float vFacing;
  varying float vDist;

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    vec2 q = abs(p) - (uSize * 0.5 - uRadius);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
    float aa = max(fwidth(d), 1e-4);
    float alpha = 1.0 - smoothstep(-aa, aa, d);
    if (alpha <= 0.0) discard;

    vec4 tex = texture2D(uMap, vUv);
    vec3 col = mix(uColor, tex.rgb, uHasMap);
    col *= mix(0.66, 1.0, pow(clamp(vFacing, 0.0, 1.0), 3.0));   // повёрнутое от нас темнее
    float fog = smoothstep(uFogNear, uFogFar, vDist);
    // левая часть карточки в картинке полупрозрачная — сквозь неё видна сцена
    gl_FragColor = vec4(col, alpha * mix(1.0, tex.a, uHasMap) * (1.0 - fog));
  }
`;

const gridVertex = /* glsl */ `
  varying vec3 vWorld;
  varying float vDist;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vec4 mv = viewMatrix * w;
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const gridFragment = /* glsl */ `
  uniform float uShift;
  uniform float uCell;
  uniform vec3 uColor;
  uniform float uNear;
  uniform float uFar;
  uniform float uTime;
  uniform float uBoost;
  varying vec3 vWorld;
  varying float vDist;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 c = vec2(vWorld.x + uShift, vWorld.z) / uCell;
    vec2 w = max(fwidth(c), vec2(1e-4));
    vec2 id = floor(c + 0.5);            // ближайший угол клетки
    vec2 f = abs(c - id);                // 0 … 0.5

    // от клетки остаётся только «+» в углу
    float arm = 0.13;
    vec2 thick = w * 0.6;
    float bx = (1.0 - smoothstep(thick.y, thick.y + w.y, f.y)) * (1.0 - smoothstep(arm - w.x, arm, f.x));
    float by = (1.0 - smoothstep(thick.x, thick.x + w.x, f.x)) * (1.0 - smoothstep(arm - w.y, arm, f.y));
    float plus = max(bx, by);
    float halo = exp(-dot(f, f) / 0.018);

    // у каждого плюса свой ритм мерцания, по полу медленно идёт волна света
    vec2 key = vec2(mod(id.x, 256.0), id.y);
    float tw = 0.5 + 0.5 * sin(uTime * (0.45 + hash(key) * 1.3) + hash(key + 19.19) * 6.2832);
    float wave = pow(0.5 + 0.5 * sin(uTime * 0.8 - id.x * 0.2208932 - id.y * 0.31), 12.0);
    float glow = 0.15 + 0.85 * tw * tw + 1.2 * wave + uBoost;

    float fade = (1.0 - smoothstep(uNear + 20.0, uFar, vDist)) * smoothstep(uNear - 20.0, uNear - 10.0, vDist);
    fade *= 1.0 - smoothstep(0.12, 0.3, max(w.x, w.y));   // у горизонта плюсы мельче пикселя — гасим
    float a = (plus * (0.4 + 0.6 * min(glow, 1.0)) + halo * 0.32 * glow) * fade;
    gl_FragColor = vec4(uColor, min(a, 1.0));
  }
`;

function init() {
  fillLinks();
  if (!webglAvailable()) { section.classList.add('no-webgl'); return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    section.classList.add('no-webgl');
    return;
  }
  THREE.ColorManagement.enabled = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 1, 800);

  // Пол: светящиеся «+» в углах клеток
  const CELL = 6;
  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.ShaderMaterial({
      vertexShader: gridVertex,
      fragmentShader: gridFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      extensions: { derivatives: true },
      uniforms: {
        uShift: { value: 0 },
        uCell: { value: CELL },
        uColor: { value: new THREE.Color('#3DF2B4') },
        uNear: { value: 27 },
        uFar: { value: 260 },
        uTime: { value: 0 },
        uBoost: { value: 0 }
      }
    })
  );
  grid.rotation.x = -Math.PI / 2;
  grid.position.set(0, FLOOR_Y, -300);
  // пол рисуется после карточек и не просвечивает сквозь их полупрозрачную часть
  grid.renderOrder = 1;
  scene.add(grid);

  // Карточки
  const shared = {
    uVel: { value: 0 },
    uAmp: { value: shape.amp },
    uK: { value: shape.k },
    uX0: { value: shape.x0 },
    uDepth: { value: shape.depth },
    uSlope: { value: shape.slope },
    uBank: { value: shape.bank },
    uHalf: { value: shape.half },
    uRearY: { value: shape.rearY },
    uRearZ: { value: shape.rearZ },
    uTwist: { value: shape.twist },
    uLean: { value: shape.lean },
    uSize: { value: new THREE.Vector2(CARD_W, CARD_H) },
    uRadius: { value: 1.1 },
    uFogNear: { value: 40 },
    uFogFar: { value: 95 }
  };

  const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H, 96, 16);
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const textures = new Map();

  function textureFor(p, material) {
    if (!textures.has(p.id)) {
      textures.set(p.id, new Promise((resolve) => {
        loader.load(cardImage(p), (tex) => {
          tex.anisotropy = maxAniso;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          resolve(tex);
        });
      }));
    }
    textures.get(p.id).then((tex) => {
      material.uniforms.uMap.value = tex;
      material.uniforms.uHasMap.value = 1;
      requestRender();
    });
  }

  const cards = items.map((p, i) => {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: true,     // заслоняет пол (см. grid.renderOrder)
      extensions: { derivatives: true },
      uniforms: { ...shared, uMap: { value: null }, uHasMap: { value: 0 }, uColor: { value: new THREE.Color('#F2F6F5') } }
    });
    textureFor(p, material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = CENTER_Y;
    mesh.userData = { product: p, index: i };
    scene.add(mesh);
    return mesh;
  });

  /* ---------- Размер и камера ---------- */
  let fitHalf = 0;
  // Куда встаёт карточка при остановке: на компьютере на гребень встаёт
  // центр блока с описанием (левые 40% карточки), на телефоне — вся карточка.
  const TEXT_CENTER = CARD_W * 0.3;
  let focusShift = TEXT_CENTER;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 60 : 75;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const portrait = camera.aspect < 1;
    // на телефоне гребень по центру и карточка почти во всю ширину
    shape.x0 = portrait ? 0 : -6;
    focusShift = portrait ? 0 : TEXT_CENTER;
    shared.uX0.value = shape.x0;
    const needHalfW = CARD_W * (portrait ? 0.5 : 0.6);
    const z = Math.max(27, needHalfW / (tanHalf * camera.aspect));
    camera.position.set(0, 0, z);
    camera.lookAt(0, 1.4, 0);
    camera.updateProjectionMatrix();
    fitHalf = z * tanHalf * camera.aspect;
    shared.uHalf.value = Math.max(shape.half, fitHalf);
    shared.uFogNear.value = z + 13;
    shared.uFogFar.value = z + 68;
    // на телефоне камера дальше — пол начинаем ближе, чтобы плюсы доходили до низа экрана
    grid.material.uniforms.uNear.value = Math.min(z, 30);
    grid.material.uniforms.uFar.value = z + 233;
    requestRender();
  }
  new ResizeObserver(resize).observe(canvas);

  /* ---------- Управление ---------- */
  let target = 0;          // куда едем
  let offset = 0;          // где сейчас
  let prevOffset = 0;
  let vel = 0;
  let lastInput = 0;
  let pointer = null;
  const pxToWorld = () => (2 * fitHalf) / canvas.clientWidth * 1.1;
  const menuOpen = () => window.actimedMenu && window.actimedMenu.isOpen();

  function nudge(delta) {
    target += delta;
    lastInput = performance.now();
    requestRender();
  }

  // колесо и тачпад
  window.addEventListener('wheel', (e) => {
    if (menuOpen()) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
    nudge(d * STEP / 520);
  }, { passive: false });

  // клавиатура
  window.addEventListener('keydown', (e) => {
    if (menuOpen()) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') {
      if (e.key === ' ' || e.key === 'Enter') return;
    }
    const next = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key);
    const prev = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key);
    if (!next && !prev) return;
    e.preventDefault();
    target = (Math.round(target / STEP) + (next ? 1 : -1)) * STEP;
    lastInput = performance.now() - 1000;
    requestRender();
  });

  // перетаскивание мышью и пальцем
  canvas.addEventListener('pointerdown', (ev) => {
    pointer = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, startX: ev.clientX, startY: ev.clientY, moved: false, type: ev.pointerType };
    canvas.setPointerCapture(ev.pointerId);
    requestRender();
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (pointer && ev.pointerId === pointer.id) {
      const dx = ev.clientX - pointer.x;
      const dy = ev.clientY - pointer.y;
      pointer.x = ev.clientX;
      pointer.y = ev.clientY;
      if (Math.hypot(ev.clientX - pointer.startX, ev.clientY - pointer.startY) > 6) {
        pointer.moved = true;
        canvas.classList.add('is-dragging');
      }
      // палец можно вести и по вертикали — как прокрутку
      const d = pointer.type === 'touch' && Math.abs(dy) > Math.abs(dx) ? dy : dx;
      nudge(-d * pxToWorld());
    } else if (ev.pointerType === 'mouse') {
      canvas.classList.toggle('is-pointer', !!pickCard(ev.clientX, ev.clientY));
    }
  });
  function endPointer(ev) {
    if (!pointer || ev.pointerId !== pointer.id) return;
    const click = !pointer.moved;
    canvas.classList.remove('is-dragging');
    pointer = null;
    lastInput = performance.now();
    if (click && ev.type === 'pointerup') {
      const p = pickCard(ev.clientX, ev.clientY);
      if (p) go(p);
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  /* ---------- Попадание по изогнутой карточке ---------- */
  function wrap(x) {
    return ((((x + TOTAL / 2) % TOTAL) + TOTAL) % TOTAL) - TOTAL / 2;
  }
  const tmp = new THREE.Vector3();
  function deformed(x, dy, v) {
    const side = x - shape.x0;
    const t = Math.min(1, Math.max(0, (Math.abs(side) / shared.uHalf.value - 0.25) / 0.75));
    const edge = t * t * (3 - 2 * t);
    const xx = x + shape.lean * v * dy;
    const theta = shape.bank * Math.sin(shape.k * side) + shape.twist * v * edge * Math.sign(side);
    const z = shape.depth + shape.amp * Math.cos(shape.k * (xx - shape.x0)) + shape.slope * xx;
    return tmp.set(xx, CENTER_Y + dy * Math.cos(theta) + shape.rearY * Math.abs(v) * edge, z - dy * Math.sin(theta) + shape.rearZ * Math.abs(v) * edge);
  }
  function inTri(px, py, a, b, c) {
    const s1 = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    const s2 = (c.x - b.x) * (py - b.y) - (c.y - b.y) * (px - b.x);
    const s3 = (a.x - c.x) * (py - c.y) - (a.y - c.y) * (px - c.x);
    return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  }
  function pickCard(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * 2 - 1;
    const py = -((clientY - r.top) / r.height) * 2 + 1;
    const v = shared.uVel.value;
    const cols = 12, rows = 2;
    let best = null, bestDepth = Infinity;
    for (const mesh of cards) {
      const cx = mesh.position.x;
      if (Math.abs(cx) > fitHalf * 2.5) continue;
      const pts = [];
      for (let j = 0; j <= rows; j++) {
        const row = [];
        for (let i = 0; i <= cols; i++) {
          const p = deformed(cx + (i / cols - 0.5) * CARD_W, (j / rows - 0.5) * CARD_H, v).clone();
          const depth = p.distanceTo(camera.position);
          p.project(camera);
          row.push({ x: p.x, y: p.y, depth });
        }
        pts.push(row);
      }
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i + 1], d = pts[j + 1][i];
          if ((inTri(px, py, a, b, c) || inTri(px, py, a, c, d)) && a.depth < bestDepth) {
            bestDepth = a.depth;
            best = mesh.userData.product;
          }
        }
      }
    }
    return best;
  }

  function currentIndex() {
    const i = Math.round(offset / STEP) % items.length;
    return (i + items.length) % items.length;
  }

  /* ---------- Кадр ---------- */
  let rafId = 0, last = 0, lastCounter = -1, lastDraw = 0;
  const clockStart = performance.now();
  // сдвиг пола берём по модулю 256 клеток — узор плюсов и волна от этого не прыгают
  const FLOOR_PERIOD = CELL * 256;

  function frame() {
    rafId = 0;
    const now = performance.now();   // те же часы, что и у событий ввода
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;

    // после паузы ближайшая карточка встаёт на гребень
    const idle = now - lastInput > 260 && !pointer;
    if (idle) {
      const snap = Math.round(target / STEP) * STEP;
      target += (snap - target) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 5));
      if (Math.abs(snap - target) < 0.001) target = snap;
    }

    const follow = reduceMotion ? 1 : 1 - Math.exp(-dt * 7);
    offset += (target - offset) * follow;
    if (Math.abs(target - offset) < 0.001) offset = target;

    const rawVel = (offset - prevOffset) / dt;
    prevOffset = offset;
    const vTarget = reduceMotion ? 0 : Math.tanh(rawVel / 240);
    vel += (vTarget - vel) * (1 - Math.exp(-dt * 6));
    if (Math.abs(vel) < 0.0005 && vTarget === 0) vel = 0;

    const snapped = target === Math.round(target / STEP) * STEP;
    const moving = offset !== target || vel !== 0 || !snapped || !!pointer;

    // плюсы на полу светятся всё время; пока лента стоит, хватает ~30 кадров в секунду
    if (moving || now - lastDraw > 30) {
      lastDraw = now;
      shared.uVel.value = vel;
      for (const mesh of cards) {
        mesh.position.x = wrap(mesh.userData.index * STEP - offset) + shape.x0 + focusShift;
      }
      const floor = grid.material.uniforms;
      floor.uShift.value = ((offset % FLOOR_PERIOD) + FLOOR_PERIOD) % FLOOR_PERIOD;
      floor.uTime.value = reduceMotion ? 0 : (now - clockStart) / 1000;
      floor.uBoost.value = Math.min(1, Math.abs(vel) * 1.4);
      renderer.render(scene, camera);
    }

    const idx = currentIndex() % products.length;
    if (counter && idx !== lastCounter) {
      lastCounter = idx;
      counter.textContent = `${pad(idx + 1)} / ${pad(products.length)}`;
    }

    if (moving || !reduceMotion) rafId = requestAnimationFrame(frame);
    else last = 0;
  }

  function requestRender() {
    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  resize();
}

init();
