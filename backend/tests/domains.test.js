import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRegistrableDomain } from '../src/domains/registrable-domain.js';
import {
  createRdapProvider,
  extractRegistrationDate,
  parseBootstrap,
} from '../src/providers/rdap.js';
import { computeAge, createDomainService } from '../src/services/domain-service.js';
import { createTtlCache } from '../src/cache/ttl-cache.js';
import { validateDomainsQuery } from '../src/validation/request.js';
import { ERROR_CODES, ProviderError } from '../src/lib/errors.js';
import { silentLogger } from '../src/lib/logger.js';
import { loadFixture } from './helpers.js';

const NOW = new Date('2026-11-09T12:00:00.000Z');
const now = () => NOW;

// --- registrable domains -----------------------------------------------------

test('normalizes hostnames to registered domains', () => {
  assert.equal(toRegistrableDomain('www.example.com'), 'example.com');
  assert.equal(toRegistrableDomain('Blog.Example.co.uk'), 'example.co.uk');
  assert.equal(toRegistrableDomain('maps.google.com.pk'), 'google.com.pk');
  assert.equal(toRegistrableDomain('example.com.'), 'example.com');
});

test('converts internationalized domains to punycode', () => {
  assert.equal(toRegistrableDomain('www.bücher.de'), 'xn--bcher-kva.de');
});

test('rejects IPs, bare suffixes and junk', () => {
  for (const host of ['192.168.0.1', 'localhost', 'co.uk', 'gov.pk', '', 'exa mple.com', null]) {
    assert.equal(toRegistrableDomain(host), null, String(host));
  }
});

// --- RDAP parsing --------------------------------------------------------------

test('bootstrap keeps only HTTPS servers', () => {
  const servers = parseBootstrap(loadFixture('rdap-bootstrap'));
  assert.equal(servers.get('com'), 'https://rdap.verisign.test/com/v1/');
  assert.equal(servers.get('uk'), 'https://rdap.nominet.test/uk/');
  assert.equal(servers.has('org'), false);
  assert.equal(parseBootstrap(null).size, 0);
});

test('extracts the registration event only', () => {
  assert.equal(
    extractRegistrationDate(loadFixture('rdap-domain-ok'), NOW),
    '2024-06-14T14:57:17.000Z',
  );
  assert.equal(
    extractRegistrationDate(
      { events: [{ eventAction: 'expiration', eventDate: '2027-01-01' }] },
      NOW,
    ),
    null,
  );
  assert.equal(
    extractRegistrationDate(
      { events: [{ eventAction: 'registration', eventDate: '2099-01-01' }] },
      NOW,
    ),
    null,
  );
  assert.equal(extractRegistrationDate({ events: 'nope' }, NOW), null);
});

function rdapWith(routes) {
  const calls = [];
  const provider = createRdapProvider({
    timeoutMs: 1000,
    now,
    bootstrapUrl: 'https://iana.test/dns.json',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const route = routes[url];
      if (!route) return new Response('', { status: 404 });
      if (route instanceof Error) throw route;
      return typeof route === 'function' ? route() : Response.json(route);
    },
  });
  return { provider, calls };
}

const bootstrapRoute = { 'https://iana.test/dns.json': loadFixture('rdap-bootstrap') };

test('RDAP lookup returns the creation date from the registry', async () => {
  const { provider, calls } = rdapWith({
    ...bootstrapRoute,
    'https://rdap.verisign.test/com/v1/domain/fixture-example.com': loadFixture('rdap-domain-ok'),
  });
  assert.deepEqual(await provider.lookup('fixture-example.com'), {
    status: 'available',
    creationDate: '2024-06-14T14:57:17.000Z',
  });
  assert.equal(calls[1].init.headers.Accept, 'application/rdap+json, application/json');

  // The bootstrap document is fetched once and reused.
  await provider.lookup('fixture-example.com');
  assert.equal(calls.filter((c) => c.url === 'https://iana.test/dns.json').length, 1);
});

test('RDAP lookup reports unsupported TLDs, unknown domains and missing dates', async () => {
  const { provider } = rdapWith({
    ...bootstrapRoute,
    'https://rdap.verisign.test/com/v1/domain/no-date.com': { events: [] },
  });
  assert.deepEqual(await provider.lookup('example.io'), {
    status: 'unavailable',
    reason: 'no_rdap_server',
  });
  assert.deepEqual(await provider.lookup('missing.com'), {
    status: 'unavailable',
    reason: 'not_found',
  });
  assert.deepEqual(await provider.lookup('no-date.com'), {
    status: 'unavailable',
    reason: 'no_registration_date',
  });
});

test('RDAP transient failures throw instead of returning data', async () => {
  const { provider } = rdapWith({
    ...bootstrapRoute,
    'https://rdap.verisign.test/com/v1/domain/limited.com': () => new Response('', { status: 429 }),
    'https://rdap.verisign.test/com/v1/domain/down.com': () => new Response('', { status: 503 }),
    'https://rdap.verisign.test/com/v1/domain/offline.com': new TypeError('fetch failed'),
  });
  await assert.rejects(provider.lookup('limited.com'), { code: ERROR_CODES.RATE_LIMITED });
  await assert.rejects(provider.lookup('down.com'), { code: ERROR_CODES.PROVIDER_ERROR });
  await assert.rejects(provider.lookup('offline.com'), { code: ERROR_CODES.PROVIDER_ERROR });
});

// --- age maths -------------------------------------------------------------------

test('computes whole years and months', () => {
  assert.deepEqual(computeAge('2024-06-14T14:57:17Z', NOW), { years: 2, months: 4 });
  assert.deepEqual(computeAge('2018-03-15T00:00:00Z', NOW), { years: 8, months: 7 });
  assert.deepEqual(computeAge('2026-11-01T00:00:00Z', NOW), { years: 0, months: 0 });
  assert.deepEqual(computeAge('2025-11-10T00:00:00Z', NOW), { years: 0, months: 11 });
  assert.deepEqual(computeAge('2025-11-09T00:00:00Z', NOW), { years: 1, months: 0 });
});

// --- domain service ----------------------------------------------------------------

function setupDomainService(answers) {
  const lookups = [];
  const ageProvider = {
    name: 'RDAP',
    async lookup(domain) {
      lookups.push(domain);
      const answer = answers[domain];
      if (answer instanceof Error) throw answer;
      return answer ?? { status: 'unavailable', reason: 'not_found' };
    },
  };
  const service = createDomainService({
    ageProvider,
    cache: createTtlCache({ ttlMs: 30 * 86_400_000, maxEntries: 100 }),
    ageTtlMs: 30 * 86_400_000,
    now,
    logger: silentLogger,
  });
  return { service, lookups };
}

test('returns the PRD 7.3/7.4 domain_age shape, deduped per registered domain', async () => {
  const { service, lookups } = setupDomainService({
    'example.com': { status: 'available', creationDate: '2018-03-15T00:00:00.000Z' },
  });
  const body = await service.getDomainMetrics(['www.example.com', 'blog.example.com', 'other.org']);

  assert.deepEqual(lookups.sort(), ['example.com', 'other.org']);
  assert.equal(body.success, true);
  assert.deepEqual(body.domains[0], {
    hostname: 'www.example.com',
    domain: 'example.com',
    domain_age: {
      creation_date: '2018-03-15',
      age_years: 8,
      age_months: 7,
      data_source: 'RDAP',
      status: 'available',
    },
    cached: false,
  });
  assert.equal(body.domains[1].domain_age.age_years, 8);
  assert.deepEqual(body.domains[2].domain_age, {
    creation_date: null,
    age_years: null,
    age_months: null,
    data_source: 'RDAP',
    status: 'unavailable',
  });
});

test('one failing domain does not affect the others, and failures are retried', async () => {
  const { service, lookups } = setupDomainService({
    'good.com': { status: 'available', creationDate: '2020-01-01T00:00:00.000Z' },
    'bad.com': new ProviderError(ERROR_CODES.PROVIDER_ERROR, 'down'),
  });
  const first = await service.getDomainMetrics(['good.com', 'bad.com']);
  assert.equal(first.domains[0].domain_age.status, 'available');
  assert.equal(first.domains[1].domain_age.status, 'error');
  assert.equal(first.domains[1].domain_age.age_years, null);

  const second = await service.getDomainMetrics(['good.com', 'bad.com']);
  assert.equal(second.domains[0].cached, true);
  assert.equal(lookups.filter((d) => d === 'bad.com').length, 2);
  assert.equal(lookups.filter((d) => d === 'good.com').length, 1);
});

test('hostnames without a registered domain are unavailable without a lookup', async () => {
  const { service, lookups } = setupDomainService({});
  const body = await service.getDomainMetrics(['localhost']);
  assert.equal(body.domains[0].domain, null);
  assert.equal(body.domains[0].domain_age.status, 'unavailable');
  assert.equal(lookups.length, 0);
});

// --- validation ----------------------------------------------------------------------

test('validates the hosts parameter', () => {
  assert.deepEqual(validateDomainsQuery({ hosts: 'A.com, b.co.uk,a.com' }), {
    ok: true,
    value: { hostnames: ['a.com', 'b.co.uk'] },
  });
  assert.equal(validateDomainsQuery({ hosts: 'bücher.de' }).ok, true);
  const tooMany = Array.from({ length: 21 }, (_, i) => `d${i}.com`).join(',');
  for (const hosts of [
    undefined,
    '',
    ['a.com'],
    tooMany,
    'a..com',
    'http://a.com',
    'a.com/x',
    '-a.com',
  ]) {
    assert.equal(
      validateDomainsQuery({ hosts }).errorCode,
      ERROR_CODES.INVALID_REQUEST,
      String(hosts),
    );
  }
});
