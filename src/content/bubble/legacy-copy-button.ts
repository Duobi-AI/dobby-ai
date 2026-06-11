import { rawResponses } from '../shared/state.js';
import { TIMING } from '../shared/constants.js';
import { getColorPalette } from '../../shared/color-palette.js';

const colors = getColorPalette('light');

const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

// Retained for callers that use the pre-React copy-button helper.
export function createCopyButton(aiMsg: HTMLElement, responseIdx: number): void {
  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.title = 'Copy';
  btn.setAttribute('aria-label', 'Copy response');
  btn.dataset.responseIdx = String(responseIdx);
  btn.innerHTML = COPY_ICON;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const text = rawResponses[responseIdx];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add('copied');
      btn.innerHTML = CHECK_ICON;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = COPY_ICON;
      }, TIMING.COPY_FEEDBACK_DURATION);
    } catch {
      btn.title = 'Copy failed';
      btn.style.color = colors.danger;
      setTimeout(() => {
        btn.title = 'Copy';
        btn.style.color = '';
      }, TIMING.COPY_FEEDBACK_DURATION);
    }
  });
  aiMsg.appendChild(btn);
}
