// Build:
//   recruit-site-wireframe.pdf     — 6 wireframe pages (top/company/work/people/recruit/entry) + cover
//   recruit-site-ia-rationale.pdf  — IA rationale document (8 A4 pages)
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = __dirname;
const PORT = 4380;

const WIRE_PAGES = ['top','company','work','people','recruit','entry'];

function startServer(){
  const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url);
    let p = decodeURIComponent(parsed.pathname);
    if (p === '/') p = '/index.html';
    const fp = path.join(ROOT, p);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    const ext = path.extname(fp).toLowerCase();
    const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'application/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise(resolve => server.listen(PORT, () => resolve(server)));
}

async function shotWireframe(browser, slug){
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/wireframe/${slug}.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const out = path.join(OUT_DIR, `wire-${slug}.png`);
  await page.screenshot({ path: out, fullPage: true, type: 'png' });
  console.log('✓', path.basename(out));
  await ctx.close();
  return out;
}

async function shotDocPages(browser, docPath, prefix){
  const ctx = await browser.newContext({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/${docPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const count = await page.evaluate(() => document.querySelectorAll('.page').length);
  const files = [];
  for (let i = 0; i < count; i++){
    const el = (await page.$$('.page'))[i];
    const out = path.join(OUT_DIR, `${prefix}-${String(i+1).padStart(2,'0')}.png`);
    await el.screenshot({ path: out, type: 'png' });
    console.log('✓', path.basename(out));
    files.push(out);
  }
  await ctx.close();
  return files;
}

async function buildPdf(files, outPdf){
  const pdf = await PDFDocument.create();
  for (const file of files){
    const bytes = fs.readFileSync(file);
    const ext = path.extname(file).toLowerCase();
    const img = (ext === '.jpg' || ext === '.jpeg') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    const targetW = 794;
    const scale = targetW / img.width;
    const page = pdf.addPage([targetW, img.height * scale]);
    page.drawImage(img, { x: 0, y: 0, width: targetW, height: img.height * scale });
  }
  fs.writeFileSync(outPdf, await pdf.save());
}

(async () => {
  const server = await startServer();
  console.log(`server up on :${PORT}`);
  const browser = await chromium.launch();

  // 1. Wireframe screenshots (full-page per file)
  const wirePngs = [];
  for (const slug of WIRE_PAGES){
    wirePngs.push(await shotWireframe(browser, slug));
  }

  // 2. IA rationale doc pages
  const iaPngs = await shotDocPages(browser, '_proposal/ia-rationale.html', 'ia');

  await browser.close();
  server.close();

  // 3a. Wireframe PDF
  const wirePdf = path.join(OUT_DIR, 'recruit-site-wireframe.pdf');
  await buildPdf(wirePngs, wirePdf);
  console.log('\n✓ Wireframe PDF   :', wirePdf, ' pages:', wirePngs.length);

  // 3b. IA rationale PDF
  const iaPdf = path.join(OUT_DIR, 'recruit-site-ia-rationale.pdf');
  await buildPdf(iaPngs, iaPdf);
  console.log('✓ IA rationale PDF:', iaPdf, ' pages:', iaPngs.length);
})().catch(e => { console.error(e); process.exit(1); });
