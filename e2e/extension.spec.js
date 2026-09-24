// e2e/extension.spec.js — Extension loads and basic functionality
const { test, expect } = require('@playwright/test');
const { launchExtension, selectText, waitForToolbar, hoverToolbar } = require('./helpers');

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

test('toolbar input isolates typing from page shortcuts', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await hoverToolbar(page);

  await page.evaluate(() => {
    window.__dobbyShortcutCount = 0;
    window.__dobbyShortcutHandler = (event) => {
      if (event.key === 's') window.__dobbyShortcutCount += 1;
    };
    document.addEventListener('keydown', window.__dobbyShortcutHandler);

    const host = document.getElementById('dobby-ai-toolbar-host');
    host.shadowRoot.querySelector('.toolbar-pencil').click();
  });

  const input = page.locator('#dobby-ai-toolbar-host').locator('.toolbar-input-field');
  await input.press('s');

  await expect(input).toHaveValue('s');
  expect(await page.evaluate(() => window.__dobbyShortcutCount)).toBe(0);

  await page.evaluate(() => {
    document.removeEventListener('keydown', window.__dobbyShortcutHandler);
    delete window.__dobbyShortcutHandler;
    delete window.__dobbyShortcutCount;
  });
});

test('popup page loads and toggle works', async () => {
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await popupPage.waitForLoadState('domcontentloaded');
  await popupPage.waitForTimeout(500);

  await popupPage.evaluate(() => chrome.storage.local.set({
    dobbyEnabled: false,
    screenshotEnabled: true,
    autosuggestEnabled: true,
    theme: 'dark',
  }));
  await popupPage.reload();

  // The checkbox is visually hidden (opacity:0) — use the label to toggle
  const toggleLabel = popupPage.locator('label.toggle').first();
  await expect(toggleLabel).toBeVisible({ timeout: 5000 });
  const screenshotToggle = popupPage.locator('#screenshot-enabled');
  const autosuggestToggle = popupPage.locator('#autosuggest-enabled');
  await expect(popupPage.locator('#enabled')).not.toBeChecked();
  await expect(screenshotToggle).toBeChecked();
  await expect(autosuggestToggle).toBeChecked();
  await expect(screenshotToggle).toBeDisabled();
  await expect(autosuggestToggle).toBeDisabled();
  await expect(popupPage.locator('.feature-paused-note')).toHaveCount(0);
  await expect(popupPage.locator('.state-badge')).toHaveCount(0);

  // Turning the master back on re-enables the saved child preferences.
  await toggleLabel.click();
  await expect(popupPage.locator('#enabled')).toBeChecked();
  await expect(screenshotToggle).toBeChecked();
  await expect(autosuggestToggle).toBeChecked();
  await expect(screenshotToggle).toBeEnabled();
  await expect(autosuggestToggle).toBeEnabled();

  // Turning it off again preserves the same child choices.
  await toggleLabel.click();
  await expect(popupPage.locator('#enabled')).not.toBeChecked();
  await expect(screenshotToggle).toBeChecked();
  await expect(autosuggestToggle).toBeChecked();

  await popupPage.close();
});

test('popup links to the guided bug report form', async () => {
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

  const reportBug = popupPage.locator('#report-bug');
  await expect(reportBug).toBeVisible();
  await expect(reportBug).toHaveAttribute(
    'href',
    'https://github.com/Duobi-AI/dobby-ai/issues/new?template=bug_report.yml',
  );
  await expect(reportBug).toHaveAttribute('target', '_blank');
  await expect(reportBug).toHaveAttribute('rel', 'noopener noreferrer');

  await popupPage.close();
});
