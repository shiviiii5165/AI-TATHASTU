const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  
  await page.goto('http://localhost:3000/brand/login-workspace.jpg');
  const origInfo = await page.evaluate(() => {
    const img = document.querySelector('img');
    return { w: img.naturalWidth, h: img.naturalHeight };
  });
  
  await page.goto('http://localhost:3000/brand/login-workspace-clean.jpg');
  const cleanInfo = await page.evaluate(() => {
    const img = document.querySelector('img');
    return { w: img.naturalWidth, h: img.naturalHeight };
  });

  console.log('Orig:', origInfo, 'Clean:', cleanInfo);
  await browser.close();
})();
