/**
 * Content-script logic: detect the Google query, ask the service worker for its
 * volume, and keep the SERP card in sync with navigation and settings changes.
 */
import { extractQueryFromUrl } from '../shared/query.js';
import { ERROR_CODES, MESSAGE_TYPES } from '../shared/messages.js';
import { getSettings, onSettingsChanged } from '../shared/settings.js';
import { createSerpCard, CARD_STATE } from './serp-card.js';

const FONT_FAMILY = 'KVF Inter';
const FONT_FILES = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' };
const MOUNT_WAIT_MS = 5000;

let settings;
let card;
let lastRequestKey = null;
let lastRenderedState = null;
let requestSequence = 0;
let mountObserver = null;

function registerFonts() {
  for (const [weight, file] of Object.entries(FONT_FILES)) {
    const url = chrome.runtime.getURL(`fonts/Inter-${file}.woff2`);
    const face = new FontFace(FONT_FAMILY, `url("${url}") format("woff2")`, {
      weight,
      display: 'swap',
    });
    document.fonts.add(face);
    face.load().catch(() => {}); // Falls back to system fonts on failure.
  }
}

function isExtensionContextValid() {
  return Boolean(chrome.runtime?.id);
}

/** Mount the card, waiting briefly if Google has not rendered the results container yet. */
function ensureCardMounted() {
  if (!settings.showSerpCard || card.mount()) return;
  if (mountObserver) return;
  mountObserver = new MutationObserver(() => {
    if (card.mount()) stopWaitingForMount();
  });
  mountObserver.observe(document.body, { childList: true, subtree: true });
  setTimeout(stopWaitingForMount, MOUNT_WAIT_MS);
}

function stopWaitingForMount() {
  mountObserver?.disconnect();
  mountObserver = null;
}

function render(state) {
  lastRenderedState = state;
  if (!settings.showSerpCard) return;
  card.render(state);
  ensureCardMounted();
}

function toCardState(result) {
  if (result?.status === 'success') {
    return {
      kind: CARD_STATE.SUCCESS,
      keyword: result.keyword,
      country: result.country,
      volume: result.searchVolume,
      dataSource: result.dataSource,
      lastUpdated: result.lastUpdated,
    };
  }
  return {
    kind: CARD_STATE.UNAVAILABLE,
    keyword: result?.keyword,
    country: result?.country,
    dataSource: result?.dataSource,
    reason: result?.reason ?? ERROR_CODES.INVALID_RESPONSE,
  };
}

async function requestVolume(keyword, refresh) {
  try {
    return await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_VOLUME, keyword, refresh });
  } catch {
    return { status: 'unavailable', keyword, reason: ERROR_CODES.NETWORK_ERROR };
  }
}

async function update({ refresh = false } = {}) {
  if (!isExtensionContextValid()) return; // Extension was reloaded; this script is orphaned.

  const query = extractQueryFromUrl(location.href);
  if (query.status === 'ignored') {
    lastRequestKey = null;
    card.unmount();
    return;
  }

  // Pagination and repeated navigation events for the same keyword+country reuse the
  // current result instead of issuing another request.
  const requestKey = `${query.keyword}|${settings.country}`;
  if (!refresh && requestKey === lastRequestKey) {
    if (lastRenderedState) render(lastRenderedState);
    return;
  }
  lastRequestKey = requestKey;

  const sequence = ++requestSequence;
  render({ kind: CARD_STATE.LOADING, keyword: query.keyword, country: settings.country });
  const result = await requestVolume(query.keyword, refresh);
  if (sequence !== requestSequence) return; // A newer search superseded this one.
  render(toCardState(result));
}

function watchNavigation(onNavigate) {
  let lastHref = location.href;
  const check = () => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    onNavigate();
  };
  window.navigation?.addEventListener('navigatesuccess', check);
  window.addEventListener('popstate', check);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) onNavigate(); // Restored from the back/forward cache.
  });
}

function listenForPopupRefresh() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || message?.type !== MESSAGE_TYPES.REFRESH_CURRENT) {
      return false;
    }
    update({ refresh: true });
    sendResponse({ accepted: true });
    return false;
  });
}

export async function start() {
  settings = await getSettings();
  registerFonts();
  card = createSerpCard({ onRefresh: () => update({ refresh: true }) });

  onSettingsChanged((next) => {
    const countryChanged = next.country !== settings.country;
    settings = next;
    if (!settings.showSerpCard) {
      stopWaitingForMount();
      card.unmount();
    }
    if (countryChanged) update();
    else if (settings.showSerpCard && lastRenderedState) render(lastRenderedState);
  });

  listenForPopupRefresh();
  watchNavigation(() => update());
  await update();
}
