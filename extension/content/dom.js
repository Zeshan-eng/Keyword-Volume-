/** Small DOM helpers shared by the content-script UI (no HTML string parsing anywhere). */
const SVG_NS = 'http://www.w3.org/2000/svg';

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Builds a 16px inline SVG icon from a single path. */
export function icon(pathData, size = 16) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', pathData);
  svg.append(path);
  return svg;
}

export const ICONS = Object.freeze({
  refresh:
    'M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  copy: 'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  search:
    'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  chevron: 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z',
  info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z',
  external:
    'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
});

/** A small "i" icon whose tooltip explains a metric to beginners. */
export function infoTip(text) {
  const tip = el('span', 'info');
  tip.title = text;
  tip.setAttribute('role', 'img');
  tip.setAttribute('aria-label', text);
  tip.append(icon(ICONS.info, 13));
  return tip;
}

/** Google can render in a dark theme independent of the OS preference. */
export function detectPageTheme() {
  const match = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
  if (!match || match.length < 3) return 'light';
  const [r, g, b] = match.map(Number);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5 ? 'dark' : 'light';
}

/**
 * Adds packaged stylesheets (web_accessible_resources) to a shadow root.
 * Resolves once all have loaded or failed, so callers can avoid a flash of unstyled UI.
 */
export function attachStylesheets(shadowRoot, paths) {
  return Promise.all(
    paths.map(
      (path) =>
        new Promise((resolve) => {
          const link = el('link');
          link.rel = 'stylesheet';
          link.href = chrome.runtime.getURL(path);
          link.addEventListener('load', resolve, { once: true });
          link.addEventListener('error', resolve, { once: true });
          shadowRoot.append(link);
        }),
    ),
  );
}
