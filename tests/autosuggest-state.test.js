// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { AUTOSUGGEST_MAX_SUGGESTION_TOKENS } from '../src/shared/autosuggest-limits.js';

describe('autosuggest constants', () => {
  it('exports AUTOSUGGEST timing constants', async () => {
    const { AUTOSUGGEST } = await import('../src/content/shared/constants.js');
    expect(AUTOSUGGEST.DEBOUNCE_MS).toBe(500);
    expect(AUTOSUGGEST.MIN_CHARS).toBe(10);
    expect(AUTOSUGGEST.MAX_CONTEXT_CHARS).toBe(2000);
    expect(AUTOSUGGEST.MAX_SUGGESTION_TOKENS).toBe(AUTOSUGGEST_MAX_SUGGESTION_TOKENS);
    expect(AUTOSUGGEST.GHOST_OPACITY).toBe(0.4);
  });
});

describe('autosuggest state', () => {
  it('exports autosuggest state variables with correct defaults', async () => {
    const state = await import('../src/content/shared/state.js');
    expect(state.autosuggestEnabled).toBe(false);
    expect(state.autosuggestActiveEditor).toBeNull();
    expect(state.autosuggestCurrentSuggestion).toBe('');
    expect(state.autosuggestOverlayHost).toBeNull();
    expect(state.autosuggestPendingRequest).toBeNull();
    expect(state.autosuggestDebounceTimer).toBeNull();
  });

  it('exports setter functions that update state', async () => {
    const state = await import('../src/content/shared/state.js');
    state.setAutosuggestEnabled(true);
    expect(state.autosuggestEnabled).toBe(true);
    state.setAutosuggestEnabled(false);

    state.setAutosuggestCurrentSuggestion('hello world');
    expect(state.autosuggestCurrentSuggestion).toBe('hello world');
    state.setAutosuggestCurrentSuggestion('');
  });

  it('resetAutosuggestState clears all mutable state', async () => {
    const state = await import('../src/content/shared/state.js');
    state.setAutosuggestEnabled(true);
    state.setAutosuggestCurrentSuggestion('test');
    state.resetAutosuggestState();
    expect(state.autosuggestEnabled).toBe(false);
    expect(state.autosuggestActiveEditor).toBeNull();
    expect(state.autosuggestCurrentSuggestion).toBe('');
    expect(state.autosuggestOverlayHost).toBeNull();
    expect(state.autosuggestPendingRequest).toBeNull();
    expect(state.autosuggestDebounceTimer).toBeNull();
  });
});
