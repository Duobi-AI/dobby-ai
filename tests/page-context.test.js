// tests/page-context.test.js
// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

const {
  gatherCurrentTabContext,
  invalidatePageContextCache,
  MAX_EXTRACTED_CONTEXT_CHARS,
} = await import('../src/content/page-context.js');

describe('gatherCurrentTabContext', () => {
  beforeEach(() => {
    invalidatePageContextCache();
    document.title = 'Dobby context test';
    document.body.innerHTML = '';
  });

  it('extracts important current-tab content while excluding page chrome and editable content', () => {
    document.body.innerHTML = `
      <header>Global navigation should not be sent</header>
      <nav>Pricing Docs Login</nav>
      <main>
        <h1>Quarterly retention report</h1>
        <section>
          <h2>Executive summary</h2>
          <p>Retention dropped because enterprise renewals slipped in the west region.</p>
          <p id="nearby">The selected renewal sentence depends on this nearby explanation and customer segment context.</p>
          <ul><li>Expansion pipeline is still healthy.</li></ul>
          <table><tr><th>Metric</th><th>Value</th></tr><tr><td>Net retention</td><td>94%</td></tr></table>
          <form><input value="private@example.com"><textarea>private draft message</textarea></form>
          <div contenteditable="true">private editable note</div>
        </section>
      </main>
      <footer>Cookie settings and legal links</footer>
    `;

    const anchorNode = document.getElementById('nearby')?.firstChild || null;
    const context = gatherCurrentTabContext({ selectedText: 'renewal sentence', anchorNode });

    expect(context.title).toBe('Dobby context test');
    expect(context.extractionMode).toBe('main');
    expect(context.text).toContain('Quarterly retention report');
    expect(context.text).toContain('Executive summary');
    expect(context.text).toContain('nearby explanation and customer segment context');
    expect(context.text).toContain('Net retention');
    expect(context.text).not.toContain('Global navigation');
    expect(context.text).not.toContain('Pricing Docs Login');
    expect(context.text).not.toContain('private@example.com');
    expect(context.text).not.toContain('private draft message');
    expect(context.text).not.toContain('private editable note');
    expect(context.text).not.toContain('Cookie settings');
  });

  it('prioritizes nearby selected-text context over unrelated long page text', () => {
    const filler = Array.from({ length: 80 }, (_, i) => `<p>Unrelated background paragraph ${i} with generic product copy.</p>`).join('');
    document.body.innerHTML = `
      <main>
        ${filler}
        <section>
          <h2>Incident impact</h2>
          <p id="selected-parent">The outage affected API ingestion for EU customers for 43 minutes.</p>
        </section>
      </main>
    `;

    const anchorNode = document.getElementById('selected-parent')?.firstChild || null;
    const context = gatherCurrentTabContext({ selectedText: 'API ingestion', anchorNode, maxChars: 900 });

    expect(context.text).toContain('Incident impact');
    expect(context.text).toContain('outage affected API ingestion');
    expect(context.text.length).toBeLessThanOrEqual(900);
  });

  it('uses an in-memory cache for unchanged page signatures and refreshes when content changes', () => {
    document.body.innerHTML = '<main><h1>Original heading</h1><p>Original body text for extraction.</p></main>';

    const first = gatherCurrentTabContext();
    const cached = gatherCurrentTabContext();

    expect(cached).toBe(first);

    document.querySelector('p').textContent = 'Changed body text after first extraction.';
    const refreshed = gatherCurrentTabContext();

    expect(refreshed).not.toBe(first);
    expect(refreshed.text).toContain('Changed body text');
  });

  it('caps extracted context and reports truncation metadata', () => {
    const paragraphs = Array.from(
      { length: 1000 },
      (_, i) => `<p>Important article context paragraph ${i} includes unique operational detail for extraction.</p>`
    ).join('');
    document.body.innerHTML = `<main>${paragraphs}</main>`;

    const context = gatherCurrentTabContext({ maxChars: 1200 });

    expect(context.text.length).toBeLessThanOrEqual(1200);
    expect(context.truncated).toBe(true);
    expect(MAX_EXTRACTED_CONTEXT_CHARS).toBeGreaterThan(1200);
  });
});
