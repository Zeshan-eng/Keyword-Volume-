import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { ERROR_CODES, ProviderError } from '../src/lib/errors.js';
import { silentLogger } from '../src/lib/logger.js';

const EXT_ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const OTHER_EXT_ORIGIN = 'chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba';

const responses = new Map();
const calls = [];
const fakeVolumeService = {
  async getVolume(args) {
    calls.push(args);
    const response = responses.get(args.keyword);
    if (response instanceof Error) throw response;
    return response;
  },
};

const fakeRelatedService = {
  async getRelated(args) {
    calls.push(args);
    if (args.keyword === 'related-boom') {
      throw new ProviderError(ERROR_CODES.RATE_LIMITED, 'limit');
    }
    return {
      success: true,
      keyword: args.keyword,
      related_keywords: [{ keyword: 'x', search_volume: 1 }],
    };
  },
};
const domainCalls = [];
const fakeDomainService = {
  async getDomainMetrics(hostnames) {
    domainCalls.push(hostnames);
    return { success: true, domains: hostnames.map((hostname) => ({ hostname })) };
  },
};

let server;
let baseUrl;

before(async () => {
  const config = loadConfig({
    DATAFORSEO_LOGIN: 'l',
    DATAFORSEO_PASSWORD: 'p',
    NODE_ENV: 'production',
    ALLOWED_EXTENSION_IDS: 'abcdefghijklmnopabcdefghijklmnop',
    RATE_LIMIT_PER_MINUTE: '40',
  });
  const app = createApp({
    config,
    volumeService: fakeVolumeService,
    relatedService: fakeRelatedService,
    domainService: fakeDomainService,
    logger: silentLogger,
  });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const get = (path, origin = EXT_ORIGIN) =>
  fetch(`${baseUrl}${path}`, { headers: origin ? { Origin: origin } : {} });

test('health check is public', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('returns volume for an allowed extension origin with CORS + security headers', async () => {
  const body = {
    success: true,
    keyword: 'roofer',
    search_volume: 100,
    country: 'US',
    data_source: 'DataForSEO Labs',
    last_updated: '2026-10-14T06:12:40.000Z',
    cached: false,
  };
  responses.set('roofer', body);
  const res = await get('/api/v1/volume?keyword=roofer&country=US');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), body);
  assert.equal(res.headers.get('access-control-allow-origin'), EXT_ORIGIN);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.ok(res.headers.get('strict-transport-security'));
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('rejects missing and unknown origins', async () => {
  for (const origin of [null, OTHER_EXT_ORIGIN, 'https://evil.example']) {
    const res = await get('/api/v1/volume?keyword=roofer&country=US', origin);
    assert.equal(res.status, 403, String(origin));
    assert.equal((await res.json()).error_code, ERROR_CODES.FORBIDDEN);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  }
});

test('answers CORS preflight for allowed origins', async () => {
  const res = await fetch(`${baseUrl}/api/v1/volume`, {
    method: 'OPTIONS',
    headers: { Origin: EXT_ORIGIN, 'Access-Control-Request-Method': 'GET' },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-methods'), 'GET');
});

test('validates input before calling the service', async () => {
  const before = calls.length;
  const badKeyword = await get('/api/v1/volume?keyword=site%3Aexample.com&country=US');
  assert.equal(badKeyword.status, 400);
  assert.equal((await badKeyword.json()).error_code, ERROR_CODES.INVALID_KEYWORD);

  const badCountry = await get('/api/v1/volume?keyword=roofer&country=FR');
  assert.equal(badCountry.status, 400);
  assert.equal((await badCountry.json()).error_code, ERROR_CODES.INVALID_COUNTRY);

  const duplicated = await get('/api/v1/volume?keyword=a&keyword=b&country=US');
  assert.equal(duplicated.status, 400);
  assert.equal(calls.length, before);
});

test('maps provider errors without leaking details', async () => {
  responses.set(
    'boom',
    new ProviderError(ERROR_CODES.PROVIDER_ERROR, 'DataForSEO 40100: secret detail'),
  );
  const res = await get('/api/v1/volume?keyword=boom&country=US');
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.ok(!text.includes('secret detail'));
  assert.equal(JSON.parse(text).error_code, ERROR_CODES.PROVIDER_ERROR);

  responses.set('limited', new ProviderError(ERROR_CODES.RATE_LIMITED, 'limit'));
  const limited = await get('/api/v1/volume?keyword=limited&country=US');
  assert.equal(limited.status, 429);
});

test('hides unexpected errors behind a generic 500', async () => {
  responses.set('crash', new Error('database password is hunter2'));
  const res = await get('/api/v1/volume?keyword=crash&country=US');
  assert.equal(res.status, 500);
  assert.ok(!(await res.text()).includes('hunter2'));
});

test('related keywords route validates and maps provider errors', async () => {
  const ok = await get('/api/v1/related?keyword=roofer&country=US');
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).related_keywords.length, 1);

  const bad = await get('/api/v1/related?keyword=site%3Ax.com&country=US');
  assert.equal(bad.status, 400);
  assert.deepEqual((await bad.json()).related_keywords, []);

  const limited = await get('/api/v1/related?keyword=related-boom&country=US');
  assert.equal(limited.status, 429);
  const body = await limited.json();
  assert.equal(body.error_code, ERROR_CODES.RATE_LIMITED);
  assert.deepEqual(body.related_keywords, []);
});

test('domains route validates hostnames and requires an allowed origin', async () => {
  const ok = await get('/api/v1/domains?hosts=www.example.com,example.org');
  assert.equal(ok.status, 200);
  assert.deepEqual(domainCalls.at(-1), ['www.example.com', 'example.org']);

  const bad = await get('/api/v1/domains?hosts=http%3A%2F%2Fevil');
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error_code, ERROR_CODES.INVALID_REQUEST);

  const forbidden = await get('/api/v1/domains?hosts=example.com', 'https://evil.example');
  assert.equal(forbidden.status, 403);
});

test('unknown routes return 404 JSON', async () => {
  const res = await get('/nope');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error_code, ERROR_CODES.NOT_FOUND);
});

// Runs last: exhausts the per-IP limit (40/min configured above).
test('rate limits clients per IP', async () => {
  responses.set('roofer', { success: true });
  let limited;
  for (let i = 0; i < 50 && !limited; i++) {
    const res = await get('/api/v1/volume?keyword=roofer&country=US');
    if (res.status === 429) limited = res;
  }
  assert.ok(limited, 'expected a 429');
  assert.equal((await limited.json()).error_code, ERROR_CODES.RATE_LIMITED);
});
