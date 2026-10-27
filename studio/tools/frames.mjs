// Renders frames [from, to) of the ZIGGY TERMINAL video into studio/frames (run from studio/)
// usage: node frames.mjs <from> <to> [url]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [a, b] = process.argv.slice(2, 4).map(Number);
const url = process.argv[4] || 'http://localhost:8765/index.html';
mkdirSync('frames', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto(url);
await page.waitForFunction(() => window.READY === true, { timeout: 120000 });
for (let i = a; i < b; i++) {
  await page.evaluate(t => window.renderAt(t), i / 30);
  await page.screenshot({ path: `frames/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 93 });
  if (i % 30 === 0) console.log('frame', i);
}
await browser.close();
console.log('done', a, b);
