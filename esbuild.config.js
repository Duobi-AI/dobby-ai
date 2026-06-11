const esbuild = require('esbuild');
const fs = require('fs');

const DIST = 'dist';
const isWatch = process.argv.includes('--watch');

function copyStaticAssets() {
  fs.copyFileSync('popup.html', `${DIST}/popup.html`);
  fs.copyFileSync('options.html', `${DIST}/options.html`);

  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  manifest.content_scripts[0].js = ['content.js'];
  manifest.background.service_worker = 'background.js';
  fs.writeFileSync(`${DIST}/manifest.json`, JSON.stringify(manifest, null, 2));

  if (fs.existsSync('icons')) {
    fs.cpSync('icons', `${DIST}/icons`, { recursive: true });
  }
}

const sharedConfig = {
  bundle: true,
  format: 'iife',
  target: 'chrome115',
  minify: false,
  tsconfig: 'tsconfig.build.json',
};

async function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  if (isWatch) {
    const contexts = await Promise.all([
      esbuild.context({ ...sharedConfig, entryPoints: ['src/content/index.ts'], outfile: `${DIST}/content.js` }),
      esbuild.context({ ...sharedConfig, entryPoints: ['src/background/index.ts'], outfile: `${DIST}/background.js` }),
      esbuild.context({ ...sharedConfig, entryPoints: ['src/popup.ts', 'src/options.ts'], outdir: DIST }),
    ]);
    copyStaticAssets();
    await Promise.all(contexts.map(ctx => ctx.watch()));
    console.log('Watching for changes...');
  } else {
    await esbuild.build({ ...sharedConfig, entryPoints: ['src/content/index.ts'], outfile: `${DIST}/content.js` });
    await esbuild.build({ ...sharedConfig, entryPoints: ['src/background/index.ts'], outfile: `${DIST}/background.js` });
    await esbuild.build({ ...sharedConfig, entryPoints: ['src/popup.ts', 'src/options.ts'], outdir: DIST });
    copyStaticAssets();
    console.log('Build complete → dist/');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
