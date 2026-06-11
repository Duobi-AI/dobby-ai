// src/content/bubble/stream.js — Streaming response and follow-up logic
import {
  responseText, appendResponseText, setResponseText,
  currentMessages, setCurrentMessages,
  renderTimer, setRenderTimer,
  setCurrentRequest,
  pushRawResponse,
} from '../shared/state.js';
import { requestChat } from '../api.js';
import { buildFollowUp } from '../prompt.js';
import { saveConversation } from '../history.js';
import { TIMING } from '../shared/constants.js';
import type { ChatMessage } from '../../shared/types';
import {
  addUserResponse,
  completeAssistantResponse,
  failAssistantResponse,
  removeBubbleMessage,
  setAssistantResponse,
  setBubbleViewStatus,
  showRateLimitView,
  startAssistantResponse,
} from './view-model.js';

export { createCopyButton } from './legacy-copy-button.js';

export function startStreaming(shadow: ShadowRoot, messages: ChatMessage[]): void {
  const responseId = startAssistantResponse();

  let firstToken = true;

  setCurrentRequest(requestChat(
    messages,
    (token) => {
      if (firstToken) {
        setBubbleViewStatus('typing...');
        firstToken = false;
      }
      appendResponseText(token);
      // Debounce rendering to ~50ms for performance
      if (!renderTimer) {
        setRenderTimer(setTimeout(() => {
          setRenderTimer(null);
          setAssistantResponse(responseId, responseText);
          const body = shadow.querySelector<HTMLElement>('.bubble-body')!;
          body.scrollTop = body.scrollHeight;
        }, TIMING.RENDER_DEBOUNCE));
      }
    },
    (usageInfo) => {
      // Flush any pending render
      if (renderTimer) { clearTimeout(renderTimer); setRenderTimer(null); }
      let responseIdx: number | undefined;
      if (responseText) {
        responseIdx = pushRawResponse(responseText);
      }
      completeAssistantResponse(responseId, responseText, responseIdx);
      if (usageInfo && usageInfo.usingOwnKey) {
        setBubbleViewStatus('your API key');
      } else if (usageInfo && usageInfo.remaining != null) {
        setBubbleViewStatus(`${usageInfo.remaining}/30 free`);
      } else {
        setBubbleViewStatus('');
      }
      shadow.querySelector<HTMLInputElement>('.follow-up-input')?.focus();
      setCurrentMessages([...currentMessages, { role: 'assistant', content: responseText }]);

      // Save to history — extract text from multimodal content arrays
      const firstUser = messages.find((m) => m.role === 'user');
      const instruction = messages.find((m) => m.role === 'system');
      let historyText = '';
      if (firstUser) {
        if (typeof firstUser.content === 'string') {
          historyText = firstUser.content;
        } else if (Array.isArray(firstUser.content)) {
          historyText = firstUser.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');
        }
      }
      saveConversation({
        text: historyText,
        instruction: (instruction?.content as string) || '',
        response: responseText,
        pageUrl: window.location.href,
        pageTitle: document.title,
      });
    },
    (code, message, data) => {
      if (code === 'RATE_LIMITED') {
        showRateLimitUI(shadow);
      } else {
        failAssistantResponse(responseId, message || 'Something went wrong.', () => {
          removeBubbleMessage(responseId);
          setResponseText('');
          startStreaming(shadow, messages);
        });
      }
    }
  ));
}

export function handleFollowUp(shadow: ShadowRoot, question: string): void {
  addUserResponse(question);

  // Scroll to show the user message
  const body = shadow.querySelector<HTMLElement>('.bubble-body')!;
  body.scrollTop = body.scrollHeight;

  // Reset responseText for the new AI reply (previous messages stay in DOM)
  setResponseText('');

  setCurrentMessages(buildFollowUp(currentMessages, question));
  startStreaming(shadow, currentMessages);
}

export function showRateLimitUI(shadow: ShadowRoot): void {
  showRateLimitView();
}
