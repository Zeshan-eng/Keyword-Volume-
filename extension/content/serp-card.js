/**
 * The compact search-volume card shown above Google's results.
 * Rendered inside a closed Shadow DOM so Google's styles and ours never collide,
 * and built exclusively with DOM APIs + textContent (no HTML string parsing).
 */
import {
  formatDate,
  formatVolume,
  describeUnavailable,
  UNAVAILABLE_LABEL,
} from '../shared/format.js';
import { getCountryName } from '../shared/countries.js';

const HOST_ID = 'kvf-serp-card-host';
const STYLESHEETS = ['styles/tokens.css', 'content/card.css'];
const SVG_NS = 'http://www.w3.org/2000/svg';

export const CARD_STATE = Object.freeze({
  LOADING: 'loading',
  SUCCESS: 'success',
  UNAVAILABLE: 'unavailable',
});

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createRefreshIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute(
    'd',
    'M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  );
  svg.append(path);
  return svg;
}

function createMetaItem(label) {
  const item = el('div', 'meta-item');
  const value = el('dd', 'meta-value');
  item.append(el('dt', 'meta-label', label), value);
  return { item, value };
}

/** Google can render in a dark theme independent of the OS preference. */
function detectPageTheme() {
  const match = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
  if (!match || match.length < 3) return 'light';
  const [r, g, b] = match.map(Number);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5 ? 'dark' : 'light';
}

function findMountTarget() {
  const centerColumn = document.getElementById('center_col');
  if (centerColumn) return { node: centerColumn, position: 'prepend' };
  const results = document.getElementById('search') ?? document.getElementById('rso');
  if (results) return { node: results, position: 'before' };
  return null;
}

export function createSerpCard({ onRefresh }) {
  const host = el('div');
  host.id = HOST_ID;
  host.style.cssText = 'display:block;max-width:652px;margin:0 0 20px;visibility:hidden;';
  const shadow = host.attachShadow({ mode: 'closed' });

  let pendingStyles = STYLESHEETS.length;
  for (const path of STYLESHEETS) {
    const link = el('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL(path);
    const reveal = () => {
      pendingStyles -= 1;
      if (pendingStyles === 0) host.style.visibility = 'visible';
    };
    link.addEventListener('load', reveal, { once: true });
    link.addEventListener('error', reveal, { once: true });
    shadow.append(link);
  }

  const card = el('section', 'card');
  card.setAttribute('aria-label', 'Keyword Volume Finder');

  const header = el('header', 'header');
  const brand = el('div', 'brand');
  const logo = el('img', 'logo');
  logo.src = chrome.runtime.getURL('icons/icon-32.png');
  logo.alt = '';
  brand.append(logo, el('span', null, 'Keyword Volume Finder'));
  const refreshButton = el('button', 'refresh');
  refreshButton.type = 'button';
  refreshButton.title = 'Refresh search volume';
  refreshButton.setAttribute('aria-label', 'Refresh search volume');
  refreshButton.append(createRefreshIcon());
  refreshButton.addEventListener('click', () => onRefresh());
  header.append(brand, refreshButton);

  const keywordRow = el('p', 'keyword');
  const keywordValue = el('span', 'keyword-value');
  keywordRow.append(el('span', 'keyword-label', 'Keyword: '), keywordValue);

  const volumeRow = el('div', 'volume-row');
  const volumeValue = el('span', 'volume');
  const volumeCaption = el('span', 'volume-caption', 'Estimated monthly searches');
  volumeRow.append(volumeValue, volumeCaption);

  const message = el('p', 'message');
  message.setAttribute('role', 'status');

  const meta = el('dl', 'meta');
  const country = createMetaItem('Country');
  const source = createMetaItem('Data source');
  const updated = createMetaItem('Last updated');
  meta.append(country.item, source.item, updated.item);

  card.append(header, keywordRow, volumeRow, message, meta);
  shadow.append(card);

  function setMeta({ countryCode, dataSource, lastUpdated }) {
    country.value.textContent = countryCode ? getCountryName(countryCode) : '—';
    source.value.textContent = dataSource ?? '—';
    updated.value.textContent = lastUpdated ? formatDate(lastUpdated) : '—';
    source.item.hidden = !dataSource;
    updated.item.hidden = !lastUpdated;
  }

  function render(state) {
    card.dataset.state = state.kind;
    keywordValue.textContent = state.keyword ?? '';
    refreshButton.disabled = state.kind === CARD_STATE.LOADING;
    message.hidden = state.kind !== CARD_STATE.UNAVAILABLE;
    volumeCaption.hidden = state.kind === CARD_STATE.UNAVAILABLE;

    if (state.kind === CARD_STATE.LOADING) {
      volumeValue.textContent = '';
      volumeValue.setAttribute('aria-label', 'Loading search volume');
      setMeta({ countryCode: state.country });
      return;
    }
    volumeValue.removeAttribute('aria-label');

    if (state.kind === CARD_STATE.SUCCESS) {
      volumeValue.textContent = formatVolume(state.volume);
      setMeta({
        countryCode: state.country,
        dataSource: state.dataSource,
        lastUpdated: state.lastUpdated,
      });
      return;
    }

    volumeValue.textContent = UNAVAILABLE_LABEL;
    message.textContent = describeUnavailable(state.reason);
    setMeta({ countryCode: state.country, dataSource: state.dataSource });
  }

  function mount() {
    if (host.isConnected) return true;
    const target = findMountTarget();
    if (!target) return false;
    host.dataset.theme = detectPageTheme();
    if (target.position === 'prepend') target.node.prepend(host);
    else target.node.before(host);
    return true;
  }

  return {
    render,
    mount,
    unmount: () => host.remove(),
    isMounted: () => host.isConnected,
  };
}
