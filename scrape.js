const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('https://www.tokuyama-dental.co.jp/recruit/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Full page screenshot
  await page.screenshot({ path: 'screenshots/fullpage.png', fullPage: true });

  // Get body HTML
  const html = await page.evaluate(() => document.body.innerHTML);
  fs.writeFileSync('scraped_body.html', html, 'utf-8');

  // Get all image info
  const imageInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => {
      const cs = getComputedStyle(img);
      const parentCs = img.parentElement ? getComputedStyle(img.parentElement) : {};
      return {
        src: img.src,
        alt: img.alt,
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        displayW: Math.round(img.getBoundingClientRect().width),
        displayH: Math.round(img.getBoundingClientRect().height),
        classes: img.className,
        parentClasses: img.parentElement?.className || '',
        objectFit: cs.objectFit,
        objectPosition: cs.objectPosition,
        position: cs.position,
        zIndex: cs.zIndex,
        borderRadius: cs.borderRadius,
        parentPosition: parentCs.position || '',
        parentOverflow: parentCs.overflow || '',
      };
    });
  });
  fs.writeFileSync('image_info.json', JSON.stringify(imageInfo, null, 2), 'utf-8');

  // Get CSS for key selectors
  const cssInfo = await page.evaluate(() => {
    const selectors = [
      '.top_flow', '.top_flow_text', '.top_flow_text_people',
      '.top_company', '.top_company_people',
      '.top_business', '.top_business_left', '.top_business_right', '.top_business_people',
      '.top_interview', '.top_interview_slider',
      '.top_data', '.top_data_people_run',
      '.top_column',
    ];
    const results = {};
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) { results[sel] = null; return; }
      const cs = getComputedStyle(el);
      results[sel] = {
        display: cs.display,
        position: cs.position,
        width: cs.width,
        height: cs.height,
        background: cs.background?.substring(0, 300),
        overflow: cs.overflow,
        flexDirection: cs.flexDirection,
        justifyContent: cs.justifyContent,
        alignItems: cs.alignItems,
        gap: cs.gap,
        padding: cs.padding,
        margin: cs.margin,
        gridTemplateColumns: cs.gridTemplateColumns,
        rect: el.getBoundingClientRect(),
        childCount: el.children.length,
        innerHTML: el.innerHTML.substring(0, 500),
      };
    });
    return results;
  });
  fs.writeFileSync('css_info.json', JSON.stringify(cssInfo, null, 2), 'utf-8');

  await browser.close();
  console.log('Done!');
})();
