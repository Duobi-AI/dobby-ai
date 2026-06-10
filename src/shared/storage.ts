import type { StorageKey, StorageState } from './types';

type StoredValues<K extends StorageKey> = Pick<StorageState, K>;

export function getLocalStorage<K extends StorageKey>(
  keys: K | K[],
  callback: (values: StoredValues<K>) => void,
): void;
export function getLocalStorage<K extends StorageKey>(
  keys: K | K[],
): Promise<StoredValues<K>>;
export function getLocalStorage<K extends StorageKey>(
  keys: K | K[],
  callback?: (values: StoredValues<K>) => void,
): Promise<StoredValues<K>> | void {
  if (callback) {
    chrome.storage.local.get(keys, callback as (items: Record<string, unknown>) => void);
    return;
  }
  return chrome.storage.local.get(keys) as Promise<StoredValues<K>>;
}

export function setLocalStorage(
  values: StorageState,
  callback?: () => void,
): Promise<void> | void {
  if (callback) {
    chrome.storage.local.set(values, callback);
    return;
  }
  return chrome.storage.local.set(values);
}

export function removeLocalStorage(
  keys: StorageKey | StorageKey[],
  callback?: () => void,
): Promise<void> | void {
  if (callback) {
    chrome.storage.local.remove(keys, callback);
    return;
  }
  return chrome.storage.local.remove(keys);
}
