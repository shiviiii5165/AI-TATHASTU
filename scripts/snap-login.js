const { chromium } = require('playwright');
const path = require('path');

const viewports = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'desktop-1756', width: 1756, height: 828 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'landscape-1024x576', width: 1024, height: 576 },
  { name: 'tablet-1024x768', width: 1024, height: 768 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-360', width: 360, height: 640 },
  { name: 'mobile-320', width: 320, height: 700 },
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(__dirname, `login-${vp.name}.png`), fullPage: false });
    console.log(`Saved login-${vp.name}.png`);
    await page.close();
  }
  await browser.close();
  console.log('All screenshots captured successfully.');
})();
