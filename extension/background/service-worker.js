/**
 * Background service worker: the only extension context that talks to the backend.
 * Content scripts ask it for volumes, related keywords and domain ages; it records each
 * tab's latest keyword results in chrome.storage.session so the popup can display them.
 */
import { createApiClient } from '../shared/api-client.js';
import { BACKEND_BASE_URL, BACKEND_TIMEOUT_MS } from '../shared/config.js';
import { createDomainRepository } from '../shared/domain-repository.js';
import { MESSAGE_TYPES, relatedStateKey, tabStateKey } from '../shared/messages.js';
import { normalizeKeyword, validateKeyword } from '../shared/query.js';
import { createRelatedRepository } from '../shared/related-repository.js';
import { getSettings } from '../shared/settings.js';
import { createExtensionCaches } from '../shared/storage-cache.js';
import { createVolumeRepository } from '../shared/volume-repository.js';
import { unavailable } from '../shared/volume-result.js';

const caches = createExtensionCaches({ storage: chrome.storage.local });
const api = createApiClient({
  fetchImpl: (...args) => fetch(...args),
  backendBaseUrl: BACKEND_BASE_URL,
  timeoutMs: BACKEND_TIMEOUT_MS,
});
const volumes = createVolumeRepository({ cache: caches.volume, api });
const related = createRelatedRepository({ cache: caches.related, api });
const domains = createDomainRepository({ cache: caches.domainAge, api });

async function saveState(key, state) {
  await chrome.storage.session.set({ [key]: { ...state, updatedAt: Date.now() } });
}

/**
 * Shared flow for keyword lookups: validate, record "loading" for the popup,
 * fetch, record the result.
 */
async function handleKeywordLookup(message, sender, { stateKey, fetchResult }) {
  const { country } = await getSettings();
  const keyword = normalizeKeyword(message.keyword);
  const tabId = sender.tab?.id;
  const key = tabId === undefined ? null : stateKey(tabId);
  const validation = validateKeyword(keyword);

  if (!validation.valid) {
    const result = unavailable({ keyword, country }, validation.reason);
    if (key) await saveState(key, result);
    return result;
  }

  if (key) await saveState(key, { status: 'loading', keyword, country });
  const result = await fetchResult({ keyword, country, refresh: message.refresh === true });
  if (key) await saveState(key, result);
  return result;
}

const HANDLERS = {
  [MESSAGE_TYPES.GET_VOLUME]: (message, sender) =>
    handleKeywordLookup(message, sender, {
      stateKey: tabStateKey,
      fetchResult: (request) => volumes.getVolume(request),
    }),
  [MESSAGE_TYPES.GET_RELATED]: (message, sender) =>
    handleKeywordLookup(message, sender, {
      stateKey: relatedStateKey,
      fetchResult: (request) => related.getRelated(request),
    }),
  [MESSAGE_TYPES.GET_DOMAIN_AGES]: (message) => domains.getDomainAges(message.hostnames),
};

function isValidMessage(message) {
  if (message?.type === MESSAGE_TYPES.GET_DOMAIN_AGES) {
    return (
      Array.isArray(message.hostnames) &&
      message.hostnames.length > 0 &&
      message.hostnames.every((host) => typeof host === 'string' && host.length <= 253)
    );
  }
  return typeof message?.keyword === 'string';
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = HANDLERS[message?.type];
  if (sender.id !== chrome.runtime.id || !handler || !isValidMessage(message)) return false;

  handler(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[Keyword Volume Finder] lookup failed:', error);
      sendResponse(undefined);
    });
  return true; // Keep the message channel open for the async response.
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove([tabStateKey(tabId), relatedStateKey(tabId)]);
});

function pruneCaches() {
  return Promise.all(Object.values(caches).map((cache) => cache.prune()));
}

chrome.runtime.onInstalled.addListener(pruneCaches);
chrome.runtime.onStartup.addListener(pruneCaches);
