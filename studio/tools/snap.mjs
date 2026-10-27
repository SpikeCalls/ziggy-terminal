// Quick preview stills: node snap.mjs 6 9 12  -> snaps/t6.jpg ...
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('snaps', { recursive: true });
const ts = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('http://localhost:8765/index.html');
await page.waitForFunction(() => window.READY === true, { timeout: 120000 });
for (const t of ts) { await page.evaluate(t => window.renderAt(t), t); await page.screenshot({ path: `snaps/t${t}.jpg`, type: 'jpeg', quality: 90 }); console.log('snap', t); }
await browser.close();
