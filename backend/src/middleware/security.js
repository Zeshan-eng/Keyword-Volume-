/** Security-related middleware: response headers, origin allow-list (CORS) and rate limits. */
import { rateLimit } from 'express-rate-limit';
import { ERROR_CODES, PUBLIC_MESSAGES } from '../lib/errors.js';

const EXTENSION_ORIGIN_PATTERN = /^chrome-extension:\/\/[a-p]{32}$/;

export function sendError(res, status, errorCode) {
  res
    .status(status)
    .json({ success: false, error_code: errorCode, message: PUBLIC_MESSAGES[errorCode] });
}

/** JSON-API hardening headers (the API never serves HTML). */
export function securityHeaders({ isProduction }) {
  return (_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Cache-Control': 'no-store',
    });
    if (isProduction) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

/**
 * Only allows requests whose Origin is an allowed Chrome extension, and emits the
 * matching CORS headers. Note: a non-browser client can forge Origin, so this
 * restricts browser-based misuse; rate limits are the backstop.
 */
export function originGuard({ allowedOrigins, allowAnyExtensionOrigin }) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.get('origin');
    const isAllowed =
      typeof origin === 'string' &&
      (allowed.has(origin) || (allowAnyExtensionOrigin && EXTENSION_ORIGIN_PATTERN.test(origin)));

    res.vary('Origin');
    if (!isAllowed) return sendError(res, 403, ERROR_CODES.FORBIDDEN);

    res.set('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.set({ 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' });
      return res.sendStatus(204);
    }
    return next();
  };
}

/** Per-client-IP request limit. */
export function clientRateLimit({ perMinute }) {
  return rateLimit({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, ERROR_CODES.RATE_LIMITED),
  });
}
