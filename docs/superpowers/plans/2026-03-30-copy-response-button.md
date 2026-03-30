# Copy Response Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-message copy button to AI response bubbles that copies raw markdown to clipboard.

**Architecture:** Track raw markdown strings in a state array (`rawResponses`). Each `.message-ai` div gets a copy button (clipboard SVG) positioned top-right, revealed on hover. Click copies the corresponding raw markdown via `navigator.clipboard.writeText()`, icon swaps to checkmark for 1.5s.

**Tech Stack:** Vanilla JS, Shadow DOM, Vitest + jsdom

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/content/shared/state.js` | Add `rawResponses` array + push/clear helpers |
| `src/content/bubble/stream.js` | Push raw markdown on completion, attach copy button |
| `src/content/bubble/core.js` | Clear `rawResponses` in `hideBubble()` |
| `src/content/bubble/styles.js` | Copy button styles (hover reveal, positioning) |
| `tests/copy-button.test.js` | Unit tests for all copy button behavior |

---

### Task 1: State — Add rawResponses tracking

**Files:**
- Modify: `src/content/shared/state.js`
- Test: `tests/copy-button.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/copy-button.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  rawResponses,
  pushRawResponse,
  clearRawResponses,
} from '../src/content/shared/state.js';

describe('rawResponses state', () => {
  beforeEach(() => {
    clearRawResponses();
  });

  it('starts empty', () => {
    expect(rawResponses).toEqual([]);
  });

  it('pushRawResponse appends to array', () => {
    pushRawResponse('hello **world**');
    pushRawResponse('second response');
    expect(rawResponses).toEqual(['hello **world**', 'second response']);
  });

  it('clearRawResponses resets to empty', () => {
    pushRawResponse('something');
    clearRawResponses();
    expect(rawResponses).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/copy-button.test.js`
Expected: FAIL — `pushRawResponse` and `clearRawResponses` not exported

- [ ] **Step 3: Write minimal implementation**

Add to `src/content/shared/state.js` at the end of the bubble state section (after line 15):

```js
// Raw AI response tracking (for copy button)
export let rawResponses = [];
export function pushRawResponse(text) { rawResponses.push(text); }
export function clearRawResponses() { rawResponses = []; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/copy-button.test.js`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Commit**

```bash
git add src/content/shared/state.js tests/copy-button.test.js
git commit -m "feat: add rawResponses state for copy button"
```

---

### Task 2: Styles — Add copy button CSS

**Files:**
- Modify: `src/content/bubble/styles.js`

- [ ] **Step 1: Add copy button styles**

Add these rules to the `getStyles()` return string in `styles.js`, after the `.message-ai` block (after the line with `word-break: break-word;` closing brace around line 129):

```css
.message-ai {
  position: relative;
}
.copy-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: ${isDark ? '#a1a1aa' : '#71717a'};
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  line-height: 1;
}
.message-ai:hover .copy-btn { opacity: 1; }
.copy-btn:hover { background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}; }
.copy-btn.copied { color: #22c55e; }
```

- [ ] **Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes with no errors

- [ ] **Step 3: Commit**

```bash
git add src/content/bubble/styles.js
git commit -m "feat: add copy button styles with hover reveal"
```

---

### Task 3: Stream — Attach copy button on completion

**Files:**
- Modify: `src/content/bubble/stream.js`
- Modify: `src/content/bubble/core.js`

- [ ] **Step 1: Import state helpers in stream.js**

Add to the imports at top of `src/content/bubble/stream.js`:

```js
import { pushRawResponse } from '../shared/state.js';
```

- [ ] **Step 2: Create copy button helper and attach on stream completion**

Add this helper function before `startStreaming` in `stream.js`:

```js
function createCopyButton(aiMsg, responseIdx) {
  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.title = 'Copy';
  btn.dataset.responseIdx = responseIdx;
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const { rawResponses } = await import('../shared/state.js');
    const text = rawResponses[responseIdx];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add('copied');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 1500);
    } catch (err) {
      // clipboard write failed silently
    }
  });
  aiMsg.appendChild(btn);
}
```

- [ ] **Step 3: Push raw response and attach button in onComplete callback**

In `startStreaming`, inside the `onComplete` callback (the second callback to `requestChat`), after `cursorEl.classList.add('hidden');` (line 61) and before `followUpInput.disabled = false;`:

```js
// Store raw markdown and add copy button
const idx = pushRawResponse(responseText);
createCopyButton(aiMsg, idx);
```

Update `pushRawResponse` in state.js to return the index:

```js
export function pushRawResponse(text) { rawResponses.push(text); return rawResponses.length - 1; }
```

- [ ] **Step 4: Clear rawResponses in hideBubble**

In `src/content/bubble/core.js`, add import:

```js
import { clearRawResponses } from '../shared/state.js';
```

In `hideBubble()`, add `clearRawResponses();` after `setResponseText('');` (line 356):

```js
setResponseText('');
clearRawResponses();
```

- [ ] **Step 5: Verify build succeeds**

Run: `npm run build`
Expected: Build completes with no errors

- [ ] **Step 6: Commit**

```bash
git add src/content/bubble/stream.js src/content/bubble/core.js src/content/shared/state.js
git commit -m "feat: attach copy button to AI responses with raw markdown copy"
```

---

### Task 4: Tests — Copy button rendering and behavior

**Files:**
- Modify: `tests/copy-button.test.js`

- [ ] **Step 1: Add DOM tests for copy button**

Append to `tests/copy-button.test.js`:

```js
import { vi } from 'vitest';
import { createCopyButton } from '../src/content/bubble/stream.js';

describe('copy button DOM', () => {
  beforeEach(() => {
    clearRawResponses();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('creates a button with copy-btn class', () => {
    pushRawResponse('test markdown');
    const div = document.createElement('div');
    createCopyButton(div, 0);
    const btn = div.querySelector('.copy-btn');
    expect(btn).toBeTruthy();
    expect(btn.title).toBe('Copy');
  });

  it('copies raw markdown on click', async () => {
    pushRawResponse('hello **bold**');
    const div = document.createElement('div');
    createCopyButton(div, 0);
    const btn = div.querySelector('.copy-btn');
    await btn.click();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello **bold**');
  });

  it('adds copied class after click', async () => {
    vi.useFakeTimers();
    pushRawResponse('test');
    const div = document.createElement('div');
    createCopyButton(div, 0);
    const btn = div.querySelector('.copy-btn');
    await btn.click();
    expect(btn.classList.contains('copied')).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(btn.classList.contains('copied')).toBe(false);
    vi.useRealTimers();
  });

  it('does not copy if index has no response', async () => {
    const div = document.createElement('div');
    createCopyButton(div, 5);
    const btn = div.querySelector('.copy-btn');
    await btn.click();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run tests/copy-button.test.js`
Expected: All tests PASS

- [ ] **Step 3: Run full test suite to check for regressions**

Run: `npx vitest run`
Expected: All existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/copy-button.test.js
git commit -m "test: add copy button unit tests"
```

---

### Task 5: Visual verification with Playwright

**Files:**
- None created (manual verification)

- [ ] **Step 1: Build the extension**

Run: `npm run build`

- [ ] **Step 2: Load and visually verify in Playwright**

Run a Playwright script to:
1. Load the extension in a persistent browser context
2. Navigate to a page, select text, trigger Dobby
3. Choose a preset to get a response
4. Screenshot the response bubble — verify copy button appears on hover
5. Screenshot the copied state — verify checkmark icon

- [ ] **Step 3: Log to Obsidian**

```bash
obsidian append file="Dobby AI" content="- **2026-03-30** — Implemented copy response button: per-message copy with raw markdown, hover reveal, checkmark feedback. Files: state.js, stream.js, core.js, styles.js."
```
