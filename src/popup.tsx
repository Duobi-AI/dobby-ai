import { useEffect, useState, type ChangeEvent } from 'react';
import { flushSync } from 'react-dom';
import { applyColorVariables } from './shared/color-palette.js';
import { COLOR_SCHEME_QUERY, normalizeThemeMode, resolveTheme } from './shared/theme.js';
import { mountReactRoot } from './shared/react-root.js';
import { getLocalStorage, setLocalStorage } from './shared/storage.js';
import { SHOW_HISTORY_MESSAGE } from './shared/runtime-messages.js';
import type {
  ContentRuntimeMessage,
  StorageState,
  ThemeMode,
  UsageState,
} from './shared/types';

const FREE_CHAT_LIMIT = 30;
const LOW_QUOTA_THRESHOLD = 5;

type PopupState = {
  dobbyEnabled: boolean;
  screenshotEnabled: boolean;
  autosuggestEnabled: boolean;
  theme: ThemeMode;
  userApiKey?: string;
  dobbyUsage?: UsageState;
  hasHistory: boolean;
};

type UsageSummary = Pick<
  UsageState,
  'chatRequests' | 'autosuggestRequests' | 'screenshotRequests' | 'freeChatRemaining'
>;

let applyStoredPopupState: (data: StorageState) => void = () => {};

function getUtcDay(): string {
  return new Date().toISOString().split('T')[0]!;
}

function applyTheme(value: unknown): ThemeMode {
  const themeMode = normalizeThemeMode(value);
  const resolvedTheme = resolveTheme(themeMode);
  applyColorVariables(document.documentElement, resolvedTheme);
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.dataset.resolvedTheme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
  return themeMode;
}

function getResetTimeLabel(): string {
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  return reset.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function todayUsage(rawUsage: UsageState | undefined): UsageSummary {
  if (!rawUsage || rawUsage.day !== getUtcDay()) {
    return {
      chatRequests: 0,
      autosuggestRequests: 0,
      screenshotRequests: 0,
      freeChatRemaining: null,
    };
  }
  return rawUsage;
}

function getUsageView({ userApiKey, dobbyUsage }: Pick<PopupState, 'userApiKey' | 'dobbyUsage'>) {
  const usage = todayUsage(dobbyUsage);
  if (userApiKey) {
    return {
      tone: 'ok',
      primary: 'Using your API key',
      secondary: `Provider billing applies. Today: ${usage.chatRequests || 0} chats, ${usage.autosuggestRequests || 0} suggestions, ${usage.screenshotRequests || 0} screenshots.`,
    };
  }

  const remaining = Number.isFinite(usage.freeChatRemaining) ? usage.freeChatRemaining : null;
  if (remaining == null) {
    return {
      tone: '',
      primary: `${FREE_CHAT_LIMIT} free questions/day`,
      secondary: 'Ask once to sync remaining quota. Add an API key for unlimited use.',
    };
  }

  return {
    tone: remaining <= 0 ? 'danger' : remaining <= LOW_QUOTA_THRESHOLD ? 'warning' : 'ok',
    primary: remaining <= 0 ? 'Free quota used' : `${remaining}/${FREE_CHAT_LIMIT} free left`,
    secondary: `Resets around ${getResetTimeLabel()}. Today: ${usage.chatRequests || 0} chats, ${usage.autosuggestRequests || 0} suggestions, ${usage.screenshotRequests || 0} screenshots.`,
  };
}

function broadcastToContent(message: ContentRuntimeMessage): void {
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id as number, message).catch(() => {});
    });
  });
}

function SwitchRow({
  id,
  label,
  title,
  enabled,
  ariaLabel,
  onChange,
}: {
  id: string;
  label: string;
  title?: string;
  enabled: boolean;
  ariaLabel: string;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <div className="toggle-copy">
        <span className="toggle-label" title={title}>{label}</span>
        <span className={`state-badge ${enabled ? 'on' : 'off'}`} id={id === 'enabled' ? 'status' : `${id.replace('-enabled', '')}-status`}>
          {enabled ? 'On' : 'Off'}
        </span>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          id={id}
          checked={enabled}
          aria-label={ariaLabel}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.checked)}
        />
        <span className="slider" />
      </label>
    </div>
  );
}

function PopupApp() {
  const [state, setState] = useState<PopupState>({
    dobbyEnabled: true,
    screenshotEnabled: true,
    autosuggestEnabled: false,
    theme: 'auto',
    hasHistory: false,
  });
  const [feedback, setFeedback] = useState('');
  const usage = getUsageView(state);
  const version = chrome.runtime.getManifest ? `v${chrome.runtime.getManifest().version}` : '';

  applyStoredPopupState = (data) => {
    const theme = applyTheme(data.theme || 'auto');
    flushSync(() => {
      setState({
        dobbyEnabled: data.dobbyEnabled !== false,
        screenshotEnabled: data.screenshotEnabled !== false,
        autosuggestEnabled: data.autosuggestEnabled === true,
        theme,
        userApiKey: data.userApiKey,
        dobbyUsage: data.dobbyUsage,
        hasHistory: Boolean(data.chatHistory?.length),
      });
    });
  };

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const colorSchemeQuery = window.matchMedia(COLOR_SCHEME_QUERY);
    const handleSystemThemeChange = () => {
      if (state.theme === 'auto') applyTheme('auto');
    };
    if (typeof colorSchemeQuery.addEventListener === 'function') {
      colorSchemeQuery.addEventListener('change', handleSystemThemeChange);
      return () => colorSchemeQuery.removeEventListener?.('change', handleSystemThemeChange);
    }
    colorSchemeQuery.addListener?.(handleSystemThemeChange);
    return () => colorSchemeQuery.removeListener?.(handleSystemThemeChange);
  }, [state.theme]);

  const updateToggle = (
    key: 'dobbyEnabled' | 'screenshotEnabled' | 'autosuggestEnabled',
    type: ContentRuntimeMessage['type'],
    enabled: boolean,
  ) => {
    setState((current) => ({ ...current, [key]: enabled }));
    setLocalStorage({ [key]: enabled } as Pick<StorageState, typeof key>);
    broadcastToContent({ type, enabled } as ContentRuntimeMessage);
  };

  const openHistory = () => {
    setFeedback('');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        flushSync(() => setFeedback('Open a regular webpage to show history.'));
        return;
      }
      chrome.tabs.sendMessage(tabId, SHOW_HISTORY_MESSAGE)
        .then(() => flushSync(() => setFeedback('History opened on this page.')))
        .catch(() => flushSync(() => setFeedback('Open a regular webpage to show history.')));
    });
  };

  const clearHistory = () => {
    setLocalStorage({ chatHistory: [] }, () => {
      flushSync(() => {
        setState((current) => ({ ...current, hasHistory: false }));
        setFeedback('History cleared.');
      });
    });
  };

  const selectTheme = (theme: ThemeMode) => {
    setLocalStorage({ theme });
    applyTheme(theme);
    setState((current) => ({ ...current, theme }));
  };

  return (
    <>
      <div className="header">
        <img className="app-logo" src="icons/dobby-logo-mark.svg" alt="Dobby AI" />
        <div className="header-text">
          <div>Dobby AI</div>
          <div className="version" id="version">{version}</div>
        </div>
      </div>
      <div className={`usage-card${usage.tone ? ` ${usage.tone}` : ''}`} id="usage-card">
        <div className="usage-primary" id="usage-primary">{usage.primary}</div>
        <div className="usage-secondary" id="usage-secondary">{usage.secondary}</div>
      </div>
      <SwitchRow
        id="enabled"
        label="Dobby on this browser"
        enabled={state.dobbyEnabled}
        ariaLabel="Enable or disable Dobby AI"
        onChange={(enabled) => updateToggle('dobbyEnabled', 'DOBBY_TOGGLE', enabled)}
      />
      <SwitchRow
        id="screenshot-enabled"
        label="Long-press screenshots"
        title="Long-press anywhere to screenshot a region and ask AI about it."
        enabled={state.screenshotEnabled}
        ariaLabel="Enable or disable screenshot mode"
        onChange={(enabled) => updateToggle('screenshotEnabled', 'SCREENSHOT_TOGGLE', enabled)}
      />
      <SwitchRow
        id="autosuggest-enabled"
        label="Text auto-suggest"
        title="Works in standard text fields (textarea). Gmail, Docs, and Notion support coming soon."
        enabled={state.autosuggestEnabled}
        ariaLabel="Enable or disable auto-suggest"
        onChange={(enabled) => updateToggle('autosuggestEnabled', 'AUTOSUGGEST_TOGGLE', enabled)}
      />
      <div className="quick-actions">
        <button className="quick-action" id="history" disabled={!state.hasHistory} onClick={openHistory}>History</button>
        <button className="quick-action" id="clear-history" disabled={!state.hasHistory} onClick={clearHistory}>Clear</button>
        <button className="quick-action" id="settings" onClick={() => chrome.runtime.openOptionsPage()}>Settings</button>
      </div>
      <div className="action-feedback" id="action-feedback">{feedback}</div>
      <div className="theme-row">
        <span className="status">Theme</span>
        <div className="theme-segment" id="theme-segment" role="group" aria-label="Theme">
          {(['auto', 'light', 'dark'] as const).map((theme) => (
            <button
              className={`theme-option${state.theme === theme ? ' active' : ''}`}
              data-theme={theme}
              aria-pressed={state.theme === theme}
              key={theme}
              onClick={() => selectTheme(theme)}
            >
              {theme[0]!.toUpperCase() + theme.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <a
        className="support-link"
        id="report-bug"
        href="https://github.com/Duobi-AI/dobby-ai/issues/new?template=bug_report.yml"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Report a bug on GitHub"
      >
        <svg className="support-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M8 9h8m-8 4h8m-5 4h3a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v5a4 4 0 0 0 4 4h1l3 3v-3Z" />
        </svg>
        <span className="support-copy">
          <span className="support-title">Report a bug</span>
          <span className="support-detail">Tell us what went wrong</span>
        </span>
        <span className="support-arrow" aria-hidden="true">&gt;</span>
      </a>
    </>
  );
}

const root = document.getElementById('root') || document.body.appendChild(document.createElement('div'));
root.id ||= 'root';
if (root !== document.body.firstElementChild || document.body.childElementCount > 1) {
  document.body.replaceChildren(root);
}
mountReactRoot(root, <PopupApp />);
getLocalStorage([
  'dobbyEnabled',
  'screenshotEnabled',
  'autosuggestEnabled',
  'theme',
  'userApiKey',
  'dobbyUsage',
  'chatHistory',
], applyStoredPopupState);
