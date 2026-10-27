const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 578, height: 576 } });
  
  await page.goto('http://localhost:3000/brand/login-workspace.jpg');
  
  const base64Data = await page.evaluate(async () => {
    const img = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    const W = canvas.width;
    const H = canvas.height;
    
    // We want the wall area above the window to be a silky smooth gradient.
    // In login-workspace.jpg:
    // Window starts at y = 265 and x = 230
    // To the right and above window (x: 235 to 577, y: 75 to 265) is wall.
    // And logo area (x: 160 to 320, y: 10 to 65) is wall.
    // Notice: at x = 575 (right edge), the wall color is:
    // y = 10: [255, 252, 248]
    // y = 100: [255, 248, 240]
    // y = 200: [253, 242, 232]
    // y = 265: [252, 238, 226]
    
    // Create an offscreen canvas to paint a smooth wall gradient matching the natural sunlight
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = W;
    wallCanvas.height = H;
    const wallCtx = wallCanvas.getContext('2d');
    wallCtx.drawImage(canvas, 0, 0);
    
    // 1. Logo area: from x: 168 to 320, y: 12 to 60.
    // Clean wall is around it. We can clone/blend the clean wall from x: 320..380 or sample gradient
    const gradLogo = ctx.createLinearGradient(168, 30, 320, 30);
    gradLogo.addColorStop(0, '#F5EDE4');
    gradLogo.addColorStop(0.5, '#F9F2EB');
    gradLogo.addColorStop(1, '#FCF7F0');
    
    ctx.fillStyle = gradLogo;
    ctx.beginPath();
    ctx.ellipse(244, 34, 76, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Headline & text area: x: 260 to 576, y: 75 to 264
    // Smooth vertical linear gradient matching the wall's natural lighting:
    // Top-right has sunlight coming from window.
    const gradWall = ctx.createLinearGradient(260, 75, 576, 265);
    gradWall.addColorStop(0, '#FAF3EB');
    gradWall.addColorStop(0.3, '#FAF1E8');
    gradWall.addColorStop(0.7, '#F7ECE0');
    gradWall.addColorStop(1, '#F3E5D6');
    
    // Save state, clip to the wall polygon above window, and fill smoothly with soft edges
    ctx.save();
    ctx.beginPath();
    // Polygon covering the text on wall above window without touching window frame or plants:
    // Left edge starts to right of plant shelf (x: 260, y: 75)
    // Down to window top frame (x: 260, y: 262)
    // Follows top window frame to x: 576, y: 262
    // Up to top right at x: 576, y: 75
    // Close path
    ctx.moveTo(260, 75);
    ctx.lineTo(576, 75);
    ctx.lineTo(576, 262);
    ctx.lineTo(260, 262);
    ctx.closePath();
    
    ctx.fillStyle = gradWall;
    ctx.fill();
    ctx.restore();
    
    // Now feather/blur edges using a subtle multi-pass box blur on just the boundary:
    const id = ctx.getImageData(0, 0, W, H);
    // Add very subtle photographic grain (noise: +/- 1.5) so it matches the surrounding photo grain perfectly!
    for (let y = 75; y <= 262; y++) {
      for (let x = 260; x <= 576; x++) {
        const idx = (y * W + x) * 4;
        const noise = (Math.random() - 0.5) * 3;
        id.data[idx] = Math.min(255, Math.max(0, id.data[idx] + noise));
        id.data[idx+1] = Math.min(255, Math.max(0, id.data[idx+1] + noise));
        id.data[idx+2] = Math.min(255, Math.max(0, id.data[idx+2] + noise));
      }
    }
    
    ctx.putImageData(id, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.98);
  });
  
  const base64Image = base64Data.replace(/^data:image\/jpeg;base64,/, '');
  fs.writeFileSync(path.join(__dirname, '../public/brand/login-workspace-clean.jpg'), Buffer.from(base64Image, 'base64'));
  console.log('Saved seamless login-workspace-clean.jpg');
  await browser.close();
})();
