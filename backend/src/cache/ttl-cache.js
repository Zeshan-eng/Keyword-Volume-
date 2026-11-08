/**
 * In-memory LRU cache with per-entry TTL. Behind a small interface so it can be
 * swapped for Redis or similar when running multiple backend instances.
 */
export function createTtlCache({ ttlMs, maxEntries, now = Date.now }) {
  const entries = new Map();

  function get(key) {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (now() - entry.storedAt >= ttlMs) {
      entries.delete(key);
      return undefined;
    }
    // Re-insert to mark as most recently used.
    entries.delete(key);
    entries.set(key, entry);
    return entry;
  }

  function set(key, value) {
    entries.delete(key);
    entries.set(key, { value, storedAt: now() });
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
