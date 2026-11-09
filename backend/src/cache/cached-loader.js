/**
 * Cache → in-flight de-duplication → loader, shared by every data service.
 *
 * The loader returns `{ value, cacheable, ttlMs? }`. Only cacheable values are stored,
 * so confirmed answers (including "no data") are reused while transient failures are
 * retried. Loader errors propagate and are never cached.
 */
export function createCachedLoader({ cache, refreshMinAgeMs = 0, now = Date.now }) {
  const inFlight = new Map();

  /** @returns {Promise<{ value: unknown, cached: boolean }>} */
  async function load(key, loader, { refresh = false } = {}) {
    const hit = cache.get(key);
    // A forced refresh only bypasses entries older than refreshMinAgeMs, which keeps a
    // "refresh" button from becoming a way to run up provider costs.
    if (hit && (!refresh || now() - hit.storedAt < refreshMinAgeMs)) {
      return { value: hit.value, cached: true };
    }

    let pending = inFlight.get(key);
    if (!pending) {
      pending = Promise.resolve()
        .then(loader)
        .then((outcome) => {
          if (outcome.cacheable) cache.set(key, outcome.value, outcome.ttlMs);
          return outcome.value;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    return { value: await pending, cached: false };
  }

  return { load };
}
