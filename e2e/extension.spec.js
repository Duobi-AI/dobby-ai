// e2e/extension.spec.js — Extension loads and basic functionality
const { test, expect } = require('@playwright/test');
const { launchExtension, selectText, waitForToolbar } = require('./helpers');

let context, extensionId, page;

test.beforeAll(async () => {
  ({ context, extensionId, page } = await launchExtension());
});

test.afterAll(async () => {
  await context?.close();
});

test('content script injects on page load', async () => {
  await selectText(page, 'h1');

  await waitForToolbar(page);
  const toolbar = page.locator('#dobby-ai-toolbar-host');
  await expect(toolbar).toBeVisible({ timeout: 3000 });
});

test('toolbar hides when selection is cleared', async () => {
  await selectText(page, 'h1');
  const toolbar = page.locator('#dobby-ai-toolbar-host');
  await expect(toolbar).toBeVisible({ timeout: 3000 });

  await page.click('body', { position: { x: 10, y: 10 } });
  await page.waitForTimeout(300);
  await expect(toolbar).not.toBeVisible();
});

test('popup page loads and toggle works', async () => {
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await popupPage.waitForLoadState('domcontentloaded');
  await popupPage.waitForTimeout(500);

  // The checkbox is visually hidden (opacity:0) — use the label to toggle
  const toggleLabel = popupPage.locator('label.toggle').first();
  await expect(toggleLabel).toBeVisible({ timeout: 5000 });

  // Click to toggle off
  await toggleLabel.click();
  const status = popupPage.locator('#status');
  await expect(status).toHaveText('Off');

  // Click to toggle back on (toggleLabel already references .first())
  await toggleLabel.click();
  await expect(status).toHaveText('On');

  await popupPage.close();
});
