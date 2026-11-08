# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
