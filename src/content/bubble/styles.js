// src/content/bubble/styles.js — CSS-in-JS styles for Dobby AI chat bubble (Shadow DOM)
import { THEME } from '../shared/constants.js';

export function getStyles(theme) {
  const isDark = theme === 'dark';
  const fontStack = THEME.FONT_STACK;
  const fontDisplay = THEME.FONT_DISPLAY;

  // Warm palette tokens
  const bg = isDark ? THEME.DARK_BG_PRIMARY : THEME.BG_PRIMARY;
  const text = isDark ? THEME.DARK_TEXT_PRIMARY : THEME.TEXT_PRIMARY;
  const textSec = isDark ? THEME.DARK_TEXT_SECONDARY : THEME.TEXT_SECONDARY;
  const border = isDark ? THEME.DARK_BORDER : THEME.BORDER;
  const surfaceHover = isDark ? THEME.DARK_SURFACE_HOVER : THEME.SURFACE_HOVER;
  const surfaceAlt = isDark ? THEME.DARK_SURFACE_ALT : THEME.SURFACE_ALT;

  return `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .bubble {
      position: relative;
      font-family: ${fontStack};
      width: 380px;
      max-height: 420px;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: bubble-enter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      background: ${bg};
      border: 1px solid ${border};
      box-shadow: 0 8px 32px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(28, 25, 23, 0.12)'};
      color: ${text};
      font-size: 14px;
      line-height: 1.5;
    }
    .bubble-header {
      display: flex;
      align-items: center;
      padding: 12px 14px;
      border-bottom: 0.5px solid ${border};
      gap: 8px;
    }
    .bubble-logo {
      font-family: ${fontDisplay};
      font-weight: 700;
      font-size: 14px;
      letter-spacing: -0.01em;
      color: ${text};
    }
    .bubble-status {
      font-size: 12px;
      color: ${textSec};
      flex: 1;
    }
    .close-btn {
      background: none;
      border: none;
      color: ${textSec};
      cursor: pointer;
      font-size: 16px;
      padding: 2px 6px;
      border-radius: 4px;
      transition: background 0.12s ease-out, transform 0.12s ease-out;
    }
    .close-btn:hover {
      background: ${surfaceHover};
      transform: translateY(-1px);
    }
    .pin-btn {
      background: none;
      border: none;
      color: ${textSec};
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 0.12s ease-out, transform 0.12s ease-out, background 0.12s ease-out;
      transform: rotate(45deg);
    }
    .pin-btn:hover {
      background: ${surfaceHover};
    }
    .pin-btn.pinned {
      color: ${text};
      transform: rotate(0deg);
    }
    .selected-text-preview {
      padding: 8px 14px;
      border-bottom: 0.5px solid ${border};
      font-size: 12px;
      color: ${textSec};
      max-height: 80px;
      overflow-y: auto;
      line-height: 1.4;
    }
    .selected-text-preview .label {
      font-family: ${fontDisplay};
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: ${textSec};
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
      padding: 14px;
      position: relative;
    }
    .bubble-body::before {
      content: '';
      position: absolute;
      bottom: 8px;
      right: 8px;
      width: 48px;
      height: 48px;
      opacity: ${isDark ? '0.04' : '0.045'};
      background-image: url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="30" r="22" fill="#1c1917"/><circle cx="14" cy="22" r="8" fill="#1c1917"/><circle cx="50" cy="22" r="8" fill="#1c1917"/><circle cx="20" cy="12" r="7" fill="#1c1917"/><circle cx="44" cy="12" r="7" fill="#1c1917"/><circle cx="32" cy="10" r="7" fill="#1c1917"/><circle cx="26" cy="8" r="5" fill="#1c1917"/><circle cx="38" cy="8" r="5" fill="#1c1917"/><ellipse cx="10" cy="34" rx="7" ry="12" fill="#1c1917" transform="rotate(-10 10 34)"/><ellipse cx="54" cy="34" rx="7" ry="12" fill="#1c1917" transform="rotate(10 54 34)"/></svg>')}");
      background-size: contain;
      background-repeat: no-repeat;
      pointer-events: none;
      z-index: 0;
    }
    .response-text {
      word-break: break-word;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .message-user {
      align-self: flex-end;
      background: ${isDark ? '#44403c' : '#f5f0eb'};
      color: ${text};
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
      background: none;
      border-left: 3px solid ${isDark ? 'rgba(168, 162, 158, 0.25)' : 'rgba(120, 113, 108, 0.18)'};
      padding: 8px 28px 8px 12px;
      border-radius: 0 8px 8px 0;
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
      color: ${textSec};
      opacity: 0;
      transition: opacity 0.12s ease-out, background 0.12s ease-out;
      line-height: 1;
    }
    .message-ai:hover .copy-btn { opacity: 1; }
    .copy-btn:hover { background: ${surfaceHover}; }
    .copy-btn.copied { color: #22c55e; }
    .response-text code {
      background: ${surfaceAlt};
      padding: 1px 4px;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 13px;
    }
    .response-text pre {
      background: ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(28, 25, 23, 0.04)'};
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
      transition: opacity 0.12s ease-out;
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
      border: 1px solid ${border};
    }
    .img-lightbox {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: rgba(0, 0, 0, 0.8);
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
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    .cursor {
      display: inline-block;
      width: 2px;
      height: 14px;
      background: ${textSec};
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
      padding: 10px 12px;
      gap: 6px;
      border-top: 0.5px solid ${border};
    }
    .follow-up-input {
      flex: 1;
      border: 1px solid ${isDark ? THEME.DARK_BORDER : 'rgba(120, 113, 108, 0.18)'};
      background: ${surfaceAlt};
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 13px;
      color: inherit;
      outline: none;
      font-family: inherit;
      transition: border-color 0.2s ease-out;
    }
    .follow-up-input:focus {
      border-color: ${isDark ? THEME.DARK_TEXT_SECONDARY : THEME.TEXT_SECONDARY};
    }
    .follow-up-input::placeholder {
      color: ${textSec};
    }
    .action-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      padding: 4px 6px;
      border-radius: 6px;
      color: ${textSec};
      transition: background 0.12s ease-out, transform 0.12s ease-out;
    }
    .action-btn:hover {
      background: ${surfaceHover};
      transform: translateY(-1px);
    }
    .error-msg {
      color: #ef4444;
      padding: 8px 0;
    }
    .retry-btn {
      background: ${text};
      color: ${isDark ? '#1c1917' : '#fafaf9'};
      border: none;
      padding: 4px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      margin-left: 8px;
      transition: transform 0.12s ease-out, box-shadow 0.12s ease-out;
    }
    .retry-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(28,25,23,0.15)'};
    }
    .rate-limit-msg {
      text-align: center;
      padding: 12px 0;
    }
    .rate-limit-msg .cta {
      display: inline-block;
      margin-top: 8px;
      color: ${textSec};
      cursor: pointer;
      text-decoration: underline;
    }
    .presets-section {
      padding: 8px 10px;
      border-bottom: 0.5px solid ${border};
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
      color: ${text};
      background: ${surfaceAlt};
      white-space: nowrap;
      transition: background 0.12s ease-out, transform 0.12s ease-out;
    }
    .preset-chip:hover {
      background: ${isDark ? THEME.DARK_SURFACE_HOVER : 'rgba(120, 113, 108, 0.12)'};
      transform: translateY(-1px);
    }
    .preset-input {
      width: 100%;
      border: 1px solid ${isDark ? THEME.DARK_BORDER : 'rgba(120, 113, 108, 0.18)'};
      background: ${surfaceAlt};
      border-radius: 8px;
      padding: 5px 8px;
      font-size: 12px;
      outline: none;
      box-sizing: border-box;
      color: ${text};
      font-family: inherit;
      transition: border-color 0.2s ease-out;
    }
    .preset-input:focus { border-color: ${isDark ? THEME.DARK_TEXT_SECONDARY : THEME.TEXT_SECONDARY}; }
    .preset-input::placeholder { color: ${textSec}; }
    .detection-badge {
      font-family: ${fontDisplay};
      font-size: 10px;
      color: ${textSec};
      font-weight: 600;
      letter-spacing: 0.3px;
      padding: 0 0 4px;
    }
    .response-section { display: none; }
    .response-section.active { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
    .history-panel { padding: 4px 0; }
    .history-entry {
      padding: 8px 0;
      border-bottom: 0.5px solid ${border};
      cursor: pointer;
      transition: background 0.12s ease-out;
    }
    .history-entry:hover { background: ${surfaceHover}; }
    .history-instruction { font-weight: 500; font-size: 13px; }
    .history-meta { font-size: 11px; color: ${textSec}; margin-top: 2px; }
    .clear-link {
      display: block;
      text-align: center;
      color: #ef4444;
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
