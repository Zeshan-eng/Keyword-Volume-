/** Related keyword lookups: cached loader → provider, shaped into the public contract. */
import { createCachedLoader } from '../cache/cached-loader.js';
import { ERROR_CODES, PUBLIC_MESSAGES } from '../lib/errors.js';
import { getLocation } from '../countries.js';

const NO_RELATED_MESSAGE = 'No related keywords found';

function unavailableBody({ keyword, country, errorCode }) {
  return {
    success: false,
    keyword,
    country,
    related_keywords: [],
    error_code: errorCode,
    message: errorCode === ERROR_CODES.NO_DATA ? NO_RELATED_MESSAGE : PUBLIC_MESSAGES[errorCode],
  };
}

export function createRelatedService({ provider, cache, refreshMinAgeMs, now = Date.now, logger }) {
  const loader = createCachedLoader({ cache, refreshMinAgeMs, now });

  /** @returns {Promise<object>} Response body. Throws ProviderError on failure. */
  async function getRelated({ keyword, country, refresh }) {
    const location = getLocation(country);
    if (!provider.supports(location)) {
      return {
        ...unavailableBody({ keyword, country, errorCode: ERROR_CODES.NOT_SUPPORTED }),
        cached: false,
      };
    }

    const cacheKey = `${keyword.toLowerCase()}|${country}|${provider.name}`;
    const { value, cached } = await loader.load(
      cacheKey,
      async () => {
        const startedAt = now();
        const result = await provider.lookup({ keyword, location });
        const body =
          result.status === 'ok'
            ? {
                success: true,
                keyword,
                country,
                related_keywords: result.relatedKeywords,
                data_source: provider.name,
                last_updated: result.lastUpdated,
              }
            : unavailableBody({ keyword, country, errorCode: ERROR_CODES.NO_DATA });
        logger.info('related_lookup', {
          country,
          count: body.related_keywords.length,
          duration_ms: now() - startedAt,
        });
        return { value: body, cacheable: true };
      },
      { refresh },
    );
    return { ...value, keyword, cached };
  }

  return { getRelated };
}
