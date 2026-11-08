import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCacheKey,
  extractQueryFromUrl,
  normalizeKeyword,
  validateKeyword,
  QUERY_REJECTION,
  IGNORE_REASON,
} from '../shared/query.js';

const search = (params, host = 'www.google.com') =>
  `https://${host}/search?${new URLSearchParams(params).toString()}`;

test('extracts a single-word keyword', () => {
  assert.deepEqual(extractQueryFromUrl(search({ q: 'plumber' })), {
    status: 'ok',
    keyword: 'plumber',
  });
});

test('extracts a long-tail keyword and preserves case', () => {
  const result = extractQueryFromUrl(search({ q: 'mold removal Gainesville FL', oq: 'mold' }));
  assert.deepEqual(result, { status: 'ok', keyword: 'mold removal Gainesville FL' });
});

test('decodes plus signs and percent-encoding', () => {
  const result = extractQueryFromUrl('https://www.google.com/search?q=caf%C3%A9+near+me&hl=en');
  assert.deepEqual(result, { status: 'ok', keyword: 'café near me' });
});

test('keeps special characters such as & + and apostrophes', () => {
  const result = extractQueryFromUrl(search({ q: "c++ & rust devs' salary" }));
  assert.deepEqual(result, { status: 'ok', keyword: "c++ & rust devs' salary" });
});

test('supports Google ccTLDs', () => {
  for (const host of ['www.google.co.uk', 'www.google.com.pk', 'www.google.com.au']) {
    assert.equal(extractQueryFromUrl(search({ q: 'roofer' }, host)).status, 'ok');
  }
});

test('treats pagination of the same query as the same keyword', () => {
  const page1 = extractQueryFromUrl(search({ q: 'roofer' }));
  const page2 = extractQueryFromUrl(search({ q: 'roofer', start: '10' }));
  assert.deepEqual(page1, page2);
});

test('accepts the explicit Web results vertical (udm=14)', () => {
  assert.equal(extractQueryFromUrl(search({ q: 'roofer', udm: '14' })).status, 'ok');
});

test('ignores images, news and other verticals', () => {
  for (const params of [
    { q: 'roofer', tbm: 'isch' },
    { q: 'roofer', tbm: 'nws' },
    { q: 'roofer', udm: '2' },
  ]) {
    assert.deepEqual(extractQueryFromUrl(search(params)), {
      status: 'ignored',
      reason: IGNORE_REASON.UNSUPPORTED_VERTICAL,
    });
  }
});

test('ignores non-search pages, empty queries and malformed URLs', () => {
  assert.equal(extractQueryFromUrl('https://www.google.com/').status, 'ignored');
  assert.equal(extractQueryFromUrl('https://www.google.com/maps?q=x').status, 'ignored');
  assert.equal(extractQueryFromUrl(search({ q: '   ' })).status, 'ignored');
  assert.equal(extractQueryFromUrl('https://evil.example/search?q=x').status, 'ignored');
  assert.equal(extractQueryFromUrl('not a url').status, 'ignored');
});

test('rejects search operators', () => {
  for (const q of ['site:example.com roofer', 'roofer -inurl:blog', 'intitle:best roofer']) {
    const result = extractQueryFromUrl(search({ q }));
    assert.equal(result.status, 'invalid', q);
    assert.equal(result.reason, QUERY_REJECTION.SEARCH_OPERATOR);
  }
});

test('does not mistake colons in normal text for operators', () => {
  assert.equal(extractQueryFromUrl(search({ q: 'ratio 16:9 monitor' })).status, 'ok');
});

test('normalizes quotes and whitespace', () => {
  assert.equal(normalizeKeyword('  "best   pizza"  nyc '), 'best pizza nyc');
  assert.equal(normalizeKeyword('“smart quotes”'), 'smart quotes');
  assert.equal(normalizeKeyword(undefined), '');
});

test('enforces provider length and word limits', () => {
  assert.deepEqual(validateKeyword('a'.repeat(80)), { valid: true });
  assert.equal(validateKeyword('a'.repeat(81)).reason, QUERY_REJECTION.TOO_LONG);
  assert.deepEqual(validateKeyword(Array(10).fill('w').join(' ')), { valid: true });
  assert.equal(
    validateKeyword(Array(11).fill('w').join(' ')).reason,
    QUERY_REJECTION.TOO_MANY_WORDS,
  );
});

test('counts characters by code point for non-Latin scripts', () => {
  assert.deepEqual(validateKeyword('مطعم'.repeat(20)), { valid: true });
});

test('rejects emoji and control characters', () => {
  assert.equal(validateKeyword('pizza 🍕').reason, QUERY_REJECTION.UNSUPPORTED_CHARACTERS);
  assert.equal(validateKeyword('a\u0007b').reason, QUERY_REJECTION.UNSUPPORTED_CHARACTERS);
  assert.equal(validateKeyword('').reason, QUERY_REJECTION.EMPTY);
});

test('cache key is case-insensitive and country-specific', () => {
  assert.equal(buildCacheKey('Mold Removal', 'US'), buildCacheKey('mold removal', 'US'));
  assert.notEqual(buildCacheKey('mold removal', 'US'), buildCacheKey('mold removal', 'GB'));
});
