// src/content/autosuggest/ghost-text.js — Renders faded suggestion text after the cursor in a textarea
import {
  autosuggestOverlayHost,
  setAutosuggestOverlayHost,
  setAutosuggestCurrentSuggestion,
} from '../shared/state.js';
import { getGhostTextStyles } from './styles.js';

export function showGhostText(textarea, suggestion) {
  setAutosuggestCurrentSuggestion(suggestion);

  // Remove existing overlay if any
  const existing = autosuggestOverlayHost;
  if (existing) existing.remove();

  // Create Shadow DOM host
  const host = document.createElement('div');
  host.setAttribute('data-dobby-autosuggest', '');

  const computed = window.getComputedStyle(textarea);
  const rect = textarea.getBoundingClientRect();

  // Position overlay exactly over the textarea
  host.style.position = 'absolute';
  host.style.top = `${rect.top + window.scrollY}px`;
  host.style.left = `${rect.left + window.scrollX}px`;
  host.style.width = `${rect.width}px`;
  host.style.height = `${rect.height}px`;
  host.style.pointerEvents = 'none';
  host.style.zIndex = '2147483640';
  host.style.overflow = 'hidden';

  const shadow = host.attachShadow({ mode: 'open' });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = getGhostTextStyles();
  shadow.appendChild(style);

  // Create container that mirrors textarea's text metrics
  const container = document.createElement('div');
  container.className = 'ghost-container';
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
  container.style.width = '100%';
  container.style.boxSizing = 'border-box';

  // Mirror text before cursor (invisible) so ghost text is positioned correctly
  const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart);
  const mirror = document.createElement('span');
  mirror.className = 'ghost-mirror';
  mirror.textContent = textBeforeCursor;

  // Ghost suggestion (visible, faded)
  const ghost = document.createElement('span');
  ghost.className = 'ghost-text';
  ghost.textContent = suggestion;

  // Paw indicator
  const paw = document.createElement('span');
  paw.className = 'ghost-paw';
  paw.textContent = '🐾';

  container.appendChild(mirror);
  container.appendChild(ghost);
  container.appendChild(paw);
  shadow.appendChild(container);

  // Match textarea scroll position
  container.scrollTop = textarea.scrollTop;

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
