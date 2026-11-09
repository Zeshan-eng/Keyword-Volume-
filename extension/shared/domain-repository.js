/**
 * Domain registration age for organic results: per-hostname local cache, then one
 * batched backend request for the hostnames that are missing.
 *
 * Age info per hostname:
 *   { status: 'available', domain, creationDate: 'YYYY-MM-DD', source }
 *   { status: 'unavailable' | 'error', domain, source }
 * The age itself is computed at display time from creationDate (see domain-age.js),
 * so cached entries never show a stale age.
 */
import { createInFlight } from './api-client.js';
import { DAY_MS } from './storage-cache.js';

export const MAX_HOSTNAMES_PER_REQUEST = 20;
const AVAILABLE_TTL_MS = 30 * DAY_MS;
const UNAVAILABLE_TTL_MS = DAY_MS;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(['available', 'unavailable', 'error']);

const errorInfo = { status: 'error', domain: null, source: null };

/** Validates one entry of the backend's `domains` array. */
export function toAgeInfo(entry) {
  const age = entry?.domain_age;
  if (!age || !STATUSES.has(age.status)) return null;
  const domain = typeof entry.domain === 'string' ? entry.domain : null;
  const source = typeof age.data_source === 'string' ? age.data_source.slice(0, 50) : null;
  if (age.status !== 'available') return { status: age.status, domain, source };
  if (!DATE_PATTERN.test(age.creation_date) || Number.isNaN(Date.parse(age.creation_date))) {
    return null;
  }
  return { status: 'available', domain, creationDate: age.creation_date, source };
}

export function createDomainRepository({ cache, api }) {
  const inFlight = createInFlight();

  async function fetchMissing(hostnames) {
    const response = await api.getJson('/api/v1/domains', { hosts: hostnames.join(',') });
    const entries =
      response.ok && Array.isArray(response.body?.domains) ? response.body.domains : [];
    const byHost = new Map();
    for (const entry of entries) {
      if (typeof entry?.hostname !== 'string' || !hostnames.includes(entry.hostname)) continue;
      const info = toAgeInfo(entry);
      if (info) byHost.set(entry.hostname, info);
    }

    const results = {};
    for (const hostname of hostnames) {
      const info = byHost.get(hostname) ?? errorInfo;
      results[hostname] = info;
      if (info.status === 'available') await cache.set(hostname, info, AVAILABLE_TTL_MS);
      else if (info.status === 'unavailable') await cache.set(hostname, info, UNAVAILABLE_TTL_MS);
    }
    return results;
  }

  /**
   * @param {string[]} hostnames
   * @returns {Promise<Record<string, object>>} Age info per (lowercased) hostname. Never throws.
   */
  async function getDomainAges(hostnames) {
    const unique = [...new Set(hostnames.map((h) => h.toLowerCase()))].slice(
      0,
      MAX_HOSTNAMES_PER_REQUEST,
    );
    const results = {};
    const missing = [];
    for (const hostname of unique) {
      const hit = await cache.get(hostname);
      if (hit) results[hostname] = hit.value;
      else missing.push(hostname);
    }
    if (missing.length) {
      Object.assign(results, await inFlight.run(missing.join(','), () => fetchMissing(missing)));
    }
    return results;
  }

  return { getDomainAges };
}
