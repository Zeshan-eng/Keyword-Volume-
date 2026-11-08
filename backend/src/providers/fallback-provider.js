/**
 * Tries providers in order and returns the first with data. A provider that has
 * no data for the keyword hands over to the next; errors are not retried
 * elsewhere (rate limits, auth and billing apply to the whole account anyway).
 */
import { NO_DATA } from './provider.js';

export function createFallbackProvider(providers) {
  return {
    /** @returns {Promise<{ result: object, source: string | null }>} */
    async lookup({ keyword, location }) {
      for (const provider of providers) {
        if (!provider.supports(location)) continue;
        const result = await provider.lookup({ keyword, location });
        if (result.status === 'ok') return { result, source: provider.name };
      }
      return { result: NO_DATA, source: null };
    },
  };
}
