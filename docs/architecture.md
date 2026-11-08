# Architecture

## Components

```
Google SERP tab                        Extension                              Backend (Node/Express)          DataForSEO
┌──────────────────┐  message   ┌───────────────────────┐  HTTPS GET   ┌─────────────────────────┐   POST   ┌──────────────┐
│ content script   │──────────▶│ service worker         │────────────▶│ /api/v1/volume          │────────▶│ Labs (1st)   │
│ (query + card)   │◀──────────│ cache + repository     │◀────────────│ validate → cache →      │◀────────│ Ads Live (2nd)│
└──────────────────┘            │ chrome.storage.local   │              │ fallback provider       │          └──────────────┘
         ▲                      │ chrome.storage.session │              └─────────────────────────┘
         │ refresh              └───────────────────────┘
┌──────────────────┐                     ▲ reads tab state
│ popup / options  │─────────────────────┘ settings in chrome.storage.sync
└──────────────────┘
```

### Extension (`extension/`)

| File                           | Responsibility                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/content.js`           | Classic-script loader. Content scripts cannot be ES modules, so it dynamically imports `content/main.js` (listed in `web_accessible_resources`).                                                                                            |
| `content/main.js`              | Reads the query from `location.href`, asks the service worker for data, follows navigation (Navigation API `navigatesuccess`, `popstate`, bfcache `pageshow`) and setting changes.                                                          |
| `content/serp-card.js`         | The card. It uses a **closed Shadow DOM**, DOM APIs and `textContent` only, and adds no markup to Google's results. It is inserted at the top of `#center_col`, falling back to before `#search` or `#rso`. It detects Google's dark theme. |
| `background/service-worker.js` | The only context that calls the backend. It validates the keyword, resolves the country from settings, uses the repository and writes each tab's latest state to `chrome.storage.session`.                                                  |
| `shared/query.js`              | URL parsing, normalization and validation: operators, emoji, the 80-character and 10-word limits, and non-web verticals.                                                                                                                    |
| `shared/volume-repository.js`  | Cache, then in-flight de-duplication, then backend. It never throws.                                                                                                                                                                        |
| `shared/volume-result.js`      | Validates backend responses against the contract. A malformed volume is never displayed.                                                                                                                                                    |
| `shared/volume-cache.js`       | 24-hour TTL cache over `chrome.storage.local`, keyed `vol:<lowercase keyword>\|<country>`.                                                                                                                                                  |
| `shared/settings.js`           | `country` and `showSerpCard` in `chrome.storage.sync`.                                                                                                                                                                                      |
| `popup/`, `options/`           | UI. Both share `styles/tokens.css` (design tokens) and `styles/components.css`.                                                                                                                                                             |

### Backend (`backend/src/`)

| Path                             | Responsibility                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `config.js`                      | Validates environment variables and fails fast with every problem listed.                              |
| `app.js`                         | Express factory: security headers, `/healthz`, rate limit, origin guard, routes, 404 and 500 handlers. |
| `validation/request.js`          | Independent validation of the keyword and country. The backend never trusts the extension.             |
| `services/volume-service.js`     | Cache (24-hour LRU), in-flight de-duplication, refresh rule, response shaping.                         |
| `providers/provider.js`          | Adapter contract. To add a provider, implement `{ name, supports, lookup }`.                           |
| `providers/dataforseo-*.js`      | HTTP client, Labs adapter and Google Ads Live adapter.                                                 |
| `providers/fallback-provider.js` | Tries providers in order. `no_data` hands over to the next provider; errors propagate.                 |
| `lib/sliding-window-limiter.js`  | Keeps Google Ads Live calls at 12 or fewer in any rolling minute.                                      |

## Key decisions

- **Labs first, Google Ads Live fallback.** Labs costs about $0.01 per request and allows high
  throughput. Ads Live costs about $0.075–0.09 per request and is capped at 12 requests per minute
  per account, but covers keywords that are missing from the Labs database. Worldwide lookups need
  Ads Live, because Labs requires a location.
- **Two cache layers.** The extension cache gives sub-200 ms repeat views and survives reloads and
  pagination. The backend cache shares results across users to reduce provider cost.
- **"No data" is cached; errors are not.** A confirmed absence of data is a stable answer, so
  caching it avoids paying again. Network errors, rate limits and provider errors are retried on
  the next search.
- **Refresh is bounded.** Refresh skips the extension cache. The backend re-queries the provider
  only when its entry is more than 1 hour old (`REFRESH_MIN_AGE_SECONDS`). Labs data changes
  monthly, so this limits cost abuse without hiding fresh data.
- **Validation is duplicated on purpose.** The extension and backend each validate keywords. The
  backend is deployable on its own and must not trust clients.
- **No bundler and no runtime dependencies in the extension.** Shared modules are plain ES
  modules, tested directly with `node:test`.
- **In-memory backend cache.** It is suitable for a single instance. For several instances, swap
  `createTtlCache` for a shared store (Redis) behind the same `get`/`set` interface.

## Response contract

`GET /api/v1/volume?keyword=<kw>&country=<US|GB|AE|PK|CA|AU|IN|GLOBAL>[&refresh=1]`

```json
{
  "success": true,
  "keyword": "mold removal gainesville fl",
  "search_volume": 1300,
  "country": "US",
  "data_source": "DataForSEO Labs",
  "last_updated": "2026-10-14T06:12:40.000Z",
  "cached": false
}
```

Failures use `success: false`, `search_volume: null`, an `error_code` and a `message`:

| `error_code`                          | HTTP | Meaning                                                                |
| ------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `no_data`                             | 200  | Provider has no volume for this keyword and location                   |
| `invalid_keyword` / `invalid_country` | 400  | Rejected by validation, or provider status 40501                       |
| `rate_limited`                        | 429  | Per-IP limit, local Ads Live limit, or a DataForSEO rate or cost limit |
| `provider_error`                      | 502  | Auth, billing, timeout, outage or malformed provider response          |
| `forbidden`                           | 403  | Origin is not an allowed extension                                     |

`last_updated` is the Labs dataset refresh time. For Google Ads Live, which returns no dataset
timestamp, it is the time the data was retrieved.
