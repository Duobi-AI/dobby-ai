// src/content/trigger/button.js — Toolbar creation, expand/collapse, morph-to-chat
// Evolves the original trigger button into a three-state toolbar:
//   collapsed (icon only) → expanded (hover, preset buttons) → morphed (inline chat)

import { getToolbarStyles } from './styles.js';
import { detectTheme, showBubble } from '../bubble/core.js';
import { watchThemeChanges } from '../../shared/theme.js';
import { mountReactRoot } from '../../shared/react-root.js';
import { getColorPalette } from '../../shared/color-palette.js';
import { buildChatMessages } from '../prompt.js';
import { Z_INDEX, TIMING } from '../shared/constants.js';
import {
  setToolbarHost, setToolbarState,
  setTriggerButton,
} from '../shared/state.js';
import { detectContentType } from '../detection.js';
import { getSuggestedPresetsForType } from '../presets.js';
import { captureImage } from '../image-capture.js';
import { recordPresetUsage, buildTypeKey } from '../shared/preset-usage.js';
import { stopShadowRootKeyboardEventPropagation } from '../shared/dom-utils.js';
import { ToolbarShell } from './toolbar-shell.js';
import type { ImageContentPart, PreservedSelection, Preset, SelectionData, ToolbarHost } from '../../shared/types';

const SELECTION_IMAGE_WAIT_MS = 1000;
const colors = getColorPalette('light');

// --- Auto-hide timer ---
let autoHideTimer: ReturnType<typeof setTimeout> | null = null;

function startAutoHide(host: ToolbarHost): void {
  clearAutoHide();
  autoHideTimer = setTimeout(() => {
    hideTrigger();
  }, TIMING.TOOLBAR_AUTO_HIDE);
}

function clearAutoHide(): void {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}

// --- Toolbar creation ---

async function createToolbar(): Promise<ToolbarHost> {
  const host = document.createElement('div') as ToolbarHost;
  host.id = 'dobby-ai-toolbar-host';
  Object.assign(host.style, {
    position: 'fixed',
    zIndex: String(Z_INDEX.TRIGGER),
    display: 'none',
    lineHeight: '0',
  });

  const shadow = host.attachShadow({ mode: 'open', delegatesFocus: true });
  stopShadowRootKeyboardEventPropagation(shadow);

  const getPresets = () => {
    const detected = detectContentType(host._selectedText || '', host._anchorNode || null);
    host._detectedType = detected.type;
    host._detectedSubType = detected.subType;
    const presets = getSuggestedPresetsForType(detected.type, detected.subType);
    return presets.length > 0
      ? presets
      : [
        { label: 'Summarize', instruction: 'Summarize the following' },
        { label: 'Explain', instruction: 'Explain the following in simple terms' },
      ];
  };

  const submitPreset = (preset: Preset) => {
    recordPresetUsage(buildTypeKey(host._detectedType || 'default', host._detectedSubType || null), preset.label);
    morphIntoBubble(host, shadow, preset.label, preset.instruction);
  };

  const submitCustom = (instruction: string) => {
    recordPresetUsage(buildTypeKey(host._detectedType || 'default', host._detectedSubType || null), 'Custom');
    morphIntoBubble(host, shadow, 'Custom', instruction);
  };

  const renderToolbar = (styles: string) => (
    <ToolbarShell
      styles={styles}
      host={host}
      getPresets={getPresets}
      onPreset={submitPreset}
      onCustom={submitCustom}
      onModeChange={setToolbarState}
      onEnterInput={showSelectionHighlight}
      onExitInput={removeSelectionHighlight}
      onPauseAutoHide={clearAutoHide}
      onResumeAutoHide={() => startAutoHide(host)}
    />
  );

  const reactRoot = mountReactRoot(shadow, renderToolbar(getToolbarStyles(await detectTheme())));
  host._reactCleanup = reactRoot.unmount;
  host._themeCleanup = watchThemeChanges((theme) => reactRoot.render(renderToolbar(getToolbarStyles(theme))));

  document.body.appendChild(host);
  setToolbarHost(host);
  // Also set triggerButton for backwards compat with selection.js hide logic
  setTriggerButton(host);

  return host;
}

// --- Morph into chat ---

function normalizeImages(images: ImageContentPart[] | null | undefined): ImageContentPart[] | null {
  return Array.isArray(images) && images.length > 0 ? images : null;
}

function cloneSelectionForImageExtraction(
  selection: Selection | PreservedSelection | null | undefined,
): PreservedSelection | null {
  try {
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!range) return null;
    const clonedRange = typeof range.cloneRange === 'function' ? range.cloneRange() : range;
    return {
      rangeCount: 1 as const,
      getRangeAt: () => clonedRange,
    };
  } catch (err) {
    console.warn('[Dobby AI] Could not preserve selection for image extraction:', (err as Error).message);
    return null;
  }
}

function startSelectionImageExtraction(
  host: ToolbarHost,
  selectionRequestId: number,
): Promise<ImageContentPart[] | null> | null | undefined {
  if (host._images || host._imagesPromise || !host._selectionForImages) {
    return host._imagesPromise;
  }

  host._imagesPromise = extractImagesFromSelection(host._selectionForImages)
    .then((images) => {
      const normalized = normalizeImages(images);
      if (host._selectionRequestId === selectionRequestId) {
        host._images = normalized;
      }
      return normalized;
    })
    .catch((err) => {
      console.warn('[Dobby AI] Selection image extraction failed:', (err as Error).message);
      return null;
    });

  return host._imagesPromise;
}

function resolveSelectionImages(
  host: ToolbarHost,
  selectionRequestId: number,
  onResolved: (images: ImageContentPart[] | null) => void,
): void {
  const finish = (images: ImageContentPart[] | null | undefined) => {
    if (!host.isConnected || host._selectionRequestId !== selectionRequestId) return;
    onResolved(normalizeImages(images));
  };

  const imagesPromise = startSelectionImageExtraction(host, selectionRequestId);

  if (imagesPromise) {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const finishOnce = (images: ImageContentPart[] | null | undefined) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      finish(images);
    };

    timeoutId = setTimeout(() => finishOnce(host._images), SELECTION_IMAGE_WAIT_MS);
    imagesPromise.then(finishOnce).catch(() => finishOnce(null));
  } else {
    finish(host._images);
  }
}

function morphIntoBubble(
  host: ToolbarHost,
  shadow: ShadowRoot,
  label: string,
  instruction: string,
): void {
  if (host._isMorphing) return;
  host._isMorphing = true;

  const toolbar = shadow.querySelector<HTMLElement>('.toolbar')!;
  const selectionRequestId = host._selectionRequestId;

  clearAutoHide();
  removeSelectionHighlight();

  resolveSelectionImages(host, selectionRequestId as number, (images) => {
    // Get toolbar position — bubble will appear growing from here
    const hostRect = host.getBoundingClientRect();

    // Pass a rect that positions the bubble at the toolbar's origin.
    // createBubbleHost places bubble at selectionRect.bottom + 8,
    // so we set bottom = toolbar.top - 8 so the bubble top = toolbar.top.
    const selectionRect = {
      top: hostRect.top - 16,
      right: hostRect.right,
      bottom: hostRect.top - 8,
      left: hostRect.left,
      width: hostRect.width,
      height: hostRect.height,
    };

    // Build messages
    const text = host._selectedText || '';
    const messages = buildChatMessages(text, instruction, true, images as ImageContentPart[] | undefined);

    // Crossfade: start bubble creation and toolbar fade simultaneously.
    // showBubble is async (theme read) but the fade timer is independent of that.
    showBubble(selectionRect, messages, text, instruction, images)
      .catch((err) => console.error('[Dobby AI] Bubble creation failed:', err));

    // Fade out toolbar smoothly over the same duration as bubble entry animation
    toolbar.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
    toolbar.style.opacity = '0';
    toolbar.style.transform = 'scale(0.9)';

    // Remove toolbar after fade completes
    setTimeout(() => hideTrigger(), 220);
  });
}

// --- Selection highlight overlay ---
// When input mode is active, the browser clears the page's text selection highlight
// because focus moves to the shadow DOM input. These overlays preserve the visual highlight.

let selectionHighlights: HTMLDivElement[] = [];

function showSelectionHighlight(): void {
  removeSelectionHighlight();
  const sel = window.getSelection()!;
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const rects = range.getClientRects();
  for (const rect of rects) {
    if (rect.width === 0 || rect.height === 0) continue;
    const div = document.createElement('div');
    div.className = 'dobby-selection-highlight';
    Object.assign(div.style, {
      position: 'fixed',
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
      background: colors.selectionHighlight,
      pointerEvents: 'none',
      zIndex: '2147483646',
      borderRadius: '2px',
    });
    document.body.appendChild(div);
    selectionHighlights.push(div);
  }
}

function removeSelectionHighlight(): void {
  selectionHighlights.forEach(el => el.remove());
  selectionHighlights = [];
}

// --- Public API ---

let toolbarCreating: Promise<ToolbarHost> | null = null;

export async function showTrigger(x: number, y: number, selectionData: SelectionData = {}): Promise<void> {
  let host = document.getElementById('dobby-ai-toolbar-host') as ToolbarHost | null;
  if (!host) {
    if (!toolbarCreating) {
      toolbarCreating = createToolbar();
    }
    host = await toolbarCreating;
    toolbarCreating = null;
  }

  // Store selection data on host
  const selectionRequestId = (host!._selectionRequestId || 0) + 1;
  host!._selectionRequestId = selectionRequestId;
  host!._isMorphing = false;
  host!._selectedText = selectionData.text || '';
  host!._anchorNode = selectionData.anchorNode || null;
  host!._images = normalizeImages(selectionData.images);
  host!._imagesPromise = null;
  host!._selectionForImages = host!._images ? null : cloneSelectionForImageExtraction(selectionData.selection);

  // Position
  host!.style.display = 'block';
  const hostWidth = 36;
  const hostHeight = 36;
  const maxLeft = window.innerWidth - hostWidth - 8;
  const maxTop = window.innerHeight - hostHeight - 8;
  host!.style.left = `${Math.min(Math.max(8, x + 12), maxLeft)}px`;
  host!.style.top = `${Math.min(Math.max(4, y + 10), maxTop)}px`;

  // Start auto-hide
  startAutoHide(host!);
}

export function hideTrigger(): void {
  clearAutoHide();
  removeSelectionHighlight();
  if (typeof document === 'undefined') return;
  const host = document.getElementById('dobby-ai-toolbar-host') as ToolbarHost | null;
  if (host) {
    if (host._themeCleanup) {
      host._themeCleanup();
    }
    host._reactCleanup?.();
    host.remove();
  }
  setToolbarHost(null);
  setTriggerButton(null);
  setToolbarState('collapsed');
}

// --- Legacy compatibility: createTriggerButton maps to showTrigger ---
export async function createTriggerButton(): Promise<void> {
  // For backwards compat: create toolbar in hidden state
  let host = document.getElementById('dobby-ai-toolbar-host') as ToolbarHost | null;
  if (!host) {
    host = await createToolbar();
  }
}

// --- Image extraction from text selection (preserved from original) ---

export async function extractImagesFromSelection(
  selection: Selection | PreservedSelection | null | undefined,
  maxImages = 2,
): Promise<ImageContentPart[]> {
  const images: ImageContentPart[] = [];
  if (!selection || !selection.rangeCount) return images;

  const range = selection.getRangeAt(0);
  if (!range?.commonAncestorContainer || typeof range.intersectsNode !== 'function') {
    return images;
  }

  const container = range.commonAncestorContainer;
  const imgElements = container.nodeType === Node.ELEMENT_NODE
    ? (container as Element).querySelectorAll('img')
    : (container.parentElement ? container.parentElement.querySelectorAll('img') : []);

  for (const imgEl of imgElements) {
    if (images.length >= maxImages) break;
    if (!range.intersectsNode(imgEl)) continue;
    if (!imgEl.src) continue;

    if (typeof captureImage === 'function') {
      const captured = await captureImage(imgEl);
      if (captured) images.push(captured);
    }
  }
  return images;
}
