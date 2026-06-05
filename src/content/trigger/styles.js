// src/content/trigger/styles.js — CSS-in-JS styles for toolbar (Shadow DOM)
import { THEME } from '../shared/constants.js';

export function getToolbarStyles(theme) {
  const isDark = theme === 'dark';
  const accent = THEME.ACCENT;
  const accentLight = THEME.ACCENT_LIGHT;
  const fontStack = THEME.FONT_STACK;

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
      background: ${isDark ? 'rgba(28, 25, 38, 0.82)' : 'rgba(255, 255, 255, 0.82)'};
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'};
      box-shadow: 0 2px 12px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.15)'};
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
      object-fit: contain;
      filter: drop-shadow(0 1px 1.5px ${isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.18)'});
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
      background: ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'};
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
      color: ${isDark ? '#e4e4e7' : '#18181b'};
      font-size: 12px;
      font-family: ${fontStack};
      padding: 4px 8px;
      border-radius: 8px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }

    .toolbar-action:hover {
      background: ${isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.1)'};
    }

    /* Pencil / close icon button */
    .toolbar-pencil {
      background: none;
      border: none;
      color: ${accent};
      min-width: 28px;
      height: 28px;
      padding: 4px 6px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }

    .toolbar-pencil:hover {
      background: ${isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.1)'};
    }

    .toolbar-pencil svg {
      width: 14px;
      height: 14px;
    }

    .toolbar-pencil.close-mode {
      color: ${isDark ? '#a1a1aa' : '#71717a'};
    }

    .toolbar-pencil.close-mode:hover {
      background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
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
      background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.06)'};
      border-radius: 10px;
      padding: 0 8px;
      font-size: 11px;
      font-family: ${fontStack};
      color: ${isDark ? '#e4e4e7' : '#18181b'};
    }

    .toolbar-input-field::placeholder {
      color: ${isDark ? '#71717a' : '#a1a1aa'};
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
      transition: opacity 0.15s;
    }

    .toolbar-send:hover {
      background: ${isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.1)'};
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
