// Build proposal PDFs:
//   recruit-site-proposal-pc.pdf     = cover + sitemap + 6 × (rationale + PC screenshot)
//   recruit-site-proposal-mobile.pdf = cover + 6 × mobile screenshots
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = __dirname;
const PORT = 4378;

const PAGES = [
  { slug: 'index', label: 'トップ' },
  { slug: 'company', label: '会社を知る' },
  { slug: 'work', label: '仕事を知る' },
  { slug: 'people', label: '社員紹介' },
  { slug: 'recruit', label: '採用情報' },
  { slug: 'entry', label: 'エントリー' },
];

const PC  = { name: 'pc',     width: 1400, height: 900 };
const MOB = { name: 'mobile', width: 390,  height: 844 };

function startServer(){
  const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url);
    let p = decodeURIComponent(parsed.pathname);
    if (p === '/') p = '/index.html';
    const fp = path.join(ROOT, p);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404); res.end('404'); return;
    }
    const ext = path.extname(fp).toLowerCase();
    const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'application/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise(resolve => server.listen(PORT, () => resolve(server)));
}

async function shot(browser, u, out, vp){
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(u, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.querySelectorAll('.an,.al,.ar,.rec-step,.flow-step,.job-card,.faq-item').forEach(el => el.classList.add('v'));
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 82 });
  await ctx.close();
  console.log('✓', path.basename(out));
}

// Capture each .page div from proposal.html as its own PNG
async function shotProposalPages(browser){
  const ctx = await browser.newContext({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/_proposal/proposal.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const count = await page.evaluate(() => document.querySelectorAll('.page').length);
  const files = [];
  for (let i = 0; i < count; i++){
    const el = (await page.$$('.page'))[i];
    const out = path.join(OUT_DIR, `proposal-${String(i+1).padStart(2,'0')}.png`);
    await el.screenshot({ path: out, type: 'png' });
    console.log('✓', path.basename(out));
    files.push(out);
  }
  await ctx.close();
  return files;
}

async function buildPdf(orderedFiles, outPdf){
  const pdf = await PDFDocument.create();
  for (const file of orderedFiles){
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

  // 1. proposal doc pages (cover=01, sitemap=02, rationale 03..08 for 6 pages)
  const proposalPngs = await shotProposalPages(browser);

  // 2. site screenshots
  const siteShots = {};
  for (const p of PAGES){
    const pcOut  = path.join(OUT_DIR, `site-${p.slug}-pc.jpg`);
    const mobOut = path.join(OUT_DIR, `site-${p.slug}-mobile.jpg`);
    await shot(browser, `http://localhost:${PORT}/${p.slug}.html`, pcOut, PC);
    await shot(browser, `http://localhost:${PORT}/${p.slug}.html`, mobOut, MOB);
    siteShots[p.slug] = { pc: pcOut, mobile: mobOut };
  }

  await browser.close();
  server.close();

  // 3a. PC PDF : cover + sitemap + (rationale + PC) × 6
  const pcOrder = [];
  pcOrder.push(proposalPngs[0]); // cover
  pcOrder.push(proposalPngs[1]); // sitemap
  PAGES.forEach((p, i) => {
    pcOrder.push(proposalPngs[i + 2]);
    pcOrder.push(siteShots[p.slug].pc);
  });
  const pcPdf = path.join(OUT_DIR, 'recruit-site-proposal-pc.pdf');
  await buildPdf(pcOrder, pcPdf);
  console.log('\n✓ PC PDF   :', pcPdf, ' pages:', pcOrder.length);

  // 3b. Mobile PDF : cover + mobile screenshots × 6
  const mobOrder = [proposalPngs[0]];
  PAGES.forEach(p => { mobOrder.push(siteShots[p.slug].mobile); });
  const mobPdf = path.join(OUT_DIR, 'recruit-site-proposal-mobile.pdf');
  await buildPdf(mobOrder, mobPdf);
  console.log('✓ Mobile PDF:', mobPdf, ' pages:', mobOrder.length);
})().catch(e => { console.error(e); process.exit(1); });
