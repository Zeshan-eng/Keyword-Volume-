/** Pure URL helpers for Google organic results (unit-tested in Node). */

const GOOGLE_HOST_PATTERN =
  /(^|\.)google\.[a-z.]+$|(^|\.)(googleusercontent|gstatic|youtube)\.com$/i;

/**
 * Returns the destination hostname of a result link, unwrapping Google's
 * "/url?q=…" redirect links. Returns null for non-http(s) and Google-owned links.
 */
export function resultHostname(href, baseUrl = 'https://www.google.com/') {
  let url;
  try {
    url = new URL(href, baseUrl);
  } catch {
    return null;
  }
  if (GOOGLE_HOST_PATTERN.test(url.hostname) && url.pathname === '/url') {
    const target = url.searchParams.get('q') ?? url.searchParams.get('url');
    return target ? resultHostname(target, baseUrl) : null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.hostname || GOOGLE_HOST_PATTERN.test(url.hostname)) return null;
  return url.hostname.toLowerCase();
}

/** ICANN's official RDAP-based lookup page for a domain. */
export function icannLookupUrl(domain) {
  const url = new URL('https://lookup.icann.org/en/lookup');
  url.searchParams.set('name', domain);
  return url.href;
}
