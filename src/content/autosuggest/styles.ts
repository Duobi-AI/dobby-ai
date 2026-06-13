// src/content/autosuggest/styles.js — CSS-in-JS styles for autosuggest ghost text overlay
import { AUTOSUGGEST } from '../shared/constants.js';
import { getColorPalette } from '../../shared/color-palette.js';

export function getGhostTextStyles() {
  const colors = getColorPalette('light');
  return `
    :host {
      position: absolute;
      pointer-events: none;
      z-index: 2147483640;
      overflow: hidden;
    }
    .ghost-container {
      position: relative;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .ghost-container.contenteditable {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .ghost-mirror {
      visibility: hidden;
    }
    .ghost-text {
      color: ${colors.ghostText};
      opacity: ${AUTOSUGGEST.GHOST_OPACITY};
    }
    .ghost-paw {
      font-size: 1.5em;
      vertical-align: middle;
      margin-left: 6px;
      opacity: 0.6;
    }
  `;
}
