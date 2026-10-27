const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

  // Let's inject experimental styles to see how it aligns with Image B
  await page.evaluate(() => {
    const bgDiv = document.querySelector('section > div');
    if (bgDiv) {
      bgDiv.style.backgroundPosition = 'left bottom';
    }
    
    // Headline container
    const h1El = document.querySelector('h1');
    const heroDesktop = h1El ? h1El.parentElement : null;
    if (heroDesktop) {
      // Position hero container starting at ~44% of the panel width
      heroDesktop.style.marginLeft = '44%';
      heroDesktop.style.paddingLeft = '0';
      heroDesktop.style.paddingRight = '24px';
      heroDesktop.style.marginTop = '40px';
      
      const h1 = heroDesktop.querySelector('h1');
      if (h1) {
        h1.style.fontSize = '44px';
        h1.style.lineHeight = '1.1';
      }
      
      const sigDiv = heroDesktop.querySelector('.justify-end');
      if (sigDiv) {
        sigDiv.style.justifyContent = 'flex-end';
        sigDiv.style.paddingRight = '16px';
        sigDiv.style.marginTop = '4px';
      }
      
      const p = heroDesktop.querySelector('p');
      if (p) {
        p.style.marginTop = '12px';
        p.style.maxWidth = '340px';
        p.style.fontSize = '15px';
      }
    }
    
    // Right panel legal text
    const authCard = document.querySelector('main > section:last-child .rounded-3xl');
    if (authCard) {
      authCard.parentElement.style.maxWidth = '440px';
      authCard.style.padding = '32px';
    }
  });

  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, 'preview-1440.png'), fullPage: false });
  console.log('Saved preview-1440.png');

  await browser.close();
})();
