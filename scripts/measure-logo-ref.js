const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  await page.goto('file:///' + 'C:/Users/Lenovo/.gemini/antigravity-ide/brain/913409ef-8267-43ec-a6e0-26195f953355/.tempmediaStorage/media_1793039234323.jpg');
  
  const logoInRef = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const img = document.querySelector('img');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Find AT icon in top left of Image B: x from 10 to 300, y from 10 to 100
    let logoAT = [];
    for (let y = 10; y < 100; y++) {
      for (let x = 10; x < 300; x++) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        if (r > 220 && g < 100 && b > 100) {
          logoAT.push({ x, y });
        }
      }
    }
    const minX = Math.min(...logoAT.map(p => p.x));
    const maxX = Math.max(...logoAT.map(p => p.x));
    const minY = Math.min(...logoAT.map(p => p.y));
    const maxY = Math.max(...logoAT.map(p => p.y));
    return {
      minX, maxX, minY, maxY,
      pctLeft: (minX / 582) * 100,
      pctTop: (minY / 576) * 100
    };
  });
  console.log('Logo in Image B:', logoInRef);
  await browser.close();
})();
