// Перерисовывает картинки сайта из шаблона tools/scene.html.
// Запуск из папки site:  node tools/render-images.mjs
// Нужен Playwright (npm i -D playwright или глобальная установка) и интернет для шрифтов.
//
//   img/cards/<id>.webp    — карточки ленты на главной (левая часть полупрозрачная)
//   img/products/<id>.webp — упаковки на прозрачном фоне для страниц товаров
//   img/footer/…           — восьмиугольник и объёмный знак в футере
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (e) {
    const globalRoot = execSync('npm root -g').toString().trim();
    return createRequire(path.join(globalRoot, 'noop.js'))('playwright');
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '..');
const only = process.argv[2];   // можно перерисовать один товар: node tools/render-images.mjs ibuprofen

// Шаблон открываем через локальный сервер: модули (js/logo3d.js) с file:// не грузятся
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const file = path.join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(site) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const scene = `http://127.0.0.1:${server.address().port}/tools/scene.html`;

const { chromium } = await loadPlaywright();
// WebGL без видеокарты — для объёмного знака
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 2400, height: 1000 }, deviceScaleFactor: 1 });
const hiDpi = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });

async function open(p, query) {
  await p.goto(`${scene}?${query}`, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { await document.fonts.ready; window.fitHeading && window.fitHeading(); });
  await p.waitForTimeout(150);
}

function save(out, buffer) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buffer);
  console.log('✓', path.relative(site, out), Math.round(buffer.length / 1024) + ' КБ');
}

// PNG → WebP средствами самого браузера (без лишних зависимостей)
async function toWebp(p, png, quality = 0.88) {
  const dataUrl = await p.evaluate(async ({ b64, quality }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', quality);
  }, { b64: png.toString('base64'), quality });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

await page.goto(scene, { waitUntil: 'load' });
const ids = (await page.evaluate(() => window.ACTIMED.products.map((p) => p.id))).filter((id) => !only || id === only);

for (const id of ids) {
  await open(page, `card=${id}`);
  const cardPng = await page.locator('#shot').screenshot({ omitBackground: true });
  save(path.join(site, 'img/cards', `${id}.webp`), await toWebp(page, cardPng, 0.9));

  await open(hiDpi, `cutout=${id}`);
  const png = await hiDpi.locator('#shot').screenshot({ omitBackground: true });
  save(path.join(site, 'img/products', `${id}.webp`), await toWebp(hiDpi, png));
}

if (!only) {
  await open(page, 'octagon');
  save(path.join(site, 'img/footer/octagon.jpg'), await page.locator('#shot').screenshot({ type: 'jpeg', quality: 86 }));
  await open(hiDpi, 'figure');
  await hiDpi.waitForFunction(() => window.figureReady, null, { timeout: 60000 });
  const figurePng = await hiDpi.locator('#shot').screenshot({ omitBackground: true });
  save(path.join(site, 'img/footer/figure.webp'), await toWebp(hiDpi, figurePng, 0.9));
}

await browser.close();
server.close();
