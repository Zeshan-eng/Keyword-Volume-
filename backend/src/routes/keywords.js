/**
 * GET /api/v1/volume?keyword=...&country=US[&refresh=1]
 * GET /api/v1/related?keyword=...&country=US[&refresh=1]
 */
import { Router } from 'express';
import { ERROR_CODES, HTTP_STATUS_BY_CODE, PUBLIC_MESSAGES, ProviderError } from '../lib/errors.js';
import { validateVolumeQuery } from '../validation/request.js';

/**
 * Wraps a keyword lookup with validation and provider-error mapping. `emptyFields`
 * are the "no value" fields included in error bodies (e.g. search_volume: null).
 */
function keywordHandler({ lookup, emptyFields, logger, event }) {
  return async (req, res, next) => {
    const validation = validateVolumeQuery(req.query);
    if (!validation.ok) {
      return res.status(HTTP_STATUS_BY_CODE[validation.errorCode]).json({
        success: false,
        ...emptyFields,
        error_code: validation.errorCode,
        message: PUBLIC_MESSAGES[validation.errorCode],
      });
    }

    const { keyword, country } = validation.value;
    try {
      return res.status(200).json(await lookup(validation.value));
    } catch (error) {
      if (!(error instanceof ProviderError)) return next(error);

      const level = error.code === ERROR_CODES.PROVIDER_ERROR ? 'error' : 'warn';
      logger[level](event, {
        code: error.code,
        provider_status: error.providerStatus,
        detail: error.message,
        country,
      });
      return res.status(HTTP_STATUS_BY_CODE[error.code] ?? 502).json({
        success: false,
        keyword,
        ...emptyFields,
        country,
        error_code: error.code,
        message: PUBLIC_MESSAGES[error.code] ?? PUBLIC_MESSAGES[ERROR_CODES.PROVIDER_ERROR],
      });
    }
  };
}

export function createKeywordRouter({ volumeService, relatedService, logger }) {
  const router = Router();

  router.get(
    '/volume',
    keywordHandler({
      lookup: (query) => volumeService.getVolume(query),
      emptyFields: { search_volume: null },
      logger,
      event: 'provider_failure',
    }),
  );

  router.get(
    '/related',
    keywordHandler({
      lookup: (query) => relatedService.getRelated(query),
      emptyFields: { related_keywords: [] },
      logger,
      event: 'related_provider_failure',
    }),
  );

  return router;
}
