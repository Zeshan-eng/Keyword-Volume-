/**
 * Background service worker: the only extension context that talks to the backend.
 * Content scripts ask it for volumes; it records each tab's latest result in
 * chrome.storage.session so the popup can display it.
 */
import { BACKEND_BASE_URL, BACKEND_TIMEOUT_MS } from '../shared/config.js';
import { MESSAGE_TYPES, tabStateKey } from '../shared/messages.js';
import { normalizeKeyword, validateKeyword } from '../shared/query.js';
import { getSettings } from '../shared/settings.js';
import { createVolumeCache } from '../shared/volume-cache.js';
import { createVolumeRepository } from '../shared/volume-repository.js';
import { unavailable } from '../shared/volume-result.js';

const cache = createVolumeCache({ storage: chrome.storage.local });
const repository = createVolumeRepository({
  cache,
  fetchImpl: (...args) => fetch(...args),
  backendBaseUrl: BACKEND_BASE_URL,
  timeoutMs: BACKEND_TIMEOUT_MS,
});

async function saveTabState(tabId, state) {
  if (tabId === undefined) return;
  await chrome.storage.session.set({ [tabStateKey(tabId)]: { ...state, updatedAt: Date.now() } });
}

async function handleGetVolume(message, sender) {
  const { country } = await getSettings();
  const keyword = normalizeKeyword(message.keyword);
  const tabId = sender.tab?.id;
  const validation = validateKeyword(keyword);

  if (!validation.valid) {
    const result = unavailable({ keyword, country }, validation.reason);
    await saveTabState(tabId, result);
    return result;
  }

  await saveTabState(tabId, { status: 'loading', keyword, country });
  const result = await repository.getVolume({
    keyword,
    country,
    refresh: message.refresh === true,
  });
  await saveTabState(tabId, result);
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== MESSAGE_TYPES.GET_VOLUME) return false;
  if (typeof message.keyword !== 'string') return false;

  handleGetVolume(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[Keyword Volume Finder] lookup failed:', error);
      sendResponse(undefined);
    });
  return true; // Keep the message channel open for the async response.
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(tabStateKey(tabId));
});

chrome.runtime.onInstalled.addListener(() => cache.prune());
chrome.runtime.onStartup.addListener(() => cache.prune());
