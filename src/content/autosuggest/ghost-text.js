// src/content/autosuggest/ghost-text.js — Renders faded suggestion text after the cursor in a textarea
import {
  autosuggestOverlayHost,
  setAutosuggestOverlayHost,
  setAutosuggestCurrentSuggestion,
} from '../shared/state.js';
import { getGhostTextStyles } from './styles.js';

// Cached references to the persistent overlay's internal nodes, plus the textarea
// the expensive getComputedStyle-derived metrics were last computed for. These let
// repeat showGhostText() calls reuse the Shadow DOM instead of rebuilding it.
let overlayRefs = null; // { container, mirror, ghost }
let styledTextarea = null;

function buildOverlay() {
  const host = document.createElement('div');
  host.setAttribute('data-dobby-autosuggest', '');
  host.style.position = 'absolute';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '2147483640';
  host.style.overflow = 'hidden';

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = getGhostTextStyles();
  shadow.appendChild(style);

  const container = document.createElement('div');
  container.className = 'ghost-container';
  container.style.width = '100%';
  container.style.boxSizing = 'border-box';

  // Mirror text before cursor (invisible) so ghost text is positioned correctly
  const mirror = document.createElement('span');
  mirror.className = 'ghost-mirror';

  // Ghost suggestion (visible, faded)
  const ghost = document.createElement('span');
  ghost.className = 'ghost-text';

  // Paw indicator
  const paw = document.createElement('span');
  paw.className = 'ghost-paw';
  paw.textContent = '🐾';

  container.appendChild(mirror);
  container.appendChild(ghost);
  container.appendChild(paw);
  shadow.appendChild(container);

  document.body.appendChild(host);
  setAutosuggestOverlayHost(host);
  overlayRefs = { container, mirror, ghost };
  return host;
}

// Recompute the expensive getComputedStyle-derived text metrics. Only called when
// the target textarea changes, not on every keystroke.
function applyTextareaStyles(textarea, container) {
  const computed = window.getComputedStyle(textarea);
  container.style.fontSize = computed.fontSize;
  container.style.fontFamily = computed.fontFamily;
  container.style.lineHeight = computed.lineHeight;
  container.style.paddingTop = computed.paddingTop;
  container.style.paddingLeft = computed.paddingLeft;
  container.style.paddingRight = computed.paddingRight;
  container.style.paddingBottom = computed.paddingBottom;
  container.style.borderTop = `${computed.borderTopWidth} solid transparent`;
  container.style.borderLeft = `${computed.borderLeftWidth} solid transparent`;
  container.style.letterSpacing = computed.letterSpacing;
  container.style.wordSpacing = computed.wordSpacing;
}

// Returns false and hides the overlay when the textarea is detached or has a
// zero-area bounding rect (detached node or SPA re-render artefact).
function positionOverlay(host, textarea) {
  if (!textarea.isConnected) {
    hideGhostText();
    return false;
  }
  const rect = textarea.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    hideGhostText();
    return false;
  }
  host.style.top = `${rect.top + window.scrollY}px`;
  host.style.left = `${rect.left + window.scrollX}px`;
  host.style.width = `${rect.width}px`;
  host.style.height = `${rect.height}px`;
  return true;
}

export function showGhostText(textarea, suggestion) {
  setAutosuggestCurrentSuggestion(suggestion);

  // Create the host + shadow root once, then reuse it across calls.
  let host = autosuggestOverlayHost;
  if (!host || !overlayRefs) {
    host = buildOverlay();
  }
  const { container, mirror, ghost } = overlayRefs;

  // Recompute expensive getComputedStyle metrics when the textarea changes OR
  // when the cached textarea has been detached (SPA re-render / node recycling).
  if (textarea !== styledTextarea || !textarea.isConnected) {
    applyTextareaStyles(textarea, container);
    styledTextarea = textarea;
  }

  // Reposition (cheap) and bail if the textarea is no longer in the DOM.
  if (!positionOverlay(host, textarea)) return;

  const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart);
  mirror.textContent = textBeforeCursor;
  ghost.textContent = suggestion;

  // Match textarea scroll position
  container.scrollTop = textarea.scrollTop;
}

export function hideGhostText() {
  const host = autosuggestOverlayHost;
  if (host) {
    host.remove();
    setAutosuggestOverlayHost(null);
  }
  overlayRefs = null;
  styledTextarea = null;
  setAutosuggestCurrentSuggestion('');
}

export function acceptSuggestion(textarea) {
  const host = autosuggestOverlayHost;
  if (!host) return;

  const ghost = host.shadowRoot.querySelector('.ghost-text');
  if (!ghost) return;

  const suggestion = ghost.textContent;
  const pos = textarea.selectionStart;

  // Insert suggestion at cursor position
  textarea.value = textarea.value.substring(0, pos) + suggestion + textarea.value.substring(pos);
  textarea.selectionStart = pos + suggestion.length;
  textarea.selectionEnd = pos + suggestion.length;

  // Dispatch input event so frameworks (React, Vue) pick up the change
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  hideGhostText();
}
