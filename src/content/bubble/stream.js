// src/content/bubble/stream.js — Streaming response and follow-up logic
import {
  responseText, appendResponseText, setResponseText,
  currentMessages, setCurrentMessages,
  renderTimer, setRenderTimer,
  setCurrentRequest,
  rawResponses, pushRawResponse,
} from '../shared/state.js';
import { requestChat } from '../api.js';
import { buildFollowUp } from '../prompt.js';
import { saveConversation } from '../history.js';
import { renderMarkdown } from './markdown.js';
import { TIMING } from '../shared/constants.js';

const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

export function createCopyButton(aiMsg, responseIdx) {
  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.title = 'Copy';
  btn.dataset.responseIdx = String(responseIdx);
  btn.innerHTML = COPY_ICON;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const text = rawResponses[responseIdx];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add('copied');
      btn.innerHTML = CHECK_ICON;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = COPY_ICON;
      }, 1500);
    } catch (err) {
      // clipboard write failed silently
    }
  });
  aiMsg.appendChild(btn);
}

export function startStreaming(shadow, messages) {
  const responseEl = shadow.querySelector('.response-text');
  const cursorEl = shadow.querySelector('.cursor');
  const statusEl = shadow.querySelector('.bubble-status');
  const followUpInput = shadow.querySelector('.follow-up-input');

  // Create a new AI message container for this response
  const aiMsg = document.createElement('div');
  aiMsg.className = 'message-ai';
  responseEl.appendChild(aiMsg);

  statusEl.textContent = 'thinking...';
  cursorEl.classList.remove('hidden');
  cursorEl.classList.add('blink');
  followUpInput.disabled = true;

  let firstToken = true;

  setCurrentRequest(requestChat(
    messages,
    (token) => {
      if (firstToken) {
        statusEl.textContent = 'typing...';
        firstToken = false;
      }
      appendResponseText(token);
      // Debounce rendering to ~50ms for performance
      if (!renderTimer) {
        setRenderTimer(setTimeout(() => {
          setRenderTimer(null);
          aiMsg.innerHTML = renderMarkdown(responseText);
          const body = shadow.querySelector('.bubble-body');
          body.scrollTop = body.scrollHeight;
        }, TIMING.RENDER_DEBOUNCE));
      }
    },
    (usageInfo) => {
      // Flush any pending render
      if (renderTimer) { clearTimeout(renderTimer); setRenderTimer(null); }
      aiMsg.innerHTML = renderMarkdown(responseText);
      if (usageInfo && usageInfo.usingOwnKey) {
        statusEl.textContent = 'your API key';
      } else if (usageInfo && usageInfo.remaining != null) {
        statusEl.textContent = `${usageInfo.remaining}/30 free`;
      } else {
        statusEl.textContent = '';
      }
      cursorEl.classList.add('hidden');
      // Store raw markdown and add copy button
      const idx = pushRawResponse(responseText);
      createCopyButton(aiMsg, idx);
      followUpInput.disabled = false;
      followUpInput.focus();
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
        instruction: instruction?.content || '',
        response: responseText,
        pageUrl: window.location.href,
        pageTitle: document.title,
      });
    },
    (code, message, data) => {
      cursorEl.classList.add('hidden');

      if (code === 'RATE_LIMITED') {
        showRateLimitUI(shadow);
      } else {
        statusEl.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-msg';
        errorDiv.textContent = message || 'Something went wrong.';
        const retryBtn = document.createElement('button');
        retryBtn.className = 'retry-btn';
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', () => {
          errorDiv.remove();
          aiMsg.remove();
          setResponseText('');
          startStreaming(shadow, messages);
        });
        errorDiv.appendChild(retryBtn);
        aiMsg.appendChild(errorDiv);
      }
    }
  ));
}

export function handleFollowUp(shadow, question) {
  const responseEl = shadow.querySelector('.response-text');

  // Add user message bubble
  const userMsg = document.createElement('div');
  userMsg.className = 'message-user';
  userMsg.textContent = question;
  responseEl.appendChild(userMsg);

  // Scroll to show the user message
  const body = shadow.querySelector('.bubble-body');
  body.scrollTop = body.scrollHeight;

  // Reset responseText for the new AI reply (previous messages stay in DOM)
  setResponseText('');

  setCurrentMessages(buildFollowUp(currentMessages, question));
  startStreaming(shadow, currentMessages);
}

export function showRateLimitUI(shadow) {
  const body = shadow.querySelector('.bubble-body');
  body.innerHTML = `
    <div class="rate-limit-msg">
      <p>You've used your 30 free questions today.</p>
      <p style="margin-top:8px">Add your own API key in Settings for unlimited access.</p>
      <span class="cta">Open Settings \u2192</span>
    </div>
  `;

  shadow.querySelector('.cta').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
  });
}
