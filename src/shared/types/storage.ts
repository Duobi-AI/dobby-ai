import type { PresetUsage, ThemeMode } from './content';

export type UsageRequestKind = 'chat' | 'autosuggest' | 'screenshot';

export type UsageOutcome = 'success' | 'provider_error' | 'timeout' | 'rate_limited';

export type ModeUsageState = {
  chatRequests: number;
  autosuggestRequests: number;
  successfulRequests: number;
  providerErrors: number;
  timeouts: number;
  rateLimited: number;
};

export type UsageState = {
  day: string;
  chatRequests: number;
  autosuggestRequests: number;
  screenshotRequests: number;
  freeChatRemaining: number | null;
  usingOwnKey: boolean;
  lastUpdated: number;
  modeUsage?: {
    free: ModeUsageState;
    byok: ModeUsageState;
  };
};

export type UsageUpdateDetails = {
  remaining?: number | null;
  usingOwnKey?: boolean;
  rateLimited?: boolean;
  outcome?: UsageOutcome;
  countRequest?: boolean;
};

export type HistoryEntryDraft = {
  text?: string;
  instruction?: string;
  response?: string | null;
  pageUrl?: string;
  pageTitle?: string;
};

export type HistoryEntry = {
  id: string;
  text?: string;
  instruction?: string;
  response: string;
  pageUrl?: string;
  pageTitle?: string;
  timestamp: number;
};

export type AutosuggestCooldown = {
  until: number;
  consecutiveRateLimits: number;
};

export type ProxyCooldown = {
  until: number;
  consecutiveFailures: number;
};

export type StorageState = {
  dobbyEnabled?: boolean;
  screenshotEnabled?: boolean;
  autosuggestEnabled?: boolean;
  autosuggestCooldown?: AutosuggestCooldown;
  proxyCooldown?: ProxyCooldown;
  theme?: ThemeMode;
  userApiKey?: string;
  telemetryInstallationId?: string;
  telemetryLastSentDay?: string;
  proxyAccessToken?: string;
  dobbyUsage?: UsageState;
  chatHistory?: HistoryEntry[];
  presetUsage?: PresetUsage;
};

export type StorageKey = keyof StorageState;
