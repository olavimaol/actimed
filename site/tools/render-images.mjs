// Перерисовывает картинки сайта из шаблона tools/scene.html.
// Запуск из папки site:  node tools/render-images.mjs
// Нужен Playwright (npm i -D playwright или глобальная установка) и интернет для шрифтов.
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

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2400, height: 1000 }, deviceScaleFactor: 1 });

async function shoot(query, out, opts = {}) {
  await page.goto(`${scene}?${query}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.locator('#shot').screenshot({ path: out, ...opts });
  console.log('✓', path.relative(site, out));
}

await page.goto(`${scene}`, { waitUntil: 'load' });
const ids = await page.evaluate(() => window.ACTIMED.categories.filter((c) => c.id !== 'all').map((c) => c.id));

for (const id of ids) {
  await shoot(`card=${id}`, path.join(site, 'img/categories', `${id}.jpg`), { type: 'jpeg', quality: 86 });
}
await shoot('octagon', path.join(site, 'img/footer/octagon.jpg'), { type: 'jpeg', quality: 86 });
await shoot('blisters', path.join(site, 'img/footer/blisters.png'), { omitBackground: true });

await browser.close();
