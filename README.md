# Keyword Volume Finder

A Manifest V3 Chrome extension for keyword research directly on Google results pages:

- **Search volume** — estimated monthly searches for your query.
- **Related keywords** — up to 20 suggestions with their volumes, copy and search actions.
- **Domain age** — an `Age: 8y` badge and a slim info bar beside each organic result.

Keyword data comes from [DataForSEO](https://dataforseo.com); domain registration dates come from
public RDAP registry records. Both go through a small Node.js backend that keeps API credentials
off the client. **Domain Rating (DR)** is planned but not implemented: it requires a paid Ahrefs
API plan (see [docs/api-integration.md](docs/api-integration.md#domain-rating-dr--not-implemented)).

> Search volumes are provider estimates (Google Ads data), not exact counts of Google searches.
> Domain age is the time since the domain was first registered, not necessarily the age of the
> website. Missing data is shown as **"Data unavailable"** or **"N/A"**, never as an invented value.

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

1. The content script reads `q` from the Google results URL and finds the organic results.
2. The service worker checks local caches (keyword data 24 hours, registration dates 30 days).
3. On a miss it calls the backend: `/api/v1/volume`, `/api/v1/related` and `/api/v1/domains`.
   The three load and fail independently.
4. Search volume: **DataForSEO Labs** first, **Google Ads Live** as fallback (and for worldwide).
   Related keywords: DataForSEO Labs `related_keywords` (needs a specific country).
   Domain age: the registry's **RDAP** server, found through the IANA bootstrap list.
5. Results appear in the card above the results, as badges beside each result, and in the popup.

See [docs/architecture.md](docs/architecture.md) for details.

## Supported countries

United States, United Kingdom, United Arab Emirates, Pakistan, Canada, Australia, India and
Global/Worldwide. The default is United States. You can change it in the popup or on the
Settings page.

## Status

- Extension and backend are implemented and covered by automated tests (117).
- **Live services verified** (9 November 2026): search volume for all 8 countries, related
  keywords, and RDAP domain age (for example .com, .co.uk and .ca dates returned; .ae, .pk and
  .io registries publish no RDAP data and show N/A).
- The extension was checked end to end in Chromium against the live backend on a page shaped like
  Google's result markup, in light and dark themes. Live google.com blocks automated browsers, so
  placement on the real Google page needs a manual check.
- Open items are listed in
  [docs/api-integration.md](docs/api-integration.md#live-verification-checklist).
