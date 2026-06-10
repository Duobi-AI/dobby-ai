import type { Preset, PresetUsage } from '../../shared/types';
import { getLocalStorage, setLocalStorage } from '../../shared/storage';

// src/content/shared/preset-usage.js — Tracks preset click frequency for reordering
// Usage data is cached in a module-level variable for instant sync access.
// Persisted to chrome.storage.local under the key "presetUsage".

let usageCache: PresetUsage = {};

/**
 * Builds a storage key from content type and optional sub-type.
 * @param {string} type - Content type (e.g. "code", "default")
 * @param {string|null|undefined} subType - Optional sub-type (e.g. "javascript")
 * @returns {string} Key like "code:javascript" or just "code"
 */
export function buildTypeKey(type: string, subType: string | null | undefined): string {
  return subType ? `${type}:${subType}` : type;
}

/**
 * Loads usage data from chrome.storage.local into the module-level cache.
 * Call once at startup. If storage is unavailable, cache stays empty.
 */
export function loadUsageData(): void {
  try {
    getLocalStorage('presetUsage', (data) => {
      usageCache = (data && data.presetUsage) || {};
    });
  } catch {
    // Graceful fallback — storage unavailable in some contexts
    usageCache = {};
  }
}

/**
 * Records a preset click: increments the counter and persists to storage.
 * @param {string} typeKey - Key from buildTypeKey()
 * @param {string} label - The preset label that was clicked
 */
export function recordPresetUsage(typeKey: string, label: string): void {
  if (!typeKey || !label) return;

  if (!usageCache[typeKey]) {
    usageCache[typeKey] = {};
  }
  usageCache[typeKey][label] = (usageCache[typeKey][label] || 0) + 1;

  try {
    setLocalStorage({ presetUsage: usageCache });
  } catch {
    // Persist failure is non-fatal — in-memory cache still works this session
  }
}

/**
 * Returns presets reordered by usage frequency if any preset has 5+ clicks.
 * Always returns a shallow copy — never mutates the input array.
 * @param {Preset[]} presets
 * @param {string} typeKey - Key from buildTypeKey()
 * @returns {Preset[]}
 */
export function getReorderedPresets(presets: Preset[], typeKey: string): Preset[] {
  const usage = usageCache[typeKey];
  if (!usage) return presets;

  // Only reorder if at least one preset has 5+ clicks
  const hasEnoughData = presets.some(p => (usage[p.label] || 0) >= 5);
  if (!hasEnoughData) return presets;

  // IMPORTANT: [...presets] creates a shallow copy — never mutate the
  // original static arrays in PRESETS/CODE_SUBTYPE_PRESETS
  return [...presets].sort((a, b) => (usage[b.label] || 0) - (usage[a.label] || 0));
}
