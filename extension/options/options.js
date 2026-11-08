/** Options page: default country, SERP card visibility and cache management. */
import { populateCountrySelect } from '../shared/country-select.js';
import { getSettings, updateSettings } from '../shared/settings.js';
import { createVolumeCache } from '../shared/volume-cache.js';

const $ = (id) => document.getElementById(id);
const STATUS_CLEAR_MS = 2500;

function flash(element, text) {
  element.textContent = text;
  clearTimeout(element.clearTimer);
  element.clearTimer = setTimeout(() => {
    element.textContent = '';
  }, STATUS_CLEAR_MS);
}

async function init() {
  const settings = await getSettings();
  const country = $('country');
  const showCard = $('show-card');

  populateCountrySelect(country, settings.country);
  showCard.checked = settings.showSerpCard;

  const save = async (partial) => {
    await updateSettings(partial);
    flash($('save-status'), 'Saved');
  };
  country.addEventListener('change', () => save({ country: country.value }));
  showCard.addEventListener('change', () => save({ showSerpCard: showCard.checked }));

  const cache = createVolumeCache({ storage: chrome.storage.local });
  $('clear-cache').addEventListener('click', async () => {
    const removed = await cache.clear();
    flash($('cache-status'), `Cleared ${removed} cached ${removed === 1 ? 'result' : 'results'}.`);
  });
}

init();
