import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, loadConfig } from '../src/config.js';
import { validateVolumeQuery } from '../src/validation/request.js';
import { ERROR_CODES } from '../src/lib/errors.js';

const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop';
const baseEnv = { DATAFORSEO_LOGIN: 'login', DATAFORSEO_PASSWORD: 'password' };

test('config: applies defaults', () => {
  const config = loadConfig(baseEnv);
  assert.equal(config.port, 8787);
  assert.equal(config.cacheTtlMs, 86_400_000);
  assert.equal(config.adsLiveMaxPerMinute, 12);
  assert.equal(config.dataForSeo.baseUrl, 'https://api.dataforseo.com');
  assert.equal(config.allowAnyExtensionOrigin, true);
});

test('config: requires credentials and lists every problem', () => {
  assert.throws(
    () => loadConfig({ PORT: 'abc' }),
    (error) => {
      assert.ok(error instanceof ConfigError);
      assert.equal(error.problems.length, 3);
      return true;
    },
  );
});

test('config: production requires extension IDs and never relaxes the origin guard', () => {
  assert.throws(() => loadConfig({ ...baseEnv, NODE_ENV: 'production' }), ConfigError);
  const config = loadConfig({ ...baseEnv, NODE_ENV: 'production', ALLOWED_EXTENSION_IDS: EXT_ID });
  assert.equal(config.allowAnyExtensionOrigin, false);
  assert.deepEqual(config.allowedOrigins, [`chrome-extension://${EXT_ID}`]);
});

test('config: rejects malformed IDs, insecure base URL and Ads limit above 12', () => {
  assert.throws(() => loadConfig({ ...baseEnv, ALLOWED_EXTENSION_IDS: 'not-an-id' }), ConfigError);
  assert.throws(
    () => loadConfig({ ...baseEnv, DATAFORSEO_BASE_URL: 'http://api.dataforseo.com' }),
    ConfigError,
  );
  assert.throws(() => loadConfig({ ...baseEnv, ADS_LIVE_MAX_PER_MINUTE: '20' }), ConfigError);
});

test('validation: accepts and normalizes a valid request', () => {
  assert.deepEqual(
    validateVolumeQuery({ keyword: '  "mold  removal"  ', country: 'US', refresh: '1' }),
    {
      ok: true,
      value: { keyword: 'mold removal', country: 'US', refresh: true },
    },
  );
  assert.equal(validateVolumeQuery({ keyword: 'a', country: 'GLOBAL' }).value.refresh, false);
});

test('validation: rejects bad keywords', () => {
  for (const keyword of [
    undefined,
    '',
    '   ',
    ['a', 'b'],
    'x'.repeat(81),
    Array(11).fill('w').join(' '),
    'site:example.com',
    'pizza 🍕',
    'a\u0000b',
  ]) {
    assert.deepEqual(
      validateVolumeQuery({ keyword, country: 'US' }),
      { ok: false, errorCode: ERROR_CODES.INVALID_KEYWORD },
      JSON.stringify(keyword),
    );
  }
});

test('validation: rejects unknown or prototype-polluting countries', () => {
  for (const country of [undefined, 'us', 'FR', '__proto__', 'constructor', ['US']]) {
    assert.equal(
      validateVolumeQuery({ keyword: 'a', country }).errorCode,
      ERROR_CODES.INVALID_COUNTRY,
      String(country),
    );
  }
});
