/**
 * Orchestrates a volume lookup: cache → in-flight de-duplication → provider,
 * and shapes the public response contract.
 */
import { ERROR_CODES, PUBLIC_MESSAGES } from '../lib/errors.js';
import { getLocation } from '../countries.js';

export function buildCacheKey(keyword, country) {
  return `${keyword.toLowerCase()}|${country}`;
}

function toResponseBody({ keyword, country, result, source }) {
  if (result.status === 'ok') {
    return {
      success: true,
      keyword,
      search_volume: result.searchVolume,
      country,
      data_source: source,
      last_updated: result.lastUpdated,
    };
  }
  return {
    success: false,
    keyword,
    search_volume: null,
    country,
    error_code: ERROR_CODES.NO_DATA,
    message: PUBLIC_MESSAGES[ERROR_CODES.NO_DATA],
  };
}

export function createVolumeService({ provider, cache, refreshMinAgeMs, now = Date.now, logger }) {
  const inFlight = new Map();

  async function fetchAndCache(cacheKey, keyword, country) {
    const startedAt = now();
    const { result, source } = await provider.lookup({ keyword, location: getLocation(country) });
    const body = toResponseBody({ keyword, country, result, source });
    // Both data and confirmed "no data" are cached; errors never are.
    cache.set(cacheKey, body);
    logger.info('volume_lookup', {
      country,
      source,
      found: body.success,
      duration_ms: now() - startedAt,
    });
    return body;
  }

  /**
   * @returns {Promise<object>} Response body. Throws ProviderError on failure.
   */
  async function getVolume({ keyword, country, refresh }) {
    const cacheKey = buildCacheKey(keyword, country);
    const cached = cache.get(cacheKey);
    // A forced refresh only bypasses entries older than refreshMinAgeMs, which keeps
    // a "refresh" button from becoming a way to run up provider costs.
    if (cached && (!refresh || now() - cached.storedAt < refreshMinAgeMs)) {
      return { ...cached.value, keyword, cached: true };
    }

    let pending = inFlight.get(cacheKey);
    if (!pending) {
      pending = fetchAndCache(cacheKey, keyword, country).finally(() => inFlight.delete(cacheKey));
      inFlight.set(cacheKey, pending);
    }
    const body = await pending;
    return { ...body, keyword, cached: false };
  }

  return { getVolume };
}
