/**
 * Validates API query parameters. The extension validates too,
 * but the backend never trusts client input.
 */
import { ERROR_CODES } from '../lib/errors.js';
import { getLocation } from '../countries.js';

const MAX_KEYWORD_LENGTH = 80;
const MAX_KEYWORD_WORDS = 10;
const OPERATOR_PATTERN =
  /(?:^|\s)-?(?:site|inurl|allinurl|intitle|allintitle|intext|allintext|filetype|ext|related|cache|link|info|define|before|after|source|location|inanchor|allinanchor):/i;
const PICTOGRAPHIC_PATTERN = /\p{Extended_Pictographic}/u;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;

export function normalizeKeyword(raw) {
  return raw.normalize('NFC').replace(/["“”]/g, ' ').replace(/\s+/g, ' ').trim();
}

function invalid(errorCode) {
  return { ok: false, errorCode };
}

/**
 * @returns {{ ok: true, value: { keyword: string, country: string, refresh: boolean } }
 *   | { ok: false, errorCode: string }}
 */
export function validateVolumeQuery(query) {
  const { keyword: rawKeyword, country: rawCountry, refresh: rawRefresh } = query ?? {};

  if (typeof rawKeyword !== 'string' || rawKeyword.length > 500) {
    return invalid(ERROR_CODES.INVALID_KEYWORD);
  }
  const keyword = normalizeKeyword(rawKeyword);
  if (
    !keyword ||
    [...keyword].length > MAX_KEYWORD_LENGTH ||
    keyword.split(' ').length > MAX_KEYWORD_WORDS ||
    CONTROL_CHAR_PATTERN.test(keyword) ||
    PICTOGRAPHIC_PATTERN.test(keyword) ||
    OPERATOR_PATTERN.test(keyword)
  ) {
    return invalid(ERROR_CODES.INVALID_KEYWORD);
  }

  if (typeof rawCountry !== 'string' || !getLocation(rawCountry)) {
    return invalid(ERROR_CODES.INVALID_COUNTRY);
  }

  // Only the exact value "1" requests a refresh; anything else is a normal lookup.
  return { ok: true, value: { keyword, country: rawCountry, refresh: rawRefresh === '1' } };
}

export const MAX_DOMAINS_PER_REQUEST = 20;
// Letters (incl. internationalized), digits, dots and hyphens; 253 chars max per hostname.
const HOSTNAME_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N}.-]{0,251}[\p{L}\p{N}])?$/u;

/**
 * GET /api/v1/domains?hosts=a.com,b.co.uk — up to 20 unique hostnames.
 * @returns {{ ok: true, value: { hostnames: string[] } } | { ok: false, errorCode: string }}
 */
export function validateDomainsQuery(query) {
  const raw = query?.hosts;
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 5_000) {
    return invalid(ERROR_CODES.INVALID_REQUEST);
  }
  const hostnames = [
    ...new Set(
      raw
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (
    hostnames.length === 0 ||
    hostnames.length > MAX_DOMAINS_PER_REQUEST ||
    !hostnames.every((h) => HOSTNAME_PATTERN.test(h) && !h.includes('..'))
  ) {
    return invalid(ERROR_CODES.INVALID_REQUEST);
  }
  return { ok: true, value: { hostnames } };
}
