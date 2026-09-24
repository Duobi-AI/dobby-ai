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

type OverlayRefs = {
  host: HTMLDivElement;
  container: HTMLDivElement;
  mirror: HTMLSpanElement;
  ghost: HTMLSpanElement;
};

let overlayRefs: OverlayRefs | null = null;
let styledEditor: AutosuggestEditor | null = null;
let styledMetrics: CSSStyleDeclaration | null = null;

function createOverlayHost(): OverlayRefs {
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
  container.style.width = '100%';
  container.style.boxSizing = 'border-box';

  const mirror = document.createElement('span');
  mirror.className = 'ghost-mirror';
  const ghost = document.createElement('span');
  ghost.className = 'ghost-text';
  const paw = document.createElement('span');
  paw.className = 'ghost-paw';
  paw.textContent = '🐾';
  container.append(mirror, ghost, paw);
  shadow.appendChild(container);
  document.body.appendChild(host);
  setAutosuggestOverlayHost(host);
  const refs = { host, container, mirror, ghost };
  overlayRefs = refs;
  return refs;
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
  mirror: HTMLSpanElement,
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

  mirror.textContent = textarea.value.substring(0, textarea.selectionStart);
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
  container.style.width = '';
  container.style.boxSizing = '';
  container.classList.add('contenteditable');
  return true;
}

export function showGhostText(editor: AutosuggestEditor, suggestion: string) {
  setAutosuggestCurrentSuggestion(suggestion);

  if (!editor.isConnected) {
    hideGhostText();
    return;
  }

  const refs = overlayRefs && autosuggestOverlayHost === overlayRefs.host
    ? overlayRefs
    : createOverlayHost();
  const { host, container, mirror, ghost } = refs;

  if (editor !== styledEditor) {
    styledMetrics = window.getComputedStyle(editor);
    applyTextMetrics(container, styledMetrics);
    styledEditor = editor;
  }

  const computed = styledMetrics!;
  if (isTextareaEditor(editor)) {
    const rect = editor.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hideGhostText();
      return;
    }
    container.classList.remove('contenteditable');
    positionTextareaOverlay(host, container, editor, computed, mirror);
  } else if (!positionContenteditableOverlay(host, container, editor, computed)) {
    hideGhostText();
    return;
  }

  ghost.textContent = suggestion;
}

export function hideGhostText() {
  const host = autosuggestOverlayHost;
  if (host) {
    host.remove();
    setAutosuggestOverlayHost(null);
  }
  overlayRefs = null;
  styledEditor = null;
  styledMetrics = null;
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
