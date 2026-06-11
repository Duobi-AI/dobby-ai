// src/content/trigger/screenshot.js — Screenshot overlay and region selection

import { screenshotState, resetScreenshotState, longPressState } from '../shared/state.js';
import { removeElement } from '../shared/dom-utils.js';
import { FONT_STACK, Z_INDEX } from '../shared/constants.js';
import { _removeProgressRing } from './progress-ring.js';
import { showBubbleWithPresets } from '../bubble/core.js';
import { captureScreenshot } from '../image-capture.js';
import { getColorPalette } from '../../shared/color-palette.js';
import type { CaptureRect, ScreenshotOverlay } from '../../shared/types';

const colors = getColorPalette('light');

export function startScreenshotMode(): void {
  if (longPressState.ringTimer) { clearTimeout(longPressState.ringTimer); longPressState.ringTimer = null; }
  _removeProgressRing();
  longPressState.timer = null;

  screenshotState.overlay = document.createElement('div');
  Object.assign(screenshotState.overlay!.style, {
    position: 'fixed',
    inset: '0',
    zIndex: String(Z_INDEX.SCREENSHOT_OVERLAY),
    background: colors.overlay,
    cursor: 'crosshair',
  });

  // Instruction banner at the top
  const banner = document.createElement('div');
  Object.assign(banner.style, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: colors.accentStrong,
    color: colors.white,
    padding: '10px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: FONT_STACK,
    fontWeight: '500',
    zIndex: String(Z_INDEX.TRIGGER),
    pointerEvents: 'none',
    boxShadow: '0 4px 16px ' + colors.shadowBanner,
    letterSpacing: '0.3px',
  });
  banner.textContent = 'Drag to select a region \u2022 ESC to cancel';
  screenshotState.overlay!.appendChild(banner);

  // Visual border around the viewport
  const border = document.createElement('div');
  Object.assign(border.style, {
    position: 'fixed',
    inset: '0',
    border: '2px solid ' + colors.accentBorder,
    pointerEvents: 'none',
    zIndex: String(Z_INDEX.TRIGGER),
  });
  screenshotState.overlay!.appendChild(border);

  screenshotState.rect = document.createElement('div');
  Object.assign(screenshotState.rect!.style, {
    position: 'fixed',
    border: '2px dashed ' + colors.accent,
    background: colors.accentBackground,
    display: 'none',
    zIndex: String(Z_INDEX.TRIGGER),
  });
  screenshotState.overlay!.appendChild(screenshotState.rect!);

  screenshotState.dragStarted = false;

  screenshotState.overlay!.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Clear existing toolbar if user re-drags on overlay
    const existingToolbar = screenshotState.overlay!.querySelector('[data-screenshot-toolbar]');
    if (existingToolbar) existingToolbar.remove();
    screenshotState.dragStarted = true;
    screenshotState.startX = e.clientX;
    screenshotState.startY = e.clientY;
    screenshotState.rect!.style.display = 'block';
    Object.assign(screenshotState.rect!.style, {
      left: e.clientX + 'px',
      top: e.clientY + 'px',
      width: '0px',
      height: '0px',
    });
  });

  screenshotState.overlay!.addEventListener('mouseup', (e) => {
    // Ignore the mouseup from the long-press release (no drag started yet)
    if (!screenshotState.dragStarted) return;

    const x = Math.min(screenshotState.startX, e.clientX);
    const y = Math.min(screenshotState.startY, e.clientY);
    const w = Math.abs(e.clientX - screenshotState.startX);
    const h = Math.abs(e.clientY - screenshotState.startY);

    // Too small — reset selection and let user try again
    if (w < 10 || h < 10) {
      screenshotState.rect!.style.display = 'none';
      screenshotState.dragStarted = false;
      return;
    }

    // Stop tracking drag so mousemove no longer resizes the rectangle
    screenshotState.dragStarted = false;

    // Lock the selection rectangle with solid border
    Object.assign(screenshotState.rect!.style, {
      border: '2px solid ' + colors.accent,
    });


    // Show confirmation toolbar below the selection
    _showConfirmToolbar(screenshotState.overlay!, banner, { x, y, width: w, height: h });
  });

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancelScreenshotMode();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  screenshotState.overlay!._escHandler = escHandler;

  document.body.appendChild(screenshotState.overlay!);
}

function _showConfirmToolbar(overlay: ScreenshotOverlay, banner: HTMLDivElement, rect: CaptureRect): void {
  // Remove existing toolbar if any
  const existing = overlay.querySelector('[data-screenshot-toolbar]');
  if (existing) existing.remove();

  // Update banner text
  banner.textContent = 'Confirm selection or reselect';

  const toolbar = document.createElement('div');
  toolbar.setAttribute('data-screenshot-toolbar', '');

  // Position below the selection, centered horizontally
  const toolbarTop = Math.min(rect.y + rect.height + 12, window.innerHeight - 52);
  const toolbarLeft = rect.x + rect.width / 2;

  Object.assign(toolbar.style, {
    position: 'fixed',
    top: toolbarTop + 'px',
    left: toolbarLeft + 'px',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px',
    zIndex: String(Z_INDEX.TRIGGER),
  });

  const btnBase = {
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontFamily: FONT_STACK,
    fontWeight: '500',
    cursor: 'pointer',
    boxShadow: '0 2px 8px ' + colors.shadowButton,
  };

  // Confirm button
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Capture';
  Object.assign(confirmBtn.style, {
    ...btnBase,
    background: colors.accent,
    color: colors.white,
  });
  confirmBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    cancelScreenshotMode();
    try {
      if (typeof captureScreenshot === 'function') {
        const captured = await captureScreenshot(rect);
        if (captured) {
          const bubbleRect = {
            bottom: rect.y + rect.height + 8,
            left: rect.x,
            right: rect.x + rect.width,
            top: rect.y,
          };
          await showBubbleWithPresets(bubbleRect, '', null, [captured]);
        }
      }
    } catch (err) {
      console.error('[Dobby AI] Screenshot capture failed:', err);
    }
  });

  // Reselect button
  const reselectBtn = document.createElement('button');
  reselectBtn.textContent = 'Reselect';
  Object.assign(reselectBtn.style, {
    ...btnBase,
    background: colors.screenshotButtonBackground,
    color: colors.screenshotText,
  });
  reselectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toolbar.remove();
    Object.assign(screenshotState.rect!.style, {
      display: 'none',
      border: '2px dashed ' + colors.accent,
      width: '0px',
      height: '0px',
    });
    screenshotState.dragStarted = false;
    banner.textContent = 'Drag to select a region \u2022 ESC to cancel';
  });

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  Object.assign(cancelBtn.style, {
    ...btnBase,
    background: colors.screenshotButtonBackground,
    color: colors.screenshotTextMuted,
  });
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cancelScreenshotMode();
  });

  toolbar.appendChild(confirmBtn);
  toolbar.appendChild(reselectBtn);
  toolbar.appendChild(cancelBtn);
  overlay.appendChild(toolbar);

  // Prevent overlay mousedown from starting a new drag while toolbar is shown
  toolbar.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
}

export function cancelScreenshotMode(): void {
  if (screenshotState.overlay) {
    if (screenshotState.overlay._escHandler) {
      document.removeEventListener('keydown', screenshotState.overlay._escHandler);
    }
    removeElement(screenshotState.overlay);
    resetScreenshotState();
  }
}
