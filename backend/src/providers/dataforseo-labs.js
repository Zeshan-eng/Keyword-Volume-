/**
 * DataForSEO Labs "Keyword Overview" adapter — the primary, low-cost source.
 * Docs: https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live/
 * Requires a location; keywords missing from the Labs database return no item.
 */
import { NO_DATA, findKeywordItem, readVolume, withNoDataHandling } from './provider.js';

const PATH = '/v3/dataforseo_labs/google/keyword_overview/live';

/** Parses DataForSEO's "yyyy-mm-dd hh:mm:ss +00:00" timestamps to ISO 8601. */
export function parseDataForSeoTime(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2}:\d{2})$/);
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}${match[3]}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function createLabsProvider({ client, now = () => new Date() }) {
  return {
    name: 'DataForSEO Labs',
    supports: (location) => location.locationCode !== null,

    lookup: ({ keyword, location }) =>
      withNoDataHandling(async () => {
        const task = await client.postTask(PATH, {
          keywords: [keyword],
          location_code: location.locationCode,
          language_code: location.languageCode,
        });
        const items = Array.isArray(task.result) ? task.result[0]?.items : undefined;
        const info = findKeywordItem(items, keyword)?.keyword_info;
        const searchVolume = readVolume(info?.search_volume);
        if (searchVolume === null) return NO_DATA;
        return {
          status: 'ok',
          searchVolume,
          // Labs reports when its dataset was refreshed; fall back to retrieval time.
          lastUpdated: parseDataForSeoTime(info.last_updated_time) ?? now().toISOString(),
        };
      }),
  };
}
