/** Message types exchanged between content script, popup and service worker. */
export const MESSAGE_TYPES = Object.freeze({
  GET_VOLUME: 'kvf:get-volume',
  REFRESH_CURRENT: 'kvf:refresh-current',
});

/** Error codes shared with the backend's response contract. */
export const ERROR_CODES = Object.freeze({
  NO_DATA: 'no_data',
  INVALID_KEYWORD: 'invalid_keyword',
  INVALID_COUNTRY: 'invalid_country',
  RATE_LIMITED: 'rate_limited',
  PROVIDER_ERROR: 'provider_error',
  NETWORK_ERROR: 'network_error',
  INVALID_RESPONSE: 'invalid_response',
});

export const TAB_STATE_PREFIX = 'tab:';

export function tabStateKey(tabId) {
  return `${TAB_STATE_PREFIX}${tabId}`;
}
