/**
 * DataForSEO Google Ads "Search Volume" Live adapter — fallback source with full
 * keyword coverage and worldwide support.
 * Docs: https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/
 * DataForSEO allows at most 12 requests/minute per account on Google Ads Live
 * endpoints, so every call must first acquire a slot from the shared limiter.
 */
import { ERROR_CODES, ProviderError } from '../lib/errors.js';
import { NO_DATA, findKeywordItem, readVolume, withNoDataHandling } from './provider.js';

const PATH = '/v3/keywords_data/google_ads/search_volume/live';

export function createGoogleAdsProvider({ client, limiter, now = () => new Date() }) {
  return {
    name: 'DataForSEO Google Ads',
    supports: () => true,

    lookup: ({ keyword, location }) =>
      withNoDataHandling(async () => {
        if (!limiter.tryAcquire()) {
          throw new ProviderError(
            ERROR_CODES.RATE_LIMITED,
            'Local Google Ads Live limit reached (12/min per account)',
          );
        }
        const task = { keywords: [keyword], search_partners: false };
        if (location.locationCode !== null) {
          task.location_code = location.locationCode;
          task.language_code = location.languageCode;
        }
        const result = await client.postTask(PATH, task);
        const searchVolume = readVolume(findKeywordItem(result.result, keyword)?.search_volume);
        if (searchVolume === null) return NO_DATA;
        // This endpoint returns no dataset timestamp; report when we retrieved it.
        return { status: 'ok', searchVolume, lastUpdated: now().toISOString() };
      }),
  };
}
