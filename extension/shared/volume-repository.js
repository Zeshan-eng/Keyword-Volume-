/**
 * Single entry point for keyword volume in the extension:
 * local cache → in-flight de-duplication → backend.
 * Dependencies are injected so this logic is unit-testable outside Chrome.
 */
import { ERROR_CODES } from './messages.js';
import { buildCacheKey } from './query.js';
import { fromBackendResponse, isCacheable, unavailable } from './volume-result.js';

export function createVolumeRepository({ cache, fetchImpl, backendBaseUrl, timeoutMs }) {
  const inFlight = new Map();

  async function fetchFromBackend(request) {
    const url = new URL('/api/v1/volume', backendBaseUrl);
    url.searchParams.set('keyword', request.keyword);
    url.searchParams.set('country', request.country);
    if (request.refresh) url.searchParams.set('refresh', '1');

    let response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        credentials: 'omit',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return unavailable(request, ERROR_CODES.NETWORK_ERROR);
    }

    try {
      return fromBackendResponse(await response.json(), request);
    } catch {
      return unavailable(request, ERROR_CODES.INVALID_RESPONSE);
    }
  }

  async function load(cacheKey, request) {
    const result = await fetchFromBackend(request);
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

    const flightKey = `${cacheKey}|${refresh}`;
    let pending = inFlight.get(flightKey);
    if (!pending) {
      pending = load(cacheKey, { keyword, country, refresh }).finally(() =>
        inFlight.delete(flightKey),
      );
      inFlight.set(flightKey, pending);
    }
    return { ...(await pending), keyword };
  }

  return { getVolume };
}
