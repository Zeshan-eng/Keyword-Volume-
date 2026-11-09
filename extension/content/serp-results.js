/**
 * Inline domain metrics for Google's organic results:
 *   - a compact badge beside the site name ("Age: 2y")
 *   - a slim grey toolbar between the title block and the snippet
 * Google's own title, URL and description are never modified; our UI lives in
 * separate closed-Shadow-DOM hosts inserted next to them.
 */
import { computeAge, formatAgeLong, formatAgeShort } from '../shared/domain-age.js';
import { formatDate } from '../shared/format.js';
import { icannLookupUrl, resultHostname } from '../shared/result-url.js';
import { attachStylesheets, detectPageTheme, el, icon, ICONS, infoTip } from './dom.js';

export const MAX_RESULTS = 10;
const STYLESHEETS = ['styles/tokens.css', 'content/results.css'];
const HOST_ATTRIBUTE = 'data-kvf-host';
const AGE_TIP =
  'Domain Age: approximate time since the domain was first registered (public RDAP records). ' +
  'It is not necessarily the age of the website or business.';

// Containers whose links are not classic organic results (ads, carousels, "People also ask").
const EXCLUDED_CONTAINERS = [
  '#tads',
  '#tadsb',
  '#bottomads',
  '[data-text-ad]',
  'g-section-with-header',
  'g-scrolling-carousel',
  'g-inner-card',
  '.related-question-pair',
  '[data-initq]',
].join(',');

/**
 * Finds organic result links on the current Google results page.
 * @returns {{ anchor: HTMLAnchorElement, hostname: string }[]}
 */
export function findOrganicResults(doc = document) {
  const root = doc.getElementById('rso') ?? doc.getElementById('search');
  if (!root) return [];
  const results = [];
  const seen = new Set();
  for (const heading of root.querySelectorAll('a h3')) {
    const anchor = heading.closest('a');
    if (!anchor || seen.has(anchor) || anchor.closest(EXCLUDED_CONTAINERS)) continue;
    const hostname = resultHostname(anchor.getAttribute('href') ?? '', location.href);
    if (!hostname) continue;
    seen.add(anchor);
    results.push({ anchor, hostname });
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

function createHost(tag, kind, theme) {
  const host = el(tag);
  host.setAttribute(HOST_ATTRIBUTE, kind);
  host.dataset.theme = theme;
  host.style.visibility = 'hidden';
  const shadow = host.attachShadow({ mode: 'closed' });
  attachStylesheets(shadow, STYLESHEETS).then(() => {
    host.style.visibility = '';
  });
  if (kind === 'badge') {
    // The badge sits inside Google's result link; clicking anywhere on it (including
    // its margin) must not open the result.
    host.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }
  return { host, shadow };
}

function ageView(info, now) {
  if (info?.status === 'loading') return { label: 'Age: …', state: 'loading', age: null };
  const age = info?.status === 'available' ? computeAge(info.creationDate, now) : null;
  return { label: `Age: ${formatAgeShort(age)}`, state: age ? 'available' : 'missing', age };
}

function badgeTitle(info, age) {
  if (age) {
    return `Domain Age: ${formatAgeLong(age)} (registered ${formatDate(info.creationDate)}, source: ${info.source ?? 'RDAP'}).`;
  }
  if (info?.status === 'error')
    return 'Domain Age: registration data source temporarily unavailable.';
  if (info?.status === 'loading') return 'Domain Age: loading…';
  return 'Domain Age: registration date not published for this domain.';
}

/** Builds (or rebuilds) the inline UI for one result. */
function renderResult(entry, info, now) {
  const { label, state, age } = ageView(info, now);
  const domain = info?.domain ?? entry.hostname;

  // Badge beside the site name.
  const badge = el('span', `badge badge--${state}`, label);
  badge.title = badgeTitle(info, age);
  entry.badgeShadow.replaceChildren(...entry.badgeShadow.querySelectorAll('link'), badge);

  // Toolbar under the title.
  const bar = el('div', 'bar');
  if (!entry.badgeHost.isConnected) bar.append(badge.cloneNode(true));
  const registered = el('span', 'item');
  registered.append(
    el('span', 'item-label', 'Registered'),
    el('strong', null, age ? formatDate(info.creationDate) : state === 'loading' ? '…' : 'N/A'),
  );
  const whois = el('a', 'item item-link', 'whois');
  whois.href = icannLookupUrl(domain);
  whois.target = '_blank';
  whois.rel = 'noopener noreferrer';
  whois.title = `ICANN registration lookup for ${domain}`;
  whois.append(icon(ICONS.external, 12));
  const source = el('span', 'item item-muted', `source: ${info?.source ?? 'RDAP'}`);
  bar.append(registered, whois, source, infoTip(AGE_TIP));
  entry.barShadow.replaceChildren(...entry.barShadow.querySelectorAll('link'), bar);
}

export function createResultAnnotator() {
  let entries = [];

  function clear() {
    for (const entry of entries) {
      entry.badgeHost.remove();
      entry.barHost.remove();
    }
    entries = [];
  }

  /** Inserts hosts for each result (removing any from a previous page state). */
  function attach(results) {
    clear();
    const theme = detectPageTheme();
    entries = results.map(({ anchor, hostname }) => {
      const badge = createHost('span', 'badge', theme);
      const bar = createHost('div', 'bar', theme);
      bar.host.style.display = 'block';

      // Badge inline right after the site name text (Google stacks the header rows, so a
      // sibling would wrap onto its own line). The site name text itself is untouched.
      const siteName = anchor.querySelector('.VuuXrf');
      if (siteName) siteName.append(badge.host);

      // Toolbar after the title block, before the snippet.
      const titleBlock = anchor.closest('.yuRUbf') ?? anchor;
      titleBlock.after(bar.host);

      return {
        hostname,
        badgeHost: badge.host,
        badgeShadow: badge.shadow,
        barHost: bar.host,
        barShadow: bar.shadow,
      };
    });
    return entries.map((entry) => entry.hostname);
  }

  /** @param {Record<string, object>} ages Age info keyed by hostname, or 'loading'. */
  function render(ages, now = new Date()) {
    for (const entry of entries) {
      const info = ages === 'loading' ? { status: 'loading' } : ages[entry.hostname];
      renderResult(entry, info ?? { status: 'error' }, now);
    }
  }

  return { attach, render, clear, isAttached: () => entries.some((e) => e.barHost.isConnected) };
}
