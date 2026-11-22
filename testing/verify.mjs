import puppeteer from 'puppeteer-core';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = process.argv[2] || 'https://fancy.laobaitv.net/hy4flash/';
const out = process.argv[3] || 'verify.png';
const VW = parseInt(process.argv[4] || '1200', 10);
const VH = parseInt(process.argv[5] || '800', 10);
const WAIT = parseInt(process.argv[6] || '7000', 10);

const browser = await puppeteer.launch({
  executablePath: chrome, headless: true,
  args: ['--enable-unsafe-swiftshader','--use-angle=swiftshader','--use-gl=angle','--no-sandbox','--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, WAIT));
await page.screenshot({ path: out }); // clean state before interactions
// exercise UI
for (const sel of ['#btn-pause','.pip[data-i="2"]','#btn-view','#btn-quality','#btn-orbit','#btn-reset']) {
  await page.click(sel).catch(()=>{});
  await new Promise(r=>setTimeout(r, 300));
}
await new Promise((r) => setTimeout(r, 1500));
const info = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return { canvas: !!c, w: c?.width, h: c?.height,
    loader: document.getElementById('loader') ? getComputedStyle(document.getElementById('loader')).display : null,
    season: document.getElementById('season-name')?.textContent,
    fps: document.getElementById('stat-fps')?.textContent };
});
await page.screenshot({ path: out });
console.log('INFO', JSON.stringify(info));
console.log('ISSUES', logs.length ? logs.slice(0,12).join('\n') : 'none');
await browser.close();
