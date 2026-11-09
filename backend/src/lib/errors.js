/** Error codes in the public response contract (mirrored by the extension). */
export const ERROR_CODES = Object.freeze({
  NO_DATA: 'no_data',
  NOT_SUPPORTED: 'not_supported',
  INVALID_KEYWORD: 'invalid_keyword',
  INVALID_COUNTRY: 'invalid_country',
  INVALID_REQUEST: 'invalid_request',
  RATE_LIMITED: 'rate_limited',
  PROVIDER_ERROR: 'provider_error',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  INTERNAL_ERROR: 'internal_error',
});

export const HTTP_STATUS_BY_CODE = Object.freeze({
  [ERROR_CODES.NO_DATA]: 200,
  [ERROR_CODES.NOT_SUPPORTED]: 200,
  [ERROR_CODES.INVALID_KEYWORD]: 400,
  [ERROR_CODES.INVALID_COUNTRY]: 400,
  [ERROR_CODES.INVALID_REQUEST]: 400,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.PROVIDER_ERROR]: 502,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
});

export const PUBLIC_MESSAGES = Object.freeze({
  [ERROR_CODES.NO_DATA]: 'Search volume unavailable',
  [ERROR_CODES.NOT_SUPPORTED]: 'Not supported for this country',
  [ERROR_CODES.INVALID_KEYWORD]: 'Keyword is not supported',
  [ERROR_CODES.INVALID_COUNTRY]: 'Country is not supported',
  [ERROR_CODES.INVALID_REQUEST]: 'Invalid request',
  [ERROR_CODES.RATE_LIMITED]: 'Too many requests, please try again later',
  [ERROR_CODES.PROVIDER_ERROR]: 'Provider temporarily unavailable',
  [ERROR_CODES.FORBIDDEN]: 'Origin not allowed',
  [ERROR_CODES.NOT_FOUND]: 'Not found',
  [ERROR_CODES.INTERNAL_ERROR]: 'Internal server error',
});

/**
 * An error raised while talking to a keyword data provider.
 * `detail` is for server logs only and is never sent to clients.
 */
export class ProviderError extends Error {
  constructor(code, detail, { providerStatus } = {}) {
    super(detail);
    this.name = 'ProviderError';
    this.code = code;
    this.providerStatus = providerStatus;
  }
}
