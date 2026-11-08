/**
 * Google Search query extraction and keyword validation.
 * Pure functions — no chrome.* or DOM access — so they can be unit-tested in Node.
 */

// DataForSEO limits: a keyword may contain at most 80 characters and 10 words.
export const MAX_KEYWORD_LENGTH = 80;
export const MAX_KEYWORD_WORDS = 10;

export const QUERY_REJECTION = Object.freeze({
  EMPTY: 'empty',
  TOO_LONG: 'too_long',
  TOO_MANY_WORDS: 'too_many_words',
  SEARCH_OPERATOR: 'search_operator',
  UNSUPPORTED_CHARACTERS: 'unsupported_characters',
});

export const IGNORE_REASON = Object.freeze({
  NOT_A_SEARCH: 'not_a_search',
  UNSUPPORTED_VERTICAL: 'unsupported_vertical',
});

// Google advanced-search operators change the meaning of a query, so there is no
// meaningful "search volume" for them.
const OPERATOR_PATTERN =
  /(?:^|\s)-?(?:site|inurl|allinurl|intitle|allintitle|intext|allintext|filetype|ext|related|cache|link|info|define|before|after|source|location|inanchor|allinanchor):/i;
const PICTOGRAPHIC_PATTERN = /\p{Extended_Pictographic}/u;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;

// `udm` selects Google's result vertical. Missing = "All"; 14 = "Web".
const WEB_RESULT_UDM_VALUES = new Set([null, '', '14']);

/**
 * Trim, Unicode-normalise, drop phrase-match quotes and collapse whitespace.
 * Case is preserved for display; cache keys lowercase separately.
 */
export function normalizeKeyword(raw) {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFC').replace(/["“”]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** @returns {{ valid: true } | { valid: false, reason: string }} */
export function validateKeyword(keyword) {
  if (!keyword) return { valid: false, reason: QUERY_REJECTION.EMPTY };
  if (CONTROL_CHAR_PATTERN.test(keyword) || PICTOGRAPHIC_PATTERN.test(keyword)) {
    return { valid: false, reason: QUERY_REJECTION.UNSUPPORTED_CHARACTERS };
  }
  if (OPERATOR_PATTERN.test(keyword)) {
    return { valid: false, reason: QUERY_REJECTION.SEARCH_OPERATOR };
  }
  if ([...keyword].length > MAX_KEYWORD_LENGTH) {
    return { valid: false, reason: QUERY_REJECTION.TOO_LONG };
  }
  if (keyword.split(' ').length > MAX_KEYWORD_WORDS) {
    return { valid: false, reason: QUERY_REJECTION.TOO_MANY_WORDS };
  }
  return { valid: true };
}

/**
 * Extract the keyword from a Google Search results URL.
 * @returns {{ status: 'ok', keyword: string }
 *   | { status: 'invalid', keyword: string, reason: string }
 *   | { status: 'ignored', reason: string }}
 */
export function extractQueryFromUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return { status: 'ignored', reason: IGNORE_REASON.NOT_A_SEARCH };
  }

  if (!/^www\.google\.[a-z.]+$/i.test(url.hostname) || url.pathname !== '/search') {
    return { status: 'ignored', reason: IGNORE_REASON.NOT_A_SEARCH };
  }
  if (url.searchParams.get('tbm') || !WEB_RESULT_UDM_VALUES.has(url.searchParams.get('udm'))) {
    return { status: 'ignored', reason: IGNORE_REASON.UNSUPPORTED_VERTICAL };
  }

  const keyword = normalizeKeyword(url.searchParams.get('q'));
  if (!keyword) return { status: 'ignored', reason: IGNORE_REASON.NOT_A_SEARCH };

  const validation = validateKeyword(keyword);
  return validation.valid
    ? { status: 'ok', keyword }
    : { status: 'invalid', keyword, reason: validation.reason };
}

/** Stable cache key: search volume is case-insensitive. */
export function buildCacheKey(keyword, countryCode) {
  return `${keyword.toLowerCase()}|${countryCode}`;
}
