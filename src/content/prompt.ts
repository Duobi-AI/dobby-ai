import type {
  ChatContentPart,
  ChatMessage,
  ImageContentPart,
} from '../shared/types';

// prompt.js — OpenAI chat message format
export const MAX_TEXT_LENGTH = 6000;
const MAX_INSTRUCTION_LENGTH = 500;
const MAX_SOURCE_CONTEXT_LENGTH = 500;

const TRUNCATION_MARKER = '...[truncated]';
const SYSTEM_PROMPT = 'You are Dobby AI, a helpful assistant. The user has selected text on a webpage and the full selected text is provided below. Do NOT attempt to access, fetch, or visit any URLs — the text content is already included in the message. A source URL may be provided as metadata only. Be concise and clear. Always respond in the same language as the selected text.';

function truncateToBudget(text: string, maxLength: number): string {
  if (!text || maxLength <= 0) return '';
  if (text.length <= maxLength) return text;
  if (maxLength <= TRUNCATION_MARKER.length) {
    return TRUNCATION_MARKER.slice(0, maxLength);
  }
  return text.substring(0, maxLength - TRUNCATION_MARKER.length) + TRUNCATION_MARKER;
}

function buildSourceSuffix(includePageContext: boolean): string {
  if (!includePageContext) return '';

  const title = typeof document !== 'undefined' ? document.title : '';
  const url = typeof window !== 'undefined' ? window.location.href : '';
  return truncateToBudget(
    `\n\n(Source: "${title}" — ${url})`,
    MAX_SOURCE_CONTEXT_LENGTH
  );
}

/**
 * Build OpenAI chat messages array from selected text and instruction.
 * @param instruction Preset or custom instruction (can be empty/null)
 * @param images Optional image content objects
 */
export function buildChatMessages(
  selectedText: string,
  instruction: string | null | undefined,
  includePageContext: boolean,
  images?: ImageContentPart[],
): ChatMessage[] {
  const safeInstruction = instruction
    ? truncateToBudget(String(instruction), MAX_INSTRUCTION_LENGTH)
    : '';
  const sourceSuffix = buildSourceSuffix(includePageContext);
  const instructionPrefix = safeInstruction ? `${safeInstruction}:\n\n` : '';
  const textBudget = MAX_TEXT_LENGTH - SYSTEM_PROMPT.length - instructionPrefix.length - sourceSuffix.length;
  const text = truncateToBudget(selectedText || '', textBudget);

  const messages: ChatMessage[] = [];

  // System message sets the assistant's role
  messages.push({
    role: 'system',
    content: SYSTEM_PROMPT,
  });

  // Combine instruction + selected text in the user message so the model
  // clearly knows what task to perform on which text
  const userText = `${instructionPrefix}${text}${sourceSuffix}`;

  // When images are present, build multimodal content array
  if (images && images.length > 0) {
    const contentParts: ChatContentPart[] = [];
    // If there's meaningful text, put it first
    if (text.trim()) {
      contentParts.push({ type: 'text', text: userText });
      images.forEach(img => contentParts.push(img));
    } else {
      // Image-only: images first, then instruction as text
      images.forEach(img => contentParts.push(img));
      const instructionText = safeInstruction || 'Explain this image';
      contentParts.push({ type: 'text', text: instructionText });
    }
    messages.push({ role: 'user', content: contentParts });
  } else {
    messages.push({ role: 'user', content: userText });
  }

  return messages;
}

/**
 * Append a follow-up question to an existing conversation.
 */
export function buildFollowUp(existingMessages: ChatMessage[], newQuestion: string): ChatMessage[] {
  return [...existingMessages, { role: 'user', content: newQuestion }];
}
