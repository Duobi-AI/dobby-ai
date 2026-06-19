// src/content/bubble/core.js — Main bubble orchestration
import {
  bubbleHost, setBubbleHost,
  currentMessages, setCurrentMessages,
  responseText, appendResponseText, setResponseText,
  currentRequest, setCurrentRequest,
  renderTimer, setRenderTimer,
  clearRawResponses,
} from '../shared/state.js';
import { Z_INDEX, TIMING } from '../shared/constants.js';
import { removeElement, stopShadowRootKeyboardEventPropagation } from '../shared/dom-utils.js';
import { detectTheme, watchThemeChanges } from '../../shared/theme.js';
import { mountReactRoot } from '../../shared/react-root.js';
import { getStyles } from './styles.js';
import { BubbleShell, type BubblePresetSelection } from './shell.js';
import { startStreaming, handleFollowUp } from './stream.js';
import { clearHistoryPanel, restoreHistoryEntry, showHistoryPanel } from './history.js';
import { detectContentType } from '../detection.js';
import { getSuggestedPresetsForType } from '../presets.js';
import { buildChatMessages } from '../prompt.js';
import { gatherCurrentTabContext } from '../page-context.js';
import { recordPresetUsage, buildTypeKey } from '../shared/preset-usage.js';
import type {
  BubbleHost,
  ChatMessage,
  DetectionResult,
  ImageContentPart,
  Preset,
  SelectionRect,
} from '../../shared/types';
import {
  activateBubbleResponse,
  getBubbleViewState,
  resetBubbleView,
  setAssistantResponse,
  setBubblePreviewLabel,
  setBubbleViewStatus,
  startAssistantResponse,
} from './view-model.js';

export { detectTheme };

function truncatePreview(text: string, maxLen = 120): string {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

function createBubbleHost(selectionRect: SelectionRect): BubbleHost {
  const host = document.createElement('div') as BubbleHost;
  host.id = 'dobby-ai-bubble';
  const bubbleHeight = 420;
  const gap = 8;
  const preferredTop = selectionRect.bottom + gap;
  const wouldOverflow = preferredTop + bubbleHeight > window.innerHeight;
  const top = wouldOverflow
    ? Math.max(gap, (selectionRect.top || selectionRect.bottom) - bubbleHeight - gap)
    : preferredTop;
  Object.assign(host.style, {
    position: 'fixed',
    zIndex: String(Z_INDEX.BUBBLE),
    left: `${Math.max(8, (selectionRect.left + selectionRect.right) / 2 - 190)}px`,
    top: `${top}px`,
  });
  host._escHandler = (e) => { if (e.key === 'Escape') hideBubble(); };
  document.addEventListener('keydown', host._escHandler);

  host._themeCleanup = watchThemeChanges((theme) => {
    if (!host.shadowRoot) return;
    const styleEl = host.shadowRoot.querySelector('style');
    if (styleEl) styleEl.textContent = getStyles(theme);
  });

  setBubbleHost(host);
  return host;
}

function wireCommonEvents(shadow: ShadowRoot): void {
  shadow.querySelector<HTMLElement>('.close-btn')!.addEventListener('click', hideBubble);
  const pinBtn = shadow.querySelector<HTMLButtonElement>('.pin-btn');
  const header = shadow.querySelector<HTMLElement>('.bubble-header')!;

  const updateDraggable = () => {
    header.classList.toggle('draggable', bubbleHost!._isPinned);
  };

  if (pinBtn) {
    pinBtn.addEventListener('click', () => {
      bubbleHost!._isPinned = !bubbleHost!._isPinned;
      pinBtn.classList.toggle('pinned', bubbleHost!._isPinned);
      pinBtn.title = bubbleHost!._isPinned ? 'Unpin' : 'Pin';
      updateDraggable();
    });
  }

  // Drag-by-header when pinned
  header.addEventListener('mousedown', (e: MouseEvent) => {
    if (!bubbleHost!._isPinned) return;
    // Don't drag when clicking buttons inside header
    if ((e.target as Element).closest && (e.target as Element).closest('.pin-btn, .close-btn')) return;

    e.preventDefault();
    header.classList.add('dragging');

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseInt(bubbleHost!.style.left) || 0;
    const startTop = parseInt(bubbleHost!.style.top) || 0;

    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const newLeft = startLeft + moveEvent.clientX - startX;
      const newTop = startTop + moveEvent.clientY - startY;
      bubbleHost!.style.left = newLeft + 'px';
      bubbleHost!.style.top = newTop + 'px';
    };

    const onMouseUp = () => {
      header.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Store cleanup for hideBubble
    bubbleHost!._dragCleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  });
  // Resize handle
  const resizeHandle = shadow.querySelector<HTMLElement>('.resize-handle');
  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const bubble = shadow.querySelector<HTMLElement>('.bubble')!;
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = bubble.getBoundingClientRect().width;
      const startHeight = bubble.getBoundingClientRect().height;

      const onMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const newWidth = Math.min(
          Math.max(300, startWidth + moveEvent.clientX - startX),
          window.innerWidth * 0.8
        );
        const newHeight = Math.min(
          Math.max(200, startHeight + moveEvent.clientY - startY),
          window.innerHeight * 0.8
        );
        bubble.style.width = newWidth + 'px';
        bubble.style.height = newHeight + 'px';
        bubble.style.maxHeight = 'none';
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      // Store cleanup reference for hideBubble
      bubbleHost!._resizeCleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    });
  }
}

function activateResponseSection(shadow: ShadowRoot, messages: ChatMessage[]): void {
  activateBubbleResponse();
  startStreaming(shadow, messages);
}

async function initBubble(
  selectionRect: SelectionRect,
  selectedText: string,
  previewLabel: string,
  images?: ImageContentPart[] | null,
  presets?: BubblePresetSelection,
): Promise<ShadowRoot> {
  hideBubble();
  setResponseText('');
  resetBubbleView();

  createBubbleHost(selectionRect);
  bubbleHost!._isPinned = false;
  const shadow = bubbleHost!.attachShadow({ mode: 'open' });
  stopShadowRootKeyboardEventPropagation(shadow);
  shadow.addEventListener('keydown', (e) => {
    if (
      (e as KeyboardEvent).key === 'Escape'
      && !(e.target as Element).closest?.('.img-lightbox')
    ) {
      hideBubble();
    }
  });

  const reactRoot = mountReactRoot(
    shadow,
    <BubbleShell
      styles={getStyles(await detectTheme())}
      previewText={truncatePreview(selectedText)}
      previewLabel={previewLabel}
      images={images}
      presets={presets}
      onFollowUp={(question) => handleFollowUp(shadow, question)}
      onHistory={() => { void showHistoryPanel(shadow); }}
      onHistoryEntry={restoreHistoryEntry}
      onClearHistory={() => { void clearHistoryPanel(); }}
    />,
  );
  bubbleHost!._reactCleanup = reactRoot.unmount;

  wireCommonEvents(shadow);
  document.body.appendChild(bubbleHost!);
  return shadow;
}

function launchFromPreset(
  shadow: ShadowRoot,
  selectedText: string,
  instruction: string,
  anchorNode: Node | null,
  images?: ImageContentPart[] | null,
): void {
  const pageContext = gatherCurrentTabContext({ selectedText, anchorNode });
  const messages = buildChatMessages(selectedText, instruction, true, images as ImageContentPart[] | undefined, pageContext);
  setCurrentMessages(messages);

  setBubblePreviewLabel(instruction);

  activateResponseSection(shadow, messages);
}

// Show bubble with preset selection first, then expand to show response
export async function showBubbleWithPresets(
  selectionRect: SelectionRect,
  selectedText: string,
  anchorNode: Node | null,
  images?: ImageContentPart[] | null,
): Promise<void> {
  const hasImages = images && images.length > 0;
  const isImageOnly = hasImages && !selectedText.trim();
  // Detect content type and populate presets
  let detected: DetectionResult;
  if (isImageOnly) {
    detected = { type: 'image', subType: null, confidence: 'high' };
  } else {
    detected = detectContentType(selectedText, anchorNode);
  }

  const presets = getSuggestedPresetsForType(detected.type, detected.subType);
  const previewLabel = isImageOnly ? 'Image' : 'Selected text';
  let shadow: ShadowRoot;
  const presetSelection: BubblePresetSelection = {
    detectionLabel: detected.type === 'default'
      ? undefined
      : (isImageOnly ? 'image' : `${detected.subType || detected.type} detected`),
    presets,
    customPlaceholder: isImageOnly
      ? 'Or ask something about this image...'
      : 'Or type a custom prompt...',
    onPreset: (preset: Preset) => {
      recordPresetUsage(buildTypeKey(detected.type, detected.subType), preset.label);
      launchFromPreset(shadow, selectedText, preset.instruction, anchorNode, images);
    },
    onCustom: (instruction: string) => {
      launchFromPreset(shadow, selectedText, instruction, anchorNode, images);
    },
    onEscape: hideBubble,
  };
  shadow = await initBubble(selectionRect, selectedText, previewLabel, images, presetSelection);
}

// Direct bubble (used by context menu — no preset selection needed)
export async function showBubble(
  selectionRect: SelectionRect,
  messages: ChatMessage[],
  selectedText: string,
  instruction: string,
  images?: ImageContentPart[] | null,
): Promise<void> {
  setCurrentMessages(messages);
  const shadow = await initBubble(selectionRect, selectedText, instruction || 'Selected text', images);
  activateResponseSection(shadow, messages);
}

export async function showHistoryBubble(selectionRect: SelectionRect): Promise<void> {
  const shadow = await initBubble(selectionRect, '', 'History', null);
  activateBubbleResponse();
  setBubbleViewStatus('history');
  await showHistoryPanel(shadow);
}

export function hideBubble(): void {
  if (renderTimer) { clearTimeout(renderTimer); setRenderTimer(null); }
  if (currentRequest) {
    currentRequest.cancel();
    setCurrentRequest(null);
  }
  if (bubbleHost) {
    if (bubbleHost._dragCleanup) {
      bubbleHost._dragCleanup();
    }
    if (bubbleHost._resizeCleanup) {
      bubbleHost._resizeCleanup();
    }
    if (bubbleHost._escHandler) document.removeEventListener('keydown', bubbleHost._escHandler);
    if (bubbleHost._themeCleanup) {
      bubbleHost._themeCleanup();
    }
    if (bubbleHost._reactCleanup) {
      bubbleHost._reactCleanup();
    }
    removeElement(bubbleHost);
  }
  setBubbleHost(null);
  setCurrentMessages([]);
  setResponseText('');
  clearRawResponses();
  resetBubbleView();
}

export function appendToken(text: string): void {
  if (!bubbleHost) return;
  appendResponseText(text);
  const messages = getBubbleViewState().messages;
  const lastMessage = messages[messages.length - 1];
  const responseId = lastMessage?.role === 'assistant' ? lastMessage.id : startAssistantResponse();
  setAssistantResponse(responseId, responseText);
}

export function setBubbleStatus(status: string): void {
  if (!bubbleHost) return;
  setBubbleViewStatus(status);
}

export function getBubbleContainer(): BubbleHost | null {
  return bubbleHost;
}
