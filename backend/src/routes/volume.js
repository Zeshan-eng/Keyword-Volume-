/** GET /api/v1/volume?keyword=...&country=US[&refresh=1] */
import { Router } from 'express';
import { ERROR_CODES, HTTP_STATUS_BY_CODE, PUBLIC_MESSAGES, ProviderError } from '../lib/errors.js';
import { validateVolumeQuery } from '../validation/request.js';

export function createVolumeRouter({ volumeService, logger }) {
  const router = Router();

  router.get('/volume', async (req, res, next) => {
    const validation = validateVolumeQuery(req.query);
    if (!validation.ok) {
      return res.status(HTTP_STATUS_BY_CODE[validation.errorCode]).json({
        success: false,
        search_volume: null,
        error_code: validation.errorCode,
        message: PUBLIC_MESSAGES[validation.errorCode],
      });
    }

    const { keyword, country } = validation.value;
    try {
      const body = await volumeService.getVolume(validation.value);
      return res.status(200).json(body);
    } catch (error) {
      if (!(error instanceof ProviderError)) return next(error);

      const level = error.code === ERROR_CODES.PROVIDER_ERROR ? 'error' : 'warn';
      logger[level]('provider_failure', {
        code: error.code,
        provider_status: error.providerStatus,
        detail: error.message,
        country,
      });
      return res.status(HTTP_STATUS_BY_CODE[error.code] ?? 502).json({
        success: false,
        keyword,
        search_volume: null,
        country,
        error_code: error.code,
        message: PUBLIC_MESSAGES[error.code] ?? PUBLIC_MESSAGES[ERROR_CODES.PROVIDER_ERROR],
      });
    }
  });

  return router;
}
