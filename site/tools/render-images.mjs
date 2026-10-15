// Перерисовывает картинки сайта из шаблона tools/scene.html.
// Запуск из папки site:  node tools/render-images.mjs
// Нужен Playwright (npm i -D playwright или глобальная установка) и интернет для шрифтов.
//
//   img/cards/<id>.jpg     — карточки ленты на главной
//   img/products/<id>.webp — упаковки на прозрачном фоне для страниц товаров
//   img/footer/…           — восьмиугольник и блистеры в футере
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
const scene = pathToFileURL(path.join(here, 'scene.html')).href;
const only = process.argv[2];   // можно перерисовать один товар: node tools/render-images.mjs ibuprofen

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
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
  save(path.join(site, 'img/cards', `${id}.jpg`), await page.locator('#shot').screenshot({ type: 'jpeg', quality: 86 }));

  await open(hiDpi, `cutout=${id}`);
  const png = await hiDpi.locator('#shot').screenshot({ omitBackground: true });
  save(path.join(site, 'img/products', `${id}.webp`), await toWebp(hiDpi, png));
}

if (!only) {
  await open(page, 'octagon');
  save(path.join(site, 'img/footer/octagon.jpg'), await page.locator('#shot').screenshot({ type: 'jpeg', quality: 86 }));
  await open(page, 'blisters');
  save(path.join(site, 'img/footer/blisters.png'), await page.locator('#shot').screenshot({ omitBackground: true }));
}

await browser.close();
