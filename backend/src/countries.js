/**
 * Supported countries mapped to DataForSEO location/language codes.
 * Codes from DataForSEO's locations list (Google Ads criteria IDs). `null` location
 * means worldwide, which only the Google Ads endpoint supports.
 */
export const COUNTRY_LOCATIONS = Object.freeze({
  US: { locationCode: 2840, languageCode: 'en' },
  GB: { locationCode: 2826, languageCode: 'en' },
  AE: { locationCode: 2784, languageCode: 'en' },
  PK: { locationCode: 2586, languageCode: 'en' },
  CA: { locationCode: 2124, languageCode: 'en' },
  AU: { locationCode: 2036, languageCode: 'en' },
  IN: { locationCode: 2356, languageCode: 'en' },
  GLOBAL: { locationCode: null, languageCode: null },
});

export function getLocation(countryCode) {
  return Object.hasOwn(COUNTRY_LOCATIONS, countryCode) ? COUNTRY_LOCATIONS[countryCode] : null;
}
