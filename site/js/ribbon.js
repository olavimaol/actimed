/*
  Лента категорий в духе Jesper Landberg:
  карточки изгибаются по дуге над сеткой-полом, лента едет от прокрутки
  страницы или перетаскивания. Наведение мыши ничего не анимирует.
*/
import * as THREE from '../vendor/three.module.min.js';

const section = document.querySelector('[data-ribbon]');
const canvas = document.querySelector('[data-ribbon-canvas]');
const fallback = document.querySelector('[data-ribbon-fallback]');
const categories = window.ACTIMED.categories.filter((c) => c.id !== 'all');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEEP = '#0B2E33';

function openCategory(id) {
  if (window.actimedOpenCategory) window.actimedOpenCategory(id);
}

function buildFallback() {
  section.classList.add('no-webgl');
  fallback.innerHTML = categories.map((c) =>
    `<li><a href="#catalog" data-cat-link="${c.id}" style="--c:${c.color}">${c.name}<small>${c.count} товаров</small></a></li>`
  ).join('');
  fallback.addEventListener('click', (e) => {
    const a = e.target.closest('[data-cat-link]');
    if (!a) return;
    e.preventDefault();
    openCategory(a.getAttribute('data-cat-link'));
  });
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

/* ---------- Рисуем картинку карточки на canvas ---------- */
function mix(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function drawShape(ctx, type, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (type) {
    case 'pill': {
      ctx.rotate(-0.6);
      const w = s * 1.5, h = s * 0.6;
      ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.roundRect(0, -h / 2, w / 2, h, [0, h / 2, h / 2, 0]); ctx.fill();
      break;
    }
    case 'cross': {
      const a = s * 1.2, b = s * 0.38;
      ctx.beginPath(); ctx.roundRect(-a / 2, -b / 2, a, b, b * 0.25); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-b / 2, -a / 2, b, a, b * 0.25); ctx.fill();
      break;
    }
    case 'dots': {
      [[-0.35, -0.3, 0.42], [0.42, -0.1, 0.3], [-0.05, 0.45, 0.25]].forEach(([x, y, r]) => {
        ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2); ctx.fill();
      });
      break;
    }
    case 'heart': {
      const k = s * 0.62;
      ctx.beginPath();
      ctx.moveTo(0, k * 0.9);
      ctx.bezierCurveTo(-k * 1.6, -k * 0.1, -k * 0.7, -k * 1.3, 0, -k * 0.45);
      ctx.bezierCurveTo(k * 0.7, -k * 1.3, k * 1.6, -k * 0.1, 0, k * 0.9);
      ctx.fill();
      break;
    }
    case 'leaf': {
      ctx.rotate(0.5);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.8);
      ctx.quadraticCurveTo(s * 0.75, 0, 0, s * 0.8);
      ctx.quadraticCurveTo(-s * 0.75, 0, 0, -s * 0.8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.moveTo(0, -s * 0.6); ctx.lineTo(0, s * 0.7); ctx.stroke();
      break;
    }
    case 'drop': {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.85);
      ctx.bezierCurveTo(s * 0.35, -s * 0.35, s * 0.6, 0, s * 0.6, s * 0.25);
      ctx.arc(0, s * 0.25, s * 0.6, 0, Math.PI);
      ctx.bezierCurveTo(-s * 0.6, 0, -s * 0.35, -s * 0.35, 0, -s * 0.85);
      ctx.fill();
      break;
    }
    case 'pulse': {
      ctx.beginPath();
      ctx.moveTo(-s, 0); ctx.lineTo(-s * 0.4, 0); ctx.lineTo(-s * 0.2, -s * 0.6);
      ctx.lineTo(s * 0.1, s * 0.6); ctx.lineTo(s * 0.3, -s * 0.2); ctx.lineTo(s * 0.45, 0); ctx.lineTo(s, 0);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawCard(cat) {
  const W = 1260, H = 840;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, mix(cat.color, '#FFFFFF', 0.12));
  g.addColorStop(1, mix(cat.color, DEEP, 0.45));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // мягкий блик
  const glow = ctx.createRadialGradient(W * 0.72, H * 0.38, 10, W * 0.72, H * 0.38, H * 0.7);
  glow.addColorStop(0, 'rgba(255,255,255,0.28)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  drawShape(ctx, cat.shape, W * 0.72, H * 0.4, H * 0.28);

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '700 30px Unbounded, Manrope, sans-serif';
  ctx.fillText('ACTIMED', 64, 92);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 78px Manrope, sans-serif';
  ctx.fillText(cat.name, 64, H - 132);
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.font = '600 36px Manrope, sans-serif';
  ctx.fillText(`${cat.count} товаров`, 64, H - 72);

  // круглая стрелка
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(W - 110, H - 100, 50, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = DEEP;
  ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(W - 132, H - 100); ctx.lineTo(W - 88, H - 100);
  ctx.moveTo(W - 106, H - 118); ctx.lineTo(W - 88, H - 100); ctx.lineTo(W - 106, H - 82);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/* ---------- Шейдеры карточки ---------- */
const vertexShader = /* glsl */ `
  uniform float uCurve;
  uniform float uVel;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float x = wp.x;
    // дуга: чем дальше от центра, тем глубже карточка
    wp.z -= x * x * uCurve;
    // волна от скорости — лента «прогибается» при движении
    wp.y += sin(x * 0.42) * uVel * 0.9;
    wp.z += cos(uv.y * 3.14159) * uVel * 0.6;
    vDepth = wp.z;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform vec3 uBg;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    vec2 q = abs(p) - uSize * 0.5 + uRadius;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
    float alpha = 1.0 - smoothstep(-0.012, 0.012, d);
    if (alpha < 0.01) discard;
    vec3 col = texture2D(uMap, vUv).rgb;
    float fade = clamp(-vDepth * 0.045, 0.0, 0.7);
    col = mix(col, uBg, fade);
    gl_FragColor = vec4(col, alpha);
  }
`;

async function init() {
  if (!hasWebGL()) { buildFallback(); return; }

  THREE.ColorManagement.enabled = false;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (e) {
    buildFallback();
    return;
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(new THREE.Color(DEEP), 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color(DEEP), 10, 34);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  // Пол-сетка
  const grid = new THREE.GridHelper(120, 60, 0x2C7A74, 0x2C7A74);
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  grid.material.fog = true;
  grid.position.y = -2.4;
  scene.add(grid);

  // Ждём шрифты, чтобы надписи на карточках были нужным шрифтом
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  } catch (e) { /* шрифты не критичны */ }

  const CARD_W = 4.2, CARD_H = 2.8, GAP = 0.6;
  const STEP = CARD_W + GAP;
  const TOTAL = STEP * categories.length;
  const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H, 48, 12);
  const shared = {
    uCurve: { value: 0.028 },
    uVel: { value: 0 },
    uSize: { value: new THREE.Vector2(CARD_W, CARD_H) },
    uRadius: { value: 0.22 },
    uBg: { value: new THREE.Color(DEEP) }
  };

  const meshes = categories.map((cat, i) => {
    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true,
      uniforms: { ...shared, uMap: { value: drawCard(cat) } }
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { cat: cat.id, base: i * STEP };
    scene.add(mesh);
    return mesh;
  });

  /* ---------- Размеры ---------- */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // на узких экранах отодвигаем камеру, чтобы карточка помещалась
    const halfW = Math.max(CARD_W * 0.62, 7.2 * Math.min(1, camera.aspect / 1.6));
    const z = halfW / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    camera.position.set(0, 0.9, Math.max(11, z));
    camera.lookAt(0, -0.1, 0);
    camera.updateProjectionMatrix();
    shared.uCurve.value = camera.aspect < 1 ? 0.05 : 0.028;
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- Управление: прокрутка + перетаскивание ---------- */
  let dragOffset = 0;
  let offset = 0, target = 0, prev = 0;
  let pointer = null;

  function scrollProgress() {
    const r = section.getBoundingClientRect();
    const range = r.height - window.innerHeight;
    return range > 0 ? Math.min(1, Math.max(0, -r.top / range)) : 0;
  }

  function worldPerPixel() {
    const dist = camera.position.z;
    const visibleH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
    return visibleH / canvas.clientHeight;
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pickCard(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? hit.object.userData.cat : null;
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
      dragOffset -= dx * worldPerPixel();
      wake();
    } else if (ev.pointerType === 'mouse') {
      // только смена курсора, без анимаций
      canvas.classList.toggle('is-pointer', !!pickCard(ev));
    }
  });
  function endPointer(ev) {
    if (!pointer || ev.pointerId !== pointer.id) return;
    const wasClick = !pointer.moved && Math.abs(ev.clientY - pointer.startY) < 6;
    canvas.classList.remove('is-dragging');
    pointer = null;
    if (wasClick && ev.type === 'pointerup') {
      const id = pickCard(ev);
      if (id) openCategory(id);
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  /* ---------- Кадр ---------- */
  function wrap(x) {
    return ((((x + TOTAL / 2) % TOTAL) + TOTAL) % TOTAL) - TOTAL / 2;
  }

  let visible = false, rafId = 0;

  function frame() {
    rafId = 0;
    target = scrollProgress() * TOTAL + dragOffset - STEP * 0.5;
    offset += (target - offset) * (reduceMotion ? 1 : 0.085);
    const vel = offset - prev;
    prev = offset;
    shared.uVel.value += (Math.max(-0.6, Math.min(0.6, vel * 1.4)) - shared.uVel.value) * 0.12;

    meshes.forEach((m) => { m.position.x = wrap(m.userData.base - offset); });
    grid.position.x = -(offset % 2);

    renderer.render(scene, camera);

    const settling = Math.abs(target - offset) > 0.0005 || Math.abs(shared.uVel.value) > 0.0005;
    if (visible && settling) rafId = requestAnimationFrame(frame);
  }

  function wake() {
    if (visible && !rafId) rafId = requestAnimationFrame(frame);
  }

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) { resize(); wake(); }
  }, { rootMargin: '100px' }).observe(section);

  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', wake);
}

init();
