/**
 * Countries offered in the UI. Provider-specific location/language codes live
 * on the backend; the extension only sends the country code.
 */
export const COUNTRIES = Object.freeze([
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'IN', name: 'India' },
  { code: 'GLOBAL', name: 'Global / Worldwide' },
]);

export const DEFAULT_COUNTRY = 'US';

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

export function isSupportedCountry(code) {
  return BY_CODE.has(code);
}

export function getCountryName(code) {
  return BY_CODE.get(code)?.name ?? code;
}
