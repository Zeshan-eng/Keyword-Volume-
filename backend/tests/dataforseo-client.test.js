import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDataForSeoClient, toProviderError } from '../src/providers/dataforseo-client.js';
import { ERROR_CODES, ProviderError } from '../src/lib/errors.js';
import { createFakeFetch, jsonResponse, loadFixture } from './helpers.js';

const baseOptions = {
  login: 'user@example.com',
  password: 'secret',
  baseUrl: 'https://api.dataforseo.test',
  timeoutMs: 1000,
};

test('sends a single task with Basic auth and JSON body', async () => {
  const { fetchImpl, calls } = createFakeFetch(
    jsonResponse(loadFixture('labs-keyword-overview-ok')),
  );
  const client = createDataForSeoClient({ ...baseOptions, fetchImpl });

  const task = await client.postTask('/v3/x', { keywords: ['a'] });

  assert.equal(task.status_code, 20000);
  assert.equal(calls[0].url, 'https://api.dataforseo.test/v3/x');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(
    calls[0].init.headers.Authorization,
    `Basic ${Buffer.from('user@example.com:secret').toString('base64')}`,
  );
  assert.deepEqual(calls[0].body, [{ keywords: ['a'] }]);
});

test('maps a top-level auth failure to provider_error', async () => {
  const { fetchImpl } = createFakeFetch(jsonResponse(loadFixture('error-unauthorized'), 401));
  const client = createDataForSeoClient({ ...baseOptions, fetchImpl });
  await assert.rejects(client.postTask('/v3/x', {}), (error) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, ERROR_CODES.PROVIDER_ERROR);
    assert.equal(error.providerStatus, 40100);
    return true;
  });
});

test('maps a task-level rate limit to rate_limited', async () => {
  const { fetchImpl } = createFakeFetch(jsonResponse(loadFixture('task-error-rate-limit')));
  const client = createDataForSeoClient({ ...baseOptions, fetchImpl });
  await assert.rejects(client.postTask('/v3/x', {}), { code: ERROR_CODES.RATE_LIMITED });
});

test('rejects non-JSON responses', async () => {
  const { fetchImpl } = createFakeFetch(
    () => new Response('<html>Bad gateway</html>', { status: 502 }),
  );
  const client = createDataForSeoClient({ ...baseOptions, fetchImpl });
  await assert.rejects(client.postTask('/v3/x', {}), { code: ERROR_CODES.PROVIDER_ERROR });
});

test('rejects JSON without a status code or task', async () => {
  for (const body of [{ hello: 'world' }, { status_code: 20000, tasks: [] }, null]) {
    const { fetchImpl } = createFakeFetch(jsonResponse(body));
    const client = createDataForSeoClient({ ...baseOptions, fetchImpl });
    await assert.rejects(client.postTask('/v3/x', {}), { code: ERROR_CODES.PROVIDER_ERROR });
  }
});

test('maps network failures and timeouts to provider_error', async () => {
  const network = createDataForSeoClient({
    ...baseOptions,
    fetchImpl: async () => {
      throw new TypeError('fetch failed');
    },
  });
  await assert.rejects(network.postTask('/v3/x', {}), {
    code: ERROR_CODES.PROVIDER_ERROR,
    message: 'DataForSEO request network failure',
  });

  const slow = createDataForSeoClient({
    ...baseOptions,
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason));
      }),
  });
  await assert.rejects(slow.postTask('/v3/x', {}), {
    code: ERROR_CODES.PROVIDER_ERROR,
    message: 'DataForSEO request timed out',
  });
});

test('status code mapping', () => {
  assert.equal(toProviderError(40102).code, ERROR_CODES.NO_DATA);
  for (const code of [40202, 40203, 40205, 40206, 40209]) {
    assert.equal(toProviderError(code).code, ERROR_CODES.RATE_LIMITED, String(code));
  }
  assert.equal(toProviderError(40501).code, ERROR_CODES.INVALID_KEYWORD);
  for (const code of [40100, 40200, 40210, 50000, 50301, 12345]) {
    assert.equal(toProviderError(code).code, ERROR_CODES.PROVIDER_ERROR, String(code));
  }
});

test('error details never include credentials', async () => {
  const { fetchImpl } = createFakeFetch(jsonResponse(loadFixture('error-unauthorized'), 401));
  const client = createDataForSeoClient({ ...baseOptions, fetchImpl });
  await assert.rejects(client.postTask('/v3/x', {}), (error) => {
    assert.ok(!error.message.includes('secret'));
    assert.ok(!error.message.includes(Buffer.from('user@example.com:secret').toString('base64')));
    return true;
  });
});
