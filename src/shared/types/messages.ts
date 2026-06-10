import type { ChatMessage } from './ai';

export type ToggleMessageType =
  | 'DOBBY_TOGGLE'
  | 'SCREENSHOT_TOGGLE'
  | 'AUTOSUGGEST_TOGGLE';

export type ToggleMessage = {
  type: ToggleMessageType;
  enabled: boolean;
};

export type ShowHistoryMessage = {
  type: 'SHOW_HISTORY';
};

export type ShowBubbleTextMessage = {
  type: 'SHOW_BUBBLE';
  text: string;
  image?: never;
};

export type ShowBubbleImageMessage = {
  type: 'SHOW_BUBBLE';
  image: string;
  text?: never;
};

export type ContentRuntimeMessage =
  | ToggleMessage
  | ShowHistoryMessage
  | ShowBubbleTextMessage
  | ShowBubbleImageMessage;

export type CaptureScreenshotMessage = {
  type: 'CAPTURE_SCREENSHOT';
};

export type OpenOptionsMessage = {
  type: 'OPEN_OPTIONS';
};

export type ValidateApiKeyMessage = {
  type: 'VALIDATE_API_KEY';
  apiKey: string;
};

export type BackgroundRuntimeMessage =
  | CaptureScreenshotMessage
  | OpenOptionsMessage
  | ValidateApiKeyMessage;

export type RuntimeMessage = ContentRuntimeMessage | BackgroundRuntimeMessage;

export type CaptureScreenshotResponse = {
  dataUrl?: string;
  error?: string;
};

export type ValidateApiKeyResponse =
  | { valid: true }
  | { valid: false; error: string };

export type StreamPortName = 'chat-stream' | 'autosuggest-stream';

export type ChatStreamRequest = {
  type: 'CHAT_REQUEST';
  messages: ChatMessage[];
};

export type AutosuggestStreamRequest = {
  type: 'AUTOSUGGEST_REQUEST';
  messages: ChatMessage[];
};

export type StreamTokenMessage = {
  type: 'token';
  text: string;
};

export type StreamErrorMessage = {
  type: 'error';
  code: number;
  message: string;
};

export type ChatStreamDoneMessage = {
  type: 'done';
  remaining: number | null;
  usingOwnKey: boolean;
};

export type AutosuggestStreamDoneMessage = {
  type: 'done';
};

export type ChatRateLimitedMessage = {
  type: 'rate_limited';
  remaining: number;
  resetAt?: string | number;
};

export type AutosuggestRateLimitedMessage = {
  type: 'rate_limited';
  remaining: number;
};

export type ChatStreamResponse =
  | StreamTokenMessage
  | StreamErrorMessage
  | ChatStreamDoneMessage
  | ChatRateLimitedMessage;

export type AutosuggestStreamResponse =
  | StreamTokenMessage
  | StreamErrorMessage
  | AutosuggestStreamDoneMessage
  | AutosuggestRateLimitedMessage;
