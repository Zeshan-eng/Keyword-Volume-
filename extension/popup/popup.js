/**
 * Popup: shows the active tab's keyword volume (from chrome.storage.session, written
 * by the service worker), and lets the user change country or refresh.
 */
import { populateCountrySelect } from '../shared/country-select.js';
import {
  describeUnavailable,
  formatDate,
  formatVolume,
  UNAVAILABLE_LABEL,
} from '../shared/format.js';
import { MESSAGE_TYPES, tabStateKey } from '../shared/messages.js';
import { extractQueryFromUrl } from '../shared/query.js';
import { getSettings, onSettingsChanged, updateSettings } from '../shared/settings.js';

const $ = (id) => document.getElementById(id);
const views = { idle: $('view-idle'), reload: $('view-reload'), result: $('view-result') };

function showView(name) {
  for (const [key, view] of Object.entries(views)) view.hidden = key !== name;
  $('refresh').disabled = name !== 'result';
}

function renderState(state) {
  showView('result');
  $('keyword').textContent = state.keyword ?? '';
  const volume = $('volume');
  const isLoading = state.status === 'loading';
  volume.dataset.state = state.status;
  $('refresh').disabled = isLoading;
  $('message').hidden = state.status !== 'unavailable';
  $('volume-caption').hidden = state.status === 'unavailable';
  $('meta-source').hidden = state.status !== 'success';
  $('meta-updated').hidden = state.status !== 'success';

  if (isLoading) {
    volume.textContent = '';
    volume.setAttribute('aria-label', 'Loading search volume');
    return;
  }
  volume.removeAttribute('aria-label');

  if (state.status === 'success') {
    volume.textContent = formatVolume(state.searchVolume);
    $('source').textContent = state.dataSource;
    $('updated').textContent = formatDate(state.lastUpdated);
    return;
  }

  volume.textContent = UNAVAILABLE_LABEL;
  $('message').textContent = describeUnavailable(state.reason);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function init() {
  const settings = await getSettings();
  const countrySelect = $('country');
  populateCountrySelect(countrySelect, settings.country);
  countrySelect.addEventListener('change', () => updateSettings({ country: countrySelect.value }));
  onSettingsChanged((next) => {
    countrySelect.value = next.country;
  });

  $('open-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

  const tab = await getActiveTab();
  // tab.url is only visible for Google Search pages (our host permissions).
  const query = tab?.url ? extractQueryFromUrl(tab.url) : { status: 'ignored' };
  if (query.status === 'ignored') {
    showView('idle');
    return;
  }

  const stateKey = tabStateKey(tab.id);
  const { [stateKey]: state } = await chrome.storage.session.get(stateKey);
  if (state) renderState(state);
  else showView('reload');

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes[stateKey]?.newValue) renderState(changes[stateKey].newValue);
  });

  $('refresh').addEventListener('click', async () => {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.REFRESH_CURRENT });
    } catch {
      showView('reload'); // No content script in the tab (e.g. installed after the page loaded).
    }
  });
}

init();
