const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  
  await page.goto('file:///' + path.join(__dirname, 'ref-exact.png').replace(/\\/g, '/'));
  
  const comparison = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    const img = document.querySelector('img');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Load login-workspace.jpg
    const origImg = new Image();
    origImg.src = 'http://localhost:3000/brand/login-workspace.jpg';
    await new Promise(r => origImg.onload = r);
    
    const origCanvas = document.createElement('canvas');
    origCanvas.width = origImg.naturalWidth;
    origCanvas.height = origImg.naturalHeight;
    const origCtx = origCanvas.getContext('2d');
    origCtx.drawImage(origImg, 0, 0);
    
    // Compare dimensions
    // Left panel in ref is 578 x 576
    // origImg is 578 x 576
    let diffCount = 0;
    for (let y = 0; y < 576; y += 5) {
      for (let x = 0; x < 578; x += 5) {
        const p1 = ctx.getImageData(x, y, 1, 1).data;
        const p2 = origCtx.getImageData(x, y, 1, 1).data;
        const diff = Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1]) + Math.abs(p1[2] - p2[2]);
        if (diff > 15) diffCount++;
      }
    }
    return {
      refW: canvas.width, refH: canvas.height,
      origW: origCanvas.width, origH: origCanvas.height,
      diffCount
    };
  });

  console.log('Comparison result:', comparison);
  await browser.close();
})();
