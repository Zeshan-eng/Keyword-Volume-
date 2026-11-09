# Architecture

## Components

```
Google SERP tab                    Extension                          Backend (Node/Express)            Providers
┌────────────────────┐ message ┌──────────────────────┐ HTTPS GET ┌────────────────────────────┐
│ content script     │───────▶│ service worker        │─────────▶│ /api/v1/volume             │──▶ DataForSEO Labs → Ads Live
│ - keyword card     │◀───────│ repositories + caches │◀─────────│ /api/v1/related            │──▶ DataForSEO Labs related_keywords
│ - result badges    │         │ chrome.storage.local  │          │ /api/v1/domains            │──▶ RDAP (IANA bootstrap → registry)
└────────────────────┘         │ chrome.storage.session│          │ validate → cache → adapter │
         ▲ refresh             └──────────────────────┘          └────────────────────────────┘
┌────────────────────┐                  ▲ reads tab state
│ popup / options    │──────────────────┘ settings in chrome.storage.sync
└────────────────────┘
```

Each of the three data types is requested separately and can fail on its own; the UI shows
whatever is available and labels the rest as unavailable.

### Extension (`extension/`)

| File                                                                                     | Responsibility                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/content.js`                                                                     | Classic-script loader. Content scripts cannot be ES modules, so it dynamically imports `content/main.js` (listed in `web_accessible_resources`).                                                                                          |
| `content/main.js`                                                                        | Orchestration: reads the query, requests volume, related keywords and domain ages independently, follows navigation (Navigation API, `popstate`, bfcache `pageshow`) and setting changes.                                                 |
| `content/serp-card.js`, `content/related-panel.js`                                       | The keyword card (closed Shadow DOM, DOM APIs and `textContent` only) with an expandable related-keywords list, copy and search actions. Inserted at the top of `#center_col`.                                                            |
| `content/serp-results.js`                                                                | Finds organic results (`#rso a h3`, skipping ads, People-also-ask, carousels and Google-owned links), then adds an age badge inside the site-name element and a toolbar after the title block. Each widget is its own closed-shadow host. |
| `content/dom.js`                                                                         | DOM helpers: element/icon builders, tooltips, theme detection, stylesheet loading.                                                                                                                                                        |
| `background/service-worker.js`                                                           | The only context that calls the backend. Routes messages to the repositories and writes each tab's latest volume / related state to `chrome.storage.session` for the popup.                                                               |
| `shared/query.js`, `shared/result-url.js`                                                | Pure URL parsing and validation (query, result destination hostnames, ICANN lookup links).                                                                                                                                                |
| `shared/*-repository.js`                                                                 | Volume, related keywords and domain ages: local cache → in-flight de-duplication → backend. Never throw.                                                                                                                                  |
| `shared/volume-result.js`, `shared/related-repository.js`, `shared/domain-repository.js` | Validate backend responses. Malformed values are never displayed.                                                                                                                                                                         |
| `shared/storage-cache.js`                                                                | Prefixed TTL caches over `chrome.storage.local`: `vol:` and `rel:` (24 h), `age:` (30 days for confirmed dates, 1 day for unavailable).                                                                                                   |
| `shared/domain-age.js`                                                                   | Age maths and labels. Age is computed at display time from the stored registration date.                                                                                                                                                  |
| `shared/settings.js`                                                                     | `country`, `showSerpCard`, `showDomainAge` in `chrome.storage.sync`.                                                                                                                                                                      |

### Backend (`backend/src/`)

| Path                             | Responsibility                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `config.js`                      | Validates environment variables and fails fast with every problem listed.                                       |
| `app.js`                         | Express factory: security headers, `/healthz`, rate limit, origin guard, routes, 404 and 500 handlers.          |
| `validation/request.js`          | Independent validation of keyword, country and hostnames. The backend never trusts the extension.               |
| `cache/cached-loader.js`         | Shared cache → in-flight de-duplication → loader logic with the bounded-refresh rule. Used by every service.    |
| `services/volume-service.js`     | Search volume via the fallback chain.                                                                           |
| `services/related-service.js`    | Related keywords; worldwide reported as `not_supported`.                                                        |
| `services/domain-service.js`     | Registered-domain normalization, per-domain RDAP lookups (4 concurrent), independent failures, age calculation. |
| `domains/registrable-domain.js`  | Hostname → registered domain with the Public Suffix List (`tldts`), IDN → punycode.                             |
| `providers/provider.js`          | Adapter contract (`{ name, supports, lookup }`). Replace or add providers without touching the extension.       |
| `providers/dataforseo-*.js`      | DataForSEO HTTP client and the Labs, Google Ads Live and related-keywords adapters.                             |
| `providers/rdap.js`              | RDAP adapter: IANA bootstrap (HTTPS servers only), `registration` event extraction.                             |
| `providers/fallback-provider.js` | Tries providers in order. `no_data` hands over to the next provider; errors propagate.                          |
| `lib/sliding-window-limiter.js`  | Keeps Google Ads Live calls at 12 or fewer in any rolling minute.                                               |

## Key decisions

- **Labs first, Google Ads Live fallback.** Labs costs about $0.01 per request and allows high
  throughput. Ads Live costs about $0.075–0.09 per request and is capped at 12 requests per minute
  per account, but covers keywords missing from the Labs database. Worldwide needs Ads Live.
- **Related keywords from Labs `related_keywords`, depth 2, top 20 by volume.** About $0.01 per
  uncached search. The seed keyword and duplicates are removed; missing volumes stay `null`.
- **Domain age from RDAP, not WHOIS scraping.** RDAP is the ICANN-mandated, structured successor
  to WHOIS and is free. Servers come only from the IANA bootstrap list over HTTPS, so the backend
  never contacts arbitrary hosts. Ages are for the _registered_ domain (`news.bbc.co.uk` →
  `bbc.co.uk`). Registries without RDAP (for example .ae, .pk, .io, .de) yield "N/A".
- **Domain Rating is not implemented.** It needs a paid Ahrefs API plan; the PRD forbids
  substituting another metric. The domain response and UI leave room to add it as a separate
  adapter and badge.
- **Two cache layers.** Extension caches give sub-200 ms repeat views; backend caches share
  results across users to reduce provider cost.
- **Confirmed "no data" is cached; errors are not.** Unavailable domain ages are retried after a
  day in case the registry starts publishing data.
- **Refresh is bounded.** Refresh skips the extension cache; the backend re-queries the provider
  only when its entry is older than 1 hour (`REFRESH_MIN_AGE_SECONDS`).
- **Google's content is never modified.** Our widgets are separate shadow hosts inserted next to
  Google's elements; the age badge is appended inside the site-name element so it sits inline,
  and clicks on it are stopped so they never open the result.
- **No bundler and no runtime dependencies in the extension.** Shared modules are plain ES
  modules tested with `node:test`.
- **In-memory backend caches.** Fine for one instance; swap `createTtlCache` for Redis behind the
  same interface to scale out.

## Response contracts

`GET /api/v1/volume?keyword=<kw>&country=<US|GB|AE|PK|CA|AU|IN|GLOBAL>[&refresh=1]`

```json
{
  "success": true,
  "keyword": "mold removal",
  "search_volume": 74000,
  "country": "US",
  "data_source": "DataForSEO Labs",
  "last_updated": "2026-10-19T00:00:00.000Z",
  "cached": false
}
```

`GET /api/v1/related?keyword=<kw>&country=<code>[&refresh=1]`

```json
{
  "success": true,
  "keyword": "mold removal",
  "country": "US",
  "related_keywords": [{ "keyword": "mold removal service", "search_volume": 90500 }],
  "data_source": "DataForSEO Labs",
  "last_updated": "2026-10-16T23:31:52.000Z",
  "cached": false
}
```

`GET /api/v1/domains?hosts=moldsolutionsgnv.com,www.bbc.co.uk` (up to 20 hostnames)

```json
{
  "success": true,
  "domains": [
    {
      "hostname": "www.bbc.co.uk",
      "domain": "bbc.co.uk",
      "domain_age": {
        "creation_date": "1994-12-13",
        "age_years": 31,
        "age_months": 10,
        "data_source": "RDAP",
        "status": "available"
      },
      "cached": false
    }
  ]
}
```

`domain_age.status` is `available`, `unavailable` (no RDAP server, unknown domain or no
registration date) or `error` (temporary failure, not cached). Unavailable values are `null`.

Error codes (`success: false`, plus `error_code` and `message`):

| `error_code`                          | HTTP | Meaning                                                                |
| ------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `no_data`                             | 200  | Provider has no data for this keyword and location                     |
| `not_supported`                       | 200  | Related keywords requested for Global / Worldwide                      |
| `invalid_keyword` / `invalid_country` | 400  | Rejected by validation, or provider status 40501                       |
| `invalid_request`                     | 400  | Malformed or too many hostnames                                        |
| `rate_limited`                        | 429  | Per-IP limit, local Ads Live limit, or a DataForSEO rate or cost limit |
| `provider_error`                      | 502  | Auth, billing, timeout, outage or malformed provider response          |
| `forbidden`                           | 403  | Origin is not an allowed extension                                     |
