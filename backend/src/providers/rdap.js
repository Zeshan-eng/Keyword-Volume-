/**
 * Domain registration dates via RDAP (RFC 9082/9083), the ICANN-mandated successor to WHOIS.
 * Servers are discovered through the IANA bootstrap registry (RFC 9224):
 * https://data.iana.org/rdap/dns.json — only those official HTTPS endpoints are contacted.
 *
 * Results:
 *   { status: 'available', creationDate: ISO 8601 }
 *   { status: 'unavailable', reason: 'no_rdap_server' | 'not_found' | 'no_registration_date' }
 * Transient failures (network, timeouts, 429, 5xx) throw ProviderError and are never cached.
 */
import { ERROR_CODES, ProviderError } from '../lib/errors.js';

export const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;

/** Builds a TLD → base URL map from the IANA bootstrap document (HTTPS URLs only). */
export function parseBootstrap(document) {
  const servers = new Map();
  if (!Array.isArray(document?.services)) return servers;
  for (const [tlds, urls] of document.services) {
    const base = Array.isArray(urls) ? urls.find((url) => /^https:\/\//.test(url)) : undefined;
    if (!base || !Array.isArray(tlds)) continue;
    for (const tld of tlds) {
      if (typeof tld === 'string')
        servers.set(tld.toLowerCase(), base.endsWith('/') ? base : `${base}/`);
    }
  }
  return servers;
}

/** Finds the domain's original registration date in an RDAP domain object. */
export function extractRegistrationDate(rdapDomain, now = new Date()) {
  const events = Array.isArray(rdapDomain?.events) ? rdapDomain.events : [];
  const registration = events.find((event) => event?.eventAction === 'registration');
  const date = new Date(registration?.eventDate);
  if (Number.isNaN(date.getTime()) || date > now || date.getUTCFullYear() < 1985) return null;
  return date.toISOString();
}

export function createRdapProvider({
  fetchImpl = globalThis.fetch,
  timeoutMs,
  now = () => new Date(),
  bootstrapUrl = RDAP_BOOTSTRAP_URL,
}) {
  let bootstrap = null;
  let bootstrapLoadedAt = 0;
  let bootstrapPending = null;

  async function fetchJson(url) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: 'application/rdap+json, application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const reason = error?.name === 'TimeoutError' ? 'timed out' : 'network failure';
      throw new ProviderError(ERROR_CODES.PROVIDER_ERROR, `RDAP request ${reason}`);
    }
    if (response.status === 404) return { notFound: true };
    if (response.status === 429) {
      throw new ProviderError(ERROR_CODES.RATE_LIMITED, 'RDAP server rate limit');
    }
    if (!response.ok) {
      throw new ProviderError(ERROR_CODES.PROVIDER_ERROR, `RDAP HTTP ${response.status}`);
    }
    try {
      return { body: await response.json() };
    } catch {
      throw new ProviderError(ERROR_CODES.PROVIDER_ERROR, 'RDAP returned non-JSON');
    }
  }

  async function getServers() {
    if (bootstrap && now().getTime() - bootstrapLoadedAt < BOOTSTRAP_TTL_MS) return bootstrap;
    bootstrapPending ??= fetchJson(bootstrapUrl)
      .then(({ body }) => {
        const servers = parseBootstrap(body);
        if (servers.size === 0) {
          throw new ProviderError(ERROR_CODES.PROVIDER_ERROR, 'RDAP bootstrap is empty');
        }
        bootstrap = servers;
        bootstrapLoadedAt = now().getTime();
        return servers;
      })
      .finally(() => {
        bootstrapPending = null;
      });
    return bootstrapPending;
  }

  return {
    name: 'RDAP',

    /** @param {string} domain ASCII registered domain, e.g. "example.co.uk". */
    async lookup(domain) {
      const tld = domain.slice(domain.lastIndexOf('.') + 1);
      const base = (await getServers()).get(tld);
      if (!base) return { status: 'unavailable', reason: 'no_rdap_server' };

      const { body, notFound } = await fetchJson(`${base}domain/${encodeURIComponent(domain)}`);
      if (notFound) return { status: 'unavailable', reason: 'not_found' };

      const creationDate = extractRegistrationDate(body, now());
      return creationDate
        ? { status: 'available', creationDate }
        : { status: 'unavailable', reason: 'no_registration_date' };
    },
  };
}
