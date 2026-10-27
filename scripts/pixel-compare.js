const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  
  // Load reference
  await page.goto('file:///' + 'C:/Users/Lenovo/.gemini/antigravity-ide/brain/913409ef-8267-43ec-a6e0-26195f953355/.tempmediaStorage/media_1793039234323.jpg');
  await page.screenshot({ path: path.join(__dirname, 'ref-exact.png') });
  
  // Load our current page
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(__dirname, 'curr-exact.png') });
  
  // Let's analyze pixel differences in key regions:
  // 1. Logo area (x: 0..300, y: 0..100)
  // 2. Headline area (x: 200..580, y: 80..270)
  // 3. Right card area (x: 600..980, y: 80..520)
  // 4. Trust row (y: 500..560)
  
  await browser.close();
  console.log('Saved ref-exact.png and curr-exact.png');
})();
