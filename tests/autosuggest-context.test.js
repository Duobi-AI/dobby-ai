// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('autosuggest context', () => {
  let buildCompletionMessages, gatherPageContext;

  beforeEach(async () => {
    const mod = await import('../src/content/autosuggest/context.js');
    buildCompletionMessages = mod.buildCompletionMessages;
    gatherPageContext = mod.gatherPageContext;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('builds messages with system prompt and user text', () => {
    const messages = buildCompletionMessages('The quick brown fox');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('autocomplete');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('The quick brown fox');
  });

  it('truncates long text to MAX_CONTEXT_CHARS from the end', () => {
    const longText = 'a'.repeat(3000) + 'IMPORTANT_END';
    const messages = buildCompletionMessages(longText);
    expect(messages[1].content).toContain('IMPORTANT_END');
    expect(messages[1].content.length).toBeLessThanOrEqual(2013);
  });

  it('includes all context fields in system prompt', () => {
    const messages = buildCompletionMessages('hello world text', {
      pageTitle: 'Gmail - Compose',
      pageUrl: 'https://mail.google.com/compose',
      fieldLabel: 'Message body',
      fieldHint: 'Write your reply...',
      formFields: ['To: alice@example.com', 'Subject: Re: Meeting'],
      surroundingText: 'Previous message content here',
    });
    const sys = messages[0].content;
    expect(sys).toContain('Gmail - Compose');
    expect(sys).toContain('mail.google.com');
    expect(sys).toContain('Message body');
    expect(sys).toContain('Write your reply...');
    expect(sys).toContain('alice@example.com');
    expect(sys).toContain('Re: Meeting');
    expect(sys).toContain('Previous message content');
  });

  it('works without page context', () => {
    const messages = buildCompletionMessages('hello world text');
    expect(messages[0].content).not.toContain('Context:');
  });

  it('gatherPageContext returns page title and URL', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    const ctx = gatherPageContext(ta);
    expect(ctx.pageTitle).toBeDefined();
    expect(ctx.pageUrl).toBeDefined();
  });

  it('gatherPageContext picks up textarea placeholder', () => {
    const ta = document.createElement('textarea');
    ta.placeholder = 'Write a comment...';
    document.body.appendChild(ta);
    const ctx = gatherPageContext(ta);
    expect(ctx.fieldHint).toBe('Write a comment...');
  });

  it('gatherPageContext picks up label', () => {
    const label = document.createElement('label');
    label.textContent = 'Description';
    label.setAttribute('for', 'desc-ta');
    const ta = document.createElement('textarea');
    ta.id = 'desc-ta';
    document.body.appendChild(label);
    document.body.appendChild(ta);
    const ctx = gatherPageContext(ta);
    expect(ctx.fieldLabel).toBe('Description');
  });

  it('gatherPageContext picks up contenteditable hints and labels', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    editor.setAttribute('aria-label', 'Message');
    editor.setAttribute('data-placeholder', 'Write a reply...');
    document.body.appendChild(editor);

    const ctx = gatherPageContext(editor);
    expect(ctx.fieldLabel).toBe('Message');
    expect(ctx.fieldHint).toBe('Write a reply...');
  });

  it('gatherPageContext picks up sibling form fields', () => {
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.name = 'title';
    input.placeholder = 'Issue title';
    input.value = 'Bug: crash on startup';
    const ta = document.createElement('textarea');
    form.appendChild(input);
    form.appendChild(ta);
    document.body.appendChild(form);
    const ctx = gatherPageContext(ta);
    expect(ctx.formFields).toBeDefined();
    expect(ctx.formFields[0]).toContain('Bug: crash on startup');
  });

  it('gatherPageContext picks up surrounding text', () => {
    const section = document.createElement('section');
    const p = document.createElement('p');
    p.textContent = 'This is the surrounding context paragraph with enough text to be included.';
    const ta = document.createElement('textarea');
    ta.value = '';
    section.appendChild(p);
    section.appendChild(ta);
    document.body.appendChild(section);
    const ctx = gatherPageContext(ta);
    expect(ctx.surroundingText).toContain('surrounding context paragraph');
  });

  it('gatherPageContext skips password and hidden fields', () => {
    const form = document.createElement('form');
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.value = 'secret-token';
    const pw = document.createElement('input');
    pw.type = 'password';
    pw.value = 'my-password';
    const ta = document.createElement('textarea');
    form.appendChild(hidden);
    form.appendChild(pw);
    form.appendChild(ta);
    document.body.appendChild(form);
    const ctx = gatherPageContext(ta);
    expect(ctx.formFields).toBeUndefined();
  });
});
