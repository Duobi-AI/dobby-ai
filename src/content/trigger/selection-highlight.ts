import { getColorPalette } from '../../shared/color-palette.js';

// Focus moves into the extension input, so Chrome no longer paints the page's
// selection. Keep a page-level overlay until the related chat is closed.
const colors = getColorPalette('light');

let selectionHighlights: HTMLDivElement[] = [];

export function showSelectionHighlight(): void {
  removeSelectionHighlight();

  const selection = window.getSelection();
  if (!selection?.rangeCount) return;

  const range = selection.getRangeAt(0);
  for (const rect of range.getClientRects()) {
    if (rect.width === 0 || rect.height === 0) continue;

    const highlight = document.createElement('div');
    highlight.className = 'dobby-selection-highlight';
    Object.assign(highlight.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      background: colors.selectionHighlight,
      pointerEvents: 'none',
      zIndex: '2147483646',
      borderRadius: '2px',
    });
    document.body.appendChild(highlight);
    selectionHighlights.push(highlight);
  }
}

export function removeSelectionHighlight(): void {
  selectionHighlights.forEach((highlight) => highlight.remove());
  selectionHighlights = [];
}
