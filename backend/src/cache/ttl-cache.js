/**
 * In-memory LRU cache with per-entry TTL. Behind a small interface so it can be
 * swapped for Redis or similar when running multiple backend instances.
 */
export function createTtlCache({ ttlMs, maxEntries, now = Date.now }) {
  const entries = new Map();

  function get(key) {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (now() >= entry.expiresAt) {
      entries.delete(key);
      return undefined;
    }
    // Re-insert to mark as most recently used.
    entries.delete(key);
    entries.set(key, entry);
    return entry;
  }

  /** Stores a value; `entryTtlMs` overrides the default TTL for this entry. */
  function set(key, value, entryTtlMs = ttlMs) {
    const storedAt = now();
    entries.delete(key);
    entries.set(key, { value, storedAt, expiresAt: storedAt + entryTtlMs });
    while (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value);
    }
  }

  return {
    get,
    set,
    delete: (key) => entries.delete(key),
    get size() {
      return entries.size;
    },
  };
}
