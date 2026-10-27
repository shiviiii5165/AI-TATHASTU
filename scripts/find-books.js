const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  await page.goto('http://localhost:3000/brand/login-workspace-clean.jpg');
  
  const metrics = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const img = document.querySelector('img');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Find text on book spine "Build": around y: 600..700, x: 0..150
    // The "Build" book has light beige/white spine with dark letters
    let buildPixels = [];
    for (let y = 600; y < 650; y++) {
      for (let x = 10; x < 150; x++) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        if (r < 40 && g < 40 && b < 40) {
          buildPixels.push({ x, y });
        }
      }
    }
    
    // Left edge of laptop
    let laptopLeft = [];
    for (let y = 460; y < 750; y += 5) {
      for (let x = 150; x < 300; x += 5) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        // Laptop base/screen bezel
      }
    }
    
    return {
      buildMinX: buildPixels.length ? Math.min(...buildPixels.map(p => p.x)) : -1,
      buildMaxX: buildPixels.length ? Math.max(...buildPixels.map(p => p.x)) : -1,
    };
  });
  
  console.log('Clean image metrics:', metrics);
  await browser.close();
})();
