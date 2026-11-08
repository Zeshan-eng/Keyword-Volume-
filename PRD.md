# PRD.md — Keyword Volume Finder

**Product Type:** Google Chrome Extension
**Version:** 1.0
**Status:** Initial Product Requirements
**Platform:** Google Chrome
**Primary Purpose:** Display keyword search volumes directly on Google Search Engine Results Pages (SERPs).

---

# 1. Product Overview

## 1.1 Product Concept

Keyword Volume Finder is a lightweight Chrome extension designed for SEO professionals, keyword researchers, digital marketers and website owners.

Its primary purpose is to display the estimated monthly search volume of a keyword directly on Google search results pages.

Users should not need to open external SEO tools every time they want to check a keyword's search volume.

When a user searches for something on Google, the extension automatically detects the search query, retrieves its keyword search volume through an SEO data API and displays the result in a clean, minimal interface.

## 1.2 Problem Statement

SEO professionals frequently need to check keyword search volumes during keyword research.

Currently, this often requires:

- Copying a keyword.
- Opening an SEO tool.
- Pasting the keyword.
- Selecting a country.
- Waiting for the results.

This process becomes repetitive when researching hundreds of keywords.

Our extension aims to make this process faster by displaying search volumes directly within Google.

## 1.3 Product Goal

Build a simple, reliable and fast Chrome extension that:

1. Automatically detects the keyword searched on Google.
2. Retrieves its estimated monthly search volume.
3. Displays the volume directly on the Google SERP.
4. Allows users to change the target country.
5. Provides a simple way to refresh or retrieve keyword data.

The product should prioritize accuracy, usability, speed and low operating costs.

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

The interface must be simple enough for someone with no previous SEO experience.

---

# 3. Core Features — MVP

## 3.1 Automatic Keyword Detection

When a user performs a Google search, the extension must:

- Detect the search query from Google's search URL.
- Extract the actual keyword.
- Automatically request its search volume.
- Display the result without requiring the user to open the extension popup.

Example:

Google search:

`mold removal Gainesville FL`

Extension displays:

`Monthly Search Volume: 1,300`

The numbers above are illustrative, not actual keyword data.

## 3.2 Search Volume Display

Display the following information:

| Field         | Description                        |
| ------------- | ---------------------------------- |
| Keyword       | The searched keyword               |
| Search Volume | Estimated average monthly searches |
| Country       | Selected target country            |
| Data Source   | Name of the data provider          |
| Last Updated  | Date/time of the retrieved data    |

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

The selected country should be saved and used for subsequent searches.

Default country: United States.

The extension must use the appropriate country code and language settings supported by the API.

## 3.4 Extension Popup

When users click the Chrome extension icon, they should see:

- Extension name and logo.
- Current selected country.
- Current Google search keyword, when available.
- Its search volume.
- A refresh button.
- A settings option.

The popup should also display a helpful message when the user is not currently on Google Search.

## 3.5 Loading and Error States

The extension must handle:

- Loading keyword data.
- No search volume available.
- API errors.
- Internet connection problems.
- API usage limits.
- Invalid responses.

Never display fabricated search volume data.

If the API cannot return a reliable result, show "Data unavailable".

## 3.6 Caching

To reduce API costs:

- Cache previously retrieved keyword results.
- Use keyword + country as the cache key.
- Set an initial cache duration of 24 hours.
- Avoid sending duplicate requests for the same keyword and country within the cache period.
- Allow users to manually refresh data when appropriate.

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

Avoid unnecessary animations, excessive colours and complicated dashboards.

Use a clean white interface with subtle grey borders and one primary accent colour.

## 4.2 Google SERP Integration

Display a compact SEO information card near the top of Google's search results.

Example layout:

**Keyword Volume Finder**

Keyword: mold removal Gainesville FL

**1,300**

Estimated monthly searches

Country: United States

Data source: Data provider

Last updated: 8 November 2026

The card must:

- Blend naturally into Google's interface.
- Avoid obstructing search results.
- Be responsive.
- Work with Google's different desktop search layouts.
- Avoid modifying Google's original search result content.

## 4.3 Chrome Popup Design

The popup should be approximately 350–400px wide.

Include:

1. Extension logo and name.
2. Search volume display.
3. Country selector.
4. Refresh button.
5. Settings link.
6. Small data-source attribution.

---

# 5. Technical Architecture

Use the following technology stack.

## 5.1 Chrome Extension

- Manifest V3.
- JavaScript.
- HTML.
- CSS.

Required extension components:

**Content Script**

- Detect Google search pages.
- Extract search queries.
- Insert the search volume card.
- Update the card when the user performs another search.

**Background Service Worker**

- Handle extension background operations.
- Manage API requests through the backend.
- Handle caching coordination and messaging.

**Popup**

- Display the extension interface.
- Show current keyword information.
- Allow country selection.
- Provide refresh functionality.

**Options / Settings**

- Manage user preferences.
- Select default country.
- Configure basic extension settings.

## 5.2 Backend

Use a lightweight backend to communicate with the keyword data provider.

Recommended option: Node.js with Express or a suitable serverless backend.

Responsibilities:

- Receive keyword and country parameters.
- Communicate with the SEO data API.
- Validate incoming requests.
- Normalize API responses.
- Protect API credentials.
- Apply request limits.
- Cache results where appropriate.
- Return clean JSON responses to the extension.

Never expose private API keys inside extension JavaScript files.

## 5.3 Keyword Data Provider

Recommended initial provider: DataForSEO.

Use its Google Ads Search Volume endpoint or another appropriate keyword search-volume endpoint after checking the current API documentation.

The backend should be designed with a provider-adapter structure so another data provider can be integrated later without rebuilding the extension.

Important:

- Verify current API availability and pricing.
- Verify country and language parameters.
- Understand the provider's definition of average monthly search volume.
- Handle unavailable data correctly.
- Do not invent or estimate missing values.

---

# 6. Data Flow

The expected workflow:

1. User opens Google.
2. User searches for a keyword.
3. Content script detects the search query.
4. Extension checks its local cache.
5. If cached data exists, display it.
6. Otherwise, send the keyword and country to the backend.
7. Backend checks its cache.
8. If necessary, backend requests data from the SEO provider.
9. Provider returns the search-volume information.
10. Backend normalizes the response.
11. Extension displays the result on Google.

The extension must not repeatedly call the API when the user refreshes or navigates between pages unnecessarily.

---

# 7. API Response Structure

Use a consistent internal response structure.

Example:

```json
{
  "success": true,
  "keyword": "mold removal Gainesville FL",
  "search_volume": 1300,
  "country": "US",
  "data_source": "DataForSEO",
  "last_updated": "2026-11-08T12:00:00Z",
  "cached": false
}
```

This is an illustrative internal response format, not a guaranteed response from DataForSEO.

When no data is available:

```json
{
  "success": false,
  "keyword": "example keyword",
  "search_volume": null,
  "country": "US",
  "message": "Search volume unavailable"
}
```

---

# 8. Security Requirements

Security is essential.

- Never store API secrets in frontend code.
- Keep API credentials on the backend.
- Validate all incoming keyword requests.
- Implement basic rate limiting.
- Avoid collecting unnecessary personal information.
- Use HTTPS for backend communication.
- Restrict backend access to legitimate extension requests where possible.
- Never expose provider credentials in browser developer tools.
- Do not execute untrusted API responses as code.

---

# 9. Performance Requirements

The extension should:

- Load without noticeably slowing Google Search.
- Display cached results immediately.
- Avoid unnecessary API requests.
- Handle API failures without breaking Google Search.
- Keep its interface lightweight.
- Support normal Google search navigation and page updates.

Target:

- Cached result display: under 200ms where practical.
- Fresh result display: as fast as the API allows.
- No blocking of Google's normal search functionality.

These are development targets, not guaranteed API response times.

---

# 10. Out of Scope — Version 1

Do not implement the following features in the initial release:

- Domain Rating (DR).
- Domain Authority (DA).
- Backlinks.
- Referring domains.
- Website age.
- Keyword difficulty.
- CPC.
- Competition score.
- Content analysis.
- AI keyword suggestions.
- SERP competitor analysis.
- Website audits.
- Rank tracking.
- Subscription and payment systems.

The first version should do one thing exceptionally well: show keyword search volume.

---

# 11. Future Possibilities — Not for MVP

Potential future additions:

- Search volume for related keywords.
- Bulk keyword search-volume checking.
- Keyword history.
- CSV export.
- Multiple country comparisons.
- Keyword lists.
- Search volume trends.
- User accounts.
- Premium API usage plans.

These features should not delay the initial release.

---

# 12. Development Phases

## Phase 1 — Project Setup

- Create the Chrome extension project.
- Configure Manifest V3.
- Create the basic folder structure.
- Build the extension popup.
- Configure Google Search permissions.

## Phase 2 — Google Search Integration

- Detect Google Search pages.
- Extract the search keyword.
- Detect search navigation.
- Insert the keyword volume card.
- Ensure the card does not interfere with Google.

## Phase 3 — API Integration

- Set up the backend.
- Integrate the selected SEO data provider.
- Secure API credentials.
- Normalize API responses.
- Implement error handling.

## Phase 4 — Country Selection and Caching

- Build country selector.
- Save country preferences.
- Implement keyword + country caching.
- Prevent duplicate requests.
- Add manual refresh.

## Phase 5 — Testing

Test:

- Single-word keywords.
- Long-tail keywords.
- Keywords containing special characters.
- Different countries.
- Google search pagination.
- Google search navigation without a full page reload.
- API failures.
- Missing search volume.
- Slow internet connections.
- Cached results.
- Extension reloads.

## Phase 6 — Finalization

- Improve interface.
- Optimize performance.
- Review permissions.
- Test security.
- Prepare Chrome Web Store assets.
- Prepare initial release.

---

# 13. Acceptance Criteria

The MVP is considered complete when:

1. The extension installs successfully in Chrome.
2. It detects a Google search query automatically.
3. It retrieves keyword search volume from the selected provider.
4. It displays the volume directly on Google Search.
5. Users can select their target country.
6. Country preferences persist.
7. Repeated searches use cached data when available.
8. API keys remain secure.
9. Missing data is handled honestly.
10. The extension does not interfere with Google's normal search functionality.

---

# 14. Instructions for Claude Code

Build this product in small, testable stages.

Before writing code:

1. Review this PRD.
2. Propose the project folder structure.
3. Identify technical requirements and potential limitations.
4. Verify the current SEO provider API documentation.
5. Confirm API pricing and availability.
6. Present the architecture and implementation plan.

During development:

- Follow Manifest V3 standards.
- Write clean, maintainable JavaScript.
- Keep frontend and backend separate.
- Use reusable components.
- Protect all API credentials.
- Avoid unnecessary dependencies.
- Do not introduce features outside the MVP scope.
- Test each phase before proceeding.
- Do not use mock data in production.
- Never claim a feature works without testing it.

If a required API credential is unavailable, implement the integration structure and clearly document what configuration is needed. Do not invent API credentials or pretend the integration is complete.

**Final objective:**

Deliver a working Chrome extension that automatically displays accurate, provider-sourced monthly keyword search volumes directly on Google search results pages, with selectable countries and efficient API usage.

Keep the product simple. Build the core functionality first.

---

# 15. Engineering Standards & Development Rules

These rules are mandatory throughout the entire development process.

## 15.1 Code Quality

- Write high-quality, production-ready code.
- Prioritize scalability, maintainability, readability and performance.
- Follow clean code principles and established software engineering best practices.
- Use modular architecture and reusable components.
- Avoid unnecessary code duplication.
- Use meaningful variable, function and file names.
- Keep functions focused and reasonably small.
- Add comments only where they improve understanding.
- Handle errors properly.
- Avoid unnecessary dependencies and overengineering.
- Do not use temporary hacks or fragile workarounds in production code.
- Refactor code when necessary rather than continuously adding complexity.
- Use appropriate validation and type safety wherever applicable.

## 15.2 Security-First Development

Security must be considered from the beginning, not added at the end.

- Never expose API keys, secrets, tokens or credentials in frontend code.
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
- Commit completed features, bug fixes, refactoring and configuration changes separately where practical.
- Use clear, descriptive commit messages following Conventional Commits where appropriate (`feat:`, `fix:`, `refactor:`, `security:`, `style:` …).
- Never commit API keys, `.env` files, credentials or other secrets.
- Maintain an appropriate `.gitignore`.
- Review changes before committing and run relevant tests before committing.
- Never use destructive Git commands or overwrite existing user work without explicit authorization.
- Do not create meaningless commits for trivial changes.

## 15.4 Latest Stable Technologies & Dependencies

- Prefer the latest stable, production-ready versions of frameworks, libraries and tools.
- Verify current official documentation before installing packages.
- Use actively maintained packages; avoid deprecated APIs.
- Prefer stable releases over experimental or beta releases.
- Avoid unnecessary dependencies; pin versions through the lockfile.
- Review security advisories before adding or updating dependencies.
- Follow the latest officially supported Chrome Extension Manifest V3 standards.

## 15.5 Typography & Design System

- Primary font: **Inter**, weights 400, 500, 600 and 700.
- Load Inter locally using bundled font files; no external font CDN at runtime.
- Maintain consistent font sizes, line heights, spacing and visual hierarchy.
- Use a consistent design system for typography, colours, spacing, borders, radii, buttons, inputs, loading indicators and error messages.

## 15.6 Testing & Quality Assurance

- Test every meaningful feature; add unit tests for important business logic.
- Test API integration and error handling, caching, country selection, Google Search navigation and extension permissions.
- Check browser console errors; run linting and formatting tools.
- Ensure existing functionality is not broken by new changes.
- Never mark a feature as complete without verifying its functionality.

## 15.7 Mandatory Development Workflow

1. Understand the requirement.
2. Inspect the existing codebase.
3. Plan the implementation.
4. Identify potential security and compatibility issues.
5. Implement the changes.
6. Run relevant tests and quality checks.
7. Review the changes for bugs, security issues and unnecessary complexity.
8. Fix identified problems.
9. Commit the completed changes to Git with a descriptive message.
10. Report what was implemented, tested and committed.

## 15.8 Documentation

Keep `README.md`, `PRD.md`, `.env.example`, `CHANGELOG.md` and `docs/` updated when relevant. Document important architectural decisions and non-obvious implementation details.
