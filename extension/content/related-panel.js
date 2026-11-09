/**
 * "Related keywords" section of the SERP card: a compact, expandable list with each
 * suggestion's estimated volume, a copy action and a search-on-Google link.
 */
import { describeUnavailable, formatDate, formatVolume } from '../shared/format.js';
import { el, icon, ICONS, infoTip } from './dom.js';

const INITIAL_VISIBLE = 10;
const COPIED_FEEDBACK_MS = 1500;
export const RELATED_TIP = 'Related keywords: other search terms connected to your keyword.';

function googleSearchUrl(keyword) {
  const url = new URL('/search', location.origin);
  url.searchParams.set('q', keyword);
  return url.href;
}

function createCopyButton(keyword) {
  const button = el('button', 'icon-button');
  button.type = 'button';
  button.title = `Copy “${keyword}”`;
  button.setAttribute('aria-label', `Copy ${keyword}`);
  button.append(icon(ICONS.copy, 14));
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(keyword);
      button.replaceChildren(icon(ICONS.check, 14));
      button.classList.add('is-done');
      setTimeout(() => {
        button.replaceChildren(icon(ICONS.copy, 14));
        button.classList.remove('is-done');
      }, COPIED_FEEDBACK_MS);
    } catch {
      button.title = 'Copy failed — select the text instead';
    }
  });
  return button;
}

function createRow({ keyword, searchVolume }) {
  const row = el('li', 'related-row');
  const link = el('a', 'related-keyword', keyword);
  link.href = googleSearchUrl(keyword);
  link.title = `Search Google for “${keyword}”`;
  const volume = el(
    'span',
    searchVolume === null ? 'related-volume is-missing' : 'related-volume',
    searchVolume === null ? 'Data unavailable' : formatVolume(searchVolume),
  );
  row.append(link, volume, createCopyButton(keyword));
  return row;
}

export function createRelatedPanel() {
  let expanded = false;
  let showAll = false;
  let current = null;

  const section = el('section', 'related');
  const toggle = el('button', 'related-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  const chevron = icon(ICONS.chevron, 16);
  chevron.classList.add('chevron');
  const label = el('span', 'related-label', 'Related keywords');
  const count = el('span', 'related-count');
  toggle.append(chevron, label, count);

  const header = el('div', 'related-header');
  header.append(toggle, infoTip(RELATED_TIP));

  const body = el('div', 'related-body');
  body.hidden = true;
  const list = el('ol', 'related-list');
  const more = el('button', 'related-more');
  more.type = 'button';
  const footnote = el('p', 'related-footnote');
  const message = el('p', 'related-message');
  body.append(list, more, message, footnote);
  section.append(header, body);

  function setExpanded(value) {
    expanded = value;
    toggle.setAttribute('aria-expanded', String(value));
    body.hidden = !value;
  }

  toggle.addEventListener('click', () => setExpanded(!expanded));
  more.addEventListener('click', () => {
    showAll = true;
    render(current);
  });

  function render(state) {
    current = state;
    section.dataset.state = state.status;
    list.replaceChildren();
    more.hidden = true;
    message.hidden = true;
    footnote.hidden = true;

    if (state.status === 'loading') {
      count.textContent = '…';
      message.hidden = false;
      message.textContent = 'Loading related keywords…';
      return;
    }

    if (state.status !== 'success') {
      count.textContent = '';
      message.hidden = false;
      message.textContent = describeUnavailable(state.reason);
      return;
    }

    const visible = showAll ? state.keywords : state.keywords.slice(0, INITIAL_VISIBLE);
    count.textContent = `(${state.keywords.length})`;
    list.replaceChildren(...visible.map(createRow));
    if (visible.length < state.keywords.length) {
      more.hidden = false;
      more.textContent = `Show all ${state.keywords.length}`;
    }
    footnote.hidden = false;
    footnote.textContent = `Estimated monthly searches · ${state.dataSource} · Updated ${formatDate(state.lastUpdated)}`;
  }

  return {
    element: section,
    render,
    /** Collapse and reset paging for a new search. */
    reset() {
      showAll = false;
      setExpanded(false);
    },
  };
}
