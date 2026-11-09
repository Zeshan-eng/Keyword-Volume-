/** Display formatting helpers shared by the SERP card and popup. */
import { QUERY_REJECTION } from './query.js';
import { ERROR_CODES } from './messages.js';

const NUMBER_FORMAT = new Intl.NumberFormat('en-US');
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export const UNAVAILABLE_LABEL = 'Data unavailable';

export function formatVolume(volume) {
  return Number.isInteger(volume) && volume >= 0 ? NUMBER_FORMAT.format(volume) : '—';
}

export function formatDate(isoString) {
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? 'Unknown' : DATE_FORMAT.format(date);
}

const REASON_MESSAGES = {
  [QUERY_REJECTION.EMPTY]: 'Enter a search to see its volume.',
  [QUERY_REJECTION.TOO_LONG]: 'Keywords longer than 80 characters are not supported.',
  [QUERY_REJECTION.TOO_MANY_WORDS]: 'Keywords with more than 10 words are not supported.',
  [QUERY_REJECTION.SEARCH_OPERATOR]:
    'Searches using operators (such as site:) have no search volume.',
  [QUERY_REJECTION.UNSUPPORTED_CHARACTERS]:
    'This search contains characters the data provider does not support.',
  [ERROR_CODES.NO_DATA]: 'The data provider has no search volume for this keyword.',
  [ERROR_CODES.NOT_SUPPORTED]: 'Not available for Global / Worldwide. Choose a country instead.',
  [ERROR_CODES.INVALID_REQUEST]: 'The request could not be processed.',
  [ERROR_CODES.INVALID_KEYWORD]: 'The data provider could not process this keyword.',
  [ERROR_CODES.INVALID_COUNTRY]: 'The selected country is not supported.',
  [ERROR_CODES.RATE_LIMITED]: 'Too many requests right now. Please try again in a minute.',
  [ERROR_CODES.NETWORK_ERROR]: 'Could not reach the server. Check your internet connection.',
  [ERROR_CODES.PROVIDER_ERROR]: 'The data provider returned an error. Please try again later.',
  [ERROR_CODES.INVALID_RESPONSE]: 'Received an invalid response. Please try again later.',
};

export function describeUnavailable(reasonCode) {
  return REASON_MESSAGES[reasonCode] ?? 'Search volume could not be retrieved.';
}
