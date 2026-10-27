const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const positions = [
    'left bottom',
    'left center',
    '10% bottom',
    'center bottom',
    'left top'
  ];
  
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.evaluate((bgPos) => {
      const bgDiv = document.querySelector('section > div');
      if (bgDiv) bgDiv.style.backgroundPosition = bgPos;
    }, pos);
    await page.waitForTimeout(400);
    const filename = `test-bg-${i}-${pos.replace(/\s+/g, '_')}.png`;
    await page.screenshot({ path: path.join(__dirname, filename), fullPage: false });
    console.log(`Saved ${filename}`);
  }
  
  await browser.close();
})();
