/**
 * Hostname → registered domain (e.g. "blog.example.co.uk" → "example.co.uk") using the
 * Public Suffix List (ICANN section), so registration data is looked up for the domain
 * a registrant actually owns.
 */
import { domainToASCII } from 'node:url';
import { parse } from 'tldts';

const HOSTNAME_PATTERN = /^[a-z0-9.-]{1,253}$/;

/** @returns {string | null} ASCII (punycode) registered domain, or null if not applicable. */
export function toRegistrableDomain(hostname) {
  if (typeof hostname !== 'string') return null;
  const ascii = domainToASCII(hostname.trim().toLowerCase().replace(/\.$/, ''));
  if (!ascii || !HOSTNAME_PATTERN.test(ascii)) return null;
  const parsed = parse(ascii, { allowPrivateDomains: false });
  if (parsed.isIp || !parsed.isIcann || !parsed.domain) return null;
  return parsed.domain;
}
