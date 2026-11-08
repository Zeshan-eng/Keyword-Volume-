# Keyword Volume Finder

A Manifest V3 Chrome extension that shows the **estimated monthly search volume** of your Google
search directly on the results page. Volumes come from [DataForSEO](https://dataforseo.com)
through a small Node.js backend that keeps the API credentials off the client.

> Search volumes are provider estimates (Google Ads data), not exact counts of Google searches.
> When the provider has no data, the extension says **"Data unavailable"**. It never shows an
> invented number.

## Repository layout

```
extension/   Chrome extension (no build step, no runtime dependencies)
backend/     Express API that validates requests, calls DataForSEO, caches and normalizes results
docs/        Architecture, API integration and security notes
scripts/     Dev utilities (icon generator)
PRD.md       Product requirements
```

## Requirements

- Node.js 22 or newer (developed on Node 24)
- Google Chrome 116 or newer
- A DataForSEO account with API credentials (minimum top-up $50; see
  [docs/api-integration.md](docs/api-integration.md) for costs)

## Setup

```bash
npm install                      # installs backend + dev tooling (npm workspaces)
cp backend/.env.example backend/.env
# edit backend/.env and set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD
npm start --workspace backend    # http://localhost:8787
```

Load the extension:

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. Search on Google. The volume card appears above the results.

The extension talks to the backend URL in [extension/shared/config.js](extension/shared/config.js)
(default `http://localhost:8787`). For production, set it to your HTTPS backend URL and set
`ALLOWED_EXTENSION_IDS` and `NODE_ENV=production` on the backend.

## Scripts

| Command                          | What it does                                        |
| -------------------------------- | --------------------------------------------------- |
| `npm test`                       | Unit + integration tests (extension and backend)    |
| `npm run lint`                   | ESLint (includes an XSS-sink ban in extension code) |
| `npm run format:check`           | Prettier check                                      |
| `npm run check`                  | All of the above                                    |
| `npm start --workspace backend`  | Start the backend with `backend/.env`               |
| `node scripts/generate-icons.js` | Regenerate extension icons                          |

## How it works

1. The content script reads `q` from the Google results URL and validates it.
2. The service worker checks a 24-hour local cache keyed by keyword and country.
3. On a cache miss it calls `GET /api/v1/volume` on the backend.
4. The backend checks its own cache, then asks **DataForSEO Labs** (cheap and fast). If Labs has
   no data, it falls back to **DataForSEO Google Ads Live**. Worldwide lookups go straight to
   Google Ads, because Labs requires a location.
5. The result is shown in a Shadow-DOM card above the results and in the toolbar popup.

See [docs/architecture.md](docs/architecture.md) for details.

## Supported countries

United States, United Kingdom, United Arab Emirates, Pakistan, Canada, Australia, India and
Global/Worldwide. The default is United States. You can change it in the popup or on the
Settings page.

## Status

- Extension and backend are implemented and covered by automated tests.
- The extension was checked end to end in Chromium against a test-only stub backend on a page
  shaped like Google's results. Live Google blocks automated browsers, so the card's placement
  on the real Google page still needs a manual check.
- **Live DataForSEO verification is pending credentials.** The adapters were built from the
  documented response formats and tested against fixtures. With placeholder credentials, the real
  API's auth error was handled correctly. See
  [docs/api-integration.md](docs/api-integration.md#live-verification-checklist).
