/**
 * Prefixed TTL cache over an injected key/value storage (chrome.storage.local in the
 * extension, an in-memory fake in tests). Storage must implement get/set/remove.
 */
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
export const CACHE_TTL_MS = DAY_MS;

export const CACHE_PREFIXES = Object.freeze({
  VOLUME: 'vol:',
  RELATED: 'rel:',
  DOMAIN_AGE: 'age:',
});

function isEntry(entry) {
  return entry !== null && typeof entry === 'object' && Number.isFinite(entry.storedAt);
}

export function createStorageCache({ storage, prefix, ttlMs = CACHE_TTL_MS, now = Date.now }) {
  // Entries written before per-entry TTLs existed have no expiresAt.
  const isExpired = (entry) => now() >= (entry.expiresAt ?? entry.storedAt + ttlMs);

  async function get(key) {
    const storageKey = prefix + key;
    const { [storageKey]: entry } = await storage.get(storageKey);
    if (entry === undefined) return undefined;
    if (!isEntry(entry) || isExpired(entry)) {
      await storage.remove(storageKey);
      return undefined;
    }
    return entry;
  }

  async function set(key, value, entryTtlMs = ttlMs) {
    const storedAt = now();
    await storage.set({ [prefix + key]: { value, storedAt, expiresAt: storedAt + entryTtlMs } });
  }

  async function removeWhere(predicate) {
    const all = await storage.get(null);
    const keys = Object.keys(all).filter((key) => key.startsWith(prefix) && predicate(all[key]));
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

/** One cache per data type, all over the same storage area. */
export function createExtensionCaches({ storage, now = Date.now }) {
  return {
    volume: createStorageCache({ storage, prefix: CACHE_PREFIXES.VOLUME, ttlMs: DAY_MS, now }),
    related: createStorageCache({ storage, prefix: CACHE_PREFIXES.RELATED, ttlMs: DAY_MS, now }),
    domainAge: createStorageCache({
      storage,
      prefix: CACHE_PREFIXES.DOMAIN_AGE,
      ttlMs: 30 * DAY_MS,
      now,
    }),
  };
}
