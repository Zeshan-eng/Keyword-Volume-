/**
 * Related keywords: response validation, local cache and backend access.
 *
 * Result shape:
 *   { status: 'success', keyword, country, keywords: [{ keyword, searchVolume }],
 *     dataSource, lastUpdated, cached }
 *   { status: 'unavailable', keyword, country, reason }
 */
import { createInFlight } from './api-client.js';
import { ERROR_CODES } from './messages.js';
import { buildCacheKey } from './query.js';
import { unavailable } from './volume-result.js';

const KNOWN_ERROR_CODES = new Set(Object.values(ERROR_CODES));
const MAX_SUGGESTIONS = 50;
const MAX_SUGGESTION_LENGTH = 200;

function toSuggestion(item) {
  if (typeof item?.keyword !== 'string') return null;
  const keyword = item.keyword.trim();
  if (!keyword || keyword.length > MAX_SUGGESTION_LENGTH) return null;
  const volume = item.search_volume;
  if (volume !== null && !(Number.isInteger(volume) && volume >= 0)) return null;
  return { keyword, searchVolume: volume };
}

export function fromRelatedResponse(body, request) {
  if (body?.success === true) {
    const items = Array.isArray(body.related_keywords) ? body.related_keywords : null;
    const suggestions = items?.slice(0, MAX_SUGGESTIONS).map(toSuggestion);
    const valid =
      suggestions &&
      suggestions.every(Boolean) &&
      typeof body.data_source === 'string' &&
      body.data_source.length > 0 &&
      body.data_source.length <= 100 &&
      !Number.isNaN(Date.parse(body.last_updated));
    if (!valid) return unavailable(request, ERROR_CODES.INVALID_RESPONSE);
    return {
      status: 'success',
      keyword: request.keyword,
      country: request.country,
      keywords: suggestions,
      dataSource: body.data_source,
      lastUpdated: body.last_updated,
      cached: body.cached === true,
    };
  }
  if (body?.success === false && typeof body.error_code === 'string') {
    return unavailable(
      request,
      KNOWN_ERROR_CODES.has(body.error_code) ? body.error_code : ERROR_CODES.PROVIDER_ERROR,
    );
  }
  return unavailable(request, ERROR_CODES.INVALID_RESPONSE);
}

/** Provider-confirmed answers are cached; transient failures are retried. */
export function isRelatedCacheable(result) {
  return (
    result.status === 'success' ||
    result.reason === ERROR_CODES.NO_DATA ||
    result.reason === ERROR_CODES.NOT_SUPPORTED
  );
}

export function createRelatedRepository({ cache, api }) {
  const inFlight = createInFlight();

  async function load(cacheKey, request) {
    const response = await api.getJson('/api/v1/related', {
      keyword: request.keyword,
      country: request.country,
      refresh: request.refresh ? '1' : undefined,
    });
    const result = response.ok
      ? fromRelatedResponse(response.body, request)
      : unavailable(request, response.errorCode);
    if (isRelatedCacheable(result)) await cache.set(cacheKey, result);
    return result;
  }

  /** @returns {Promise<object>} Never throws. */
  async function getRelated({ keyword, country, refresh = false }) {
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

  return { getRelated };
}
