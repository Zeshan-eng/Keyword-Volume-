# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added (PRD v2)

- Related keywords: up to 20 suggestions with estimated volumes in an expandable card section,
  with copy and search-on-Google actions; count shown in the popup.
- Domain age: inline `Age: Ny` badge beside each organic result and a slim toolbar (registration
  date, ICANN whois link, source) from public RDAP records.
- Backend endpoints `/api/v1/related` and `/api/v1/domains`; setting to hide domain age;
  beginner tooltips for every metric; `AGENTS.md` with project rules.

### Changed

- Shared cached-loader (backend) and prefixed storage caches (extension).
- Default per-IP rate limit raised to 60/min (each search makes about 3 API calls).

### Not implemented

- Domain Rating (DR): requires a paid Ahrefs API plan; deferred by decision on 9 November 2026.

### Earlier

### Added

- Manifest V3 extension: automatic Google query detection; a Shadow-DOM search-volume card with
  loading, unavailable and dark-theme states; same-document navigation handling.
- Toolbar popup with keyword, volume, data source, last-updated date, country selector and
  refresh.
- Settings page: default country, SERP card on/off, clear cached results.
- 24-hour keyword+country cache in the extension and in the backend, with de-duplication of
  in-flight requests.
- Express backend with validation, an origin allow-list, per-IP rate limiting and security
  headers.
- DataForSEO Labs Keyword Overview as the primary source and Google Ads Search Volume Live as the
  fallback (and the only source for worldwide), behind a provider-adapter interface.
- Design system (tokens, components) with bundled Inter font.
- Unit and integration tests for query handling, caching, response validation, provider
  adapters, configuration and HTTP behaviour.
- Documentation: architecture, API integration, security, release checklist.

### Verified

- Live DataForSEO lookups for all supported countries, "no data" handling and caching.

### Pending

- Manual verification of card placement on live Google Search.
