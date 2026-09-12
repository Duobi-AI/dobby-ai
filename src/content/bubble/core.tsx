// Bubble entry adapters. The lifecycle module owns mutable response and host state.

import { stopShadowRootKeyboardEventPropagation } from '../shared/dom-utils.js';
import { detectTheme } from '../../shared/theme.js';
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
  appendResponseText,
  activateBubbleResponse,
  beginBubbleDrag,
  beginBubbleResize,
  closeBubble,
  getBubbleHost,
  getBubbleLifecycleState,
  getResponseText,
  isBubblePinned,
  openBubbleHost,
  setAssistantResponse,
  setBubbleReactCleanup,
  setCurrentMessages,
  setResponseText,
  setBubblePreviewLabel,
  setBubbleViewStatus,
  startAssistantResponse,
  toggleBubblePin,
} from './lifecycle.js';

export { detectTheme, isBubblePinned };

function truncatePreview(text: string, maxLen = 120): string {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
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
  const host = openBubbleHost(selectionRect);
  setResponseText('');
  const shadow = host.attachShadow({ mode: 'open' });
  stopShadowRootKeyboardEventPropagation(shadow);

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
      onClose={closeBubble}
      onTogglePin={toggleBubblePin}
      onDragStart={beginBubbleDrag}
      onResizeStart={beginBubbleResize}
      onEscape={closeBubble}
    />,
  );
  setBubbleReactCleanup(reactRoot.unmount);
  document.body.appendChild(host);
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

// Preset selection entry operation.
export async function showBubbleWithPresets(
  selectionRect: SelectionRect,
  selectedText: string,
  anchorNode: Node | null,
  images?: ImageContentPart[] | null,
): Promise<void> {
  const hasImages = images && images.length > 0;
  const isImageOnly = hasImages && !selectedText.trim();
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
    onEscape: closeBubble,
  };
  shadow = await initBubble(selectionRect, selectedText, previewLabel, images, presetSelection);
}

// Direct response entry operation.
export async function showBubble(
  selectionRect: SelectionRect,
  messages: ChatMessage[],
  selectedText: string,
  instruction: string,
  images?: ImageContentPart[] | null,
): Promise<void> {
  const shadow = await initBubble(selectionRect, selectedText, instruction || 'Selected text', images);
  setCurrentMessages(messages);
  activateResponseSection(shadow, messages);
}

// History entry operation.
export async function showHistoryBubble(selectionRect: SelectionRect): Promise<void> {
  const shadow = await initBubble(selectionRect, '', 'History', null);
  activateBubbleResponse();
  setBubbleViewStatus('history');
  await showHistoryPanel(shadow);
}

export function hideBubble(): void {
  closeBubble();
}

export function appendToken(text: string): void {
  if (!getBubbleHost()) return;
  appendResponseText(text);
  const messages = getBubbleLifecycleState().messages;
  const lastMessage = messages[messages.length - 1];
  const responseId = lastMessage?.role === 'assistant' ? lastMessage.id : startAssistantResponse();
  setAssistantResponse(responseId, getResponseText());
}

export function setBubbleStatus(status: string): void {
  if (!getBubbleHost()) return;
  setBubbleViewStatus(status);
}

export function getBubbleContainer(): BubbleHost | null {
  return getBubbleHost();
}
