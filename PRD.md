# PRD.md — Keyword Volume Finder

**Product Type:** Google Chrome Extension  
**Version:** 2.0  
**Status:** Product Requirements — Updated  
**Platform:** Google Chrome  
**Primary Purpose:** Display keyword search volumes, related keywords, website age, and Domain Rating (DR) directly on Google Search Engine Results Pages (SERPs).

---

# 1. Product Overview

## 1.1 Product Concept

Keyword Volume Finder is a lightweight Chrome extension designed for SEO professionals, keyword researchers, digital marketers, niche researchers, and website owners.

The extension helps users perform keyword research and quickly evaluate competing websites without repeatedly switching between external SEO tools.

When a user searches on Google, the extension automatically detects the search query and displays useful SEO information directly on the search results page.

The extension will provide four main types of information:

1. **Keyword Search Volume:** Estimated average monthly searches for the searched keyword.
2. **Related Keywords:** Keyword suggestions related to the original search, including their estimated monthly search volumes.
3. **Website Age:** Approximate age of the domains appearing in Google's organic search results.
4. **Domain Rating (DR):** Domain Rating for websites appearing in Google's organic search results, using an authorized SEO data provider.

The product should remain lightweight, easy to understand, reliable, and affordable to operate.

## 1.2 Problem Statement

SEO professionals frequently need several tools to research a keyword and evaluate competing websites.

A typical workflow involves:

- Searching a keyword on Google.
- Opening a keyword research tool.
- Checking monthly search volume.
- Finding related keyword ideas.
- Opening an SEO tool to check Domain Rating.
- Checking the age of competing domains.
- Repeating the process for multiple keywords.

This process is repetitive and time-consuming.

Keyword Volume Finder aims to bring these important SEO metrics together inside Google Search.

## 1.3 Product Goal

Build a reliable Chrome extension that:

1. Automatically detects the keyword searched on Google.
2. Retrieves its estimated monthly search volume.
3. Displays related keywords and their search volumes.
4. Identifies organic ranking websites.
5. Displays the approximate age of each ranking domain.
6. Displays the Domain Rating (DR) of each ranking domain.
7. Allows users to change the target country.
8. Caches previously retrieved information to reduce API costs.
9. Provides a clean and easy-to-use interface.

The product should prioritize accuracy, usability, performance, security, and manageable operating costs.

---

# 2. Target Audience

Primary users:

- SEO professionals.
- Beginner keyword researchers.
- Digital marketing students.
- Niche researchers.
- Rank & Rent website builders.
- Freelance SEO specialists.
- Content creators.
- Website owners.

The interface must be simple enough for someone with no previous SEO experience.

All SEO metrics should have short explanations so beginners understand what they mean.

---

# 3. Core Features — MVP

## 3.1 Automatic Keyword Detection

When a user performs a Google search, the extension must:

- Detect the search query from Google's search URL.
- Extract the actual keyword.
- Identify the selected target country.
- Automatically request keyword information.
- Display the results without requiring the user to open the extension popup.

Example:

Google search:

`mold removal Gainesville FL`

Extension displays:

- Monthly search volume.
- Related keyword suggestions.
- Website age for organic ranking domains.
- Domain Rating for organic ranking domains.

All numerical examples in this PRD are illustrative, not actual keyword or domain data.

## 3.2 Search Volume Display

Display the following information:

| Field | Description |
|---|---|
| Keyword | The searched keyword |
| Search Volume | Estimated average monthly searches |
| Country | Selected target country |
| Data Source | Name of the data provider |
| Last Updated | Date and time of retrieved data |

Search volume must be clearly identified as an estimate, not an exact count of Google searches.

## 3.3 Country Selection

Users should be able to select their target country.

Initial supported options should include:

- United States
- United Kingdom
- United Arab Emirates
- Pakistan
- Canada
- Australia
- India
- Global / Worldwide, if supported by the selected provider

Default country: United States.

The selected country should be saved and used for subsequent keyword searches and related keyword requests.

The extension must use the appropriate country code and language settings supported by the selected API.

Domain Age and DR are domain-level metrics and should not be presented as country-specific metrics unless the provider explicitly defines them that way.

## 3.4 Related Keywords

The extension must display keyword suggestions related to the user's original Google search.

Example:

Original search:

`mold removal Gainesville FL`

Possible related keyword results:

| Related Keyword | Monthly Search Volume |
|---|---:|
| mold remediation Gainesville | 450 |
| mold inspection Gainesville FL | 320 |
| mold removal near me | 2,400 |
| black mold removal Gainesville | 170 |
| mold removal cost Florida | 590 |

The values above are fictional examples used only to demonstrate the layout.

Requirements:

- Retrieve related keyword suggestions through a supported keyword data API.
- Display estimated monthly search volume for each suggestion.
- Use the currently selected target country.
- Show a reasonable number of suggestions, initially targeting 10–20.
- Allow users to view more suggestions when the provider supports pagination or additional results.
- Avoid showing duplicate keywords.
- Avoid returning the original search keyword as a related suggestion.
- Display unavailable volume as "Data unavailable".
- Clearly identify search volumes as estimates.
- Allow users to copy a keyword.
- Provide a simple way to search a related keyword on Google.

The system should distinguish between related keywords, keyword variations, and search suggestions if the provider supplies those categories.

Do not invent related keywords or search volumes.

## 3.5 Organic Search Result Analysis

The extension must identify organic Google search results and enrich them with SEO information.

For each supported organic result, display:

- Website/domain name.
- Website age.
- Domain Rating (DR).

Example:

| Ranking Website | Domain Age | DR |
|---|---:|---:|
| example.com | 12 years | 38 |
| example2.com | 5 years | 21 |
| example3.com | 2 years | 14 |

These values are illustrative only.

Requirements:

- Identify organic results from the Google Search page.
- Extract the destination URL.
- Normalize URLs into their registered domains.
- Avoid processing the same domain repeatedly.
- Exclude Google advertisements and non-organic result elements.
- Handle subdomains and international domains correctly.
- Display unavailable metrics honestly.
- Never invent or estimate DR or website age.

The extension should initially support the first 10 organic results when available.

If Google loads additional results through pagination or scrolling, the extension may process them when needed, without generating excessive API requests.

## 3.6 Website Age

Display the approximate registration age of each ranking domain.

Website age should be calculated using the domain's original registration or creation date obtained from a suitable domain registration data source, such as RDAP.

Example:

- Domain registration date: 15 March 2018.
- Current date: 9 November 2026.
- Displayed age: Approximately 8 years.

Requirements:

- Use an appropriate RDAP or authorized domain registration data source.
- Retrieve the domain creation date where available.
- Calculate the age using the current date.
- Display age in years and months where practical.
- Clearly label it as "Domain Age" or "Registration Age".
- Store the original registration date where available.
- Handle unavailable, private, restricted, or unsupported registration information.
- Handle internationalized domain names and different domain extensions.
- Avoid confusing a website's launch date with its domain registration date.

Important limitations:

Domain registration age does not necessarily represent the age of the actual website or business.

A domain may have existed before its current website was created. It may also have expired, been transferred, or been registered again.

RDAP data availability and accuracy may differ between domain registries.

If the original creation date cannot be verified, display:

`Age unavailable`

Never invent a domain registration date.

## 3.7 Domain Rating (DR)

Display the Domain Rating of each organic ranking domain.

Domain Rating is a proprietary SEO metric created by Ahrefs. It is generally scored from 0 to 100 and is used to estimate the strength of a website's backlink profile.

Requirements:

- Retrieve DR through an authorized Ahrefs API or another provider that explicitly offers an equivalent metric.
- Prefer official Ahrefs data when actual Ahrefs DR is required.
- Do not calculate or manufacture an Ahrefs DR value.
- Do not use Domain Authority (DA) as a replacement for DR.
- Do not present a third-party metric as Ahrefs DR.
- Identify the data provider.
- Display the last updated date where available.
- Handle domains for which no DR value is available.
- Cache DR results to reduce API usage.
- Avoid repeatedly requesting DR for the same domain.

If Ahrefs API access is unavailable or too expensive, evaluate alternative authorized providers.

Any alternative metric must be clearly named according to its actual provider and definition.

Example:

`DR: 38`

If unavailable:

`DR: Unavailable`

The extension must never fabricate DR values.

## 3.8 Extension Popup

When users click the Chrome extension icon, they should see:

- Extension name and logo.
- Current selected country.
- Current Google search keyword, when available.
- Current keyword search volume.
- Number of related keyword suggestions available.
- A refresh button.
- A settings option.

The popup should also display a helpful message when the user is not currently on Google Search.

## 3.9 Loading and Error States

The extension must handle:

- Loading keyword data.
- Loading related keywords.
- Loading domain age.
- Loading DR.
- No search volume available.
- Domain registration information unavailable.
- DR unavailable.
- API errors.
- Internet connection problems.
- API usage limits.
- Invalid responses.
- Provider outages.

Each metric should fail independently.

For example, if DR is unavailable but domain age is available, the extension must still display domain age.

Never allow one failed data source to prevent other working metrics from appearing.

Use clear messages such as:

- Loading...
- Data unavailable.
- Provider temporarily unavailable.
- No data found.

## 3.10 Caching

Caching is essential to reduce operating costs.

Implement caching for:

**Keyword data**
- Cache key: keyword + country.
- Initial cache duration: 24 hours.

**Related keywords**
- Cache key: keyword + country + provider.
- Initial cache duration: 24 hours.

**Domain age**
- Cache key: normalized domain + data source.
- Initial cache duration: 30 days.

**Domain Rating**
- Cache key: normalized domain + provider.
- Initial cache duration: 7 days.

These are initial configurable defaults. Actual cache durations should be adjustable based on provider update frequency, pricing, and data freshness.

Additional requirements:

- Avoid duplicate requests for the same data.
- Use server-side caching where appropriate.
- Use local caching for previously retrieved results where practical.
- Allow manual refresh when appropriate.
- Do not let users trigger unlimited expensive API requests.
- Clearly distinguish cached data from newly retrieved data.

---

# 4. User Interface Requirements

## 4.1 Design Direction

The design should be:

- Minimalist.
- Modern.
- Lightweight.
- Professional.
- Easy to understand.
- Visually consistent.

Avoid unnecessary animations, excessive colours, and complicated dashboards.

Use a clean white interface with subtle grey borders and one primary accent colour.

Primary font: Inter.

## 4.2 Google SERP Integration

The extension should display SEO information in a compact interface near the top of Google's search results.

The interface should have two main sections.

### Section A — Keyword Overview

Display:

- Searched keyword.
- Estimated monthly search volume.
- Selected country.
- Data source.
- Last updated date.

### Section B — Related Keywords

Display a compact list or expandable section containing:

- Related keyword.
- Estimated monthly search volume.
- Copy keyword action.
- Search keyword action.

### Section C — Organic Competitor Metrics

Display information alongside or beneath each organic result.

Example:

**example.com**

Domain Age: 12 years

DR: 38

**example2.com**

Domain Age: 5 years

DR: 21

The actual Google result title, description, and URL must remain unchanged.

The extension should not obstruct normal search result interaction.

## 4.3 Chrome Popup Design

The popup should be approximately 350–400px wide.

Include:

1. Extension logo and name.
2. Current keyword.
3. Search volume.
4. Country selector.
5. Related keyword count.
6. Refresh button.
7. Settings link.
8. Small data-source attribution.

The popup must remain simple and easy to navigate.

## 4.4 Beginner-Friendly Metric Explanations

Provide short explanations for important metrics.

Examples:

- **Search Volume:** Estimated number of searches per month.
- **Related Keywords:** Other search terms connected to your keyword.
- **Domain Age:** Approximate time since the domain was first registered.
- **DR:** Ahrefs metric that estimates the strength of a website's backlink profile.

Explanations should be available through tooltips or small information icons.

---

# 5. Technical Architecture

Use a modular architecture that allows new data providers and features to be added without rewriting the entire extension.

## 5.1 Chrome Extension

Technology:

- Chrome Extension Manifest V3.
- JavaScript or TypeScript.
- HTML.
- CSS.

Use TypeScript if it provides a clear maintainability and type-safety benefit without unnecessary complexity.

Required components:

### Content Script

Responsibilities:

- Detect Google Search pages.
- Extract the search query.
- Identify organic search result URLs.
- Insert the keyword information interface.
- Display domain age and DR alongside supported organic results.
- Display related keywords.
- Update the interface when Google search navigation changes.
- Avoid interfering with Google's original content.

### Background Service Worker

Responsibilities:

- Handle extension background operations.
- Manage communication between extension components.
- Coordinate API requests through the backend.
- Coordinate caching where appropriate.
- Handle messaging.
- Avoid unnecessary background activity.

### Popup

Responsibilities:

- Display keyword information.
- Show current keyword.
- Show selected country.
- Display search volume.
- Provide refresh functionality.
- Provide access to settings.

### Options / Settings

Responsibilities:

- Manage user preferences.
- Select default country.
- Configure basic extension settings.
- Provide data-source and privacy information where relevant.

## 5.2 Backend

Use a lightweight backend.

Recommended option: Node.js with Express or a suitable serverless backend.

The backend is responsible for:

- Receiving keyword and domain parameters.
- Communicating with SEO data providers.
- Retrieving search volumes.
- Retrieving related keywords.
- Retrieving DR.
- Retrieving domain registration dates.
- Normalizing provider responses.
- Protecting API credentials.
- Validating incoming requests.
- Applying rate limits.
- Caching results.
- Returning consistent JSON responses.

Never expose private API keys inside extension JavaScript files.

## 5.3 Provider Adapter Architecture

Use separate provider adapters for different data sources.

Suggested structure:

- `KeywordProvider`
- `RelatedKeywordProvider`
- `DomainRatingProvider`
- `DomainRegistrationProvider`

Potential providers:

**Keyword search volume and related keywords**
- DataForSEO or another suitable keyword data provider.

**Domain Rating**
- Ahrefs API for actual Ahrefs DR, subject to available API access and pricing.
- Other authorized providers only when their metrics are clearly identified.

**Domain registration age**
- RDAP-compatible services or official registry-supported sources.

The architecture must allow providers to be replaced without rebuilding the entire extension.

Do not tightly couple the application to one provider.

Before selecting providers, verify:

- Current official API documentation.
- Pricing.
- API access requirements.
- Rate limits.
- Country support.
- Data availability.
- Commercial usage permissions.
- Bulk lookup capabilities.

Do not scrape restricted third-party websites or bypass provider access controls.

---

# 6. Data Flow

## 6.1 Keyword Search Workflow

1. User opens Google.
2. User searches for a keyword.
3. Content script detects the search query.
4. Extension checks local cache.
5. If cached data exists, display it.
6. Otherwise, send the keyword and country to the backend.
7. Backend checks its cache.
8. If necessary, backend requests search volume from the selected provider.
9. Backend normalizes the response.
10. Extension displays the search volume.

## 6.2 Related Keyword Workflow

1. User searches for a keyword.
2. Extension sends the keyword and selected country to the backend.
3. Backend checks the related keyword cache.
4. If no cached result exists, the backend requests related keyword data.
5. Provider returns related keyword suggestions and available search volumes.
6. Backend normalizes and filters the suggestions.
7. Extension displays the related keyword list.
8. Results are cached for future searches.

## 6.3 Domain Metrics Workflow

1. Google displays organic search results.
2. Content script identifies supported organic result URLs.
3. URLs are normalized into registered domains.
4. Duplicate domains are removed.
5. Extension sends the domains to the backend.
6. Backend checks the domain age and DR caches independently.
7. Missing domain age data is requested from the RDAP-compatible provider.
8. Missing DR data is requested from the authorized DR provider.
9. Backend normalizes both responses.
10. Extension displays available metrics beside each organic result.
11. Results are cached according to their respective cache policies.

The system should support batch requests when providers allow them.

Do not send unnecessary requests when a domain has already been processed.

---

# 7. API Response Structure

Use a consistent internal response structure.

The following examples illustrate the application's internal API. They are not guaranteed to match the original provider response formats.

## 7.1 Keyword Search Volume

```json
{
  "success": true,
  "keyword": "mold removal Gainesville FL",
  "search_volume": 1300,
  "country": "US",
  "data_source": "DataForSEO",
  "last_updated": "2026-11-09T12:00:00Z",
  "cached": false
}
```

## 7.2 Related Keywords

```json
{
  "success": true,
  "keyword": "mold removal Gainesville FL",
  "country": "US",
  "related_keywords": [
    {
      "keyword": "mold remediation Gainesville",
      "search_volume": 450
    },
    {
      "keyword": "mold inspection Gainesville FL",
      "search_volume": 320
    }
  ],
  "data_source": "DataForSEO",
  "last_updated": "2026-11-09T12:00:00Z",
  "cached": false
}
```

## 7.3 Domain Metrics

```json
{
  "success": true,
  "domain": "example.com",
  "domain_age": {
    "creation_date": "2018-03-15",
    "age_years": 8,
    "age_months": 7,
    "data_source": "RDAP",
    "status": "available"
  },
  "domain_rating": {
    "value": 38,
    "provider": "Ahrefs",
    "last_updated": "2026-11-09T12:00:00Z",
    "status": "available"
  },
  "cached": false
}
```

## 7.4 Unavailable Data

```json
{
  "success": true,
  "domain": "example.com",
  "domain_age": {
    "creation_date": null,
    "age_years": null,
    "age_months": null,
    "data_source": "RDAP",
    "status": "unavailable"
  },
  "domain_rating": {
    "value": null,
    "provider": "Ahrefs",
    "status": "unavailable"
  }
}
```

Important:

- Use `null` for unavailable values.
- Never replace missing values with zero.
- Keep the availability status separate from the actual metric.
- Track provider and last-updated information where available.
- Allow individual metrics to succeed or fail independently.

---

# 8. Security Requirements

Security is essential.

- Never store API secrets in frontend code.
- Keep API credentials on the backend.
- Store sensitive configuration in secure environment variables.
- Validate all incoming keyword and domain requests.
- Sanitize data before displaying it.
- Implement appropriate rate limiting.
- Use HTTPS for backend communication.
- Restrict backend access to legitimate extension requests where possible.
- Never expose provider credentials in browser developer tools.
- Do not execute untrusted API responses as code.
- Follow Chrome Manifest V3 security requirements.
- Request only the permissions required by the extension.
- Avoid collecting unnecessary personal information.
- Keep dependencies updated and check for known vulnerabilities.
- Do not log sensitive information.
- Review security implications before introducing new packages or integrations.

Do not assume that a publicly visible extension identifier alone is sufficient authentication for a backend API.

---

# 9. Performance Requirements

The extension should:

- Load without noticeably slowing Google Search.
- Display cached results immediately.
- Avoid unnecessary API requests.
- Handle API failures without breaking Google Search.
- Keep the interface lightweight.
- Support normal Google search navigation.
- Process multiple domains efficiently.
- Avoid blocking the main browser interface.
- Use batch API requests where supported.
- Load related keywords and domain metrics independently where practical.

Targets:

- Cached result display: under 200ms where practical.
- Fresh result display: as fast as the API allows.
- No blocking of Google's normal search functionality.
- No repeated requests for already cached data.

These are development targets, not guaranteed API response times.

---

# 10. Out of Scope — Initial Release

Do not implement the following features in the initial release:

- Domain Authority (DA).
- Backlinks count.
- Referring domains count.
- Linking root domains.
- Keyword difficulty (KD).
- CPC.
- Competition score.
- Full content analysis.
- AI-generated content.
- AI keyword recommendations.
- Complete SERP competitor analysis.
- Website audits.
- Rank tracking.
- Bulk keyword exports.
- Subscription and payment systems.
- User account management.
- Automatic website crawling.

These features may be considered in future versions.

---

# 11. Future Possibilities

Potential future additions:

- Bulk keyword search-volume checking.
- Keyword history.
- CSV export.
- Multiple country comparisons.
- Keyword lists.
- Search volume trends.
- Backlink metrics.
- Referring domains.
- Keyword difficulty.
- Additional SEO metrics.
- User accounts.
- Premium API usage plans.
- Custom keyword collections.

These features should not delay the initial release.

---

# 12. Development Phases

## Phase 1 — Project Setup

- Inspect the existing project before changing anything.
- Review this PRD.
- Configure Manifest V3.
- Create the folder structure.
- Set up the extension popup.
- Set up the backend.
- Configure environment variables.
- Initialize Git if required.
- Configure linting and formatting.
- Establish the Inter font design system.

## Phase 2 — Google Search Integration

- Detect Google Search pages.
- Extract the search keyword.
- Identify organic search result URLs.
- Normalize domain names.
- Detect search navigation.
- Insert the keyword information interface.
- Insert domain metrics beside organic results.
- Ensure the extension does not interfere with Google.

## Phase 3 — Keyword API Integration

- Verify current provider documentation.
- Confirm API pricing and availability.
- Set up the keyword data provider.
- Retrieve search volumes.
- Normalize API responses.
- Implement error handling.
- Secure API credentials.

## Phase 4 — Related Keywords

- Integrate the related keyword provider endpoint.
- Retrieve related keyword suggestions.
- Retrieve their estimated search volumes.
- Remove duplicates.
- Implement caching.
- Display the results in the Google SERP interface.
- Add copy and search actions.

## Phase 5 — Website Age

- Integrate an RDAP-compatible domain registration data source.
- Retrieve domain creation dates.
- Calculate domain age.
- Handle unavailable registration information.
- Implement domain caching.
- Test different domain extensions and subdomains.

## Phase 6 — Domain Rating

- Verify authorized DR data providers.
- Confirm API access and pricing.
- Integrate the selected provider.
- Retrieve DR for organic ranking domains.
- Implement batch requests where supported.
- Cache domain-level results.
- Handle unavailable metrics.

## Phase 7 — Country Selection and Caching

- Build the country selector.
- Save country preferences.
- Implement keyword + country caching.
- Implement related keyword caching.
- Implement domain age caching.
- Implement DR caching.
- Prevent duplicate requests.
- Add manual refresh functionality.

## Phase 8 — Testing

Test:

- Single-word keywords.
- Long-tail keywords.
- Keywords containing special characters.
- Different countries.
- Related keyword suggestions.
- Duplicate keyword suggestions.
- Organic search result extraction.
- Different domain extensions.
- Subdomains.
- Internationalized domain names.
- Missing RDAP information.
- Missing DR information.
- Different provider responses.
- Google search pagination.
- Google search navigation without a full page reload.
- API failures.
- Slow internet connections.
- Cached results.
- Extension reloads.
- Independent failure of different metrics.

## Phase 9 — Finalization

- Improve the interface.
- Optimize performance.
- Review permissions.
- Test security.
- Review API costs.
- Verify data-source attribution.
- Prepare Chrome Web Store assets.
- Prepare the initial release.

---

# 13. Acceptance Criteria

The initial release is considered complete when:

1. The extension installs successfully in Chrome.
2. It detects Google search queries automatically.
3. It retrieves keyword search volume from the selected provider.
4. It displays search volume directly on Google Search.
5. It retrieves related keyword suggestions.
6. It displays related keyword search volumes.
7. It identifies supported organic Google search results.
8. It retrieves domain registration dates where available.
9. It calculates and displays approximate domain age.
10. It retrieves actual DR from an authorized provider.
11. It displays DR beside supported organic results.
12. It clearly identifies unavailable data.
13. Users can select their target country.
14. Country preferences persist.
15. Repeated searches use cached data when available.
16. API keys remain secure.
17. Metrics can fail independently without breaking the interface.
18. The extension does not interfere with Google's normal search functionality.
19. Tests pass and the implementation is documented.

---

# 14. Instructions for Claude Code

Build this product in small, testable stages.

Before writing code:

1. Review this PRD carefully.
2. Inspect the existing project and its current implementation.
3. Preserve existing user work.
4. Identify technical requirements and potential limitations.
5. Propose the project folder structure.
6. Verify current official SEO provider API documentation.
7. Confirm API pricing and availability.
8. Verify the availability of actual Ahrefs DR through an authorized API.
9. Verify RDAP support and domain creation date availability.
10. Present the architecture and implementation plan.

During development:

- Follow Chrome Manifest V3 standards.
- Write clean, maintainable code.
- Keep frontend and backend separate.
- Use reusable components.
- Protect all API credentials.
- Avoid unnecessary dependencies.
- Do not introduce features outside the defined scope.
- Test each phase before proceeding.
- Do not use mock data in production.
- Never claim a feature works without testing it.
- Do not fabricate keyword volumes, related keywords, website ages, or DR values.
- Clearly document any provider limitations.
- Do not silently substitute DA or another metric for Ahrefs DR.
- Do not start expensive API integrations without verifying their cost and access requirements.

If a required API credential is unavailable, implement the integration structure and clearly document the configuration required.

Do not invent API credentials or pretend the integration is complete.

**Final objective:**

Deliver a working Chrome extension that displays:

- Estimated monthly keyword search volume.
- Related keywords with their estimated search volumes.
- Approximate domain registration age for organic ranking websites.
- Domain Rating (DR) for organic ranking websites.

All information should be displayed directly on Google Search results pages, with selectable countries, efficient API usage, secure architecture, and a clean user interface.

Keep the product simple, reliable, and accurate. Build and test the core functionality first.

---

# 15. Engineering Standards & Development Rules

These rules are mandatory throughout the entire development process.

## 15.1 Code Quality

- Write high-quality, production-ready code.
- Prioritize scalability, maintainability, readability, and performance.
- Follow clean code principles and established software engineering best practices.
- Use modular architecture and reusable components.
- Avoid unnecessary code duplication.
- Use meaningful variable, function, and file names.
- Keep functions focused and reasonably small.
- Add comments only where they improve understanding.
- Handle errors properly.
- Avoid unnecessary dependencies and overengineering.
- Do not use temporary hacks or fragile workarounds in production code.
- Refactor code when necessary rather than continuously adding complexity.
- Use appropriate validation and type safety wherever applicable.

## 15.2 Security-First Development

Security must be considered from the beginning, not added at the end.

- Never expose API keys, secrets, tokens, or credentials in frontend code.
- Store sensitive configuration in secure environment variables.
- Validate and sanitize all external inputs.
- Implement backend authentication and authorization where required.
- Apply appropriate API rate limiting.
- Use HTTPS for all backend communication.
- Follow Chrome Manifest V3 security requirements.
- Follow the principle of least privilege when requesting extension permissions.
- Avoid unsafe DOM manipulation and prevent XSS vulnerabilities.
- Never execute untrusted data.
- Keep dependencies updated and check for known vulnerabilities.
- Do not log sensitive information.
- Review security implications before introducing new packages or integrations.

## 15.3 Git & Version Control

Git must be used throughout development.

- Initialize a Git repository if one does not already exist.
- Maintain a clean and organized commit history.
- Commit code after every meaningful development milestone.
- Commit completed features, bug fixes, refactoring, and configuration changes separately where practical.
- Use clear, descriptive commit messages following Conventional Commits where appropriate (`feat:`, `fix:`, `refactor:`, `security:`, `style:`).
- Never commit API keys, `.env` files, credentials, or other secrets.
- Maintain an appropriate `.gitignore`.
- Review changes before committing and run relevant tests before committing.
- Never use destructive Git commands or overwrite existing user work without explicit authorization.
- Do not create meaningless commits for trivial changes.

## 15.4 Latest Stable Technologies & Dependencies

- Prefer the latest stable, production-ready versions of frameworks, libraries, and tools.
- Verify current official documentation before installing packages.
- Use actively maintained packages; avoid deprecated APIs.
- Prefer stable releases over experimental or beta releases.
- Avoid unnecessary dependencies.
- Pin dependency versions through the lockfile.
- Review security advisories before adding or updating dependencies.
- Follow the latest officially supported Chrome Extension Manifest V3 standards.
- Check compatibility before upgrading existing dependencies.
- Do not blindly upgrade packages if doing so could break existing functionality.

## 15.5 Typography & Design System

- Primary font: **Inter**.
- Use font weights 400, 500, 600, and 700.
- Load Inter locally using bundled font files, subject to the font licence.
- Do not rely on an external font CDN at runtime.
- Maintain consistent font sizes, line heights, spacing, and visual hierarchy.
- Use a consistent design system for typography, colours, spacing, borders, radii, buttons, inputs, loading indicators, and error messages.

## 15.6 Testing & Quality Assurance

- Test every meaningful feature.
- Add unit tests for important business logic.
- Test API integration and error handling.
- Test keyword search volume.
- Test related keyword retrieval.
- Test domain age calculation.
- Test DR retrieval and provider attribution.
- Test caching.
- Test country selection.
- Test Google Search navigation.
- Test extension permissions.
- Check browser console errors.
- Run linting and formatting tools.
- Ensure existing functionality is not broken by new changes.
- Never mark a feature as complete without verifying its functionality.

## 15.7 Mandatory Development Workflow

For every meaningful development task:

1. Understand the requirement.
2. Inspect the existing codebase.
3. Plan the implementation.
4. Identify potential security and compatibility issues.
5. Implement the changes.
6. Run relevant tests and quality checks.
7. Review the changes for bugs, security issues, and unnecessary complexity.
8. Fix identified problems.
9. Commit the completed changes to Git with a descriptive message.
10. Report what was implemented, tested, and committed.

## 15.8 Documentation

Keep the following documentation updated:

- `README.md`
- `PRD.md`
- `.env.example`
- `CHANGELOG.md`
- `docs/`

Document important architectural decisions, provider integrations, API configuration, limitations, and non-obvious implementation details.

Never place real API credentials in documentation or example environment files.

## 15.9 Persistent Project Instructions

Create an `AGENTS.md` file at the project root.

It should contain the important engineering standards from this PRD so Claude Code follows them during future development sessions.

Claude Code must read and follow `AGENTS.md` before making meaningful project changes.

# Additional UI Requirement — SERP Inline SEO Metrics

## 1. Design Reference

Use the user-provided screenshot as the primary visual reference for how SEO information should appear on Google Search Results Pages.

The extension should integrate SEO metrics directly into Google's existing organic search results.

Do not create a large dashboard or display all metrics in a separate panel.

## 2. Domain Information Badges

Display compact badges beside the website's domain name, near the top of each organic search result.

Required badges:

- `DR: 1` — Domain Rating.
- `Age: 2y` — Approximate domain registration age.
- `Beatable` — An optional competitor opportunity indicator, only when its calculation is supported by a clearly defined and tested methodology.

Use small, rounded badges with a consistent background and readable text.

If a metric is unavailable, display `DR: N/A` or `Age: N/A`, or omit that badge. Never invent values.

## 3. Compact SEO Metrics Toolbar

Below the website URL and above the search result description, display a compact horizontal information bar.

The initial design should accommodate:

- Domain Rating (DR).
- Domain Age.
- Organic traffic estimate.
- Backlinks, if added in a later approved version.
- Referring domains, if added in a later approved version.
- WHOIS/domain registration information.
- Data source.
- Analyze action.

Only display metrics that are actually implemented and supported by an authorized data provider.

Do not introduce extra API costs or new feature requirements merely to reproduce the reference screenshot.

## 4. Related Keyword Panel

Display related keyword suggestions in a separate, compact expandable section near the keyword overview.

Each keyword should show its estimated monthly search volume.

Include a copy action and an option to search the keyword on Google.

## 5. Visual Requirements

- Follow the screenshot's compact, inline SEO toolbar design.
- Use Inter typography.
- Use small rounded metric badges.
- Use subtle grey backgrounds for information bars.
- Use a restrained teal or green accent for metric badges.
- Keep spacing and alignment consistent with Google's search results.
- Do not cover or replace Google's original content.
- Ensure the layout works on different desktop screen sizes.
- Avoid unnecessary animations and large cards.
- Make the toolbar responsive when there is insufficient horizontal space.

## 6. Important Implementation Rules

- Identify organic search results accurately.
- Associate each metric with the correct registered domain.
- Cache domain-level metrics to avoid duplicate API requests.
- Load metrics independently so one unavailable metric does not hide the others.
- Keep the original Google result title, URL and description unchanged.
- Clearly identify the data provider where appropriate.
- Do not display fabricated or unsupported SEO metrics.

The screenshot is a visual and layout reference, not permission to implement every additional metric shown in it.