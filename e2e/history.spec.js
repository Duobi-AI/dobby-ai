// e2e/history.spec.js — Chat history panel UI
const { test, expect } = require('@playwright/test');
const { launchExtension, selectText, waitForToolbar, openBubbleViaToolbar, waitForBubble, clickInShadow, getTextInShadow, countInShadow, isVisibleInShadow } = require('./helpers');

let context, extensionId, page;

test.beforeAll(async () => {
  ({ context, extensionId, page } = await launchExtension());
});

test.afterAll(async () => {
  await context?.close();
});

test.beforeEach(async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
});

async function setHistory(entries) {
  const serviceWorker = context.serviceWorkers()[0];
  await serviceWorker.evaluate((chatHistory) => chrome.storage.local.set({ chatHistory }), entries);
}

async function openActiveConversation() {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);
  await waitForBubble(page);
}

test('one footer control opens History and returns to the conversation', async () => {
  await openActiveConversation();
  const historyControl = page.locator('#dobby-ai-bubble').locator('.history-btn');

  await expect(historyControl).toHaveCount(1);
  await expect(historyControl).toHaveText('History');
  await expect(historyControl).toHaveAttribute('aria-label', 'Open history');
  await expect(historyControl).toHaveAttribute('title', 'History');

  // Click history button
  await clickInShadow(page, '.history-btn');
  await page.waitForTimeout(500);

  // History panel should show (either entries or "No history yet")
  const bodyText = await getTextInShadow(page, '.bubble-body');
  expect(bodyText).toBeTruthy();
  await expect(historyControl).toHaveCount(1);
  await expect(historyControl).toContainText('Back to conversation');
  await expect(historyControl).toHaveAttribute('aria-label', 'Return to current conversation');
  await expect(page.locator('#dobby-ai-bubble').locator('.history-back-btn')).toHaveCount(0);

  await clickInShadow(page, '.history-btn');
  await expect(page.locator('#dobby-ai-bubble').locator('.history-panel')).toHaveCount(0);
  await expect(historyControl).toHaveText('History');
});

test('the same footer control returns after restoring a history entry', async () => {
  await setHistory([{
    id: 'saved-entry',
    text: 'archived prompt',
    instruction: 'archived instruction',
    response: 'archived answer',
    pageTitle: 'Saved Page',
    timestamp: Date.now(),
  }]);
  await openActiveConversation();
  const historyControl = page.locator('#dobby-ai-bubble').locator('.history-btn');
  await clickInShadow(page, '.history-btn');
  await page.locator('#dobby-ai-bubble').locator('.history-entry').click();

  await expect(page.locator('#dobby-ai-bubble').locator('.response-text')).toContainText('archived answer');
  await expect(historyControl).toContainText('Back to conversation');
  await expect(historyControl).toHaveAttribute('aria-label', 'Return to current conversation');
  await expect(page.locator('#dobby-ai-bubble').locator('.history-back-btn')).toHaveCount(0);
  await clickInShadow(page, '.history-btn');

  await expect(page.locator('#dobby-ai-bubble').locator('.history-panel')).toHaveCount(0);
  await expect(page.locator('#dobby-ai-bubble').locator('.selected-text-preview')).toContainText('History test selection text');
});

test('popup history message reuses an active bubble', async () => {
  await setHistory([]);
  await openActiveConversation();
  await page.locator('#dobby-ai-bubble').evaluate((host) => { host.dataset.sessionMarker = 'active-chat'; });

  const serviceWorker = context.serviceWorkers()[0];
  await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_HISTORY' });
  });

  await expect(page.locator('#dobby-ai-bubble').locator('.history-panel')).toBeVisible();
  await expect(page.locator('#dobby-ai-bubble')).toHaveAttribute('data-session-marker', 'active-chat');
  await expect(page.locator('#dobby-ai-bubble').locator('.history-btn')).toContainText('Back to conversation');
  await clickInShadow(page, '.history-btn');
  await expect(page.locator('#dobby-ai-bubble').locator('.selected-text-preview')).toContainText('History test selection text');
});

test('clear history shows empty state', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);

  await clickInShadow(page, '.history-btn');
  await page.waitForTimeout(500);

  const clearVisible = await isVisibleInShadow(page, '.clear-link');
  if (clearVisible) {
    await clickInShadow(page, '.clear-link');
    await page.waitForTimeout(500);

    const bodyText = await getTextInShadow(page, '.bubble-body');
    expect(bodyText).toMatch(/cleared|No history/i);
  }
});
