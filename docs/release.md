# Release checklist (Chrome Web Store)

## Before packaging

- [ ] Deploy the backend over HTTPS with `NODE_ENV=production`, real credentials and a
      DataForSEO cost limit.
- [ ] Set `BACKEND_BASE_URL` in `extension/shared/config.js` to the production HTTPS URL.
- [ ] Upload once to get the store extension ID, then add it to `ALLOWED_EXTENSION_IDS`.
- [ ] Complete the live verification checklist in [api-integration.md](api-integration.md).
- [ ] `npm run check` and `npm audit` are clean.
- [ ] Bump `version` in `extension/manifest.json` and update `CHANGELOG.md`.
- [ ] Zip the **contents** of `extension/` (not the folder itself), without `extension/tests/`.

## Store listing assets

- Icon: `extension/icons/icon-128.png`
- At least one screenshot at 1280×800 or 640×400: the SERP card, the popup, the settings page
- Small promo tile, 440×280 (optional)
- Short description (132 characters or fewer), for example: "See estimated monthly search
  volume for your Google searches, right on the results page."

## Privacy and permission disclosures

- **Single purpose:** show estimated search volume for the current Google search.
- **`storage`:** saves the chosen country, the card preference and a 24-hour result cache on the
  device.
- **Host access to Google Search pages:** reads the search query from the URL and shows the card.
- **Data handling:** the search keyword and chosen country are sent to the extension's backend
  and, from there, to DataForSEO to look up volume. No personal information, browsing history or
  account data is collected. A privacy policy URL is required, because user-entered search terms
  leave the device.
- **Remote code:** none. All code is packaged.
