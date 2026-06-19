import type { CurrentTabContext, CurrentTabContextExtractionMode } from '../shared/types';

export const MAX_EXTRACTED_CONTEXT_CHARS = 32_000;
const CACHE_TTL_MS = 60_000;
const MUTATION_DEBOUNCE_MS = 1_000;
const TRUNCATION_MARKER = '...[truncated]';

type GatherOptions = {
  selectedText?: string;
  anchorNode?: Node | null;
  maxChars?: number;
};

type ContextBlock = {
  text: string;
  score: number;
  index: number;
  kind: string;
};

type CacheEntry = {
  key: string;
  expiresAt: number;
  value: CurrentTabContext;
};

const REMOVE_SELECTOR = [
  'script',
  'style',
  'noscript',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'input',
  'textarea',
  'select',
  'button',
  '[contenteditable]',
  '[aria-hidden="true"]',
].join(',');

let cache: CacheEntry | null = null;
let observer: MutationObserver | null = null;
let mutationTimer: ReturnType<typeof setTimeout> | null = null;

function normalizeText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getNodeText(node: Node | null | undefined): string {
  if (!node) return '';
  const element = node as HTMLElement;
  return normalizeText(element.innerText || node.textContent || '');
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function buildPageSignature(): string {
  const bodyText = getNodeText(document.body);
  const sample = [
    bodyText.slice(0, 800),
    bodyText.slice(Math.max(0, Math.floor(bodyText.length / 2) - 400), Math.floor(bodyText.length / 2) + 400),
    bodyText.slice(-800),
  ].join('\n');
  return [
    window.location.href || '',
    document.title || '',
    bodyText.length,
    hashString(sample),
  ].join('|');
}

function ensureMutationObserver(): void {
  if (observer || typeof MutationObserver === 'undefined' || !document.body) return;
  observer = new MutationObserver(() => {
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      cache = null;
      mutationTimer = null;
    }, MUTATION_DEBOUNCE_MS);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

export function invalidatePageContextCache(): void {
  cache = null;
  if (mutationTimer) {
    clearTimeout(mutationTimer);
    mutationTimer = null;
  }
}

function chooseRoot(): { root: HTMLElement | null; mode: CurrentTabContextExtractionMode } {
  const article = document.querySelector<HTMLElement>('article');
  if (article) return { root: article, mode: 'article' };
  const main = document.querySelector<HTMLElement>('main, [role="main"]');
  if (main) return { root: main, mode: 'main' };
  if (document.body) return { root: document.body, mode: 'body' };
  return { root: null, mode: 'none' };
}

function cloneCleanRoot(root: HTMLElement): HTMLElement {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(REMOVE_SELECTOR).forEach((el) => el.remove());
  return clone;
}

function closestAnchorContext(anchorNode: Node | null | undefined): string {
  if (!anchorNode) return '';
  const element = anchorNode.nodeType === Node.ELEMENT_NODE
    ? anchorNode as Element
    : anchorNode.parentElement;
  const container = element?.closest('p, li, tr, pre, code, blockquote, section, article, main');
  return getNodeText(container || element);
}

function elementKind(el: Element): string {
  return el.tagName.toLowerCase();
}

function scoreBlock(text: string, kind: string, selectedText: string, anchorContext: string): number {
  let score = 0;
  const lower = text.toLowerCase();
  const selected = normalizeText(selectedText).toLowerCase();
  const anchor = normalizeText(anchorContext).toLowerCase();

  if (/^h[1-4]$/.test(kind)) score += 90;
  if (kind === 'p' || kind === 'blockquote') score += 40;
  if (kind === 'li') score += 30;
  if (kind === 'pre' || kind === 'code') score += 55;
  if (kind === 'td' || kind === 'th' || kind === 'caption') score += 25;

  if (selected && lower.includes(selected)) score += 160;
  if (anchor && (lower.includes(anchor) || anchor.includes(lower))) score += 140;

  const length = text.length;
  if (length >= 80 && length <= 800) score += 30;
  else if (length > 800) score += 10;
  else if (/^h[1-4]$/.test(kind)) score += 20;

  const words = text.split(/\s+/).filter(Boolean);
  const uniqueWords = new Set(words.map(word => word.toLowerCase()));
  if (words.length > 0 && uniqueWords.size / words.length < 0.35) score -= 35;

  return score;
}

function collectBlocks(root: HTMLElement, options: GatherOptions): ContextBlock[] {
  const selectedText = options.selectedText || '';
  const anchorContext = closestAnchorContext(options.anchorNode);
  const seen = new Set<string>();
  const blocks: ContextBlock[] = [];
  const elements = root.querySelectorAll('h1, h2, h3, h4, p, li, blockquote, pre, code, th, td, caption');

  elements.forEach((el, index) => {
    const kind = elementKind(el);
    const text = normalizeText(el.textContent || '');
    if (!text) return;
    if (text.length < 20 && !/^h[1-4]$/.test(kind) && kind !== 'th' && kind !== 'td') return;

    const dedupeKey = text.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    blocks.push({
      text,
      score: scoreBlock(text, kind, selectedText, anchorContext),
      index,
      kind,
    });
  });

  return blocks;
}

function truncateToBudget(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  if (maxChars <= TRUNCATION_MARKER.length) {
    return { text: TRUNCATION_MARKER.slice(0, maxChars), truncated: true };
  }
  return {
    text: text.slice(0, maxChars - TRUNCATION_MARKER.length) + TRUNCATION_MARKER,
    truncated: true,
  };
}

function formatContext(blocks: ContextBlock[], maxChars: number): { text: string; truncated: boolean } {
  const headings = blocks
    .filter(block => /^h[1-4]$/.test(block.kind))
    .sort((a, b) => a.index - b.index)
    .slice(0, 8)
    .map(block => block.text);

  const nearby = blocks
    .filter(block => block.score >= 140)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 4)
    .map(block => block.text);

  const important = blocks
    .filter(block => !nearby.includes(block.text))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 40)
    .sort((a, b) => a.index - b.index)
    .map(block => block.text);

  const sections: string[] = [];
  if (headings.length > 0) sections.push(`Key headings:\n${headings.join('\n')}`);
  if (nearby.length > 0) sections.push(`Nearby context:\n${nearby.join('\n\n')}`);
  if (important.length > 0) sections.push(`Important page excerpts:\n${important.join('\n\n')}`);

  return truncateToBudget(sections.join('\n\n'), maxChars);
}

export function gatherCurrentTabContext(options: GatherOptions = {}): CurrentTabContext {
  ensureMutationObserver();
  const maxChars = Math.max(0, options.maxChars || MAX_EXTRACTED_CONTEXT_CHARS);
  const key = `${buildPageSignature()}|${normalizeText(options.selectedText || '')}|${getNodeText(options.anchorNode).slice(0, 300)}|${maxChars}`;
  const now = Date.now();

  if (cache && cache.key === key && cache.expiresAt > now) {
    return cache.value;
  }

  const { root, mode } = chooseRoot();
  const title = document.title || '';
  const url = window.location.href || '';
  if (!root || mode === 'none') {
    const empty: CurrentTabContext = {
      title,
      url,
      text: '',
      extractionMode: 'none',
      originalChars: 0,
      cleanedChars: 0,
      truncated: false,
    };
    cache = { key, expiresAt: now + CACHE_TTL_MS, value: empty };
    return empty;
  }

  const originalText = getNodeText(root);
  const cleanedRoot = cloneCleanRoot(root);
  const blocks = collectBlocks(cleanedRoot, options);
  const formatted = formatContext(blocks, maxChars);
  const value: CurrentTabContext = {
    title,
    url,
    text: formatted.text,
    extractionMode: mode,
    originalChars: originalText.length,
    cleanedChars: formatted.text.length,
    truncated: formatted.truncated,
  };

  cache = { key, expiresAt: now + CACHE_TTL_MS, value };
  return value;
}
