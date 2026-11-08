/** User preferences persisted in chrome.storage.sync. */
import { DEFAULT_COUNTRY, isSupportedCountry } from './countries.js';

export const SETTINGS_DEFAULTS = Object.freeze({
  country: DEFAULT_COUNTRY,
  showSerpCard: true,
});

export function sanitizeSettings(raw) {
  const value = raw ?? {};
  return {
    country: isSupportedCountry(value.country) ? value.country : SETTINGS_DEFAULTS.country,
    showSerpCard:
      typeof value.showSerpCard === 'boolean' ? value.showSerpCard : SETTINGS_DEFAULTS.showSerpCard,
  };
}

export async function getSettings() {
  const stored = await chrome.storage.sync.get(Object.keys(SETTINGS_DEFAULTS));
  return sanitizeSettings(stored);
}

export async function updateSettings(partial) {
  const next = sanitizeSettings({ ...(await getSettings()), ...partial });
  await chrome.storage.sync.set(next);
  return next;
}

/** Subscribe to settings changes from any extension context. Returns an unsubscribe function. */
export function onSettingsChanged(callback) {
  const listener = (changes, areaName) => {
    if (areaName !== 'sync') return;
    if (!Object.keys(SETTINGS_DEFAULTS).some((key) => key in changes)) return;
    getSettings().then(callback);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
