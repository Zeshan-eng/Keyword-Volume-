import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRelatedKeywordsProvider,
  toRelatedKeywords,
} from '../src/providers/dataforseo-related.js';
import { createDataForSeoClient } from '../src/providers/dataforseo-client.js';
import { createRelatedService } from '../src/services/related-service.js';
import { createTtlCache } from '../src/cache/ttl-cache.js';
import { COUNTRY_LOCATIONS } from '../src/countries.js';
import { ERROR_CODES, ProviderError } from '../src/lib/errors.js';
import { silentLogger } from '../src/lib/logger.js';
import { createFakeFetch, createManualClock, jsonResponse, loadFixture } from './helpers.js';

const now = () => new Date('2026-11-09T12:00:00.000Z');

function clientFor(...responders) {
  const fake = createFakeFetch(...responders);
  const client = createDataForSeoClient({
    login: 'l',
    password: 'p',
    baseUrl: 'https://api.dataforseo.test',
    timeoutMs: 1000,
    fetchImpl: fake.fetchImpl,
  });
  return { client, calls: fake.calls };
}

test('dedupes, drops the seed keyword, keeps null volumes as null', () => {
  const items = loadFixture('labs-related-keywords-ok').tasks[0].result[0].items;
  const { keywords, lastUpdated } = toRelatedKeywords(items, 'fixture seed', 20);
  assert.deepEqual(keywords, [
    { keyword: 'fixture related one', search_volume: 2400 },
    { keyword: 'fixture related two', search_volume: null },
    { keyword: 'fixture related three', search_volume: 170 },
  ]);
  assert.equal(lastUpdated, '2026-10-17T13:08:31.000Z');
});

test('respects the limit and ignores malformed items', () => {
  const items = [null, {}, { keyword_data: { keyword: '' } }, { keyword_data: { keyword: 'a' } }];
  assert.deepEqual(toRelatedKeywords(items, 'seed', 1).keywords, [
    { keyword: 'a', search_volume: null },
  ]);
  assert.deepEqual(toRelatedKeywords(undefined, 'seed', 5).keywords, []);
});

test('provider sends the documented request and returns suggestions', async () => {
  const { client, calls } = clientFor(jsonResponse(loadFixture('labs-related-keywords-ok')));
  const provider = createRelatedKeywordsProvider({ client, limit: 20, now });
  const result = await provider.lookup({ keyword: 'fixture seed', location: COUNTRY_LOCATIONS.GB });

  assert.equal(result.status, 'ok');
  assert.equal(result.relatedKeywords.length, 3);
  assert.match(calls[0].url, /dataforseo_labs\/google\/related_keywords\/live$/);
  assert.deepEqual(calls[0].body, [
    {
      keyword: 'fixture seed',
      location_code: 2826,
      language_code: 'en',
      depth: 2,
      limit: 30,
      order_by: ['keyword_data.keyword_info.search_volume,desc'],
    },
  ]);
});

test('provider reports no_data for empty results and does not support worldwide', async () => {
  const fixture = loadFixture('labs-keyword-overview-not-found');
  const { client } = clientFor(jsonResponse(fixture));
  const provider = createRelatedKeywordsProvider({ client, now });
  assert.deepEqual(await provider.lookup({ keyword: 'x', location: COUNTRY_LOCATIONS.US }), {
    status: 'no_data',
  });
  assert.equal(provider.supports(COUNTRY_LOCATIONS.GLOBAL), false);
});

function setupService(responses) {
  const clock = createManualClock();
  const queue = [...responses];
  const lookups = [];
  const provider = {
    name: 'DataForSEO Labs',
    supports: (location) => location.locationCode !== null,
    async lookup(args) {
      lookups.push(args);
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (next instanceof Error) throw next;
      return next;
    },
  };
  const service = createRelatedService({
    provider,
    cache: createTtlCache({ ttlMs: 86_400_000, maxEntries: 100, now: clock.now }),
    refreshMinAgeMs: 3_600_000,
    now: clock.now,
    logger: silentLogger,
  });
  return { service, lookups, clock };
}

const okResult = {
  status: 'ok',
  relatedKeywords: [{ keyword: 'b', search_volume: 10 }],
  lastUpdated: '2026-10-17T13:08:31.000Z',
};

test('service returns the PRD 7.2 shape and caches per keyword+country', async () => {
  const { service, lookups } = setupService([okResult]);
  const body = await service.getRelated({ keyword: 'Seed', country: 'US' });
  assert.deepEqual(body, {
    success: true,
    keyword: 'Seed',
    country: 'US',
    related_keywords: [{ keyword: 'b', search_volume: 10 }],
    data_source: 'DataForSEO Labs',
    last_updated: '2026-10-17T13:08:31.000Z',
    cached: false,
  });
  assert.equal((await service.getRelated({ keyword: 'seed', country: 'US' })).cached, true);
  await service.getRelated({ keyword: 'seed', country: 'GB' });
  assert.equal(lookups.length, 2);
});

test('service: worldwide is reported as not supported without calling the provider', async () => {
  const { service, lookups } = setupService([okResult]);
  const body = await service.getRelated({ keyword: 'seed', country: 'GLOBAL' });
  assert.equal(body.success, false);
  assert.equal(body.error_code, ERROR_CODES.NOT_SUPPORTED);
  assert.deepEqual(body.related_keywords, []);
  assert.equal(lookups.length, 0);
});

test('service: no data is cached, errors are not', async () => {
  const { service, lookups } = setupService([
    new ProviderError(ERROR_CODES.PROVIDER_ERROR, 'boom'),
    { status: 'no_data' },
  ]);
  await assert.rejects(service.getRelated({ keyword: 's', country: 'US' }));
  const empty = await service.getRelated({ keyword: 's', country: 'US' });
  assert.equal(empty.error_code, ERROR_CODES.NO_DATA);
  assert.equal(empty.message, 'No related keywords found');
  assert.equal((await service.getRelated({ keyword: 's', country: 'US' })).cached, true);
  assert.equal(lookups.length, 2);
});
