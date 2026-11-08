/**
 * Keyword+country result cache with a 24h TTL. Storage is injected (chrome.storage.local
 * in the extension, an in-memory fake in tests); it must implement get/set/remove.
 */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'vol:';

function isEntry(entry) {
  return entry !== null && typeof entry === 'object' && Number.isFinite(entry.storedAt);
}

export function createVolumeCache({ storage, ttlMs = CACHE_TTL_MS, now = Date.now }) {
  const isExpired = (entry) => now() - entry.storedAt >= ttlMs;

  async function get(key) {
    const storageKey = KEY_PREFIX + key;
    const { [storageKey]: entry } = await storage.get(storageKey);
    if (entry === undefined) return undefined;
    if (!isEntry(entry) || isExpired(entry)) {
      await storage.remove(storageKey);
      return undefined;
    }
    return entry;
  }

  async function set(key, value) {
    await storage.set({ [KEY_PREFIX + key]: { value, storedAt: now() } });
  }

  async function removeWhere(predicate) {
    const all = await storage.get(null);
    const keys = Object.keys(all).filter(
      (key) => key.startsWith(KEY_PREFIX) && predicate(all[key]),
    );
    if (keys.length) await storage.remove(keys);
    return keys.length;
  }

  return {
    get,
    set,
    /** Deletes expired or malformed entries; returns how many were removed. */
    prune: () => removeWhere((entry) => !isEntry(entry) || isExpired(entry)),
    clear: () => removeWhere(() => true),
  };
}
