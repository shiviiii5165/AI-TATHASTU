const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 578, height: 576 } });
  
  await page.goto('http://localhost:3000/brand/login-workspace.jpg');
  
  const bufferBase64 = await page.evaluate(async () => {
    const img = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // The smooth cream wall is around x: 260 to 570, y: 70 to 260
    // And logo area is around x: 160 to 320, y: 15 to 65
    // Let's inspect the wall color around it:
    // At x = 400..570, y = 50..100, the wall is a smooth gradient from top to bottom
    // We can sample vertical gradients of the clean wall to cleanly remove the text
    return canvas.toDataURL('image/jpeg', 0.95);
  });
  
  console.log('Got base64 length:', bufferBase64.length);
  await browser.close();
})();
