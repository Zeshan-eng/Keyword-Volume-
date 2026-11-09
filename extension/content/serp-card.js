/**
 * The compact keyword card shown above Google's results: search volume plus the
 * related-keywords section. Rendered inside a closed Shadow DOM so Google's styles and
 * ours never collide, and built exclusively with DOM APIs + textContent.
 */
import {
  formatDate,
  formatVolume,
  describeUnavailable,
  UNAVAILABLE_LABEL,
} from '../shared/format.js';
import { getCountryName } from '../shared/countries.js';
import { attachStylesheets, detectPageTheme, el, icon, ICONS, infoTip } from './dom.js';
import { createRelatedPanel } from './related-panel.js';

const HOST_ID = 'kvf-serp-card-host';
const STYLESHEETS = ['styles/tokens.css', 'content/card.css'];
const VOLUME_TIP = 'Search volume: estimated number of searches per month (provider estimate).';

export const CARD_STATE = Object.freeze({
  LOADING: 'loading',
  SUCCESS: 'success',
  UNAVAILABLE: 'unavailable',
});

function createMetaItem(label) {
  const item = el('div', 'meta-item');
  const value = el('dd', 'meta-value');
  item.append(el('dt', 'meta-label', label), value);
  return { item, value };
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

  attachStylesheets(shadow, STYLESHEETS).then(() => {
    host.style.visibility = 'visible';
  });

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
  refreshButton.title = 'Refresh keyword data';
  refreshButton.setAttribute('aria-label', 'Refresh keyword data');
  refreshButton.append(icon(ICONS.refresh));
  refreshButton.addEventListener('click', () => onRefresh());
  header.append(brand, refreshButton);

  const keywordRow = el('p', 'keyword');
  const keywordValue = el('span', 'keyword-value');
  keywordRow.append(el('span', 'keyword-label', 'Keyword: '), keywordValue);

  const volumeRow = el('div', 'volume-row');
  const volumeValue = el('span', 'volume');
  const volumeCaption = el('span', 'volume-caption', 'Estimated monthly searches');
  volumeRow.append(volumeValue, volumeCaption, infoTip(VOLUME_TIP));

  const message = el('p', 'message');
  message.setAttribute('role', 'status');

  const meta = el('dl', 'meta');
  const country = createMetaItem('Country');
  const source = createMetaItem('Data source');
  const updated = createMetaItem('Last updated');
  meta.append(country.item, source.item, updated.item);

  const related = createRelatedPanel();

  card.append(header, keywordRow, volumeRow, message, meta, related.element);
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
    renderRelated: (state) => related.render(state),
    resetRelated: () => related.reset(),
    mount,
    unmount: () => host.remove(),
    isMounted: () => host.isConnected,
  };
}
