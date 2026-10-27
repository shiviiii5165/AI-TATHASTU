const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  
  await page.setContent(`
    <img id="orig" src="file:///d:/ai%20tathastu%203/public/brand/login-workspace.jpg" style="width: 578px; height: 576px;" />
    <img id="clean" src="file:///d:/ai%20tathastu%203/public/brand/login-workspace-clean.jpg" style="width: 578px; height: 576px;" />
  `);
  
  const comparison = await page.evaluate(() => {
    const orig = document.getElementById('orig');
    const clean = document.getElementById('clean');
    return {
      orig: { w: orig.naturalWidth, h: orig.naturalHeight, ratio: orig.naturalWidth / orig.naturalHeight },
      clean: { w: clean.naturalWidth, h: clean.naturalHeight, ratio: clean.naturalWidth / clean.naturalHeight }
    };
  });
  console.log('Comparison:', comparison);
  await browser.close();
})();
