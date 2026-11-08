# Security

## Credentials

- DataForSEO credentials exist only in the backend environment (`backend/.env`, which is
  gitignored). The extension contains no secrets. [extension/shared/config.js](../extension/shared/config.js)
  holds only the backend URL.
- The backend refuses to start without credentials. Error details from the provider, which may
  include account information, are written to server logs only. Clients get generic messages.
- Logs never contain credentials. Search keywords are not logged at `info` level.

## Backend access control

- **Origin allow-list.** `/api/v1/*` accepts only requests whose `Origin` is
  `chrome-extension://<id>` for an ID in `ALLOWED_EXTENSION_IDS`. This is required in production.
  CORS headers are sent only to allowed origins. In development with no IDs set, any well-formed
  extension origin is accepted, so unpacked builds work.
- **Honest limitation.** A Chrome extension cannot hold a real secret. Anything shipped in it can
  be extracted, and a non-browser client can forge the `Origin` header. The origin check stops
  casual browser-based misuse. **Rate limits are the real backstop:**
  - per client IP: `RATE_LIMIT_PER_MINUTE` (default 30)
  - Google Ads Live: a strict 12 requests per rolling minute
  - refresh re-queries the provider only for entries older than 1 hour
  - set a **cost limit** in the DataForSEO dashboard as a final safeguard (status 40203 maps to
    `rate_limited`)
- If abuse becomes a problem, add user accounts or signed tokens. That is outside the MVP scope
  (PRD §10).
- Behind a reverse proxy, set `TRUST_PROXY_HOPS` so per-IP limits use the real client IP.

## Transport

- Production must run behind HTTPS. HSTS is sent when `NODE_ENV=production`. The DataForSEO base
  URL must be `https://`, and config validation enforces it.
- Before publishing, change `BACKEND_BASE_URL` in the extension to the HTTPS URL.

## Input validation

- Keywords are validated in the extension and again on the backend. Checks: string type, length
  at most 80 code points, at most 10 words, no control characters or emoji, no search operators.
  The country is checked against an allow-list using `Object.hasOwn`, which blocks
  prototype-key tricks.
- The query parser is `simple`. Duplicated parameters produce arrays, which are rejected.
- Backend responses are validated in the extension (`volume-result.js`). Non-integer or negative
  volumes and bad dates are treated as invalid responses and never displayed.

## Extension hardening

- Permissions: only `storage`, plus host access to Google Search pages. There is no `tabs`,
  `webNavigation` or `<all_urls>` permission. The backend is reached through CORS, not host
  permissions.
- The card lives in a closed Shadow DOM and is built with `document.createElement` and
  `textContent`. ESLint forbids `innerHTML`, `outerHTML` and `insertAdjacentHTML` in extension
  code. Nothing from the network is evaluated.
- Message handlers accept messages only from this extension (`sender.id === chrome.runtime.id`).
- `chrome.storage.session` keeps its default trusted-contexts access level, so content scripts
  cannot read other tabs' state.
- The default MV3 extension-page CSP applies (`script-src 'self'`). There are no remote scripts,
  and fonts are bundled.
- `web_accessible_resources` exposes only module code, card CSS, fonts and one icon, and only to
  Google origins. This lets Google pages detect that the extension is installed. That is
  accepted for MVP.

## HTTP response headers (backend)

`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
`Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Cache-Control: no-store`,
HSTS in production, and no `X-Powered-By`.

## Dependencies

Runtime dependencies are `express` and `express-rate-limit`. All versions are pinned and the
lockfile is committed. `npm audit` reports 0 vulnerabilities. Through `overrides`, ESLint's
transitive `minimatch` is pinned to a patched release (GHSA-g3hv-75wg-m249).
