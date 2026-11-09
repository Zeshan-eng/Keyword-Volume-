/** Shared test doubles for extension modules. */
import { createApiClient } from '../shared/api-client.js';

/** In-memory stand-in for chrome.storage.local. */
export function createMemoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(keys) {
      if (keys === null) return structuredClone(data);
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(
        list.filter((k) => k in data).map((k) => [k, structuredClone(data[k])]),
      );
    },
    async set(items) {
      Object.assign(data, structuredClone(items));
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    },
  };
}

export function createClock(start = 1_000_000) {
  let current = start;
  return { now: () => current, advance: (ms) => (current += ms) };
}

/** API client over a fake fetch that records calls. */
export function createFakeApi(responder) {
  const calls = [];
  const api = createApiClient({
    backendBaseUrl: 'https://kvf.example',
    timeoutMs: 1000,
    fetchImpl: async (url, init) => {
      calls.push({ url: new URL(url), init });
      return responder(calls.length, new URL(url));
    },
  });
  return { api, calls };
}

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
