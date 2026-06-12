// proxy/src/openai.ts
import { DEFAULT_OPENAI_MODEL, DEFAULT_REASONING_EFFORT } from '../../src/shared/model-config.js';
import type { ChatMessage } from '../../src/shared/types';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MAX_TOKENS = 1000;

export async function createChatStream(
  messages: ChatMessage[],
  apiKey: string,
  signal?: AbortSignal,
  maxTokens?: number,
): Promise<Response> {
  return fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_OPENAI_MODEL,
      messages,
      stream: true,
      reasoning_effort: DEFAULT_REASONING_EFFORT,
      max_completion_tokens: maxTokens || DEFAULT_MAX_TOKENS,
    }),
    signal,
  });
}
