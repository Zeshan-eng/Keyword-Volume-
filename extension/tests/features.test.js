import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAge, formatAgeLong, formatAgeShort } from '../shared/domain-age.js';
import { createDomainRepository, toAgeInfo } from '../shared/domain-repository.js';
import { ERROR_CODES } from '../shared/messages.js';
import {
  createRelatedRepository,
  fromRelatedResponse,
  isRelatedCacheable,
} from '../shared/related-repository.js';
import { icannLookupUrl, resultHostname } from '../shared/result-url.js';
import { CACHE_PREFIXES, createExtensionCaches, DAY_MS } from '../shared/storage-cache.js';
import { createClock, createFakeApi, createMemoryStorage, json } from './helpers.js';

const request = { keyword: 'mold removal', country: 'US' };
const relatedBody = {
  success: true,
  keyword: 'mold removal',
  country: 'US',
  related_keywords: [
    { keyword: 'mold removal service', search_volume: 90500 },
    { keyword: 'mold remediation', search_volume: null },
  ],
  data_source: 'DataForSEO Labs',
  last_updated: '2026-10-16T23:31:52.000Z',
  cached: false,
};

// --- related keywords ---------------------------------------------------------------

test('related: accepts valid suggestions and keeps null volumes null', () => {
  assert.deepEqual(fromRelatedResponse(relatedBody, request), {
    status: 'success',
    keyword: 'mold removal',
    country: 'US',
    keywords: [
      { keyword: 'mold removal service', searchVolume: 90500 },
      { keyword: 'mold remediation', searchVolume: null },
    ],
    dataSource: 'DataForSEO Labs',
    lastUpdated: '2026-10-16T23:31:52.000Z',
    cached: false,
  });
});

test('related: rejects malformed suggestions instead of showing them', () => {
  for (const related_keywords of [
    [{ keyword: 'x', search_volume: '100' }],
    [{ keyword: 'x', search_volume: -1 }],
    [{ keyword: '', search_volume: 1 }],
    [{ search_volume: 1 }],
    'nope',
  ]) {
    const result = fromRelatedResponse({ ...relatedBody, related_keywords }, request);
    assert.equal(result.reason, ERROR_CODES.INVALID_RESPONSE, JSON.stringify(related_keywords));
  }
});

test('related: maps error codes; only confirmed outcomes are cacheable', () => {
  const notSupported = fromRelatedResponse(
    { success: false, error_code: 'not_supported' },
    request,
  );
  assert.equal(notSupported.reason, ERROR_CODES.NOT_SUPPORTED);
  assert.equal(isRelatedCacheable(notSupported), true);
  assert.equal(isRelatedCacheable({ status: 'unavailable', reason: ERROR_CODES.NO_DATA }), true);
  assert.equal(
    isRelatedCacheable({ status: 'unavailable', reason: ERROR_CODES.NETWORK_ERROR }),
    false,
  );
});

test('related repository: one backend call, then cache; refresh bypasses cache', async () => {
  const storage = createMemoryStorage();
  const { api, calls } = createFakeApi(() => json(relatedBody));
  const repository = createRelatedRepository({
    cache: createExtensionCaches({ storage }).related,
    api,
  });
  const first = await repository.getRelated(request);
  const second = await repository.getRelated({ ...request, keyword: 'Mold Removal' });
  assert.equal(first.keywords.length, 2);
  assert.equal(second.cached, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/api/v1/related');
  assert.ok(Object.keys(storage.data)[0].startsWith(CACHE_PREFIXES.RELATED));

  await repository.getRelated({ ...request, refresh: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.searchParams.get('refresh'), '1');
});

// --- domain age ----------------------------------------------------------------------

const NOW = new Date('2026-11-09T12:00:00Z');

test('age maths and labels', () => {
  assert.deepEqual(computeAge('2024-06-14', NOW), { years: 2, months: 4 });
  assert.deepEqual(computeAge('2026-08-20', NOW), { years: 0, months: 2 });
  assert.equal(computeAge('not-a-date', NOW), null);
  assert.equal(formatAgeShort({ years: 2, months: 4 }), '2y');
  assert.equal(formatAgeShort({ years: 0, months: 2 }), '2m');
  assert.equal(formatAgeShort({ years: 0, months: 0 }), '<1m');
  assert.equal(formatAgeShort(null), 'N/A');
  assert.equal(formatAgeLong({ years: 1, months: 1 }), '1 year, 1 month');
  assert.equal(formatAgeLong({ years: 8, months: 0 }), '8 years');
});

test('validates backend domain entries', () => {
  const ok = {
    hostname: 'www.example.com',
    domain: 'example.com',
    domain_age: { status: 'available', creation_date: '2018-03-15', data_source: 'RDAP' },
  };
  assert.deepEqual(toAgeInfo(ok), {
    status: 'available',
    domain: 'example.com',
    creationDate: '2018-03-15',
    source: 'RDAP',
  });
  assert.equal(
    toAgeInfo({ ...ok, domain_age: { ...ok.domain_age, creation_date: '15/03/2018' } }),
    null,
  );
  assert.equal(toAgeInfo({ ...ok, domain_age: { status: 'weird' } }), null);
  assert.equal(toAgeInfo({ domain_age: { status: 'unavailable' } }).status, 'unavailable');
});

function domainsResponse(entries) {
  return json({ success: true, domains: entries });
}

test('domain repository batches missing hostnames and caches per hostname', async () => {
  const clock = createClock();
  const storage = createMemoryStorage();
  const { api, calls } = createFakeApi((_n, url) => {
    const hosts = url.searchParams.get('hosts').split(',');
    return domainsResponse(
      hosts.map((hostname) =>
        hostname === 'old.com'
          ? {
              hostname,
              domain: 'old.com',
              domain_age: { status: 'available', creation_date: '2001-01-01', data_source: 'RDAP' },
            }
          : {
              hostname,
              domain: hostname,
              domain_age: { status: 'unavailable', data_source: 'RDAP' },
            },
      ),
    );
  });
  const repository = createDomainRepository({
    cache: createExtensionCaches({ storage, now: clock.now }).domainAge,
    api,
  });

  const first = await repository.getDomainAges(['old.com', 'NEW.ae']);
  assert.equal(first['old.com'].creationDate, '2001-01-01');
  assert.equal(first['new.ae'].status, 'unavailable');
  assert.equal(calls[0].url.searchParams.get('hosts'), 'old.com,new.ae');

  await repository.getDomainAges(['old.com', 'new.ae']);
  assert.equal(calls.length, 1, 'served from cache');

  // Unavailable answers are retried after a day; confirmed dates last 30 days.
  clock.advance(DAY_MS);
  await repository.getDomainAges(['old.com', 'new.ae']);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.searchParams.get('hosts'), 'new.ae');
});

test('domain repository: network failure yields error states and is not cached', async () => {
  const storage = createMemoryStorage();
  const { api, calls } = createFakeApi(() => {
    throw new TypeError('Failed to fetch');
  });
  const repository = createDomainRepository({
    cache: createExtensionCaches({ storage }).domainAge,
    api,
  });
  const ages = await repository.getDomainAges(['a.com']);
  assert.equal(ages['a.com'].status, 'error');
  await repository.getDomainAges(['a.com']);
  assert.equal(calls.length, 2);
  assert.deepEqual(storage.data, {});
});

test('domain repository ignores entries for hostnames it did not ask for', async () => {
  const { api } = createFakeApi(() =>
    domainsResponse([
      {
        hostname: 'evil.com',
        domain: 'evil.com',
        domain_age: { status: 'available', creation_date: '2000-01-01', data_source: 'RDAP' },
      },
    ]),
  );
  const repository = createDomainRepository({
    cache: createExtensionCaches({ storage: createMemoryStorage() }).domainAge,
    api,
  });
  const ages = await repository.getDomainAges(['a.com']);
  assert.deepEqual(Object.keys(ages), ['a.com']);
  assert.equal(ages['a.com'].status, 'error');
});

// --- result URLs ----------------------------------------------------------------------

test('extracts destination hostnames from result links', () => {
  assert.equal(resultHostname('https://www.Example.com/page'), 'www.example.com');
  assert.equal(
    resultHostname(
      '/url?q=https://moldsolutionsgnv.com/&sa=U',
      'https://www.google.com/search?q=x',
    ),
    'moldsolutionsgnv.com',
  );
  for (const href of [
    'https://www.google.com/search?q=other',
    'https://maps.google.co.uk/x',
    'https://www.youtube.com/watch?v=1',
    'javascript:alert(1)',
    'mailto:a@b.com',
    '#',
  ]) {
    assert.equal(resultHostname(href), null, href);
  }
});

test('builds ICANN lookup links', () => {
  assert.equal(
    icannLookupUrl('example.com'),
    'https://lookup.icann.org/en/lookup?name=example.com',
  );
});
