/**
 * Provider adapter contract. Any keyword data source implements:
 *
 *   {
 *     name: string,                       // shown to users as the data source
 *     supports(location): boolean,        // can it answer for this location?
 *     lookup({ keyword, location }): Promise<ProviderResult>
 *   }
 *
 * where `location` is an entry from COUNTRY_LOCATIONS and ProviderResult is either
 *   { status: 'ok', searchVolume: number, lastUpdated: string (ISO 8601) }
 * or
 *   { status: 'no_data' }
 *
 * Failures are thrown as ProviderError. Adapters must never fabricate values:
 * a missing or non-integer volume is reported as `no_data`.
 */
import { ERROR_CODES } from '../lib/errors.js';

export const NO_DATA = Object.freeze({ status: 'no_data' });

/** Returns a non-negative integer volume, or null if the provider value is unusable. */
export function readVolume(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/** Picks the item for our keyword from a provider result list (providers lowercase keywords). */
export function findKeywordItem(items, keyword) {
  if (!Array.isArray(items) || items.length === 0) return undefined;
  const target = keyword.toLowerCase();
  return (
    items.find(
      (item) => typeof item?.keyword === 'string' && item.keyword.toLowerCase() === target,
    ) ?? (items.length === 1 ? items[0] : undefined)
  );
}

/** Runs a lookup, converting a provider-reported "no results" error into NO_DATA. */
export async function withNoDataHandling(lookup) {
  try {
    return await lookup();
  } catch (error) {
    if (error?.code === ERROR_CODES.NO_DATA) return NO_DATA;
    throw error;
  }
}
