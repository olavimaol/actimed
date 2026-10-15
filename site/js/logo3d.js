/*
  Объёмный знак Actimed (наклонный штрих «А» и лист) для футера.
  Контуры — из img/logo-mark.svg; знак выдавлен в толщину, края
  скруглены фаской. Белая глянцевая «керамика» с отражениями мятной
  студии. Используется в js/footer.js и в tools/scene.html?figure
  (неподвижная картинка img/footer/figure.png — запасной вариант).
*/
import * as THREE from '../vendor/three.module.min.js';

// SVG-координаты знака (viewBox -2 -2 104 96, y вниз) → центр в нуле, y вверх
const P = (x, y) => [x - 50, 45 - y];

// Половина кривой Безье до/после t (де Кастельжо)
function split(a, b, c, d, t) {
  const l = (p, q) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const ab = l(a, b), bc = l(b, c), cd = l(c, d), abc = l(ab, bc), bcd = l(bc, cd), m = l(abc, bcd);
  return { first: [a, ab, abc, m], second: [m, bcd, cd, d] };
}

function cubic(a, b, c, d, t) {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]
  ];
}

function shapes() {
  const blade = new THREE.Shape();
  blade.moveTo(...P(51.2, 0));
  blade.lineTo(...P(100, 87.1));
  blade.lineTo(...P(77, 87.1));
  blade.quadraticCurveTo(...P(70.1, 87.1), ...P(66.8, 81.6));
  blade.lineTo(...P(39.4, 34.6));
  blade.bezierCurveTo(...P(36.1, 29), ...P(35.8, 23.8), ...P(39.1, 18.7));
  blade.closePath();

  // Острый кончик листа в объёме скругляем: фаска на таком углу ломается
  const rise = split(P(0, 91.3), P(6.2, 80.5), P(11.8, 70.8), P(16.2, 64.2), 0.12).second;
  const fall = split(P(9.7, 87.1), P(6.2, 87.4), P(2.8, 89), P(0, 91.3), 0.82).first;
  const leaf = new THREE.Shape();
  leaf.moveTo(...rise[0]);
  leaf.bezierCurveTo(...rise[1], ...rise[2], ...rise[3]);
  leaf.bezierCurveTo(...P(18.1, 61.4), ...P(20.7, 60.3), ...P(24.2, 60));
  leaf.lineTo(...P(49.9, 58.1));
  leaf.lineTo(...P(33.6, 82.6));
  leaf.bezierCurveTo(...P(32.2, 84.9), ...P(29.7, 87.1), ...P(26.3, 87.1));
  leaf.lineTo(...P(9.7, 87.1));
  leaf.bezierCurveTo(...fall[1], ...fall[2], ...fall[3]);
  leaf.quadraticCurveTo(...P(0.4, 90.6), ...rise[0]);

  // Прожилка листа — прорезь. В объёме её чуть расширяем (у стебля шире,
  // к кончику сходится в точку), иначе фаска её «заливает».
  const up = [P(6.2, 88), P(17.3, 72.2), P(31.1, 63.6), P(47.7, 60.3)];
  const low = [P(47.7, 60.3), P(33.9, 65.8), P(20.1, 75), P(7.6, 89)];
  const top = [], bottom = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const s = i / N;                                   // 0 — у стебля, 1 — у кончика
    const a = cubic(...up, 0.14 + 0.86 * s);
    const b = cubic(...low, 0.86 - 0.86 * s);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const k = 1.7;
    top.push(new THREE.Vector2(mx + (a[0] - mx) * k, my + (a[1] - my) * k));
    bottom.push(new THREE.Vector2(mx + (b[0] - mx) * k, my + (b[1] - my) * k));
  }
  const vein = new THREE.Path(top.concat(bottom.reverse().slice(1)));
  leaf.holes.push(vein);
  return [blade, leaf];
}

export function buildLogo() {
  const geometry = new THREE.ExtrudeGeometry(shapes(), {
    depth: 9,
    curveSegments: 36,
    bevelEnabled: true,
    bevelThickness: 2.4,
    bevelSize: 1.0,
    bevelOffset: -1.0,           // фаска внутрь: силуэт знака не толстеет
    bevelSegments: 10
  });
  geometry.translate(0, 0, -4.5);
  geometry.computeVertexNormals();
  const material = new THREE.MeshPhysicalMaterial({
    color: '#FFFFFF',
    roughness: 0.28,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
    sheen: 0.4,
    sheenColor: new THREE.Color('#BFF0DD'),
    envMapIntensity: 1.05
  });
  return new THREE.Mesh(geometry, material);
}

// Мягкая «студия» для отражений: комната с софтбоксами (как RoomEnvironment)
export function studio(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(12, 12, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.7, 0.67), side: THREE.BackSide })
  );
  env.add(room);
  const panel = (w, h, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(7, 4, new THREE.Color(8, 8, 8), -3, 4.5, 4);           // главный свет сверху слева
  panel(4, 6, new THREE.Color(1.4, 3.2, 2.6), 5.5, 0, 1.5);     // мятный справа
  panel(8, 2, new THREE.Color(4, 4, 4), 0, -1, -5.5);           // контровой сзади
  panel(9, 9, new THREE.Color(0.08, 0.3, 0.29), 0, -5.8, 0);    // тёмно-бирюзовый пол
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return texture;
}

// Сцена с камерой под знак; canvas — квадратный
export function createFigure(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.environment = studio(renderer);
  // направленный свет даёт разницу между лицевой гранью, фаской и торцами
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(-120, 160, 220);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(26, 1, 10, 1000);
  camera.position.set(0, 0, 330);
  const logo = buildLogo();
  const pivot = new THREE.Group();
  pivot.add(logo);
  scene.add(pivot);
  return {
    renderer,
    pivot,
    resize(size, dpr) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(size, size, false);
    },
    // поза: поворот вокруг вертикали и горизонтали (радианы), лёгкий крен, подъём
    render(yaw, pitch, roll, lift) {
      pivot.rotation.set(pitch, yaw, roll);
      pivot.position.y = lift;
      renderer.render(scene, camera);
    }
  };
}
