/**
 * Thin DataForSEO v3 HTTP client: Basic auth, timeout, and mapping of DataForSEO
 * status codes (https://docs.dataforseo.com/v3/appendix/errors/) to our error codes.
 */
import { ERROR_CODES, ProviderError } from '../lib/errors.js';

const STATUS_OK = 20000;
const NO_SEARCH_RESULTS = 40102;
const RATE_LIMIT_CODES = new Set([40202, 40203, 40205, 40206, 40209]);
const INVALID_INPUT_CODES = new Set([40501]);

/** Maps a non-OK DataForSEO status code to a ProviderError. */
export function toProviderError(statusCode, statusMessage) {
  const detail = `DataForSEO ${statusCode}: ${statusMessage ?? 'unknown error'}`;
  if (statusCode === NO_SEARCH_RESULTS) {
    return new ProviderError(ERROR_CODES.NO_DATA, detail, { providerStatus: statusCode });
  }
  if (RATE_LIMIT_CODES.has(statusCode)) {
    return new ProviderError(ERROR_CODES.RATE_LIMITED, detail, { providerStatus: statusCode });
  }
  if (INVALID_INPUT_CODES.has(statusCode)) {
    return new ProviderError(ERROR_CODES.INVALID_KEYWORD, detail, { providerStatus: statusCode });
  }
  // Auth (401xx), funds (402xx), internal (5xxxx) and anything unexpected.
  return new ProviderError(ERROR_CODES.PROVIDER_ERROR, detail, { providerStatus: statusCode });
}

export function createDataForSeoClient({
  login,
  password,
  baseUrl,
  timeoutMs,
  fetchImpl = globalThis.fetch,
}) {
  const authorization = `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;

  /** POSTs a single task and returns the task object from the response. */
  async function postTask(path, task) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify([task]),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const reason = error?.name === 'TimeoutError' ? 'timed out' : 'network failure';
      throw new ProviderError(ERROR_CODES.PROVIDER_ERROR, `DataForSEO request ${reason}`);
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw new ProviderError(
        ERROR_CODES.PROVIDER_ERROR,
        `DataForSEO returned non-JSON (HTTP ${response.status})`,
      );
    }

    if (typeof body?.status_code !== 'number') {
      throw new ProviderError(
        ERROR_CODES.PROVIDER_ERROR,
        `DataForSEO returned an unexpected body (HTTP ${response.status})`,
      );
    }
    if (body.status_code !== STATUS_OK)
      throw toProviderError(body.status_code, body.status_message);

    const taskResult = Array.isArray(body.tasks) ? body.tasks[0] : undefined;
    if (!taskResult || typeof taskResult.status_code !== 'number') {
      throw new ProviderError(ERROR_CODES.PROVIDER_ERROR, 'DataForSEO response has no task');
    }
    if (taskResult.status_code !== STATUS_OK) {
      throw toProviderError(taskResult.status_code, taskResult.status_message);
    }
    return taskResult;
  }

  return { postTask };
}
