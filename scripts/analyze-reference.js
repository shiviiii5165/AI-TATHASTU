const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  await page.goto('file:///' + 'C:/Users/Lenovo/.gemini/antigravity-ide/brain/913409ef-8267-43ec-a6e0-26195f953355/.tempmediaStorage/media_1793039234323.jpg');
  
  const laptopMetrics = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const img = document.querySelector('img');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // The laptop screen has an avatar or white screen background
    // In John McCarthy's card or the laptop bezel (black/dark gray)
    // The top edge of laptop lid:
    // Scan vertical slice at x = 250 from y = 150 to 350 to find the top edge of the laptop lid
    let topLidY = -1;
    for (let y = 180; y < 350; y++) {
      const p = ctx.getImageData(250, y, 1, 1).data;
      // Laptop bezel is dark
      if (p[0] < 50 && p[1] < 50 && p[2] < 50) {
        topLidY = y;
        break;
      }
    }
    
    // Let's also check the card position on the right panel
    // Auth card has background #FFFFFF while the page background is ~#FAFAFD or slightly off-white, or check the card border
    let cardBounds = {};
    for (let y = 100; y < 450; y += 10) {
      for (let x = 600; x < 980; x += 5) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        // Check if card has a distinct shadow or border
      }
    }
    
    // Find the right panel card by scanning for the Google button or "Welcome to AI Tathastu"
    // "Welcome to AI Tathastu" is dark navy around x: 650-800, y: 120-160
    let welcomePixels = [];
    for (let y = 120; y < 170; y++) {
      for (let x = 650; x < 900; x++) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        if (p[0] < 30 && p[1] < 30 && p[2] < 50) {
          welcomePixels.push({ x, y });
        }
      }
    }
    
    // Google button G icon has red, yellow, green, blue
    let googleBtnPixels = [];
    for (let y = 180; y < 240; y++) {
      for (let x = 700; x < 750; x++) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        if (p[0] > 200 && p[1] < 80 && p[2] < 80) { // Google Red
          googleBtnPixels.push({ x, y });
        }
      }
    }
    
    return {
      topLidY,
      topLidPct: (topLidY / 576) * 100,
      welcomeTextMinX: welcomePixels.length ? Math.min(...welcomePixels.map(p => p.x)) : -1,
      welcomeTextMinY: welcomePixels.length ? Math.min(...welcomePixels.map(p => p.y)) : -1,
      googleBtnY: googleBtnPixels.length ? Math.min(...googleBtnPixels.map(p => p.y)) : -1
    };
  });
  
  console.log('Laptop & Card metrics:', laptopMetrics);
  await browser.close();
})();
