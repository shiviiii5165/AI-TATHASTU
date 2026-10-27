const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  
  const tests = [
    {
      name: 'opt-1-warm-soft-backdrop',
      bgPos: 'center 80%',
      overlay: 'linear-gradient(to bottom, rgba(250,250,253,0.96) 0%, rgba(250,250,253,0.88) 60%, rgba(250,250,253,0.5) 100%)',
    },
    {
      name: 'opt-2-higher-contrast',
      bgPos: 'center 85%',
      overlay: 'linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.6) 100%)',
    },
    {
      name: 'opt-3-bottom-desk',
      bgPos: 'center bottom',
      overlay: 'linear-gradient(to bottom, rgba(250,250,253,0.95) 0%, rgba(250,250,253,0.85) 55%, rgba(250,250,253,0.45) 100%)',
    }
  ];

  for (const t of tests) {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.evaluate((cfg) => {
      const bgDiv = document.querySelector('section > div');
      if (bgDiv) bgDiv.style.backgroundPosition = cfg.bgPos;
      const overlay = document.querySelector('section > div:nth-child(3)');
      if (overlay) overlay.style.background = cfg.overlay;
    }, t);
    await page.waitForTimeout(400);
    const fname = `mobile-${t.name}.png`;
    await page.screenshot({ path: path.join(__dirname, fname), fullPage: false });
    console.log(`Saved ${fname}`);
  }
  
  await browser.close();
})();
