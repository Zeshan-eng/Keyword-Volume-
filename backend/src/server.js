/** Composition root: wires configuration, providers, cache and the HTTP server. */
import { createApp } from './app.js';
import { createTtlCache } from './cache/ttl-cache.js';
import { ConfigError, loadConfig } from './config.js';
import { createLogger } from './lib/logger.js';
import { createSlidingWindowLimiter } from './lib/sliding-window-limiter.js';
import { createGoogleAdsProvider } from './providers/dataforseo-ads.js';
import { createDataForSeoClient } from './providers/dataforseo-client.js';
import { createFallbackProvider } from './providers/fallback-provider.js';
import { createLabsProvider } from './providers/dataforseo-labs.js';
import { createVolumeService } from './services/volume-service.js';

function buildServer(config, logger) {
  const client = createDataForSeoClient({
    ...config.dataForSeo,
    timeoutMs: config.providerTimeoutMs,
  });
  const provider = createFallbackProvider([
    createLabsProvider({ client }),
    createGoogleAdsProvider({
      client,
      limiter: createSlidingWindowLimiter({ limit: config.adsLiveMaxPerMinute, windowMs: 60_000 }),
    }),
  ]);
  const volumeService = createVolumeService({
    provider,
    cache: createTtlCache({ ttlMs: config.cacheTtlMs, maxEntries: config.cacheMaxEntries }),
    refreshMinAgeMs: config.refreshMinAgeMs,
    logger,
  });
  return createApp({ config, volumeService, logger });
}

function main() {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\nSee backend/.env.example.\n`);
      process.exit(1);
    }
    throw error;
  }

  const logger = createLogger({ level: config.logLevel });
  if (config.allowAnyExtensionOrigin) {
    logger.warn('origin_guard_relaxed', {
      detail:
        'ALLOWED_EXTENSION_IDS not set; accepting any chrome-extension:// origin (development only)',
    });
  }

  const server = buildServer(config, logger).listen(config.port, () => {
    logger.info('server_started', { port: config.port, production: config.isProduction });
  });

  const shutdown = (signal) => {
    logger.info('server_stopping', { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
