// @ts-check

/** @typedef {import('./types').ResolvedTheme} ResolvedTheme */
/** @typedef {import('./types').ThemeMode} ThemeMode */

export const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** @param {unknown} value @returns {ThemeMode} */
export function normalizeThemeMode(value) {
  return value === 'light' || value === 'dark' || value === 'auto' ? value : 'auto';
}

/** @returns {ResolvedTheme} */
function getSystemTheme() {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia(COLOR_SCHEME_QUERY).matches ? 'dark' : 'light';
  }
  return 'light';
}

/** @param {unknown} value @returns {ResolvedTheme} */
export function resolveTheme(value) {
  const mode = normalizeThemeMode(value);
  return mode === 'auto' ? getSystemTheme() : mode;
}

/** @returns {Promise<ResolvedTheme>} */
export function detectTheme() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local?.get) {
      resolve(resolveTheme('auto'));
      return;
    }

    chrome.storage.local.get('theme', (data) => {
      resolve(resolveTheme(data?.theme));
    });
  });
}

/**
 * @param {(theme: ResolvedTheme) => void} applyTheme
 * @returns {() => void}
 */
export function watchThemeChanges(applyTheme) {
  /** @type {ThemeMode} */
  let mode = 'auto';
  const mediaQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(COLOR_SCHEME_QUERY)
    : null;

  const applyResolved = () => applyTheme(resolveTheme(mode));

  const storageHandler = (changes, areaName) => {
    if (areaName && areaName !== 'local') return;
    if (!changes.theme) return;
    mode = normalizeThemeMode(changes.theme.newValue);
    applyResolved();
  };

  const mediaHandler = () => {
    if (mode === 'auto') applyResolved();
  };

  if (typeof chrome !== 'undefined' && chrome.storage?.local?.get) {
    chrome.storage.local.get('theme', (data) => {
      mode = normalizeThemeMode(data?.theme);
    });
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener(storageHandler);
  }

  if (mediaQuery) {
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', mediaHandler);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(mediaHandler);
    }
  }

  return () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged?.removeListener) {
      chrome.storage.onChanged.removeListener(storageHandler);
    }
    if (mediaQuery) {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', mediaHandler);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(mediaHandler);
      }
    }
  };
}
