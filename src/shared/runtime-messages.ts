import type {
  CaptureScreenshotMessage,
  OpenOptionsMessage,
  ShowHistoryMessage,
  ValidateApiKeyMessage,
} from './types';

export const CAPTURE_SCREENSHOT_MESSAGE: CaptureScreenshotMessage = {
  type: 'CAPTURE_SCREENSHOT',
};

export const OPEN_OPTIONS_MESSAGE: OpenOptionsMessage = {
  type: 'OPEN_OPTIONS',
};

export const SHOW_HISTORY_MESSAGE: ShowHistoryMessage = {
  type: 'SHOW_HISTORY',
};

export function createValidateApiKeyMessage(apiKey: string): ValidateApiKeyMessage {
  return {
    type: 'VALIDATE_API_KEY',
    apiKey,
  };
}
