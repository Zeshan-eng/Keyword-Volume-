/** Options page: default country, what to show on Google, and cache management. */
import { populateCountrySelect } from '../shared/country-select.js';
import { getSettings, updateSettings } from '../shared/settings.js';
import { createExtensionCaches } from '../shared/storage-cache.js';

const $ = (id) => document.getElementById(id);
const STATUS_CLEAR_MS = 2500;
const clearTimers = new Map();

function flash(element, text) {
  element.textContent = text;
  clearTimeout(clearTimers.get(element));
  clearTimers.set(
    element,
    setTimeout(() => {
      element.textContent = '';
    }, STATUS_CLEAR_MS),
  );
}

function bindToggle(id, settingName, settings, save) {
  const input = $(id);
  input.checked = settings[settingName];
  input.addEventListener('change', () => save({ [settingName]: input.checked }));
}

async function init() {
  const settings = await getSettings();
  const save = async (partial) => {
    await updateSettings(partial);
    flash($('save-status'), 'Saved');
  };

  const country = $('country');
  populateCountrySelect(country, settings.country);
  country.addEventListener('change', () => save({ country: country.value }));
  bindToggle('show-card', 'showSerpCard', settings, save);
  bindToggle('show-domain-age', 'showDomainAge', settings, save);

  const caches = createExtensionCaches({ storage: chrome.storage.local });
  $('clear-cache').addEventListener('click', async () => {
    const counts = await Promise.all(Object.values(caches).map((cache) => cache.clear()));
    const removed = counts.reduce((sum, n) => sum + n, 0);
    flash($('cache-status'), `Cleared ${removed} cached ${removed === 1 ? 'result' : 'results'}.`);
  });
}

init();
