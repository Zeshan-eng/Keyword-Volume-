/**
 * Loads and validates configuration from environment variables.
 * Fails fast with every problem listed, so misconfiguration never reaches runtime.
 */
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

export class ConfigError extends Error {
  constructor(problems) {
    super(`Invalid configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

function readInt(env, name, fallback, { min, max }, problems) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    problems.push(`${name} must be an integer between ${min} and ${max}`);
    return fallback;
  }
  return value;
}

export function loadConfig(env = process.env) {
  const problems = [];
  const isProduction = env.NODE_ENV === 'production';

  const login = env.DATAFORSEO_LOGIN?.trim();
  const password = env.DATAFORSEO_PASSWORD?.trim();
  if (!login) problems.push('DATAFORSEO_LOGIN is required');
  if (!password) problems.push('DATAFORSEO_PASSWORD is required');

  const baseUrl = (env.DATAFORSEO_BASE_URL?.trim() || 'https://api.dataforseo.com').replace(
    /\/+$/,
    '',
  );
  if (!/^https:\/\//.test(baseUrl)) problems.push('DATAFORSEO_BASE_URL must use https');

  const extensionIds = (env.ALLOWED_EXTENSION_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const badIds = extensionIds.filter((id) => !EXTENSION_ID_PATTERN.test(id));
  if (badIds.length) problems.push(`ALLOWED_EXTENSION_IDS has invalid IDs: ${badIds.join(', ')}`);
  if (isProduction && extensionIds.length === 0) {
    problems.push('ALLOWED_EXTENSION_IDS is required when NODE_ENV=production');
  }

  const logLevel = env.LOG_LEVEL?.trim() || 'info';
  if (!LOG_LEVELS.has(logLevel)) problems.push('LOG_LEVEL must be debug, info, warn or error');

  const config = {
    isProduction,
    port: readInt(env, 'PORT', 8787, { min: 1, max: 65535 }, problems),
    dataForSeo: { login, password, baseUrl },
    allowedOrigins: extensionIds.map((id) => `chrome-extension://${id}`),
    // Unpacked development builds get a path-dependent ID, so development accepts any
    // extension origin unless IDs are configured explicitly.
    allowAnyExtensionOrigin: !isProduction && extensionIds.length === 0,
    cacheTtlMs:
      readInt(env, 'CACHE_TTL_SECONDS', 86_400, { min: 60, max: 2_592_000 }, problems) * 1000,
    refreshMinAgeMs:
      readInt(env, 'REFRESH_MIN_AGE_SECONDS', 3_600, { min: 0, max: 86_400 }, problems) * 1000,
    cacheMaxEntries: readInt(
      env,
      'CACHE_MAX_ENTRIES',
      10_000,
      { min: 100, max: 1_000_000 },
      problems,
    ),
    rateLimitPerMinute: readInt(
      env,
      'RATE_LIMIT_PER_MINUTE',
      30,
      { min: 1, max: 10_000 },
      problems,
    ),
    adsLiveMaxPerMinute: readInt(env, 'ADS_LIVE_MAX_PER_MINUTE', 12, { min: 1, max: 12 }, problems),
    providerTimeoutMs: readInt(
      env,
      'PROVIDER_TIMEOUT_MS',
      20_000,
      { min: 1_000, max: 60_000 },
      problems,
    ),
    trustProxy: readInt(env, 'TRUST_PROXY_HOPS', 0, { min: 0, max: 10 }, problems),
    logLevel,
  };

  if (problems.length) throw new ConfigError(problems);
  return Object.freeze(config);
}
