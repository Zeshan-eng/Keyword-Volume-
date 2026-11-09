/** GET /api/v1/domains?hosts=example.com,www.example.co.uk */
import { Router } from 'express';
import { HTTP_STATUS_BY_CODE, PUBLIC_MESSAGES } from '../lib/errors.js';
import { validateDomainsQuery } from '../validation/request.js';

export function createDomainRouter({ domainService }) {
  const router = Router();

  router.get('/domains', async (req, res, next) => {
    const validation = validateDomainsQuery(req.query);
    if (!validation.ok) {
      return res.status(HTTP_STATUS_BY_CODE[validation.errorCode]).json({
        success: false,
        domains: [],
        error_code: validation.errorCode,
        message: PUBLIC_MESSAGES[validation.errorCode],
      });
    }
    try {
      return res.status(200).json(await domainService.getDomainMetrics(validation.value.hostnames));
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
