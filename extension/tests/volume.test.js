import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_PREFIXES, CACHE_TTL_MS, createStorageCache } from '../shared/storage-cache.js';
import { createClock, createFakeApi, createMemoryStorage, json } from './helpers.js';
import { fromBackendResponse, isCacheable } from '../shared/volume-result.js';
import { createVolumeRepository } from '../shared/volume-repository.js';
import { ERROR_CODES } from '../shared/messages.js';

const createVolumeCache = (options) =>
  createStorageCache({ prefix: CACHE_PREFIXES.VOLUME, ttlMs: CACHE_TTL_MS, ...options });

const request = { keyword: 'mold removal', country: 'US' };
const successBody = {
  success: true,
  keyword: 'mold removal',
  search_volume: 1300,
  country: 'US',
  data_source: 'DataForSEO Labs',
  last_updated: '2026-10-14T06:12:40.000Z',
  cached: false,
};

// --- volume-result ---------------------------------------------------------

test('accepts a valid success response', () => {
  assert.deepEqual(fromBackendResponse(successBody, request), {
    status: 'success',
    keyword: 'mold removal',
    country: 'US',
    searchVolume: 1300,
    dataSource: 'DataForSEO Labs',
    lastUpdated: '2026-10-14T06:12:40.000Z',
    cached: false,
  });
});

test('never turns malformed volumes into numbers', () => {
  for (const search_volume of [null, '1300', -5, 12.5, undefined]) {
    const result = fromBackendResponse({ ...successBody, search_volume }, request);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.reason, ERROR_CODES.INVALID_RESPONSE);
  }
});

test('rejects success responses with bad metadata', () => {
  assert.equal(
    fromBackendResponse({ ...successBody, last_updated: 'yesterday' }, request).status,
    'unavailable',
  );
  assert.equal(
    fromBackendResponse({ ...successBody, data_source: '' }, request).status,
    'unavailable',
  );
});

test('passes through known error codes and maps unknown ones', () => {
  assert.equal(
    fromBackendResponse({ success: false, error_code: 'no_data' }, request).reason,
    ERROR_CODES.NO_DATA,
  );
  assert.equal(
    fromBackendResponse({ success: false, error_code: 'forbidden' }, request).reason,
    ERROR_CODES.PROVIDER_ERROR,
  );
  for (const body of [null, 'text', {}, { success: 'yes' }]) {
    assert.equal(fromBackendResponse(body, request).reason, ERROR_CODES.INVALID_RESPONSE);
  }
});

test('only provider-confirmed outcomes are cacheable', () => {
  assert.equal(isCacheable({ status: 'success' }), true);
  assert.equal(isCacheable({ status: 'unavailable', reason: ERROR_CODES.NO_DATA }), true);
  for (const reason of [
    ERROR_CODES.NETWORK_ERROR,
    ERROR_CODES.RATE_LIMITED,
    ERROR_CODES.PROVIDER_ERROR,
  ]) {
    assert.equal(isCacheable({ status: 'unavailable', reason }), false);
  }
});

// --- volume-cache ------------------------------------------------------------

test('cache entries expire after 24 hours', async () => {
  const clock = createClock();
  const storage = createMemoryStorage();
  const cache = createVolumeCache({ storage, now: clock.now });
  await cache.set('k|US', { a: 1 });
  assert.deepEqual((await cache.get('k|US')).value, { a: 1 });

  clock.advance(CACHE_TTL_MS - 1);
  assert.ok(await cache.get('k|US'));
  clock.advance(1);
  assert.equal(await cache.get('k|US'), undefined);
  assert.deepEqual(storage.data, {});
});

test('cache ignores and removes malformed entries', async () => {
  const storage = createMemoryStorage({ 'vol:x|US': 'garbage' });
  const cache = createVolumeCache({ storage });
  assert.equal(await cache.get('x|US'), undefined);
  assert.deepEqual(storage.data, {});
});

test('prune and clear only touch cache entries', async () => {
  const clock = createClock();
  const storage = createMemoryStorage({ unrelated: true });
  const cache = createVolumeCache({ storage, now: clock.now });
  await cache.set('old|US', 1);
  clock.advance(CACHE_TTL_MS);
  await cache.set('new|US', 2);

  assert.equal(await cache.prune(), 1);
  assert.deepEqual(Object.keys(storage.data).sort(), ['unrelated', 'vol:new|US']);
  assert.equal(await cache.clear(), 1);
  assert.deepEqual(Object.keys(storage.data), ['unrelated']);
});

// --- volume-repository ----------------------------------------------------------

function setupRepository(responder) {
  const storage = createMemoryStorage();
  const { api, calls } = createFakeApi(responder);
  const repository = createVolumeRepository({ cache: createVolumeCache({ storage }), api });
  return { repository, calls, storage };
}

test('calls the backend once, then serves from cache', async () => {
  const { repository, calls } = setupRepository(() => json(successBody));
  const first = await repository.getVolume(request);
  const second = await repository.getVolume({ ...request, keyword: 'MOLD Removal' });

  assert.equal(first.searchVolume, 1300);
  assert.equal(second.cached, true);
  assert.equal(second.keyword, 'MOLD Removal');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/api/v1/volume');
  assert.equal(calls[0].url.searchParams.get('keyword'), 'mold removal');
  assert.equal(calls[0].url.searchParams.get('country'), 'US');
  assert.equal(calls[0].url.searchParams.has('refresh'), false);
  assert.equal(calls[0].init.credentials, 'omit');
});

test('different countries are cached separately', async () => {
  const { repository, calls } = setupRepository(() => json(successBody));
  await repository.getVolume(request);
  await repository.getVolume({ ...request, country: 'GB' });
  assert.equal(calls.length, 2);
});

test('refresh bypasses the local cache and asks the backend to refresh', async () => {
  const { repository, calls } = setupRepository(() => json(successBody));
  await repository.getVolume(request);
  const refreshed = await repository.getVolume({ ...request, refresh: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.searchParams.get('refresh'), '1');
  assert.equal(refreshed.cached, false);
});

test('de-duplicates concurrent requests', async () => {
  const { repository, calls } = setupRepository(() => json(successBody));
  await Promise.all([repository.getVolume(request), repository.getVolume(request)]);
  assert.equal(calls.length, 1);
});

test('network failures are reported and not cached', async () => {
  const { repository, calls } = setupRepository((n) => {
    if (n === 1) throw new TypeError('Failed to fetch');
    return json(successBody);
  });
  const failed = await repository.getVolume(request);
  assert.deepEqual(failed, {
    status: 'unavailable',
    keyword: 'mold removal',
    country: 'US',
    reason: ERROR_CODES.NETWORK_ERROR,
  });
  const retried = await repository.getVolume(request);
  assert.equal(retried.status, 'success');
  assert.equal(calls.length, 2);
});

test('non-JSON and rate-limit responses are reported, not cached', async () => {
  const { repository, storage } = setupRepository((n) =>
    n === 1
      ? new Response('<html>502</html>', { status: 502 })
      : json({ success: false, error_code: 'rate_limited' }, 429),
  );
  assert.equal((await repository.getVolume(request)).reason, ERROR_CODES.INVALID_RESPONSE);
  assert.equal((await repository.getVolume(request)).reason, ERROR_CODES.RATE_LIMITED);
  assert.deepEqual(storage.data, {});
});

test('no-data results are cached to avoid repeated paid lookups', async () => {
  const { repository, calls } = setupRepository(() =>
    json({ success: false, search_volume: null, error_code: 'no_data' }),
  );
  await repository.getVolume(request);
  const again = await repository.getVolume(request);
  assert.equal(again.reason, ERROR_CODES.NO_DATA);
  assert.equal(again.cached, true);
  assert.equal(calls.length, 1);
});
