// e2e/helpers.js — Shared E2E test utilities
const { chromium } = require('@playwright/test');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '..', 'dist');

/**
 * Launch Chrome with the extension loaded.
 * Returns { context, extensionId, page }.
 */
async function launchExtension() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  // Wait for service worker to register and extract extension ID
  const serviceWorker = context.serviceWorkers()[0] ||
    await context.waitForEvent('serviceworker');
  const extensionId = serviceWorker.url().split('/')[2];

  // Open a test page
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');

  return { context, extensionId, page };
}

/**
 * Select text on the page by triple-clicking a selector.
 */
async function selectText(page, selector) {
  await page.click(selector, { clickCount: 3 });
  // Wait for selection to register
  await page.waitForFunction(() => window.getSelection().toString().length > 0, { timeout: 3000 });
}

/**
 * Wait for the toolbar host to appear.
 */
async function waitForToolbar(page) {
  await page.waitForSelector('#dobby-ai-toolbar-host', { timeout: 5000 });
}

/**
 * Hover over the toolbar host to expand it.
 */
async function hoverToolbar(page) {
  const host = page.locator('#dobby-ai-toolbar-host');
  await host.hover();
  // Wait for expanded state
  await page.waitForFunction(() => {
    const h = document.getElementById('dobby-ai-toolbar-host');
    if (!h || !h.shadowRoot) return false;
    const toolbar = h.shadowRoot.querySelector('.toolbar');
    return toolbar && toolbar.classList.contains('expanded');
  }, { timeout: 3000 });
}

/**
 * Open the full bubble via toolbar: hover → click pencil → type prompt → Enter
 * Uses the inline custom prompt input to open the bubble.
 */
async function openBubbleViaToolbar(page) {
  await hoverToolbar(page);

  // Click the pencil button to enter input mode
  await page.evaluate(() => {
    const h = document.getElementById('dobby-ai-toolbar-host');
    if (!h || !h.shadowRoot) throw new Error('No toolbar host found');
    const pencilBtn = h.shadowRoot.querySelector('.toolbar-pencil');
    if (!pencilBtn) throw new Error('.toolbar-pencil not found in shadow DOM');
    pencilBtn.click();
  });

  // Wait for input mode
  await page.waitForFunction(() => {
    const h = document.getElementById('dobby-ai-toolbar-host');
    if (!h || !h.shadowRoot) return false;
    const inputSection = h.shadowRoot.querySelector('.toolbar-input-section');
    return inputSection && inputSection.classList.contains('visible');
  }, { timeout: 3000 });

  // Type a prompt and submit
  await page.evaluate(() => {
    const h = document.getElementById('dobby-ai-toolbar-host');
    if (!h || !h.shadowRoot) throw new Error('No toolbar host found');
    const inputField = h.shadowRoot.querySelector('.toolbar-input-field');
    if (!inputField) throw new Error('.toolbar-input-field not found');
    inputField.value = 'Explain this';
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    inputField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });

  // Wait for the full bubble to appear
  await page.waitForSelector('#dobby-ai-bubble', { timeout: 5000 });
}

/**
 * Click a preset action in the expanded toolbar by index.
 */
async function clickToolbarPreset(page, index) {
  await page.evaluate((idx) => {
    const h = document.getElementById('dobby-ai-toolbar-host');
    if (!h || !h.shadowRoot) throw new Error('No toolbar host found');
    const actions = h.shadowRoot.querySelectorAll('.toolbar-action');
    if (!actions[idx]) throw new Error(`Toolbar action at index ${idx} not found`);
    actions[idx].click();
  }, index);
}

/**
 * Wait for the bubble to appear.
 */
async function waitForBubble(page) {
  await page.waitForSelector('#dobby-ai-bubble', { timeout: 5000 });
}

/**
 * Wait for the bubble to show "thinking..." status (streaming started).
 */
async function waitForStreamingStarted(page) {
  // Wait for the response section to become active (presets hidden)
  await page.waitForFunction(() => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) return false;
    const responseSection = host.shadowRoot.querySelector('.response-section');
    return responseSection && responseSection.classList.contains('active');
  }, { timeout: 10000 });
}

/**
 * Click an element inside the bubble's shadow DOM.
 */
async function clickInShadow(page, selector) {
  await page.evaluate((sel) => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) throw new Error('No bubble found');
    const el = host.shadowRoot.querySelector(sel);
    if (!el) throw new Error(`Element ${sel} not found in shadow DOM`);
    // Dispatch mousedown first (some elements like preset chips use mousedown, not click)
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.click();
  }, selector);
}

/**
 * Get text content of an element inside the bubble's shadow DOM.
 */
async function getTextInShadow(page, selector) {
  return page.evaluate((sel) => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) return null;
    const el = host.shadowRoot.querySelector(sel);
    return el ? el.textContent : null;
  }, selector);
}

/**
 * Check if an element exists and is visible inside the bubble's shadow DOM.
 */
async function isVisibleInShadow(page, selector) {
  return page.evaluate((sel) => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) return false;
    const el = host.shadowRoot.querySelector(sel);
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }, selector);
}

/**
 * Count elements matching selector inside the bubble's shadow DOM.
 */
async function countInShadow(page, selector) {
  return page.evaluate((sel) => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) return 0;
    return host.shadowRoot.querySelectorAll(sel).length;
  }, selector);
}

module.exports = {
  launchExtension,
  selectText,
  waitForToolbar,
  hoverToolbar,
  openBubbleViaToolbar,
  clickToolbarPreset,
  waitForBubble,
  waitForStreamingStarted,
  clickInShadow,
  getTextInShadow,
  isVisibleInShadow,
  countInShadow,
};
