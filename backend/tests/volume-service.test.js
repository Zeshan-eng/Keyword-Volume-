import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVolumeService } from '../src/services/volume-service.js';
import { createTtlCache } from '../src/cache/ttl-cache.js';
import { ERROR_CODES, ProviderError } from '../src/lib/errors.js';
import { silentLogger } from '../src/lib/logger.js';
import { createManualClock } from './helpers.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function setup(responses) {
  const clock = createManualClock();
  const queue = [...responses];
  const lookups = [];
  const provider = {
    async lookup(args) {
      lookups.push(args);
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (next instanceof Error) throw next;
      return next;
    },
  };
  const service = createVolumeService({
    provider,
    cache: createTtlCache({ ttlMs: DAY, maxEntries: 100, now: clock.now }),
    refreshMinAgeMs: HOUR,
    now: clock.now,
    logger: silentLogger,
  });
  return { service, clock, lookups };
}

const ok = (searchVolume) => ({
  result: { status: 'ok', searchVolume, lastUpdated: '2026-10-14T06:12:40.000Z' },
  source: 'DataForSEO Labs',
});
const noData = { result: { status: 'no_data' }, source: null };

test('returns the PRD response shape', async () => {
  const { service, lookups } = setup([ok(1300)]);
  const body = await service.getVolume({ keyword: 'Mold Removal', country: 'US', refresh: false });
  assert.deepEqual(body, {
    success: true,
    keyword: 'Mold Removal',
    search_volume: 1300,
    country: 'US',
    data_source: 'DataForSEO Labs',
    last_updated: '2026-10-14T06:12:40.000Z',
    cached: false,
  });
  assert.equal(lookups[0].location.locationCode, 2840);
});

test('serves repeated lookups from cache (case-insensitive) for 24h', async () => {
  const { service, clock, lookups } = setup([ok(1300)]);
  await service.getVolume({ keyword: 'mold removal', country: 'US' });
  const second = await service.getVolume({ keyword: 'MOLD removal', country: 'US' });
  assert.equal(second.cached, true);
  assert.equal(second.keyword, 'MOLD removal');
  assert.equal(lookups.length, 1);

  clock.advance(DAY);
  const expired = await service.getVolume({ keyword: 'mold removal', country: 'US' });
  assert.equal(expired.cached, false);
  assert.equal(lookups.length, 2);
});

test('cache is per country', async () => {
  const { service, lookups } = setup([ok(1300)]);
  await service.getVolume({ keyword: 'roofer', country: 'US' });
  await service.getVolume({ keyword: 'roofer', country: 'GB' });
  assert.equal(lookups.length, 2);
});

test('de-duplicates concurrent identical lookups', async () => {
  const { service, lookups } = setup([ok(10)]);
  const results = await Promise.all([
    service.getVolume({ keyword: 'a', country: 'US' }),
    service.getVolume({ keyword: 'A', country: 'US' }),
    service.getVolume({ keyword: 'a', country: 'US' }),
  ]);
  assert.equal(lookups.length, 1);
  assert.deepEqual(
    results.map((r) => r.search_volume),
    [10, 10, 10],
  );
});

test('refresh only re-queries entries older than the minimum age', async () => {
  const { service, clock, lookups } = setup([ok(100), ok(200)]);
  await service.getVolume({ keyword: 'a', country: 'US' });

  const early = await service.getVolume({ keyword: 'a', country: 'US', refresh: true });
  assert.equal(early.cached, true);
  assert.equal(lookups.length, 1);

  clock.advance(HOUR);
  const late = await service.getVolume({ keyword: 'a', country: 'US', refresh: true });
  assert.equal(late.cached, false);
  assert.equal(late.search_volume, 200);
  assert.equal(lookups.length, 2);
});

test('caches confirmed no-data results honestly', async () => {
  const { service, lookups } = setup([noData]);
  const body = await service.getVolume({ keyword: 'zzqx', country: 'US' });
  assert.deepEqual(body, {
    success: false,
    keyword: 'zzqx',
    search_volume: null,
    country: 'US',
    error_code: ERROR_CODES.NO_DATA,
    message: 'Search volume unavailable',
    cached: false,
  });
  const again = await service.getVolume({ keyword: 'zzqx', country: 'US' });
  assert.equal(again.cached, true);
  assert.equal(lookups.length, 1);
});

test('never caches provider errors', async () => {
  const { service, lookups } = setup([
    new ProviderError(ERROR_CODES.PROVIDER_ERROR, 'boom'),
    ok(5),
  ]);
  await assert.rejects(service.getVolume({ keyword: 'a', country: 'US' }), {
    code: ERROR_CODES.PROVIDER_ERROR,
  });
  const body = await service.getVolume({ keyword: 'a', country: 'US' });
  assert.equal(body.search_volume, 5);
  assert.equal(lookups.length, 2);
});

test('LRU cache evicts the least recently used entry', () => {
  const cache = createTtlCache({ ttlMs: DAY, maxEntries: 2 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a');
  cache.set('c', 3);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a').value, 1);
  assert.equal(cache.size, 2);
});
