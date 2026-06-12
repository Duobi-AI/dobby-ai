import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { applyColorVariables } from './shared/color-palette.js';
import { COLOR_SCHEME_QUERY, normalizeThemeMode, resolveTheme } from './shared/theme.js';
import { mountReactRoot } from './shared/react-root.js';
import { getLocalStorage, removeLocalStorage } from './shared/storage.js';
import { createValidateApiKeyMessage } from './shared/runtime-messages.js';
import type { ThemeMode, ValidateApiKeyResponse } from './shared/types';

type Provider = 'openai' | 'anthropic';
type StatusTone = '' | 'error' | 'info';

let applyStoredOptionsState: (userApiKey: string | undefined, theme: unknown) => void = () => {};

function applyTheme(value: unknown): ThemeMode {
  const themeMode = normalizeThemeMode(value);
  const resolvedTheme = resolveTheme(themeMode);
  applyColorVariables(document.documentElement, resolvedTheme);
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.dataset.resolvedTheme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
  return themeMode;
}

function maskKey(key: string): string {
  if (!key || key.length < 12) return '••••••••';
  return key.substring(0, 7) + '••••' + key.substring(key.length - 4);
}

function OptionsApp() {
  const [storedKey, setStoredKey] = useState('');
  const [status, setStatus] = useState('');
  const [statusTone, setStatusTone] = useState<StatusTone>('');
  const [validating, setValidating] = useState(false);
  const [provider, setProvider] = useState<Provider>('openai');
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const apiKeyInput = useRef<HTMLInputElement>(null);
  const version = chrome.runtime.getManifest ? `v${chrome.runtime.getManifest().version}` : 'v1.2.2';

  const showNoKey = () => {
    flushSync(() => {
      setStoredKey('');
      setStatus('');
      setStatusTone('');
    });
    if (apiKeyInput.current) apiKeyInput.current.value = '';
  };

  applyStoredOptionsState = (userApiKey, theme) => {
    flushSync(() => {
      setThemeMode(applyTheme(theme || 'auto'));
      setStoredKey(userApiKey || '');
      setValidating(false);
      if (!userApiKey) {
        setStatus('');
        setStatusTone('');
      }
    });
    if (!userApiKey && apiKeyInput.current) apiKeyInput.current.value = '';
  };

  useEffect(() => {
    if (typeof chrome.storage.onChanged?.addListener !== 'function') return;
    const handleStorageChange = (changes: { theme?: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName && areaName !== 'local') return;
      if (changes.theme) {
        flushSync(() => setThemeMode(applyTheme(changes.theme!.newValue)));
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener?.(handleStorageChange);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const colorSchemeQuery = window.matchMedia(COLOR_SCHEME_QUERY);
    const handleSystemThemeChange = () => {
      if (themeMode === 'auto') applyTheme('auto');
    };
    if (typeof colorSchemeQuery.addEventListener === 'function') {
      colorSchemeQuery.addEventListener('change', handleSystemThemeChange);
      return () => colorSchemeQuery.removeEventListener?.('change', handleSystemThemeChange);
    }
    colorSchemeQuery.addListener?.(handleSystemThemeChange);
    return () => colorSchemeQuery.removeListener?.(handleSystemThemeChange);
  }, [themeMode]);

  const setStatusView = (message: string, tone: StatusTone, isValidating = false) => {
    flushSync(() => {
      setStatus(message);
      setStatusTone(tone);
      setValidating(isValidating);
    });
  };

  const saveKey = () => {
    const key = apiKeyInput.current?.value.trim() || '';
    if (!key) {
      setStatusView('Please enter an API key', 'error');
      return;
    }
    if (!key.startsWith('sk-')) {
      setStatusView('API key should start with "sk-"', 'error');
      return;
    }

    setStatusView('Validating...', 'info', true);
    chrome.runtime.sendMessage(createValidateApiKeyMessage(key), (response: ValidateApiKeyResponse) => {
      if (response?.valid) {
        flushSync(() => {
          setValidating(false);
          setStatus('');
          setStatusTone('');
          setStoredKey(key);
        });
      } else {
        setStatusView(response && 'error' in response ? response.error : 'Invalid API key', 'error');
      }
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') saveKey();
  };

  const removeKey = () => {
    removeLocalStorage('userApiKey', showNoKey);
  };

  const selectProvider = (nextProvider: Provider) => {
    flushSync(() => setProvider(nextProvider));
  };

  return (
    <div className="container">
      <div className="header">
        <img src="icons/dobby-logo-mark.svg" alt="Dobby AI" />
        <div>
          <h1>Dobby AI</h1>
          <div className="version" id="extension-version">{version}</div>
        </div>
      </div>

      <div className="card">
        <h2>API Key</h2>
        <p>Add your own API key for unlimited usage. Without a key, you get 30 free questions per day via our proxy.</p>

        <div id="has-key" style={{ display: storedKey ? 'block' : 'none' }}>
          <div className="current-key">
            <span className="key-value" id="key-display">{maskKey(storedKey)}</span>
            <button className="btn btn-danger" id="remove-btn" onClick={removeKey}>Remove key</button>
          </div>
          <div className="status success" id="key-status-active">Using your API key — unlimited access</div>
        </div>

        <div id="no-key" style={{ display: storedKey ? 'none' : 'block' }}>
          <div className="input-group">
            <input
              ref={apiKeyInput}
              type="password"
              id="api-key-input"
              placeholder="sk-..."
              autoComplete="off"
              onKeyDown={handleKeyDown}
            />
            <button className="btn btn-primary" id="save-btn" disabled={validating} onClick={saveKey}>Save</button>
          </div>
          <p className="hint">Your key is stored locally and never sent to our servers.</p>
          <div className={`status${statusTone ? ` ${statusTone}` : ''}`} id="key-status">{status}</div>
        </div>
      </div>

      <div className="card">
        <h2>How to get an API key</h2>
        <div style={{ marginBottom: '12px' }}>
          <span className={`provider-tab${provider === 'openai' ? ' active' : ''}`} data-provider="openai" onClick={() => selectProvider('openai')}>OpenAI</span>
          <span className={`provider-tab${provider === 'anthropic' ? ' active' : ''}`} data-provider="anthropic" onClick={() => selectProvider('anthropic')}>Anthropic (Claude)</span>
        </div>
        <div className="provider-content">
          <div className={`provider-panel${provider === 'openai' ? ' active' : ''}`} id="panel-openai">
            <ol className="steps">
              <li>Go to <a href="https://platform.openai.com/signup" target="_blank">platform.openai.com</a> and sign up or log in</li>
              <li>Navigate to <a href="https://platform.openai.com/api-keys" target="_blank">API Keys</a> in your dashboard</li>
              <li>Click <strong>"Create new secret key"</strong>, give it a name, and copy the key</li>
              <li>Paste the key above and click Save — Dobby AI will validate it automatically</li>
            </ol>
            <p className="hint">OpenAI keys typically start with <code>sk-</code>. You'll need a payment method on your OpenAI account. Usage is billed by OpenAI based on model and token usage.</p>
          </div>
          <div className={`provider-panel${provider === 'anthropic' ? ' active' : ''}`} id="panel-anthropic">
            <ol className="steps">
              <li>Go to <a href="https://console.anthropic.com/" target="_blank">console.anthropic.com</a> and sign up or log in</li>
              <li>Navigate to <a href="https://console.anthropic.com/settings/keys" target="_blank">API Keys</a> in Settings</li>
              <li>Click <strong>"Create Key"</strong>, name it, and copy the key</li>
              <li>Paste the key above and click Save — Dobby AI will validate it automatically</li>
            </ol>
            <p className="hint">Anthropic keys start with <code>sk-ant-</code>. Note: Dobby AI currently uses OpenAI for all features. Anthropic key support is planned.</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>How it works</h2>
        <div className="usage-info">
          <strong>Free tier:</strong> 30 questions/day powered by GPT-5.4 mini via our proxy server. No setup needed.<br /><br />
          <strong>Your own key:</strong> Requests go directly to the API provider — your key stays on your device and is never sent to our servers.<br /><br />
          <strong>Helpful links:</strong><br />
          • <a href="https://platform.openai.com/usage" target="_blank" style={{ color: 'inherit' }}>OpenAI usage dashboard</a><br />
          • <a href="https://platform.openai.com/docs/guides/rate-limits" target="_blank" style={{ color: 'inherit' }}>OpenAI rate limits</a><br />
          • <a href="https://console.anthropic.com/settings/usage" target="_blank" style={{ color: 'inherit' }}>Anthropic usage dashboard</a><br />
          • <a href="https://docs.anthropic.com/en/docs/about-claude/models" target="_blank" style={{ color: 'inherit' }}>Claude models &amp; pricing</a>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById('root') || document.body.appendChild(document.createElement('div'));
root.id ||= 'root';
if (root !== document.body.firstElementChild || document.body.childElementCount > 1) {
  document.body.replaceChildren(root);
}
mountReactRoot(root, <OptionsApp />);
getLocalStorage(['userApiKey', 'theme'], (result) => {
  applyStoredOptionsState(result.userApiKey, result.theme);
});
