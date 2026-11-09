/**
 * Search volume lookups: cached loader → provider chain, shaped into the public
 * response contract.
 */
import { createCachedLoader } from '../cache/cached-loader.js';
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
  const loader = createCachedLoader({ cache, refreshMinAgeMs, now });

  /** @returns {Promise<object>} Response body. Throws ProviderError on failure. */
  async function getVolume({ keyword, country, refresh }) {
    const { value, cached } = await loader.load(
      buildCacheKey(keyword, country),
      async () => {
        const startedAt = now();
        const { result, source } = await provider.lookup({
          keyword,
          location: getLocation(country),
        });
        const body = toResponseBody({ keyword, country, result, source });
        logger.info('volume_lookup', {
          country,
          source,
          found: body.success,
          duration_ms: now() - startedAt,
        });
        // Both data and confirmed "no data" are cached; errors never are.
        return { value: body, cacheable: true };
      },
      { refresh },
    );
    return { ...value, keyword, cached };
  }

  return { getVolume };
}
