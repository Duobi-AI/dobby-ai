# Copy Response Button — Design Spec

## Overview

Add a per-message copy button to each AI response bubble in the chat UI. Copies the raw markdown text (not rendered HTML) so it pastes cleanly into Slack, Notion, docs, and editors.

## Behavior

- **Trigger**: Hover over any `.message-ai` bubble reveals a copy icon (clipboard SVG) in the top-right corner
- **Click**: Copies the raw markdown for that specific response to clipboard via `navigator.clipboard.writeText()`
- **Feedback**: Icon swaps to a checkmark (✓) for 1.5s, then reverts to clipboard icon
- **Timing**: Copy button only appears after streaming completes — not visible during typing

## State Management

Add to `src/content/shared/state.js`:

- `rawResponses: []` — array of raw markdown strings, one per AI response
- `pushRawResponse(text)` — appends to the array
- `clearRawResponses()` — resets to empty array

Each `.message-ai` div gets a `data-response-idx` attribute mapping to its index in `rawResponses`.

## Files Changed

| File | Change |
|------|--------|
| `src/content/shared/state.js` | Add `rawResponses` array, `pushRawResponse()`, `clearRawResponses()` |
| `src/content/bubble/stream.js` | On stream completion: push raw markdown to state, create copy button on the `.message-ai` div with correct index |
| `src/content/bubble/core.js` | Call `clearRawResponses()` in `hideBubble()` |
| `src/content/bubble/styles.js` | Add `.copy-btn` styles: absolute positioning top-right, opacity 0→1 on hover, icon swap animation |
| `tests/copy-button.test.js` | Unit tests for copy button rendering, clipboard interaction, feedback animation |

## DOM Structure

```html
<div class="message-ai" data-response-idx="0">
  <!-- rendered markdown content -->
  <button class="copy-btn" title="Copy">
    <svg><!-- clipboard icon --></svg>
  </button>
</div>
```

## Styles

- `.message-ai` gets `position: relative` (already scoped within bubble)
- `.copy-btn`: absolute, top 4px, right 4px, opacity 0, transition 0.15s
- `.message-ai:hover .copy-btn`: opacity 1
- `.copy-btn.copied`: show checkmark SVG instead of clipboard

## Edge Cases

- **Clipboard API**: `navigator.clipboard.writeText()` works in Chrome extension content scripts. No fallback needed.
- **Follow-ups**: Each follow-up response gets its own index and independent copy button.
- **Error messages**: No copy button on error/rate-limit UI.
- **Empty response**: No copy button if response text is empty.

## Testing

- Copy button appears on hover over `.message-ai`
- Copy button hidden during streaming
- Clicking copy writes raw markdown to clipboard
- Icon swaps to checkmark and reverts after 1.5s
- Multiple responses have independent copy buttons with correct content
- No copy button on error messages
