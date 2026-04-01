// src/content/shared/constants.js — Shared constants for Dobby AI extension

export const Z_INDEX = {
  TRIGGER: 2147483647,
  SCREENSHOT_OVERLAY: 2147483646,
  BUBBLE: 2147483647,
  PROGRESS_RING: 2147483645,
  LIGHTBOX: 2147483647,
};

export const THEME = {
  // Accent — used sparingly: primary CTA, active states, brand mark
  ACCENT: '#7c3aed',
  ACCENT_LIGHT: '#a78bfa',
  ACCENT_BG: 'rgba(124, 58, 237, 0.1)',
  ACCENT_STRONG: 'rgba(124, 58, 237, 0.9)',
  ACCENT_BORDER: 'rgba(124, 58, 237, 0.6)',
  ACCENT_GLOW: 'rgba(124,58,237,0.4)',

  // Typography
  FONT_STACK: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  FONT_DISPLAY: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',

  // Light mode — warm stone palette
  BG_PRIMARY: '#fafaf9',
  TEXT_PRIMARY: '#1c1917',
  TEXT_SECONDARY: '#78716c',
  BORDER: 'rgba(120, 113, 108, 0.12)',
  SURFACE_HOVER: 'rgba(120, 113, 108, 0.06)',
  SURFACE_ALT: 'rgba(120, 113, 108, 0.08)',

  // Dark mode — warm dark palette
  DARK_BG_PRIMARY: 'rgba(28, 25, 23, 0.95)',
  DARK_TEXT_PRIMARY: '#e7e5e4',
  DARK_TEXT_SECONDARY: '#a8a29e',
  DARK_BORDER: 'rgba(168, 162, 158, 0.14)',
  DARK_SURFACE_HOVER: 'rgba(168, 162, 158, 0.1)',
  DARK_SURFACE_ALT: 'rgba(168, 162, 158, 0.08)',

  BACKDROP_BLUR: 'blur(12px)',
};

export const TIMING = {
  LONG_PRESS_DURATION: 1000,
  PROGRESS_RING_DELAY: 500,
  MOVEMENT_THRESHOLD: 5,
  SELECTION_DEBOUNCE: 300,
  SCROLL_DEBOUNCE: 150,
  RENDER_DEBOUNCE: 50,
  TOOLTIP_AUTO_HIDE: 2000,
  MOUSEUP_DELAY: 10,
  TOOLBAR_AUTO_HIDE: 3000,
  TOOLBAR_EXPAND_DURATION: 220,
  COPY_FEEDBACK_DURATION: 1500,
};

export const AUTOSUGGEST = {
  DEBOUNCE_MS: 500,
  MIN_CHARS: 10,
  MAX_CONTEXT_CHARS: 2000,
  MAX_SUGGESTION_TOKENS: 50,
  GHOST_OPACITY: 0.4,
  GHOST_COLOR: '#9ca3af',
};
