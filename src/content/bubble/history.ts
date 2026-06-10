// src/content/bubble/history.js — History panel UI
import { setCurrentMessages, setResponseText } from '../shared/state.js';
import { getHistory, clearHistory } from '../history.js';
import { renderMarkdown } from './markdown.js';

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export async function showHistoryPanel(shadow) {
  const body = shadow.querySelector('.bubble-body');
  const entries = await getHistory();

  if (entries.length === 0) {
    body.innerHTML = '<div class="history-panel"><p class="history-empty">No history yet</p></div>';
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'history-panel';

  entries.forEach((entry) => {
    const el = document.createElement('div');
    el.className = 'history-entry';
    const timeAgo = getTimeAgo(entry.timestamp);
    const instrDiv = document.createElement('div');
    instrDiv.className = 'history-instruction';
    instrDiv.textContent = entry.text ? entry.text.substring(0, 60) : (entry.instruction || '').substring(0, 60);
    const metaDiv = document.createElement('div');
    metaDiv.className = 'history-meta';
    metaDiv.textContent = `${entry.pageTitle || 'Unknown page'} \u00b7 ${timeAgo}`;
    el.appendChild(instrDiv);
    el.appendChild(metaDiv);
    el.addEventListener('click', () => {
      body.innerHTML = '';
      const responseEl = document.createElement('div');
      responseEl.className = 'response-text';
      responseEl.innerHTML = renderMarkdown(entry.response);
      body.appendChild(responseEl);
      const cursor = document.createElement('span');
      cursor.className = 'cursor hidden';
      body.appendChild(cursor);

      // Show response section and hide presets
      const presetsSection = shadow.querySelector('.presets-section');
      if (presetsSection) presetsSection.classList.add('collapsed');
      const responseSection = shadow.querySelector('.response-section');
      if (responseSection) responseSection.classList.add('active');

      // Restore conversation state so follow-up works
      const msgs = [];
      if (entry.instruction) msgs.push({ role: 'system', content: entry.instruction });
      if (entry.text) msgs.push({ role: 'user', content: entry.text });
      if (entry.response) msgs.push({ role: 'assistant', content: entry.response });
      setCurrentMessages(msgs);
      setResponseText(entry.response || '');

      const followUpInput = shadow.querySelector('.follow-up-input');
      if (followUpInput) {
        followUpInput.disabled = false;
        followUpInput.focus();
      }
    });
    panel.appendChild(el);
  });

  const clearLink = document.createElement('span');
  clearLink.className = 'clear-link';
  clearLink.textContent = 'Clear all history';
  clearLink.addEventListener('click', async () => {
    await clearHistory();
    body.innerHTML = '<div class="history-panel"><p class="history-empty">History cleared</p></div>';
  });
  panel.appendChild(clearLink);

  body.innerHTML = '';
  body.appendChild(panel);
}
