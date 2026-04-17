const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('file:///C:/Users/myuda/recruit-site/index.html', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/new_fullpage.png', fullPage: true });
  await page.screenshot({ path: 'screenshots/new_hero.png', clip: { x: 0, y: 0, width: 1400, height: 900 } });
  await browser.close();
  console.log('Done');
})();
