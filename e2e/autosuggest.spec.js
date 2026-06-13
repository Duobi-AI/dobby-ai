// e2e/autosuggest.spec.js — Real-browser contenteditable autosuggest behavior
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { launchExtension } = require('./helpers');

let context, page, serviceWorker;

test.beforeAll(async () => {
  ({ context, page } = await launchExtension());
  serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({ autosuggestEnabled: true });
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('dobby-ai-proxy') || url.includes('api.openai.com')) {
        return new Response(
          'data: {"choices":[{"delta":{"content":" from Dobby"}}]}\n\ndata: [DONE]\n\n',
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        );
      }
      return originalFetch(input, init);
    };
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await context?.close();
});

test('contenteditable shows and accepts an autosuggestion', async () => {
  await page.evaluate(() => {
    const editor = document.createElement('div');
    editor.id = 'autosuggest-rich-editor';
    editor.setAttribute('contenteditable', 'true');
    editor.setAttribute('aria-label', 'Message');
    editor.style.cssText = [
      'width: 560px',
      'min-height: 96px',
      'margin: 80px auto',
      'padding: 16px',
      'border: 1px solid #777',
      'border-radius: 8px',
      'font: 16px/24px Arial, sans-serif',
      'background: white',
      'color: black',
    ].join(';');
    document.body.appendChild(editor);
  });

  const editor = page.locator('#autosuggest-rich-editor');
  await editor.click();
  await editor.pressSequentially('Please send the project update', { delay: 20 });

  const ghostHost = page.locator('[data-dobby-autosuggest]');
  await expect(ghostHost).toBeVisible({ timeout: 5000 });
  await expect(ghostHost.locator('.ghost-text')).toHaveText(' from Dobby');

  await page.screenshot({
    path: path.resolve('output/playwright/autosuggest-contenteditable-ghost.png'),
    fullPage: true,
  });

  await editor.press('Tab');
  await expect(editor).toHaveText('Please send the project update from Dobby');
  await expect(ghostHost).toHaveCount(0);
});
