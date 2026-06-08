// src/content/bubble/styles.js — CSS-in-JS styles for Dobby AI chat bubble (Shadow DOM)
import { FONT_STACK } from '../shared/constants.js';
import { getColorPalette } from '../../shared/color-palette.js';

export function getStyles(theme) {
  const colors = getColorPalette(theme);
  const accent = colors.accent;
  const accentInteractive = colors.accentInteractive;
  const fontStack = FONT_STACK;
  return `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .close-btn:focus-visible,
    .pin-btn:focus-visible,
    .history-btn:focus-visible,
    .action-btn:focus-visible,
    .retry-btn:focus-visible,
    .copy-btn:focus-visible,
    .preset-chip:focus-visible,
    .preset-input:focus-visible,
    .follow-up-input:focus-visible,
    .history-entry:focus-visible {
      outline: 2px solid ${accent};
      outline-offset: 2px;
    }
    .copy-btn:focus-visible { opacity: 1; }
    .bubble {
      position: relative;
      font-family: ${fontStack};
      width: 380px;
      max-height: 420px;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: bubble-enter 0.2s ease-out;
      background: ${colors.surfaceGlass};
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border: 1px solid ${colors.borderPanel};
      box-shadow: 0 8px 32px ${colors.panelShadow};
      color: ${colors.textPrimary};
      font-size: 14px;
      line-height: 1.5;
    }
    @supports not (backdrop-filter: blur(16px)) {
      .bubble { background: ${colors.surfaceGlassSolid}; }
    }
    .bubble-header {
      display: flex;
      align-items: center;
      padding: 10px 14px;
      border-bottom: 1px solid ${colors.borderDivider};
      gap: 8px;
    }
    .bubble-logo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 14px;
      color: ${accentInteractive};
    }
    .bubble-logo-mark {
      width: 22px;
      height: 22px;
      display: block;
      object-fit: contain;
      filter: drop-shadow(0 1px 1.5px ${colors.iconShadow});
    }
    .bubble-status {
      font-size: 12px;
      color: ${colors.textMuted};
      flex: 1;
    }
    .close-btn {
      background: none;
      border: none;
      color: ${colors.textMuted};
      cursor: pointer;
      font-size: 16px;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .close-btn:hover { background: ${colors.surfaceCode}; }
    .pin-btn {
      background: none;
      border: none;
      color: ${colors.textMuted};
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 0.15s, transform 0.15s;
      transform: rotate(45deg);
    }
    .pin-btn:hover { background: ${colors.surfaceCode}; }
    .pin-btn.pinned {
      color: ${accent};
      transform: rotate(0deg);
    }
    .selected-text-preview {
      padding: 8px 14px;
      border-bottom: 1px solid ${colors.borderDivider};
      font-size: 12px;
      color: ${colors.textMuted};
      max-height: 80px;
      overflow-y: auto;
      line-height: 1.4;
    }
    .selected-text-preview .label {
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: ${accentInteractive};
      margin-bottom: 2px;
    }
    .selected-text-preview .text {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }
    .bubble-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px 14px;
    }
    .response-text {
      word-break: break-word;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .message-user {
      align-self: flex-end;
      background: ${accent};
      color: ${colors.accentContrast};
      padding: 6px 12px;
      border-radius: 12px 12px 2px 12px;
      max-width: 85%;
      font-size: 13px;
      line-height: 1.4;
      word-break: break-word;
    }
    .message-ai {
      position: relative;
      align-self: flex-start;
      background: ${colors.surfaceMessage};
      padding: 8px 28px 8px 12px;
      border-radius: 12px 12px 12px 2px;
      max-width: 95%;
      word-break: break-word;
    }
    .copy-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      color: ${colors.textMuted};
      opacity: 0;
      transition: opacity 0.15s, background 0.15s;
      line-height: 1;
    }
    .message-ai:hover .copy-btn { opacity: 1; }
    .copy-btn:hover { background: ${colors.surfaceCode}; }
    .copy-btn.copied { color: ${colors.successBright}; }
    .response-text code {
      background: ${colors.surfaceCode};
      padding: 1px 4px;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 13px;
    }
    .response-text pre {
      background: ${colors.surfaceCodeBlock};
      padding: 10px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 8px 0;
    }
    .response-text pre code { background: none; padding: 0; }
    .response-text strong { font-weight: 600; }
    .response-text .response-img {
      max-width: 100%;
      border-radius: 8px;
      margin: 8px 0;
      cursor: pointer;
      display: block;
      transition: opacity 0.15s;
    }
    .response-text .response-img:hover { opacity: 0.85; }
    .image-preview {
      display: flex;
      gap: 6px;
      padding: 4px 0;
    }
    .image-preview img {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid ${colors.imageBorder};
    }
    .img-lightbox {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: ${colors.overlayStrong};
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .img-lightbox img {
      max-width: 90vw;
      max-height: 90vh;
      border-radius: 8px;
      object-fit: contain;
      box-shadow: 0 8px 32px ${colors.shadowLightbox};
    }
    .cursor {
      display: inline-block;
      width: 2px;
      height: 14px;
      background: ${accentInteractive};
      margin-left: 2px;
      vertical-align: text-bottom;
    }
    .cursor.blink { animation: blink 1s step-end infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    @keyframes bubble-enter {
      from { opacity: 0; transform: scale(0.92) translateY(-8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .cursor.hidden { display: none; }
    .bubble-footer {
      display: flex;
      align-items: center;
      padding: 8px 10px;
      gap: 6px;
      border-top: 1px solid ${colors.borderDivider};
    }
    .follow-up-input {
      flex: 1;
      border: 1px solid ${colors.borderStrong};
      background: ${colors.surfaceInputSoft};
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 13px;
      color: inherit;
      outline: none;
      font-family: inherit;
    }
    .follow-up-input:focus {
      border-color: ${accentInteractive};
    }
    .follow-up-input::placeholder {
      color: ${colors.textSubtle};
    }
    .action-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      padding: 4px 6px;
      border-radius: 6px;
      color: ${colors.textMuted};
    }
    .action-btn:hover { background: ${colors.surfaceCode}; }
    .error-msg {
      color: ${colors.danger};
      padding: 8px 0;
    }
    .retry-btn {
      background: ${accentInteractive};
      color: ${colors.accentContrast};
      border: none;
      padding: 4px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      margin-left: 8px;
    }
    .rate-limit-msg {
      text-align: center;
      padding: 12px 0;
    }
    .rate-limit-msg .cta {
      display: inline-block;
      margin-top: 8px;
      color: ${accentInteractive};
      cursor: pointer;
      text-decoration: underline;
    }
    .presets-section {
      padding: 8px 10px;
      border-bottom: 1px solid ${colors.borderDivider};
    }
    .presets-section.collapsed { display: none; }
    .preset-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-bottom: 6px;
    }
    .preset-chip {
      padding: 4px 10px;
      cursor: pointer;
      border-radius: 10px;
      font-size: 12px;
      color: ${colors.textPrimary};
      background: ${colors.surfaceChip};
      white-space: nowrap;
      transition: background 0.15s;
    }
    .preset-chip:hover { background: ${colors.accentSoft}; }
    .preset-input {
      width: 100%;
      border: 1px solid ${colors.borderStrong};
      background: ${colors.surfaceInputSoft};
      border-radius: 8px;
      padding: 5px 8px;
      font-size: 12px;
      outline: none;
      box-sizing: border-box;
      color: ${colors.textPrimary};
      font-family: inherit;
    }
    .preset-input:focus { border-color: ${accentInteractive}; }
    .preset-input::placeholder { color: ${colors.textSubtle}; }
    .detection-badge {
      font-size: 10px;
      color: ${accentInteractive};
      font-weight: 500;
      padding: 0 0 4px;
    }
    .response-section { display: none; }
    .response-section.active { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
    .history-panel { padding: 4px 0; }
    .history-empty { text-align: center; color: ${colors.textMuted}; }
    .history-entry {
      padding: 8px 0;
      border-bottom: 1px solid ${colors.borderHistory};
      cursor: pointer;
    }
    .history-entry:hover { background: ${colors.surfaceHistoryHover}; }
    .history-instruction { font-weight: 500; font-size: 13px; }
    .history-meta { font-size: 11px; color: ${colors.textSubtle}; margin-top: 2px; }
    .clear-link {
      display: block;
      text-align: center;
      color: ${colors.danger};
      cursor: pointer;
      font-size: 12px;
      padding: 8px;
    }
    .resize-handle {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 16px;
      height: 16px;
      cursor: se-resize;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .resize-handle svg {
      opacity: 0.4;
      transition: opacity 0.15s;
    }
    .resize-handle:hover svg {
      opacity: 0.8;
    }
    .bubble-header.draggable {
      cursor: grab;
    }
    .bubble-header.dragging {
      cursor: grabbing;
    }
  `;
}
