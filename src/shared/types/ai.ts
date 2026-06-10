export type ChatRole = 'system' | 'user' | 'assistant';

export type TextContentPart = {
  type: 'text';
  text: string;
};

export type ImageContentPart = {
  type: 'image_url';
  image_url: {
    url: string;
  };
};

export type ChatContentPart = TextContentPart | ImageContentPart;
export type ChatContent = string | ChatContentPart[];

export type ChatMessage = {
  role: ChatRole;
  content: ChatContent;
};

export type ProxyPurpose = 'chat' | 'autosuggest';

export type ProxyChatPayload = {
  messages: ChatMessage[];
  signature: string;
  timestamp: number;
  purpose?: ProxyPurpose;
};

export type StreamRequestHandle = {
  cancel: () => void;
};

export type ChatUsageInfo = {
  remaining: number | null;
  usingOwnKey: boolean;
};

export type RateLimitInfo = {
  remaining: number;
  resetAt?: string | number;
};
