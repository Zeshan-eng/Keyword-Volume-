# DataForSEO integration

Verified against the official documentation on **8 November 2026**. Re-check prices and limits
before launch, because they change.

## Endpoints

|              | Labs Keyword Overview (primary)                                                                       | Google Ads Search Volume Live (fallback)                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Endpoint     | `POST /v3/dataforseo_labs/google/keyword_overview/live`                                               | `POST /v3/keywords_data/google_ads/search_volume/live`                                            |
| Docs         | [keyword_overview/live](https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live/) | [search_volume/live](https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/) |
| Approx. cost | ~$0.01 per request (keywords missing from results are not charged)                                    | ~$0.075–0.09 per request                                                                          |
| Rate limit   | 10,000 calls/min, 30 concurrent                                                                       | **12 requests/min per account**                                                                   |
| Location     | `location_code` + `language_code` required                                                            | Optional (omitted = worldwide)                                                                    |
| Volume field | `tasks[0].result[0].items[].keyword_info.search_volume`                                               | `tasks[0].result[].search_volume`                                                                 |
| Timestamp    | `keyword_info.last_updated_time` (`yyyy-mm-dd hh:mm:ss +00:00`)                                       | none (we use retrieval time)                                                                      |

Shared rules:

- Authentication is HTTP Basic with your API login and password from
  [app.dataforseo.com/api-access](https://app.dataforseo.com/api-access).
- Keywords may have at most 80 characters and 10 words. They are lowercased in responses. Some
  symbols and emoji are rejected.
- "Average monthly search volume" is Google Ads' estimate over the last 12 months, rounded into
  buckets. Similar keywords may be reported with combined volumes.
- DataForSEO requires a minimum top-up of $50. New accounts get a $1 trial credit.

## Country mapping

Defined in [backend/src/countries.js](../backend/src/countries.js):

| Country | `location_code`          | `language_code` |
| ------- | ------------------------ | --------------- |
| US      | 2840                     | en              |
| GB      | 2826                     | en              |
| AE      | 2784                     | en              |
| PK      | 2586                     | en              |
| CA      | 2124                     | en              |
| AU      | 2036                     | en              |
| IN      | 2356                     | en              |
| GLOBAL  | (omitted, Ads Live only) | (omitted)       |

**Verified live on 8 November 2026:** a lookup for "plumber" returned data from Labs for all seven
countries with these codes (US, GB, AE, PK, CA, AU, IN), so the location and language pairs above
work. The full `locations_and_languages` list was not cross-checked. If Labs ever does not
support a location, the provider returns an error (status 40501 maps to `invalid_keyword`).

## Status-code mapping

From [the errors appendix](https://docs.dataforseo.com/v3/appendix/errors/), implemented in
[dataforseo-client.js](../backend/src/providers/dataforseo-client.js):

| DataForSEO status                                       | Our code                              |
| ------------------------------------------------------- | ------------------------------------- |
| 20000                                                   | success                               |
| 40102 (no search results)                               | `no_data`, so the fallback is tried   |
| 40202, 40203, 40205, 40206, 40209                       | `rate_limited`                        |
| 40501 (invalid field)                                   | `invalid_keyword`                     |
| everything else (40100 auth, 40200/40210 funds, 5xxxx…) | `provider_error` (logged server-side) |

## Fallback rules

1. If the location is supported by Labs, query Labs.
2. If Labs returns no item, a `null` volume or 40102, query Google Ads Live. Before the call it
   must get a slot from the local 12-per-minute limiter, otherwise the result is `rate_limited`.
3. If Ads Live also has no data, the result is `no_data`. It is cached and shown as
   "Data unavailable".
4. Any error (auth, billing, rate limit, timeout) stops the chain. Retrying on the same account
   would not help.

## Configuration

All settings are in [backend/.env.example](../backend/.env.example). The required ones are
`DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`, plus `ALLOWED_EXTENSION_IDS` when
`NODE_ENV=production`.

DataForSEO offers a free **sandbox** (`DATAFORSEO_BASE_URL=https://sandbox.dataforseo.com`) that
returns sample data. It is useful for checking connectivity, but its numbers are not real
volumes.

## Live verification checklist

Run on 8 November 2026 against the live API (backend started with real credentials):

- [x] `curl` one keyword ("plumber") per country with an extension `Origin` header. All 8 returned
      `success: true` with plausible volumes (US 673,000; GB 60,500; AE 5,400; PK 12,100; CA 60,500;
      AU 40,500; IN 110,000; GLOBAL 1,220,000).
- [x] Nonsense keyword ("zzqxv blorptang wumbo", US) returned `no_data`, shown as "Data unavailable".
- [x] `GLOBAL` was answered by Google Ads Live ("DataForSEO Google Ads"); the other seven by Labs.
- [x] A repeated US lookup returned `cached: true` with no second provider call.
- [x] The country mapping table is confirmed by the results above.
- [ ] Not yet seen: a real keyword that Labs lacks but Google Ads Live has (fallback on a non-global
      location). Covered by fixture tests only. Also record the raw Labs "not found" shape.
- [ ] Check the per-request `cost` in responses against the estimates above (check the DataForSEO
      dashboard usage page).
- [ ] Load the extension in Chrome on real google.com and google.co.uk, and confirm the card's
      placement and dark-theme rendering. Automated browsers are blocked by Google's CAPTCHA, so
      this needs a manual check.
