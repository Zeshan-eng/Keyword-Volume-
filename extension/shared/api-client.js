/**
 * Minimal backend client. Never throws: transport and parse failures are returned
 * as error codes so every caller can show an honest "unavailable" state.
 */
import { ERROR_CODES } from './messages.js';

export function createApiClient({ fetchImpl, backendBaseUrl, timeoutMs }) {
  /** @returns {Promise<{ ok: true, body: unknown } | { ok: false, errorCode: string }>} */
  async function getJson(path, params) {
    const url = new URL(path, backendBaseUrl);
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(name, value);
    }

    let response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        credentials: 'omit',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return { ok: false, errorCode: ERROR_CODES.NETWORK_ERROR };
    }

    try {
      return { ok: true, body: await response.json() };
    } catch {
      return { ok: false, errorCode: ERROR_CODES.INVALID_RESPONSE };
    }
  }

  return { getJson };
}

/** Runs at most one pending task per key; concurrent callers share its promise. */
export function createInFlight() {
  const pending = new Map();
  return {
    run(key, task) {
      let promise = pending.get(key);
      if (!promise) {
        promise = Promise.resolve()
          .then(task)
          .finally(() => pending.delete(key));
        pending.set(key, promise);
      }
      return promise;
    },
  };
}
