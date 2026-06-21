import type { PresetUsage, ThemeMode } from './content';

export type UsageRequestKind = 'chat' | 'autosuggest' | 'screenshot';

export type UsageState = {
  day: string;
  chatRequests: number;
  autosuggestRequests: number;
  screenshotRequests: number;
  freeChatRemaining: number | null;
  usingOwnKey: boolean;
  lastUpdated: number;
};

export type UsageUpdateDetails = {
  remaining?: number | null;
  usingOwnKey?: boolean;
  rateLimited?: boolean;
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

export type StorageState = {
  dobbyEnabled?: boolean;
  screenshotEnabled?: boolean;
  autosuggestEnabled?: boolean;
  theme?: ThemeMode;
  userApiKey?: string;
  proxyAccessToken?: string;
  dobbyUsage?: UsageState;
  chatHistory?: HistoryEntry[];
  presetUsage?: PresetUsage;
};

export type StorageKey = keyof StorageState;
