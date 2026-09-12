// src/content/bubble/markdown.ts — Safe Markdown rendering for chat responses

import MarkdownIt from 'markdown-it';

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const markdown = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: false,
  typographer: false,
});

const defaultImageRenderer = markdown.renderer.rules.image;
markdown.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index]!;
  const src = String(token.attrGet('src') || '');

  // Images load inside arbitrary host pages, so keep the extension's stricter
  // HTTPS-only policy rather than accepting every URL allowed for links.
  if (!isValidImageUrl(src)) {
    return `![${markdown.utils.escapeHtml(String(token.content))}](${markdown.utils.escapeHtml(src)})`;
  }

  token.attrJoin('class', 'response-img');
  token.attrSet('loading', 'lazy');

  return defaultImageRenderer
    ? defaultImageRenderer(tokens, index, options, env, self)
    : self.renderToken(tokens, index, options);
};

const defaultLinkOpenRenderer = markdown.renderer.rules.link_open;
markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index]!;
  token.attrSet('target', '_blank');
  token.attrSet('rel', 'noopener noreferrer');

  return defaultLinkOpenRenderer
    ? defaultLinkOpenRenderer(tokens, index, options, env, self)
    : self.renderToken(tokens, index, options);
};

export function renderMarkdown(text: string): string {
  return markdown.render(text);
}
