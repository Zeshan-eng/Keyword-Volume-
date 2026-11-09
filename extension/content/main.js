/**
 * Content-script logic: detect the Google query, ask the service worker for search
 * volume, related keywords and domain ages, and keep the UI in sync with navigation and
 * settings. Each data source loads and fails independently.
 */
import { extractQueryFromUrl } from '../shared/query.js';
import { ERROR_CODES, MESSAGE_TYPES } from '../shared/messages.js';
import { getSettings, onSettingsChanged } from '../shared/settings.js';
import { createSerpCard, CARD_STATE } from './serp-card.js';
import { createResultAnnotator, findOrganicResults } from './serp-results.js';

const FONT_FAMILY = 'KVF Inter';
const FONT_FILES = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' };
const MOUNT_WAIT_MS = 5000;
const RESULTS_RETRY_DELAYS_MS = [500, 1500, 3000];

let settings;
let card;
let annotator;
let lastRequestKey = null;
let lastVolumeState = null;
let lastRelatedState = null;
let requestSequence = 0;
let annotateSequence = 0;
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

async function send(message, fallback) {
  try {
    return (await chrome.runtime.sendMessage(message)) ?? fallback;
  } catch {
    return fallback;
  }
}

// --- Keyword card -------------------------------------------------------------------

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

function renderVolume(state) {
  lastVolumeState = state;
  if (!settings.showSerpCard) return;
  card.render(state);
  ensureCardMounted();
}

function renderRelated(state) {
  lastRelatedState = state;
  if (!settings.showSerpCard) return;
  card.renderRelated(state);
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

async function loadKeywordData(keyword, refresh) {
  const sequence = ++requestSequence;
  const isCurrent = () => sequence === requestSequence; // A newer search may supersede this one.
  const failed = { status: 'unavailable', keyword, reason: ERROR_CODES.NETWORK_ERROR };

  card.resetRelated();
  renderVolume({ kind: CARD_STATE.LOADING, keyword, country: settings.country });
  renderRelated({ status: 'loading' });

  await Promise.all([
    send({ type: MESSAGE_TYPES.GET_VOLUME, keyword, refresh }, failed).then((result) => {
      if (isCurrent()) renderVolume(toCardState(result));
    }),
    send({ type: MESSAGE_TYPES.GET_RELATED, keyword, refresh }, failed).then((result) => {
      if (isCurrent()) renderRelated(result);
    }),
  ]);
}

// --- Organic result metrics ---------------------------------------------------------

async function annotateResults() {
  const sequence = ++annotateSequence;
  if (!settings.showDomainAge) {
    annotator.clear();
    return;
  }

  // Google usually renders results server-side, but give late layouts a few chances.
  let results = findOrganicResults();
  for (const delay of RESULTS_RETRY_DELAYS_MS) {
    if (results.length) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (sequence !== annotateSequence) return;
    results = findOrganicResults();
  }
  if (!results.length) return;

  const hostnames = annotator.attach(results);
  annotator.render('loading');
  const ages = await send({ type: MESSAGE_TYPES.GET_DOMAIN_AGES, hostnames }, {});
  if (sequence === annotateSequence) annotator.render(ages);
}

// --- Orchestration ------------------------------------------------------------------

async function update({ refresh = false } = {}) {
  if (!isExtensionContextValid()) return; // Extension was reloaded; this script is orphaned.

  const query = extractQueryFromUrl(location.href);
  if (query.status === 'ignored') {
    lastRequestKey = null;
    card.unmount();
    annotator.clear();
    return;
  }

  // Results change with every navigation; their metrics are cached, so this is cheap.
  if (refresh || !annotator.isAttached()) annotateResults();

  // Pagination and repeated navigation events for the same keyword+country reuse the
  // current keyword data instead of issuing another request.
  const requestKey = `${query.keyword}|${settings.country}`;
  if (!refresh && requestKey === lastRequestKey) {
    if (lastVolumeState) renderVolume(lastVolumeState);
    if (lastRelatedState) renderRelated(lastRelatedState);
    return;
  }
  lastRequestKey = requestKey;
  await loadKeywordData(query.keyword, refresh);
}

function watchNavigation(onNavigate) {
  let lastHref = location.href;
  const check = () => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    annotator.clear(); // New results on the page; re-annotate them.
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

function applySettings(next) {
  const countryChanged = next.country !== settings.country;
  const domainAgeChanged = next.showDomainAge !== settings.showDomainAge;
  settings = next;

  if (!settings.showSerpCard) {
    stopWaitingForMount();
    card.unmount();
  }
  if (domainAgeChanged) annotateResults();
  if (countryChanged) {
    update();
  } else if (settings.showSerpCard) {
    if (lastVolumeState) renderVolume(lastVolumeState);
    if (lastRelatedState) renderRelated(lastRelatedState);
  }
}

export async function start() {
  settings = await getSettings();
  registerFonts();
  card = createSerpCard({ onRefresh: () => update({ refresh: true }) });
  annotator = createResultAnnotator();

  onSettingsChanged(applySettings);
  listenForPopupRefresh();
  watchNavigation(() => update());
  await update();
}
