const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 578, height: 576 } });
  await page.goto('file:///' + 'd:/ai tathastu 3/public/brand/login-workspace.jpg');
  
  const metrics = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const img = document.querySelector('img');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Width and height
    const W = canvas.width;
    const H = canvas.height;
    
    // Find dark text pixels in headline region: x from 200 to 570, y from 80 to 280
    // "Turn effort" is very dark navy (#0F172A)
    // "into" is dark navy
    // "opportunities" is pink/coral
    // "Tathastu." is pink
    // Underline is yellow
    // "Showcase your work..." is slate
    
    let turnEffort = [];
    let opportunities = [];
    let tathastu = [];
    let underline = [];
    let showcase = [];
    
    for (let y = 60; y < 270; y++) {
      for (let x = 200; x < 570; x++) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        
        // Turn effort / into: dark navy
        if (r < 35 && g < 35 && b < 55 && y < 165) {
          turnEffort.push({ x, y });
        }
        // opportunities: pink/coral r > 200, g < 110, b in 80..160
        else if (r > 200 && g < 100 && b > 70 && b < 160 && y < 170) {
          opportunities.push({ x, y });
        }
        // Tathastu: pink script r > 200, g < 100, b in 70..160, y between 165 and 205
        else if (r > 200 && g < 100 && b > 70 && b < 160 && y >= 165 && y < 205) {
          tathastu.push({ x, y });
        }
        // Yellow underline: r > 210, g > 180, b < 110
        else if (r > 210 && g > 180 && b < 110 && y >= 180 && y < 215) {
          underline.push({ x, y });
        }
        // Showcase your work: slate text y between 210 and 260
        else if (r > 60 && r < 120 && g > 60 && g < 120 && b > 70 && b < 140 && y >= 210 && y < 265) {
          showcase.push({ x, y });
        }
      }
    }
    
    const getBox = (arr) => {
      if (!arr.length) return null;
      const minX = Math.min(...arr.map(p => p.x));
      const maxX = Math.max(...arr.map(p => p.x));
      const minY = Math.min(...arr.map(p => p.y));
      const maxY = Math.max(...arr.map(p => p.y));
      return {
        minX, maxX, width: maxX - minX,
        minY, maxY, height: maxY - minY,
        pctLeft: (minX / W) * 100,
        pctTop: (minY / H) * 100,
        pctWidth: ((maxX - minX) / W) * 100,
        pctHeight: ((maxY - minY) / H) * 100
      };
    };
    
    // Also let's find the logo position in login-workspace.jpg
    // Logo "AT" icon is pink/orange gradient at top
    let logoAT = [];
    for (let y = 10; y < 80; y++) {
      for (let x = 100; x < 250; x++) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        if (r > 220 && g < 100 && b > 100) {
          logoAT.push({ x, y });
        }
      }
    }
    
    return {
      W, H,
      turnEffort: getBox(turnEffort),
      opportunities: getBox(opportunities),
      tathastu: getBox(tathastu),
      underline: getBox(underline),
      showcase: getBox(showcase),
      logoAT: getBox(logoAT)
    };
  });
  
  console.log('Original Text Metrics:', JSON.stringify(metrics, null, 2));
  await browser.close();
})();
