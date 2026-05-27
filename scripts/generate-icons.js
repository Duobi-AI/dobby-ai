// scripts/generate-icons.js - Generate extension icons from the approved Dobby AI PNG mark
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const logoPath = path.resolve('icons/dobby-logo-source.png');
const logoDataUri = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;

async function renderPng(size, outPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(`
    <!doctype html>
    <html>
      <body style="margin:0;background:transparent;width:${size}px;height:${size}px">
        <img src="${logoDataUri}" width="${size}" height="${size}" style="display:block">
      </body>
    </html>
  `);
  await page.screenshot({ path: outPath, omitBackground: true });
  await browser.close();
  console.log(`Created ${path.relative(process.cwd(), outPath)}`);
}

(async () => {
  await renderPng(16, path.resolve('icons/icon16.png'));
  await renderPng(48, path.resolve('icons/icon48.png'));
  await renderPng(128, path.resolve('icons/icon128.png'));
  await renderPng(128, path.resolve('icons/store-icon-128.png'));
  await renderPng(128, path.resolve('icons/store-icon.png'));
  await renderPng(128, path.resolve('docs/images/store-icon.png'));

  const brandLogoDataUri = fs.readFileSync(path.resolve('icons/store-icon.png')).toString('base64');
  fs.writeFileSync(
    path.resolve('src/shared/brand.js'),
    `export const BRAND_NAME = 'Dobby AI';\n\nexport const BRAND_LOGO_DATA_URI = 'data:image/png;base64,${brandLogoDataUri}';\n`
  );
  console.log('Updated src/shared/brand.js');
})();
