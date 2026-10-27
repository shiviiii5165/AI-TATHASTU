const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file:///' + path.join(__dirname, 'test-bg-0-left_bottom.png').replace(/\\/g, '/'));
  
  const windowPos = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const img = document.querySelector('img');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // The window frame at y = 350
    // Window has green grass / campus outside (bright greens/buildings)
    // Left panel is 0 to 818
    // Find where the window sill/frame is:
    let windowGlassStart = -1;
    for (let x = 200; x < 600; x++) {
      const [r, g, b] = ctx.getImageData(x, 350, 1, 1).data;
      // Outside scenery has distinct green/daylight
      if (g > 140 && g > r && b < 150) { // grass/trees outside
        windowGlassStart = x;
        break;
      }
    }
    return {
      windowGlassStart,
      windowGlassPctOfLeftPanel: (windowGlassStart / 818) * 100
    };
  });
  
  console.log('Window Pos in 1440 screenshot:', windowPos);
  await browser.close();
})();
