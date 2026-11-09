/** Express application factory. Dependencies are injected so the app is testable. */
import express from 'express';
import { ERROR_CODES } from './lib/errors.js';
import { clientRateLimit, originGuard, securityHeaders, sendError } from './middleware/security.js';
import { createDomainRouter } from './routes/domains.js';
import { createKeywordRouter } from './routes/keywords.js';

export function createApp({ config, volumeService, relatedService, domainService, logger }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('query parser', 'simple');

  app.use(securityHeaders({ isProduction: config.isProduction }));

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  app.use(
    '/api/v1',
    clientRateLimit({ perMinute: config.rateLimitPerMinute }),
    originGuard({
      allowedOrigins: config.allowedOrigins,
      allowAnyExtensionOrigin: config.allowAnyExtensionOrigin,
    }),
    createKeywordRouter({ volumeService, relatedService, logger }),
    createDomainRouter({ domainService }),
  );

  app.use((_req, res) => sendError(res, 404, ERROR_CODES.NOT_FOUND));

  // Final error handler: log the details, never leak them.
  app.use((error, _req, res, _next) => {
    logger.error('unhandled_error', { name: error?.name, message: error?.message });
    sendError(res, 500, ERROR_CODES.INTERNAL_ERROR);
  });

  return app;
}
