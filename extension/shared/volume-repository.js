/**
 * Single entry point for keyword volume in the extension:
 * local cache → in-flight de-duplication → backend.
 * Dependencies are injected so this logic is unit-testable outside Chrome.
 */
import { createInFlight } from './api-client.js';
import { buildCacheKey } from './query.js';
import { fromBackendResponse, isCacheable, unavailable } from './volume-result.js';

export function createVolumeRepository({ cache, api }) {
  const inFlight = createInFlight();

  async function load(cacheKey, request) {
    const response = await api.getJson('/api/v1/volume', {
      keyword: request.keyword,
      country: request.country,
      refresh: request.refresh ? '1' : undefined,
    });
    const result = response.ok
      ? fromBackendResponse(response.body, request)
      : unavailable(request, response.errorCode);
    if (isCacheable(result)) await cache.set(cacheKey, result);
    return result;
  }

  /** @returns {Promise<object>} A result (see volume-result.js). Never throws. */
  async function getVolume({ keyword, country, refresh = false }) {
    const cacheKey = buildCacheKey(keyword, country);

    if (!refresh) {
      const hit = await cache.get(cacheKey);
      if (hit) return { ...hit.value, keyword, cached: true };
    }

    const result = await inFlight.run(`${cacheKey}|${refresh}`, () =>
      load(cacheKey, { keyword, country, refresh }),
    );
    return { ...result, keyword };
  }

  return { getVolume };
}
