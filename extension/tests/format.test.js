import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeUnavailable, formatDate, formatVolume } from '../shared/format.js';
import { ERROR_CODES } from '../shared/messages.js';
import { sanitizeSettings, SETTINGS_DEFAULTS } from '../shared/settings.js';
import { getCountryName, isSupportedCountry } from '../shared/countries.js';

test('formats volumes with thousands separators', () => {
  assert.equal(formatVolume(1300), '1,300');
  assert.equal(formatVolume(0), '0');
  assert.equal(formatVolume(2_740_000), '2,740,000');
});

test('never renders a number for missing or invalid volumes', () => {
  for (const value of [null, undefined, -1, 1.5, '1300', NaN]) {
    assert.equal(formatVolume(value), '—');
  }
});

test('formats ISO dates as day month year', () => {
  assert.equal(formatDate('2026-11-08T12:00:00Z'), '8 November 2026');
  assert.equal(formatDate('garbage'), 'Unknown');
});

test('has a human message for every error code', () => {
  for (const code of Object.values(ERROR_CODES)) {
    assert.notEqual(describeUnavailable(code), describeUnavailable('unknown-code'), code);
  }
});

test('sanitizes stored settings', () => {
  assert.deepEqual(sanitizeSettings(undefined), SETTINGS_DEFAULTS);
  assert.deepEqual(sanitizeSettings({ country: 'XX', showSerpCard: 'yes' }), SETTINGS_DEFAULTS);
  assert.deepEqual(sanitizeSettings({ country: 'GB', showSerpCard: false }), {
    country: 'GB',
    showSerpCard: false,
  });
});

test('country helpers', () => {
  assert.equal(isSupportedCountry('GLOBAL'), true);
  assert.equal(isSupportedCountry('FR'), false);
  assert.equal(getCountryName('AE'), 'United Arab Emirates');
});
