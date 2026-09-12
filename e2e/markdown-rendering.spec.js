// e2e/markdown-rendering.spec.js — Streamed Markdown renders as structured bubble content
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const {
  launchExtension,
  selectText,
  waitForToolbar,
  openBubbleViaToolbar,
} = require('./helpers');

let context, page;

test.beforeAll(async () => {
  ({ context, page } = await launchExtension());
  const serviceWorker = context.serviceWorkers()[0] ||
    await context.waitForEvent('serviceworker');

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      userApiKey: 'sk-test-markdown-rendering',
      theme: 'light',
    });
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('api.openai.com')) {
        const content = [
          '当然，可以举例说明这三个概念：',
          '',
          '### 1) Label（标签）',
          'Label 是附加在 metric 上的键值对。',
          '',
          '---',
          '',
          '### 2) Metric（指标）',
          'Metric 是一个有名字的测量值。',
        ].join('\n');
        const chunk = JSON.stringify({ choices: [{ delta: { content } }] });
        return new Response(`data: ${chunk}\n\ndata: [DONE]\n\n`, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
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

test('renders headings and thematic breaks in a completed chat response', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);

  const bubble = page.locator('#dobby-ai-bubble');
  const message = bubble.locator('.message-content');
  await expect(message.locator('h3')).toHaveCount(2);
  await expect(message.locator('h3').first()).toHaveText('1) Label（标签）');
  await expect(message.locator('hr')).toHaveCount(1);
  await expect(message).not.toContainText('###');
  await expect(message).not.toContainText('---');

  await bubble.screenshot({
    path: path.resolve('output/playwright/markdown-rendering-light.png'),
  });

  const serviceWorker = context.serviceWorkers()[0];
  await serviceWorker.evaluate(() => chrome.storage.local.set({ theme: 'dark' }));
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);

  const darkBubble = page.locator('#dobby-ai-bubble');
  const darkMessage = darkBubble.locator('.message-content');
  await expect(darkMessage.locator('h3')).toHaveCount(2);
  await expect(darkMessage.locator('hr')).toHaveCount(1);
  await darkBubble.screenshot({
    path: path.resolve('output/playwright/markdown-rendering-dark.png'),
  });
});
