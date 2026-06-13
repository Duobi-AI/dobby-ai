// src/content/autosuggest/ghost-text.js — Renders faded suggestion text after the editor cursor
import {
  autosuggestOverlayHost,
  setAutosuggestOverlayHost,
  setAutosuggestCurrentSuggestion,
} from '../shared/state.js';
import { getGhostTextStyles } from './styles.js';
import {
  getContenteditableCaretRect,
  insertSuggestion,
  isTextareaEditor,
  type AutosuggestEditor,
} from './editor.js';

function createOverlayHost(): { host: HTMLDivElement; container: HTMLDivElement } {
  const host = document.createElement('div');
  host.setAttribute('data-dobby-autosuggest', '');
  host.style.position = 'absolute';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '2147483640';

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = getGhostTextStyles();
  shadow.appendChild(style);

  const container = document.createElement('div');
  container.className = 'ghost-container';
  shadow.appendChild(container);
  return { host, container };
}

function applyTextMetrics(container: HTMLDivElement, computed: CSSStyleDeclaration) {
  container.style.fontSize = computed.fontSize;
  container.style.fontFamily = computed.fontFamily;
  container.style.fontWeight = computed.fontWeight;
  container.style.fontStyle = computed.fontStyle;
  container.style.lineHeight = computed.lineHeight;
  container.style.letterSpacing = computed.letterSpacing;
  container.style.wordSpacing = computed.wordSpacing;
}

function positionTextareaOverlay(
  host: HTMLDivElement,
  container: HTMLDivElement,
  textarea: HTMLTextAreaElement,
  computed: CSSStyleDeclaration,
) {
  const rect = textarea.getBoundingClientRect();
  host.style.top = `${rect.top + window.scrollY}px`;
  host.style.left = `${rect.left + window.scrollX}px`;
  host.style.width = `${rect.width}px`;
  host.style.height = `${rect.height}px`;
  host.style.overflow = 'hidden';

  container.style.paddingTop = computed.paddingTop;
  container.style.paddingLeft = computed.paddingLeft;
  container.style.paddingRight = computed.paddingRight;
  container.style.paddingBottom = computed.paddingBottom;
  container.style.borderTop = `${computed.borderTopWidth} solid transparent`;
  container.style.borderLeft = `${computed.borderLeftWidth} solid transparent`;
  container.style.width = '100%';
  container.style.boxSizing = 'border-box';
  container.scrollTop = textarea.scrollTop;

  const mirror = document.createElement('span');
  mirror.className = 'ghost-mirror';
  mirror.textContent = textarea.value.substring(0, textarea.selectionStart);
  container.appendChild(mirror);
}

function positionContenteditableOverlay(
  host: HTMLDivElement,
  container: HTMLDivElement,
  editor: HTMLElement,
  computed: CSSStyleDeclaration,
): boolean {
  const caretRect = getContenteditableCaretRect(editor);
  if (!caretRect) return false;
  const editorRect = editor.getBoundingClientRect();
  const lineHeight = Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) || 16;
  const remainingWidth = editorRect.right - caretRect.right;
  const wrapToNextLine = remainingWidth < 120;

  host.style.top = `${(wrapToNextLine ? caretRect.bottom : caretRect.top) + window.scrollY}px`;
  host.style.left = `${(wrapToNextLine ? editorRect.left : caretRect.right) + window.scrollX}px`;
  host.style.maxWidth = `${wrapToNextLine ? editorRect.width : remainingWidth}px`;
  host.style.minHeight = `${lineHeight}px`;
  host.style.overflow = 'visible';
  container.classList.add('contenteditable');
  return true;
}

export function showGhostText(editor: AutosuggestEditor, suggestion: string) {
  setAutosuggestCurrentSuggestion(suggestion);

  const existing = autosuggestOverlayHost;
  if (existing) existing.remove();

  const { host, container } = createOverlayHost();
  const computed = window.getComputedStyle(editor);
  applyTextMetrics(container, computed);
  if (isTextareaEditor(editor)) {
    positionTextareaOverlay(host, container, editor, computed);
  } else if (!positionContenteditableOverlay(host, container, editor, computed)) {
    setAutosuggestCurrentSuggestion('');
    return;
  }

  const ghost = document.createElement('span');
  ghost.className = 'ghost-text';
  ghost.textContent = suggestion;

  const paw = document.createElement('span');
  paw.className = 'ghost-paw';
  paw.textContent = '🐾';

  container.appendChild(ghost);
  container.appendChild(paw);

  document.body.appendChild(host);
  setAutosuggestOverlayHost(host);
}

export function hideGhostText() {
  const host = autosuggestOverlayHost;
  if (host) {
    host.remove();
    setAutosuggestOverlayHost(null);
  }
  setAutosuggestCurrentSuggestion('');
}

export function acceptSuggestion(editor: AutosuggestEditor): boolean {
  const host = autosuggestOverlayHost;
  if (!host) return false;

  const ghost = host.shadowRoot!.querySelector('.ghost-text');
  if (!ghost) return false;

  const accepted = insertSuggestion(editor, ghost.textContent || '');
  if (accepted) hideGhostText();
  return accepted;
}
