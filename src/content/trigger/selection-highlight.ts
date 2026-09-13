import { getColorPalette } from '../../shared/color-palette.js';
import { Z_INDEX } from '../shared/constants.js';

// Focus moves into the extension input, so Chrome no longer paints the page's
// selection. Keep a page-level overlay until the related chat is closed.
const colors = getColorPalette('light');
const HOST_ID = 'dobby-ai-selection-highlight-host';

type HighlightRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

function getStyles(rects: readonly HighlightRect[]): string {
  const positions = rects.map((rect, index) => `
    .dobby-selection-highlight[data-index="${index}"] {
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
    }
  `).join('\n');

  return `
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: ${Z_INDEX.SCREENSHOT_OVERLAY};
    }

    .dobby-selection-highlight {
      position: fixed;
      background: ${colors.selectionHighlight};
      pointer-events: none;
      border-radius: 2px;
    }

    ${positions}
  `;
}

let selectionHighlightHost: HTMLDivElement | null = null;

export function showSelectionHighlight(): void {
  removeSelectionHighlight();

  const selection = window.getSelection();
  if (!selection?.rangeCount) return;

  const rects = Array.from(selection.getRangeAt(0).getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (rects.length === 0) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  const styles = document.createElement('style');
  styles.textContent = getStyles(rects);
  shadow.appendChild(styles);

  rects.forEach((_rect, index) => {
    const highlight = document.createElement('div');
    highlight.className = 'dobby-selection-highlight';
    highlight.dataset.index = String(index);
    shadow.appendChild(highlight);
  });

  document.body.appendChild(host);
  selectionHighlightHost = host;
}

export function removeSelectionHighlight(): void {
  selectionHighlightHost?.remove();
  selectionHighlightHost = null;
}
