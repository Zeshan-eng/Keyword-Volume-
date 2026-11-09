/**
 * Domain metrics for organic results. Currently: registration age via RDAP.
 * Each domain is looked up, cached and allowed to fail independently.
 */
import { createCachedLoader } from '../cache/cached-loader.js';
import { toRegistrableDomain } from '../domains/registrable-domain.js';

const UNAVAILABLE_RETRY_MS = 24 * 60 * 60 * 1000;

/** Whole years and remaining months between two dates (UTC). */
export function computeAge(creationIso, now) {
  const created = new Date(creationIso);
  let months =
    (now.getUTCFullYear() - created.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - created.getUTCMonth());
  if (now.getUTCDate() < created.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  return { years: Math.floor(months / 12), months: months % 12 };
}

function ageBlock(result, source, now) {
  if (result.status !== 'available') {
    return {
      creation_date: null,
      age_years: null,
      age_months: null,
      data_source: source,
      status: result.status,
    };
  }
  const { years, months } = computeAge(result.creationDate, now);
  return {
    creation_date: result.creationDate.slice(0, 10),
    age_years: years,
    age_months: months,
    data_source: source,
    status: 'available',
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export function createDomainService({
  ageProvider,
  cache,
  ageTtlMs,
  concurrency = 4,
  now = () => new Date(),
  logger,
}) {
  const loader = createCachedLoader({ cache, now: () => now().getTime() });

  async function lookupAge(domain) {
    try {
      const { value, cached } = await loader.load(`age|${domain}|${ageProvider.name}`, async () => {
        const result = await ageProvider.lookup(domain);
        // Confirmed dates rarely change; "no data" answers are retried sooner.
        const ttlMs = result.status === 'available' ? ageTtlMs : UNAVAILABLE_RETRY_MS;
        return { value: result, cacheable: true, ttlMs };
      });
      return { result: value, cached };
    } catch (error) {
      logger.warn('domain_age_failure', { code: error?.code, detail: error?.message });
      return { result: { status: 'error' }, cached: false };
    }
  }

  /**
   * @param {string[]} hostnames Hostnames of organic results (already validated).
   * @returns {Promise<object>} Response body; never throws for per-domain failures.
   */
  async function getDomainMetrics(hostnames) {
    const entries = hostnames.map((hostname) => ({
      hostname,
      domain: toRegistrableDomain(hostname),
    }));
    const uniqueDomains = [...new Set(entries.map((e) => e.domain).filter(Boolean))];
    const ages = new Map(
      await mapWithConcurrency(uniqueDomains, concurrency, async (domain) => [
        domain,
        await lookupAge(domain),
      ]),
    );

    const current = now();
    return {
      success: true,
      domains: entries.map(({ hostname, domain }) => {
        const age = domain
          ? ages.get(domain)
          : { result: { status: 'unavailable' }, cached: false };
        return {
          hostname,
          domain,
          domain_age: ageBlock(age.result, ageProvider.name, current),
          cached: age.cached,
        };
      }),
    };
  }

  return { getDomainMetrics };
}
