// src/content/trigger/styles.js — CSS-in-JS styles for toolbar (Shadow DOM)
import { THEME } from '../shared/constants.js';

export function getToolbarStyles(theme) {
  const isDark = theme === 'dark';
  const accent = THEME.ACCENT;
  const accentLight = THEME.ACCENT_LIGHT;
  const fontStack = THEME.FONT_STACK;

  // Warm palette tokens
  const text = isDark ? THEME.DARK_TEXT_PRIMARY : THEME.TEXT_PRIMARY;
  const textSec = isDark ? THEME.DARK_TEXT_SECONDARY : THEME.TEXT_SECONDARY;
  const border = isDark ? THEME.DARK_BORDER : THEME.BORDER;
  const surfaceHover = isDark ? THEME.DARK_SURFACE_HOVER : THEME.SURFACE_HOVER;
  const surfaceAlt = isDark ? THEME.DARK_SURFACE_ALT : THEME.SURFACE_ALT;

  return `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .toolbar {
      position: relative;
      font-family: ${fontStack};
      display: flex;
      flex-direction: column;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      overflow: hidden;
      background: ${isDark ? 'rgba(28, 25, 23, 0.88)' : 'rgba(250, 250, 249, 0.88)'};
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid ${border};
      box-shadow: 0 2px 12px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(28, 25, 23, 0.1)'};
      cursor: pointer;
      user-select: none;
      transition: width 0.22s cubic-bezier(0.4,0,0.2,1),
                  height 0.25s cubic-bezier(0.4,0,0.2,1),
                  border-radius 0.22s cubic-bezier(0.4,0,0.2,1);
    }

    .toolbar.expanded {
      width: var(--toolbar-expanded-width, 260px);
      height: 36px;
      border-radius: 18px;
      overflow: visible;
    }


    .toolbar-row {
      display: flex;
      align-items: center;
      height: 36px;
      min-height: 36px;
      flex-shrink: 0;
    }

    .toolbar-icon {
      width: 36px;
      height: 36px;
      min-width: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .toolbar-icon img {
      width: 28px;
      height: 28px;
      display: block;
    }


    .toolbar-expand {
      display: flex;
      align-items: center;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: none;
      white-space: nowrap;
      padding-right: 4px;
    }

    .toolbar.expanded .toolbar-expand {
      opacity: 1;
      pointer-events: auto;
    }

    .toolbar-sep {
      width: 1px;
      height: 18px;
      background: ${border};
      flex-shrink: 0;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .toolbar-action {
      background: none;
      border: none;
      color: ${text};
      font-size: 12px;
      font-family: ${fontStack};
      padding: 4px 8px;
      border-radius: 8px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.12s ease-out, transform 0.12s ease-out;
    }

    .toolbar-action:hover {
      background: ${surfaceHover};
      transform: translateY(-1px);
    }

    /* Pencil / close icon button */
    .toolbar-pencil {
      background: none;
      border: none;
      color: ${text};
      min-width: 28px;
      height: 28px;
      padding: 4px 6px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.12s ease-out, color 0.12s ease-out;
    }

    .toolbar-pencil:hover {
      background: ${surfaceHover};
    }

    .toolbar-pencil svg {
      width: 14px;
      height: 14px;
    }

    .toolbar-pencil.close-mode {
      color: ${textSec};
    }

    .toolbar-pencil.close-mode:hover {
      background: ${surfaceHover};
    }

    /* Input mode container — sits between dog icon and pencil/close button */
    .toolbar-input-section {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1;
      min-width: 0;
      opacity: 0;
      pointer-events: none;
      position: absolute;
      left: 37px;
      right: 34px;
      transition: opacity 0.15s ease;
    }

    .toolbar-input-section.visible {
      opacity: 1;
      pointer-events: auto;
    }

    .toolbar-input-field {
      flex: 1;
      min-width: 0;
      height: 24px;
      border: none;
      outline: none;
      background: ${surfaceAlt};
      border-radius: 10px;
      padding: 0 8px;
      font-size: 11px;
      font-family: ${fontStack};
      color: ${text};
    }

    .toolbar-input-field::placeholder {
      color: ${textSec};
    }

    .toolbar-send {
      background: none;
      border: none;
      color: ${accent};
      min-width: 24px;
      height: 24px;
      padding: 2px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.12s ease-out;
    }

    .toolbar-send:hover {
      background: ${surfaceHover};
    }

    .toolbar-send.disabled {
      opacity: 0.3;
      cursor: default;
      pointer-events: none;
    }

    .toolbar-send svg {
      width: 14px;
      height: 14px;
    }

  `;
}
