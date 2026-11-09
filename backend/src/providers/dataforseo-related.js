/**
 * DataForSEO Labs "Related Keywords" adapter (Google "searches related to" graph).
 * Docs: https://docs.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live/
 * Requires a location, so worldwide is not supported.
 */
import { NO_DATA, readVolume, withNoDataHandling } from './provider.js';
import { parseDataForSeoTime } from './dataforseo-labs.js';

const PATH = '/v3/dataforseo_labs/google/related_keywords/live';
const MAX_KEYWORD_LENGTH = 200;

/**
 * Normalizes provider items into unique suggestions, excluding the seed keyword.
 * Volumes that are missing stay `null` — never 0.
 */
export function toRelatedKeywords(items, seedKeyword, limit) {
  if (!Array.isArray(items)) return { keywords: [], lastUpdated: null };
  const seen = new Set([seedKeyword.toLowerCase()]);
  const keywords = [];
  let lastUpdated = null;

  for (const item of items) {
    const data = item?.keyword_data;
    const text = typeof data?.keyword === 'string' ? data.keyword.replace(/\s+/g, ' ').trim() : '';
    if (!text || text.length > MAX_KEYWORD_LENGTH) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push({ keyword: text, search_volume: readVolume(data.keyword_info?.search_volume) });
    lastUpdated ??= parseDataForSeoTime(data.keyword_info?.last_updated_time);
    if (keywords.length >= limit) break;
  }
  return { keywords, lastUpdated };
}

export function createRelatedKeywordsProvider({ client, limit = 20, now = () => new Date() }) {
  return {
    name: 'DataForSEO Labs',
    supports: (location) => location.locationCode !== null,

    lookup: ({ keyword, location }) =>
      withNoDataHandling(async () => {
        const task = await client.postTask(PATH, {
          keyword,
          location_code: location.locationCode,
          language_code: location.languageCode,
          // Depth 2 gathers up to ~72 candidates; we keep the top `limit` by volume.
          depth: 2,
          // Ask for a few extra so de-duplication still leaves `limit` suggestions.
          limit: limit + 10,
          order_by: ['keyword_data.keyword_info.search_volume,desc'],
        });
        const items = Array.isArray(task.result) ? task.result[0]?.items : undefined;
        const { keywords, lastUpdated } = toRelatedKeywords(items, keyword, limit);
        if (keywords.length === 0) return NO_DATA;
        return {
          status: 'ok',
          relatedKeywords: keywords,
          lastUpdated: lastUpdated ?? now().toISOString(),
        };
      }),
  };
}
