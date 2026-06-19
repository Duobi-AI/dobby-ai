// tests/prompt.test.js
import { buildChatMessages, buildFollowUp, MAX_TOTAL_PROMPT_CHARS } from '../src/content/prompt.js';

const SYSTEM_MSG = {
  role: 'system',
  content: expect.stringContaining('current tab context'),
};

describe('MAX_TOTAL_PROMPT_CHARS', () => {
  it('matches the expanded current-tab context budget', () => {
    expect(MAX_TOTAL_PROMPT_CHARS).toBe(64000);
  });
});

describe('buildChatMessages', () => {
  function totalTextChars(messages) {
    return messages.reduce((total, message) => {
      if (typeof message.content === 'string') {
        return total + message.content.length;
      }
      if (Array.isArray(message.content)) {
        return total + message.content
          .filter((item) => item.type === 'text')
          .reduce((sum, item) => sum + item.text.length, 0);
      }
      return total;
    }, 0);
  }

  it('always includes system message', () => {
    const result = buildChatMessages('hello world', '', false);
    expect(result[0]).toEqual(SYSTEM_MSG);
  });

  it('puts raw text in user message when no instruction', () => {
    const result = buildChatMessages('hello world', '', false);
    expect(result.length).toBe(2);
    expect(result[1]).toEqual({ role: 'user', content: 'hello world' });
  });

  it('combines instruction and text in user message', () => {
    const result = buildChatMessages('code here', 'Explain this code', false);
    expect(result.length).toBe(2);
    expect(result[0]).toEqual(SYSTEM_MSG);
    expect(result[1]).toEqual({ role: 'user', content: 'Explain this code:\n\ncode here' });
  });

  it('handles null instruction like empty', () => {
    const result = buildChatMessages('text', null, false);
    expect(result.length).toBe(2);
    expect(result[1].content).toBe('text');
  });

  it('truncates selected text so total text payload fits the proxy limit', () => {
    const longText = 'a'.repeat(MAX_TOTAL_PROMPT_CHARS + 500);
    const result = buildChatMessages(longText, 'Summarize the following', true);
    const userContent = result[1].content;
    expect(totalTextChars(result)).toBeLessThanOrEqual(MAX_TOTAL_PROMPT_CHARS);
    expect(userContent).toContain('...[truncated]');
  });

  it('does not truncate when the total text payload fits the budget', () => {
    const text = 'a'.repeat(1000);
    const result = buildChatMessages(text, '', false);
    expect(result[1].content).toBe(text);
  });

  it('appends source metadata when includePageContext is true without extracted context', () => {
    const result = buildChatMessages('hello', '', true);
    expect(result[1].content).toContain('Source:');
  });

  it('does not append page context when false', () => {
    const result = buildChatMessages('hello', '', false);
    expect(result[1].content).not.toContain('(Source:');
  });

  it('preserves whitespace and newlines in text', () => {
    const text = '  line one\n  line two';
    const result = buildChatMessages(text, '', false);
    expect(result[1].content).toBe(text);
  });

  it('instruction + text + page context are combined correctly', () => {
    const result = buildChatMessages('some text', 'Summarize the following', true);
    const content = result[1].content;
    expect(content).toContain('Task:\nSummarize the following');
    expect(content).toContain('Selected text:\nsome text');
    expect(content).toContain('Source:');
  });

  it('includes extracted current-tab context as a structured prompt section', () => {
    const result = buildChatMessages('selected renewal sentence', 'Explain', true, undefined, {
      title: 'Renewal dashboard',
      url: 'https://example.com/accounts',
      text: 'Enterprise renewal risk increased after a pricing change.',
      extractionMode: 'main',
      originalChars: 1000,
      cleanedChars: 120,
      truncated: false,
    });

    expect(result[0]).toEqual(SYSTEM_MSG);
    expect(result[1].content).toContain('Task:\nExplain');
    expect(result[1].content).toContain('Selected text:\nselected renewal sentence');
    expect(result[1].content).toContain('Current tab context:\nEnterprise renewal risk increased');
    expect(result[1].content).toContain('Source:\n"Renewal dashboard" — https://example.com/accounts');
  });

  it('preserves selected text when extracted page context is long', () => {
    const selectedText = 'critical selected sentence that must remain intact';
    const result = buildChatMessages(selectedText, 'Explain', true, undefined, {
      title: 'Long document',
      url: 'https://example.com/long',
      text: 'context '.repeat(MAX_TOTAL_PROMPT_CHARS),
      extractionMode: 'body',
      originalChars: 200000,
      cleanedChars: 180000,
      truncated: true,
    });

    const content = result[1].content;
    expect(totalTextChars(result)).toBeLessThanOrEqual(MAX_TOTAL_PROMPT_CHARS);
    expect(content).toContain(`Selected text:\n${selectedText}`);
    expect(content).toContain('Current tab context:');
    expect(content).toContain('...[truncated]');
  });

  it('returns string content when no images', () => {
    const result = buildChatMessages('text', 'Explain', false);
    expect(typeof result[1].content).toBe('string');
  });

  it('returns string content when images is empty array', () => {
    const result = buildChatMessages('text', 'Explain', false, []);
    expect(typeof result[1].content).toBe('string');
  });

  it('returns array content when images are provided with text', () => {
    const images = [{ type: 'image_url', image_url: { url: 'https://example.com/img.png' } }];
    const result = buildChatMessages('some text', 'Explain', false, images);
    expect(Array.isArray(result[1].content)).toBe(true);
    // Text first, then image
    expect(result[1].content[0].type).toBe('text');
    expect(result[1].content[0].text).toContain('Explain');
    expect(result[1].content[0].text).toContain('some text');
    expect(result[1].content[1]).toEqual(images[0]);
  });

  it('puts images first when text is empty (image-only mode)', () => {
    const images = [{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc' } }];
    const result = buildChatMessages('', 'Explain this image', false, images);
    expect(Array.isArray(result[1].content)).toBe(true);
    // Image first, then instruction text
    expect(result[1].content[0]).toEqual(images[0]);
    expect(result[1].content[1].type).toBe('text');
    expect(result[1].content[1].text).toBe('Explain this image');
  });

  it('defaults instruction to "Explain this image" for image-only with no instruction', () => {
    const images = [{ type: 'image_url', image_url: { url: 'https://example.com/img.png' } }];
    const result = buildChatMessages('', '', false, images);
    expect(result[1].content[1].text).toBe('Explain this image');
  });

  it('supports multiple images', () => {
    const images = [
      { type: 'image_url', image_url: { url: 'https://example.com/1.png' } },
      { type: 'image_url', image_url: { url: 'https://example.com/2.png' } },
    ];
    const result = buildChatMessages('text here', 'Compare', false, images);
    const content = result[1].content;
    expect(content.length).toBe(3); // text + 2 images
    expect(content[0].type).toBe('text');
    expect(content[1].type).toBe('image_url');
    expect(content[2].type).toBe('image_url');
  });
});

describe('buildFollowUp', () => {
  it('appends user message to existing conversation', () => {
    const existing = [
      { role: 'system', content: 'Explain' },
      { role: 'user', content: 'code here' },
      { role: 'assistant', content: 'This code does...' },
    ];
    const result = buildFollowUp(existing, 'Can you simplify it?');
    expect(result.length).toBe(4);
    expect(result[3]).toEqual({ role: 'user', content: 'Can you simplify it?' });
  });

  it('does not mutate the original array', () => {
    const existing = [{ role: 'user', content: 'hi' }];
    const result = buildFollowUp(existing, 'follow up');
    expect(existing.length).toBe(1);
    expect(result.length).toBe(2);
  });

  it('works with empty conversation', () => {
    const result = buildFollowUp([], 'hello');
    expect(result).toEqual([{ role: 'user', content: 'hello' }]);
  });
});
