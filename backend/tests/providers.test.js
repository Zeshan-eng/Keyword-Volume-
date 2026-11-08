import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLabsProvider, parseDataForSeoTime } from '../src/providers/dataforseo-labs.js';
import { createGoogleAdsProvider } from '../src/providers/dataforseo-ads.js';
import { createFallbackProvider } from '../src/providers/fallback-provider.js';
import { createDataForSeoClient } from '../src/providers/dataforseo-client.js';
import { createSlidingWindowLimiter } from '../src/lib/sliding-window-limiter.js';
import { COUNTRY_LOCATIONS } from '../src/countries.js';
import { ERROR_CODES } from '../src/lib/errors.js';
import { createFakeFetch, createManualClock, jsonResponse, loadFixture } from './helpers.js';

const FIXED_NOW = new Date('2026-11-08T12:00:00.000Z');
const now = () => FIXED_NOW;
const US = COUNTRY_LOCATIONS.US;
const GLOBAL = COUNTRY_LOCATIONS.GLOBAL;

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

const openLimiter = { tryAcquire: () => true };

test('parses DataForSEO timestamps', () => {
  assert.equal(parseDataForSeoTime('2026-10-14 06:12:40 +00:00'), '2026-10-14T06:12:40.000Z');
  assert.equal(parseDataForSeoTime('2026-10-14 06:12:40 +02:00'), '2026-10-14T04:12:40.000Z');
  assert.equal(parseDataForSeoTime('garbage'), null);
  assert.equal(parseDataForSeoTime(undefined), null);
});

test('Labs: returns volume and dataset timestamp', async () => {
  const { client, calls } = clientFor(jsonResponse(loadFixture('labs-keyword-overview-ok')));
  const result = await createLabsProvider({ client, now }).lookup({
    keyword: 'Fixture Keyword',
    location: US,
  });
  assert.deepEqual(result, {
    status: 'ok',
    searchVolume: 4400,
    lastUpdated: '2026-10-14T06:12:40.000Z',
  });
  assert.deepEqual(calls[0].body, [
    { keywords: ['Fixture Keyword'], location_code: 2840, language_code: 'en' },
  ]);
  assert.match(calls[0].url, /dataforseo_labs\/google\/keyword_overview\/live$/);
});

test('Labs: keyword missing from database is no_data', async () => {
  const { client } = clientFor(jsonResponse(loadFixture('labs-keyword-overview-not-found')));
  const result = await createLabsProvider({ client, now }).lookup({ keyword: 'x', location: US });
  assert.deepEqual(result, { status: 'no_data' });
});

test('Labs: null search_volume is no_data, never zero', async () => {
  const fixture = loadFixture('labs-keyword-overview-ok');
  fixture.tasks[0].result[0].items[0].keyword_info.search_volume = null;
  const { client } = clientFor(jsonResponse(fixture));
  const result = await createLabsProvider({ client, now }).lookup({
    keyword: 'fixture keyword',
    location: US,
  });
  assert.deepEqual(result, { status: 'no_data' });
});

test('Labs: does not support worldwide', () => {
  const { client } = clientFor();
  const labs = createLabsProvider({ client });
  assert.equal(labs.supports(GLOBAL), false);
  assert.equal(labs.supports(US), true);
});

test('Ads: returns volume with retrieval time', async () => {
  const { client, calls } = clientFor(jsonResponse(loadFixture('ads-search-volume-ok')));
  const result = await createGoogleAdsProvider({ client, limiter: openLimiter, now }).lookup({
    keyword: 'fixture keyword',
    location: US,
  });
  assert.deepEqual(result, {
    status: 'ok',
    searchVolume: 90,
    lastUpdated: FIXED_NOW.toISOString(),
  });
  assert.deepEqual(calls[0].body, [
    {
      keywords: ['fixture keyword'],
      search_partners: false,
      location_code: 2840,
      language_code: 'en',
    },
  ]);
});

test('Ads: worldwide omits location and language', async () => {
  const { client, calls } = clientFor(jsonResponse(loadFixture('ads-search-volume-ok')));
  await createGoogleAdsProvider({ client, limiter: openLimiter, now }).lookup({
    keyword: 'fixture keyword',
    location: GLOBAL,
  });
  assert.deepEqual(calls[0].body, [{ keywords: ['fixture keyword'], search_partners: false }]);
});

test('Ads: null search_volume is no_data', async () => {
  const { client } = clientFor(jsonResponse(loadFixture('ads-search-volume-null')));
  const result = await createGoogleAdsProvider({ client, limiter: openLimiter, now }).lookup({
    keyword: 'fixture keyword',
    location: US,
  });
  assert.deepEqual(result, { status: 'no_data' });
});

test('Ads: refuses to call the provider once the local limit is reached', async () => {
  const clock = createManualClock();
  const limiter = createSlidingWindowLimiter({ limit: 2, windowMs: 60_000, now: clock.now });
  const { client, calls } = clientFor(jsonResponse(loadFixture('ads-search-volume-ok')));
  const ads = createGoogleAdsProvider({ client, limiter, now });
  const lookup = () => ads.lookup({ keyword: 'fixture keyword', location: US });

  await lookup();
  await lookup();
  await assert.rejects(lookup(), { code: ERROR_CODES.RATE_LIMITED });
  assert.equal(calls.length, 2);

  clock.advance(60_000);
  await lookup();
  assert.equal(calls.length, 3);
});

test('Fallback: uses Labs when it has data', async () => {
  const { client, calls } = clientFor(jsonResponse(loadFixture('labs-keyword-overview-ok')));
  const provider = createFallbackProvider([
    createLabsProvider({ client, now }),
    createGoogleAdsProvider({ client, limiter: openLimiter, now }),
  ]);
  const { result, source } = await provider.lookup({ keyword: 'fixture keyword', location: US });
  assert.equal(result.searchVolume, 4400);
  assert.equal(source, 'DataForSEO Labs');
  assert.equal(calls.length, 1);
});

test('Fallback: falls back to Google Ads when Labs has no data', async () => {
  const { client, calls } = clientFor(
    jsonResponse(loadFixture('labs-keyword-overview-not-found')),
    jsonResponse(loadFixture('ads-search-volume-ok')),
  );
  const provider = createFallbackProvider([
    createLabsProvider({ client, now }),
    createGoogleAdsProvider({ client, limiter: openLimiter, now }),
  ]);
  const { result, source } = await provider.lookup({ keyword: 'fixture keyword', location: US });
  assert.equal(result.searchVolume, 90);
  assert.equal(source, 'DataForSEO Google Ads');
  assert.equal(calls.length, 2);
});

test('Fallback: worldwide goes straight to Google Ads', async () => {
  const { client, calls } = clientFor(jsonResponse(loadFixture('ads-search-volume-ok')));
  const provider = createFallbackProvider([
    createLabsProvider({ client, now }),
    createGoogleAdsProvider({ client, limiter: openLimiter, now }),
  ]);
  const { source } = await provider.lookup({ keyword: 'fixture keyword', location: GLOBAL });
  assert.equal(source, 'DataForSEO Google Ads');
  assert.equal(calls.length, 1);
});

test('Fallback: no_data from every provider is no_data', async () => {
  const { client } = clientFor(
    jsonResponse(loadFixture('labs-keyword-overview-not-found')),
    jsonResponse(loadFixture('ads-search-volume-null')),
  );
  const provider = createFallbackProvider([
    createLabsProvider({ client, now }),
    createGoogleAdsProvider({ client, limiter: openLimiter, now }),
  ]);
  const { result, source } = await provider.lookup({ keyword: 'fixture keyword', location: US });
  assert.deepEqual(result, { status: 'no_data' });
  assert.equal(source, null);
});

test('Fallback: provider errors are not masked by the fallback', async () => {
  const { client, calls } = clientFor(jsonResponse(loadFixture('task-error-rate-limit')));
  const provider = createFallbackProvider([
    createLabsProvider({ client, now }),
    createGoogleAdsProvider({ client, limiter: openLimiter, now }),
  ]);
  await assert.rejects(provider.lookup({ keyword: 'x', location: US }), {
    code: ERROR_CODES.RATE_LIMITED,
  });
  assert.equal(calls.length, 1);
});

test('A provider "no search results" status (40102) is no_data', async () => {
  const fixture = loadFixture('task-error-rate-limit');
  fixture.tasks[0].status_code = 40102;
  const { client } = clientFor(jsonResponse(fixture));
  const result = await createLabsProvider({ client, now }).lookup({ keyword: 'x', location: US });
  assert.deepEqual(result, { status: 'no_data' });
});
