/**
 * Converts backend responses into the extension's internal result shape and
 * rejects anything that does not match the contract — the UI must never show
 * a number that did not come from the provider.
 *
 * Result shape:
 *   { status: 'success', keyword, country, searchVolume, dataSource, lastUpdated, cached }
 *   { status: 'unavailable', keyword, country, reason }
 */
import { ERROR_CODES } from './messages.js';

const KNOWN_ERROR_CODES = new Set(Object.values(ERROR_CODES));

function isIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function unavailable({ keyword, country }, reason) {
  return { status: 'unavailable', keyword, country, reason };
}

export function fromBackendResponse(body, request) {
  const { keyword, country } = request;

  if (body?.success === true) {
    const valid =
      Number.isInteger(body.search_volume) &&
      body.search_volume >= 0 &&
      typeof body.data_source === 'string' &&
      body.data_source.length > 0 &&
      body.data_source.length <= 100 &&
      isIsoDate(body.last_updated);
    if (!valid) return unavailable(request, ERROR_CODES.INVALID_RESPONSE);
    return {
      status: 'success',
      keyword,
      country,
      searchVolume: body.search_volume,
      dataSource: body.data_source,
      lastUpdated: body.last_updated,
      cached: body.cached === true,
    };
  }

  if (body?.success === false && typeof body.error_code === 'string') {
    const reason = KNOWN_ERROR_CODES.has(body.error_code)
      ? body.error_code
      : ERROR_CODES.PROVIDER_ERROR;
    return unavailable(request, reason);
  }

  return unavailable(request, ERROR_CODES.INVALID_RESPONSE);
}

/** Only provider-confirmed outcomes are worth caching; transient failures are not. */
export function isCacheable(result) {
  return result.status === 'success' || result.reason === ERROR_CODES.NO_DATA;
}
