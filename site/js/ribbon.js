/*
  Лента категорий по мотивам Jesper Landberg.

  Как устроено:
  • Карточки стоят вплотную и едут сквозь неподвижную «волну» глубины.
    Волна меняет только z, поэтому контур карточки изгибается за счёт
    перспективы (ближняя часть крупнее, дальняя мельче), а не перекоса.
  • Гребень волны сдвинут левее центра: ближняя карточка стоит на склоне.
  • Лента слегка повёрнута вдоль своей оси; при быстрой прокрутке её края
    приподнимаются и закручиваются в разные стороны, в покое всё ровно.
  • Движение берётся из прокрутки страницы (секция закреплена) и перетаскивания.
  • Наведение мыши ничего не анимирует — меняется только курсор.
*/
import * as THREE from '../vendor/three.module.min.js';

const section = document.querySelector('[data-ribbon]');
const canvas = document.querySelector('[data-ribbon-canvas]');
const fallback = document.querySelector('[data-ribbon-fallback]');
const counter = document.querySelector('[data-ribbon-counter]');
const categories = window.ACTIMED.categories.filter((c) => c.id !== 'all');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const imageOf = (cat) => `img/categories/${cat.id}.jpg`;
const pad = (n) => String(n).padStart(2, '0');

function openCategory(id) {
  if (window.actimedOpenCategory) window.actimedOpenCategory(id);
}

// Обычные ссылки на категории: для клавиатуры и экранного диктора,
// а без WebGL — видимая лента картинок.
function fillLinks() {
  fallback.innerHTML = categories.map((c) =>
    `<li><a href="#catalog" data-cat-link="${c.id}"><img src="${imageOf(c)}" alt="${c.name}" loading="lazy" width="1600" height="900"></a></li>`
  ).join('');
  fallback.addEventListener('click', (e) => {
    const a = e.target.closest('[data-cat-link]');
    if (!a) return;
    e.preventDefault();
    openCategory(a.getAttribute('data-cat-link'));
  });
}

function buildFallback() {
  section.classList.add('no-webgl');
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
const TOTAL = STEP * categories.length;
const CENTER_Y = -0.4;
const FLOOR_Y = -14;

// Форма ленты (в покое)
const shape = {
  amp: 6.5,                 // глубина волны
  k: Math.PI * 0.9 / 33,    // меньше половины периода на полэкрана — одна длинная дуга
  x0: -14,                  // гребень левее центра
  depth: -3.5,
  slope: -0.06,             // вся лента чуть уходит вглубь вправо
  bank: -0.05,              // наклон вдоль оси ленты
  half: 34,
  // Реакция на скорость
  rearY: 2.2,
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
    float dy = position.y;                 // высота над осью ленты
    float side = w.x - uX0;
    float edge = smoothstep(0.25, 1.0, abs(side) / uHalf);
    float speed = abs(uVel);

    float x = w.x + uLean * uVel * dy;     // лёгкий наклон по ходу движения
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

    vec3 col = mix(uColor, texture2D(uMap, vUv).rgb, uHasMap);
    col *= mix(0.62, 1.0, pow(clamp(vFacing, 0.0, 1.0), 3.0));   // повёрнутое от нас темнее
    float fog = smoothstep(uFogNear, uFogFar, vDist);
    gl_FragColor = vec4(col, alpha * (1.0 - fog));
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
  varying vec3 vWorld;
  varying float vDist;
  void main() {
    vec2 c = vec2(vWorld.x + uShift, vWorld.z) / uCell;
    vec2 g = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), vec2(1e-4));
    float line = 1.0 - min(min(g.x, g.y), 1.0);
    float fade = (1.0 - smoothstep(uNear + 20.0, uFar, vDist)) * smoothstep(uNear - 20.0, uNear - 10.0, vDist);
    gl_FragColor = vec4(uColor, line * 0.42 * fade);
  }
`;

function init() {
  fillLinks();
  if (!webglAvailable()) { buildFallback(); return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    buildFallback();
    return;
  }
  THREE.ColorManagement.enabled = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 1, 800);

  // Пол-сетка
  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.ShaderMaterial({
      vertexShader: gridVertex,
      fragmentShader: gridFragment,
      transparent: true,
      depthWrite: false,
      extensions: { derivatives: true },
      uniforms: {
        uShift: { value: 0 },
        uCell: { value: 6 },
        uColor: { value: new THREE.Color('#6FC2AE') },
        uNear: { value: 27 },
        uFar: { value: 260 }
      }
    })
  );
  grid.rotation.x = -Math.PI / 2;
  grid.position.set(0, FLOOR_Y, -300);
  grid.renderOrder = 0;
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

  const cards = categories.map((cat, i) => {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      extensions: { derivatives: true },
      uniforms: {
        ...shared,
        uMap: { value: null },
        uHasMap: { value: 0 },
        uColor: { value: new THREE.Color(cat.color) }
      }
    });
    loader.load(imageOf(cat), (tex) => {
      tex.anisotropy = maxAniso;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      material.uniforms.uMap.value = tex;
      material.uniforms.uHasMap.value = 1;
      requestRender();
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = CENTER_Y;
    mesh.renderOrder = 1;
    mesh.userData = { cat: cat.id, index: i };
    scene.add(mesh);
    return mesh;
  });

  /* ---------- Размер и камера ---------- */
  let fitHalf = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 60 : 75;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // на узком экране отодвигаем камеру, чтобы карточка поместилась по ширине
    const needHalfW = CARD_W * (camera.aspect < 1 ? 0.54 : 0.6);
    const z = Math.max(27, needHalfW / (tanHalf * camera.aspect));
    camera.position.set(0, 0, z);
    camera.lookAt(0, 1.6, 0);
    camera.updateProjectionMatrix();
    fitHalf = z * tanHalf * camera.aspect;
    // туман и сетка считаются от реального расстояния камеры
    shared.uFogNear.value = z + 13;
    shared.uFogFar.value = z + 68;
    grid.material.uniforms.uNear.value = z;
    grid.material.uniforms.uFar.value = z + 233;
    shared.uHalf.value = Math.max(shape.half, fitHalf);
    requestRender();
  }
  new ResizeObserver(resize).observe(canvas);

  /* ---------- Управление ---------- */
  let dragOffset = 0;
  let offset = 0;
  let prevOffset = 0;
  let vel = 0;
  let pointer = null;

  function scrollProgress() {
    const r = section.getBoundingClientRect();
    const range = r.height - window.innerHeight;
    return range > 0 ? Math.min(1, Math.max(0, -r.top / range)) : 0;
  }
  const targetOffset = () => scrollProgress() * (categories.length - 1) * STEP + dragOffset;

  function wrap(x) {
    return ((((x + TOTAL / 2) % TOTAL) + TOTAL) % TOTAL) - TOTAL / 2;
  }

  // Та же деформация, что в шейдере, — чтобы клик попадал в изогнутую карточку
  const tmp = new THREE.Vector3();
  function deformed(x, dy, v) {
    const side = x - shape.x0;
    const t = Math.min(1, Math.max(0, (Math.abs(side) / shared.uHalf.value - 0.25) / 0.75));
    const edge = t * t * (3 - 2 * t);
    const xx = x + shape.lean * v * dy;
    const theta = shape.bank * Math.sin(shape.k * side) + shape.twist * v * edge * Math.sign(side);
    const z = shape.depth + shape.amp * Math.cos(shape.k * (xx - shape.x0)) + shape.slope * xx;
    return tmp.set(
      xx,
      CENTER_Y + dy * Math.cos(theta) + shape.rearY * Math.abs(v) * edge,
      z - dy * Math.sin(theta) + shape.rearZ * Math.abs(v) * edge
    );
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
          if (inTri(px, py, a, b, c) || inTri(px, py, a, c, d)) {
            if (a.depth < bestDepth) { bestDepth = a.depth; best = mesh.userData.cat; }
          }
        }
      }
    }
    return best;
  }
  function inTri(px, py, a, b, c) {
    const s1 = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    const s2 = (c.x - b.x) * (py - b.y) - (c.y - b.y) * (px - b.x);
    const s3 = (a.x - c.x) * (py - c.y) - (a.y - c.y) * (px - c.x);
    return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  }

  canvas.addEventListener('pointerdown', (ev) => {
    pointer = { id: ev.pointerId, x: ev.clientX, startX: ev.clientX, startY: ev.clientY, moved: false };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (pointer && ev.pointerId === pointer.id) {
      const dx = ev.clientX - pointer.x;
      pointer.x = ev.clientX;
      if (Math.abs(ev.clientX - pointer.startX) > 6) {
        pointer.moved = true;
        canvas.classList.add('is-dragging');
      }
      // пиксели → мировые единицы на глубине гребня
      dragOffset -= dx * (2 * fitHalf) / canvas.clientWidth * 1.1;
      requestRender();
    } else if (ev.pointerType === 'mouse') {
      canvas.classList.toggle('is-pointer', !!pickCard(ev.clientX, ev.clientY));
    }
  });
  function endPointer(ev) {
    if (!pointer || ev.pointerId !== pointer.id) return;
    const click = !pointer.moved && Math.abs(ev.clientY - pointer.startY) < 6;
    canvas.classList.remove('is-dragging');
    pointer = null;
    if (click && ev.type === 'pointerup') {
      const id = pickCard(ev.clientX, ev.clientY);
      if (id) openCategory(id);
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  function currentIndex() {
    const i = Math.round(offset / STEP) % categories.length;
    return (i + categories.length) % categories.length;
  }

  /* ---------- Кадр ---------- */
  let visible = false, rafId = 0, last = 0, lastCounter = -1;

  function frame(now) {
    rafId = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;

    const target = targetOffset();
    const follow = reduceMotion ? 1 : 1 - Math.exp(-dt * 7);
    offset += (target - offset) * follow;
    if (Math.abs(target - offset) < 0.001) offset = target;

    const rawVel = dt > 0 ? (offset - prevOffset) / dt : 0;   // единиц в секунду
    prevOffset = offset;
    const vTarget = reduceMotion ? 0 : Math.tanh(rawVel / 240);   // мягкое насыщение
    vel += (vTarget - vel) * (1 - Math.exp(-dt * 6));
    if (Math.abs(vel) < 0.0005 && vTarget === 0) vel = 0;
    shared.uVel.value = vel;

    for (const mesh of cards) {
      mesh.position.x = wrap(mesh.userData.index * STEP - offset) + shape.x0;
    }
    grid.material.uniforms.uShift.value = offset;

    renderer.render(scene, camera);

    const idx = currentIndex();
    if (counter && idx !== lastCounter) {
      lastCounter = idx;
      counter.textContent = `${pad(idx + 1)} / ${pad(categories.length)}`;
    }

    const moving = offset !== target || vel !== 0;
    if (visible && moving) rafId = requestAnimationFrame(frame);
    else last = 0;
  }

  function requestRender() {
    if (visible && !rafId) rafId = requestAnimationFrame(frame);
  }

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) { resize(); requestRender(); }
  }, { rootMargin: '200px 0px' }).observe(section);

  window.addEventListener('scroll', requestRender, { passive: true });
  resize();
}

init();
