const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    const overlay = document.querySelector('section > div:nth-child(3)');
    if (overlay) {
      overlay.style.background = 'linear-gradient(to bottom, rgba(250,250,253,0.98) 0%, rgba(250,250,253,0.92) 55%, rgba(250,250,253,0.60) 100%)';
    }
  });

  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, 'mobile-soft-veil.png'), fullPage: false });
  console.log('Saved mobile-soft-veil.png');

  await browser.close();
})();
