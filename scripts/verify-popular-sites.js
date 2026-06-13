#!/usr/bin/env node

const path = require('node:path');
const readline = require('node:readline');
const { chromium } = require('playwright');

const mode = process.argv[2] || 'login';
const site = process.argv[3] || 'all';
const root = path.resolve(__dirname, '..');
const extensionPath = path.join(root, 'dist');
const profilePath = path.join(root, '.playwright-auth', 'popular-sites');
const testText = 'Dobby autosuggest real site verification';

if (!['login', 'verify'].includes(mode) || !['all', 'linkedin', 'github'].includes(site)) {
  console.error('Usage: node scripts/verify-popular-sites.js [login|verify] [all|linkedin|github]');
  process.exit(1);
}

async function enableAutosuggest(context) {
  let serviceWorker = context.serviceWorkers().find((worker) => worker.url().startsWith('chrome-extension://'));
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {
      predicate: (worker) => worker.url().startsWith('chrome-extension://'),
      timeout: 10000,
    });
  }
  const extensionId = new URL(serviceWorker.url()).host;
  const popup = await context.newPage();
  try {
    await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
    const toggle = popup.locator('#autosuggest-enabled');
    await toggle.waitFor({ state: 'attached', timeout: 10000 });
    if (!await toggle.isChecked()) await toggle.click({ force: true });
  } finally {
    await popup.close();
  }
}

async function clearDraft(locator) {
  await locator.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await locator.press('Backspace');
}

async function verifyEditor(page, name, locator) {
  let draftStarted = false;
  try {
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    await locator.click();
    await locator.type(testText, { delay: 30 });
    draftStarted = true;

    const ghostHost = page.locator('[data-dobby-autosuggest]');
    await ghostHost.waitFor({ state: 'visible', timeout: 15000 });
    const suggestion = await ghostHost.locator('.ghost-text').textContent();
    await locator.press('Tab');
    await clearDraft(locator);
    return { site: name, passed: true, suggestion };
  } catch (error) {
    if (draftStarted) {
      try {
        await clearDraft(locator);
      } catch (cleanupError) {
        return {
          site: name,
          passed: false,
          error: `${error.message.split('\n')[0]}; draft cleanup failed: ${cleanupError.message.split('\n')[0]}`,
        };
      }
    }
    return { site: name, passed: false, error: error.message.split('\n')[0] };
  }
}

async function waitForUser() {
  console.log('\nLog into LinkedIn and GitHub in the opened browser.');
  console.log('Press Enter here when finished. The browser profile will be saved for future verification.\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question('', resolve));
  rl.close();
}

async function main() {
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  try {
    await enableAutosuggest(context);
    const linkedin = site === 'all' || site === 'linkedin'
      ? context.pages()[0] || await context.newPage()
      : null;
    if (linkedin) await linkedin.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
    const github = site === 'all' || site === 'github' ? await context.newPage() : null;
    if (github) await github.goto('https://github.com/Duobi-AI/dobby-ai/issues/new', { waitUntil: 'domcontentloaded' });

    if (mode === 'login') {
      await waitForUser();
      return;
    }

    const results = [];
    if (linkedin) {
      results.push(await verifyEditor(
        linkedin,
        'LinkedIn messaging',
        linkedin.getByRole('textbox', { name: 'Write a message…', exact: true }),
      ));
    }
    if (github) {
      results.push(await verifyEditor(
        github,
        'GitHub issue description',
        github.getByRole('textbox', { name: 'Markdown value', exact: true }),
      ));
    }

    console.table(results);
    if (results.some((result) => !result.passed)) process.exitCode = 1;
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
