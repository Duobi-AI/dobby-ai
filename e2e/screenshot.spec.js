// e2e/screenshot.spec.js — Long-press → screenshot overlay → capture flow
const { test, expect } = require('@playwright/test');
const { launchExtension, waitForBubble } = require('./helpers');

let context, extensionId, page;

test.beforeAll(async () => {
  ({ context, extensionId, page } = await launchExtension());
});

test.afterAll(async () => {
  await context?.close();
});

test.beforeEach(async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
});

test('long-press shows progress ring then screenshot overlay', async () => {
  // Long-press in empty area (avoid interactive elements)
  await page.mouse.move(400, 400);
  await page.mouse.down();

  // Progress ring should appear after 500ms
  await page.waitForTimeout(600);
  const ring = page.locator('[data-dobby-progress-ring]');
  await expect(ring).toBeVisible();

  // Hold until long-press completes (1000ms total)
  await page.waitForTimeout(500);

  // Screenshot overlay should appear
  const overlay = page.locator('div[style*="crosshair"]');
  await expect(overlay).toBeVisible({ timeout: 3000 });

  // Progress ring should be removed
  await expect(ring).not.toBeVisible();

  // Cancel for cleanup
  await page.keyboard.press('Escape');
});

test('drag selection shows toolbar with Capture/Reselect/Cancel', async () => {
  // Trigger screenshot mode via long-press
  await page.mouse.move(400, 400);
  await page.mouse.down();
  await page.waitForTimeout(1100);
  await page.mouse.up();

  const overlay = page.locator('div[style*="crosshair"]');
  await expect(overlay).toBeVisible({ timeout: 3000 });

  // Drag to select a region
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(500, 400, { steps: 5 });
  await page.mouse.up();

  // Toolbar should appear
  const toolbar = page.locator('[data-screenshot-toolbar]');
  await expect(toolbar).toBeVisible({ timeout: 3000 });
  await expect(toolbar).toContainText('Capture');
  await expect(toolbar).toContainText('Reselect');
  await expect(toolbar).toContainText('Cancel');

  // Cancel for cleanup
  await page.keyboard.press('Escape');
});

test('Cancel button dismisses screenshot overlay', async () => {
  await page.mouse.move(400, 400);
  await page.mouse.down();
  await page.waitForTimeout(1100);
  await page.mouse.up();

  const overlay = page.locator('div[style*="crosshair"]');
  await expect(overlay).toBeVisible({ timeout: 3000 });

  // Drag to get toolbar
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(500, 400, { steps: 5 });
  await page.mouse.up();

  // Click Cancel
  const cancelBtn = page.locator('[data-screenshot-toolbar] button:has-text("Cancel")');
  await cancelBtn.click();

  await expect(overlay).not.toBeVisible();
});

test('ESC key dismisses screenshot overlay', async () => {
  await page.mouse.move(400, 400);
  await page.mouse.down();
  await page.waitForTimeout(1100);
  await page.mouse.up();

  const overlay = page.locator('div[style*="crosshair"]');
  await expect(overlay).toBeVisible({ timeout: 3000 });

  await page.keyboard.press('Escape');
  await expect(overlay).not.toBeVisible();
});

test('right-click dismisses screenshot overlay', async () => {
  await page.mouse.move(400, 400);
  await page.mouse.down();
  await page.waitForTimeout(1100);
  await page.mouse.up();

  const overlay = page.locator('div[style*="crosshair"]');
  await expect(overlay).toBeVisible({ timeout: 3000 });

  await page.mouse.click(400, 400, { button: 'right' });
  await expect(overlay).not.toBeVisible();
});

test('mouse movement cancels long-press', async () => {
  await page.mouse.move(400, 400);
  await page.mouse.down();
  await page.waitForTimeout(300);

  // Move more than 5px threshold
  await page.mouse.move(420, 420);
  await page.waitForTimeout(800);
  await page.mouse.up();

  // Overlay should NOT appear
  const overlay = page.locator('div[style*="crosshair"]');
  await expect(overlay).not.toBeVisible();
});

test('Reselect button allows new drag', async () => {
  await page.mouse.move(400, 400);
  await page.mouse.down();
  await page.waitForTimeout(1100);
  await page.mouse.up();

  const overlay = page.locator('div[style*="crosshair"]');
  await expect(overlay).toBeVisible({ timeout: 3000 });

  // First drag
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(500, 400, { steps: 5 });
  await page.mouse.up();

  // Click Reselect
  const reselectBtn = page.locator('[data-screenshot-toolbar] button:has-text("Reselect")');
  await reselectBtn.click();

  // Toolbar should be gone but overlay still visible
  await expect(page.locator('[data-screenshot-toolbar]')).not.toBeVisible();
  await expect(overlay).toBeVisible();

  // Cleanup
  await page.keyboard.press('Escape');
});
