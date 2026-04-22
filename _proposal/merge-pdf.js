// Merge all PDFs into one: IA → Wireframe → Mockup PC → Mockup Mobile
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const OUT_DIR = __dirname;
const ORDER = [
  'recruit-site-ia-rationale.pdf',
  'recruit-site-wireframe.pdf',
  'recruit-site-proposal-pc.pdf',
  'recruit-site-proposal-mobile.pdf',
];
const OUT = 'recruit-site-all.pdf';

(async () => {
  const merged = await PDFDocument.create();
  for (const name of ORDER){
    const bytes = fs.readFileSync(path.join(OUT_DIR, name));
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
    console.log('✓', name, '→', src.getPageCount(), 'pages');
  }
  fs.writeFileSync(path.join(OUT_DIR, OUT), await merged.save());
  console.log('\n✓ Merged:', OUT, ' total:', merged.getPageCount(), 'pages');
})().catch(e => { console.error(e); process.exit(1); });
