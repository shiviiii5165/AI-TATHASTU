const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 578, height: 576 } });
  await page.goto('file:///' + 'd:/ai tathastu 3/public/brand/login-workspace.jpg');
  
  const curvePoints = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const img = document.querySelector('img');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Sample yellow pixels along x
    let points = [];
    for (let x = 410; x < 550; x += 5) {
      let ys = [];
      for (let y = 180; y < 225; y++) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        if (r > 200 && g > 170 && b < 110) {
          ys.push(y);
        }
      }
      if (ys.length) {
        const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
        points.push({ x, avgY });
      }
    }
    return points;
  });
  
  console.log('Underline curve points (x, avgY):', curvePoints);
  await browser.close();
})();
