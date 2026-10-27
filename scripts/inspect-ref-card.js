const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  await page.goto('file:///' + path.join(__dirname, 'ref-exact.png').replace(/\\/g, '/'));
  
  const textInfo = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const img = document.querySelector('img');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Scan card region (x: 630..980, y: 100..500)
    // Find text lines by looking for non-white pixels
    let lines = [];
    for (let y = 100; y < 500; y++) {
      let nonWhiteCount = 0;
      for (let x = 650; x < 960; x++) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        if (r < 240 || g < 240 || b < 240) {
          nonWhiteCount++;
        }
      }
      if (nonWhiteCount > 10) {
        lines.push({ y, count: nonWhiteCount });
      }
    }
    
    // Group into vertical blocks
    let blocks = [];
    let currentBlock = [];
    for (let i = 0; i < lines.length; i++) {
      if (currentBlock.length === 0 || lines[i].y - lines[i-1].y <= 3) {
        currentBlock.push(lines[i]);
      } else {
        blocks.push({
          minY: currentBlock[0].y,
          maxY: currentBlock[currentBlock.length - 1].y,
          height: currentBlock[currentBlock.length - 1].y - currentBlock[0].y + 1
        });
        currentBlock = [lines[i]];
      }
    }
    if (currentBlock.length) {
      blocks.push({
        minY: currentBlock[0].y,
        maxY: currentBlock[currentBlock.length - 1].y,
        height: currentBlock[currentBlock.length - 1].y - currentBlock[0].y + 1
      });
    }

    return { blocks };
  });
  
  console.log('Card blocks in reference image:', JSON.stringify(textInfo, null, 2));
  await browser.close();
})();
