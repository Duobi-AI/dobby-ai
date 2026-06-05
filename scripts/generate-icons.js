// scripts/generate-icons.js - Generate extension icons from the approved Dobby AI PNG mark
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const logoPath = path.resolve('icons/dobby-logo-source.png');
const logoDataUri = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;

function pngDataUri(filePath) {
  return `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function svgDataUri(filePath) {
  return `data:image/svg+xml;base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function writeEmbeddedPngSvg({ sourcePath, outPath, title, description, width, height }) {
  const sourceDataUri = pngDataUri(sourcePath);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <title id="title">${title}</title>
  <desc id="desc">${description}</desc>
  <image href="${sourceDataUri}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;
  fs.writeFileSync(outPath, svg);
  console.log(`Created ${path.relative(process.cwd(), outPath)}`);
}

async function renderPng(size, outPath, imageDataUri = logoDataUri) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(`
    <!doctype html>
    <html>
      <body style="margin:0;background:transparent;width:${size}px;height:${size}px">
        <img src="${imageDataUri}" width="${size}" height="${size}" style="display:block">
      </body>
    </html>
  `);
  await page.screenshot({ path: outPath, omitBackground: true });
  await browser.close();
  console.log(`Created ${path.relative(process.cwd(), outPath)}`);
}

async function renderTransparentMark(outPath, size = 128) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const base64 = await page.evaluate(async ({ logoDataUri, size }) => {
    const source = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = logoDataUri;
    });

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = source.naturalWidth;
    sourceCanvas.height = source.naturalHeight;
    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    sourceCtx.drawImage(source, 0, 0);

    const { width, height } = sourceCanvas;
    const imageData = sourceCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const pixels = width * height;
    const visited = new Uint8Array(pixels);

    const isMuzzleRegion = (index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      const dx = (x - width * 0.5) / (width * 0.2);
      const dy = (y - height * 0.66) / (height * 0.14);
      return dx * dx + dy * dy <= 1 && y > height * 0.5;
    };

    const isBackgroundCandidate = (index) => {
      // The white muzzle belongs to the dog, even though it connects visually to the white tile.
      if (isMuzzleRegion(index)) return false;
      const offset = index * 4;
      const alpha = data[offset + 3];
      if (alpha < 8) return true;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      return r > 230 && g > 230 && b > 225 && Math.max(r, g, b) - Math.min(r, g, b) < 22;
    };

    const removeComponent = (component) => {
      for (const index of component) {
        data[index * 4 + 3] = 0;
      }
    };

    for (let index = 0; index < pixels; index += 1) {
      if (visited[index] || !isBackgroundCandidate(index)) continue;

      const stack = [index];
      const component = [];
      visited[index] = 1;
      let touchesEdge = false;

      while (stack.length > 0) {
        const current = stack.pop();
        component.push(current);
        const x = current % width;
        const y = Math.floor(current / width);
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          touchesEdge = true;
        }

        const neighbors = [];
        if (x > 0) neighbors.push(current - 1);
        if (x < width - 1) neighbors.push(current + 1);
        if (y > 0) neighbors.push(current - width);
        if (y < height - 1) neighbors.push(current + width);

        for (const next of neighbors) {
          if (!visited[next] && isBackgroundCandidate(next)) {
            visited[next] = 1;
            stack.push(next);
          }
        }
      }

      if (touchesEdge || component.length > pixels * 0.12) {
        removeComponent(component);
      }
    }

    sourceCtx.putImageData(imageData, 0, 0);

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 8) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = size;
    outputCanvas.height = size;
    const outputCtx = outputCanvas.getContext('2d');
    outputCtx.clearRect(0, 0, size, size);

    if (maxX >= minX && maxY >= minY) {
      const cropWidth = maxX - minX + 1;
      const cropHeight = maxY - minY + 1;
      const padding = Math.round(size * 0.08);
      const scale = Math.min((size - padding * 2) / cropWidth, (size - padding * 2) / cropHeight);
      const drawWidth = cropWidth * scale;
      const drawHeight = cropHeight * scale;
      outputCtx.drawImage(
        sourceCanvas,
        minX,
        minY,
        cropWidth,
        cropHeight,
        (size - drawWidth) / 2,
        (size - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
    }

    return outputCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  }, { logoDataUri, size });

  fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
  await browser.close();
  console.log(`Created ${path.relative(process.cwd(), outPath)}`);
}

(async () => {
  const logoSvgPath = path.resolve('icons/dobby-logo.svg');
  const markSvgPath = path.resolve('icons/dobby-logo-mark.svg');
  const mark512Path = path.resolve('icons/dobby-logo-mark-512.png');

  writeEmbeddedPngSvg({
    sourcePath: logoPath,
    outPath: logoSvgPath,
    title: 'Dobby AI logo',
    description: 'Rounded square Dobby AI logo tile for app icons and brand placements.',
    width: 512,
    height: 512,
  });
  writeEmbeddedPngSvg({
    sourcePath: logoPath,
    outPath: path.resolve('docs/images/dobby-logo.svg'),
    title: 'Dobby AI logo',
    description: 'Rounded square Dobby AI logo tile for documentation and web placements.',
    width: 512,
    height: 512,
  });

  const logoSvgDataUri = svgDataUri(logoSvgPath);
  await renderPng(16, path.resolve('icons/icon16.png'), logoSvgDataUri);
  await renderPng(48, path.resolve('icons/icon48.png'), logoSvgDataUri);
  await renderPng(128, path.resolve('icons/icon128.png'), logoSvgDataUri);
  await renderPng(128, path.resolve('icons/store-icon-128.png'), logoSvgDataUri);
  await renderPng(128, path.resolve('icons/store-icon.png'), logoSvgDataUri);
  await renderPng(128, path.resolve('docs/images/store-icon.png'), logoSvgDataUri);
  await renderTransparentMark(path.resolve('icons/dobby-logo-mark.png'));
  await renderTransparentMark(mark512Path, 512);

  writeEmbeddedPngSvg({
    sourcePath: mark512Path,
    outPath: markSvgPath,
    title: 'Dobby AI mark',
    description: 'Transparent Dobby AI logo mark for UI surfaces and flexible brand placements.',
    width: 512,
    height: 512,
  });
  writeEmbeddedPngSvg({
    sourcePath: mark512Path,
    outPath: path.resolve('docs/images/dobby-logo-mark.svg'),
    title: 'Dobby AI mark',
    description: 'Transparent Dobby AI logo mark for documentation and web placements.',
    width: 512,
    height: 512,
  });

  const brandLogoDataUri = fs.readFileSync(path.resolve('icons/store-icon.png')).toString('base64');
  const brandMarkDataUri = fs.readFileSync(path.resolve('icons/dobby-logo-mark.png')).toString('base64');
  fs.writeFileSync(
    path.resolve('src/shared/brand.js'),
    `export const BRAND_NAME = 'Dobby AI';\n\nexport const BRAND_LOGO_DATA_URI = 'data:image/png;base64,${brandLogoDataUri}';\n\nexport const BRAND_MARK_DATA_URI = 'data:image/png;base64,${brandMarkDataUri}';\n`
  );
  console.log('Updated src/shared/brand.js');
})();
