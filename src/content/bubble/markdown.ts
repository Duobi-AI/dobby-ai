// src/content/bubble/markdown.js — Pure markdown rendering functions

type MarkdownImage = { alt: string; url: string };

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function renderMarkdown(text: string): string {
  // Extract code blocks first so their contents are not processed
  const codeBlocks: string[] = [];
  let processed = text.replace(/```([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(code);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  // Extract images before escaping (they need real <img> tags)
  const images: MarkdownImage[] = [];
  processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    if (isValidImageUrl(url)) {
      images.push({ alt: escapeHtml(alt), url: escapeHtml(url) });
      return `%%IMAGE_${images.length - 1}%%`;
    }
    return `![${alt}](${url})`;
  });

  // Escape HTML to prevent XSS
  let escaped = escapeHtml(processed);
  // Inline transforms
  escaped = escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>');
  // Re-insert code blocks with preserved formatting
  escaped = escaped.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => {
    const block = codeBlocks[parseInt(i)];
    return block != null ? '<pre><code>' + escapeHtml(block) + '</code></pre>' : '';
  });
  // Re-insert images
  escaped = escaped.replace(/%%IMAGE_(\d+)%%/g, (_, i) => {
    const img = images[parseInt(i)];
    if (!img) return '';
    return `<img class="response-img" src="${img.url}" alt="${img.alt}" loading="lazy" onerror="this.style.display='none'">`;
  });
  return escaped;
}
