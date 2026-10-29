import type { Collection, Edition, RenderedTopic, RenderedDocument, RenderedPage, PageLink, ShellOptions } from './types.ts';
export const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const safeJSON = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');

// Field Atlas details derived from existing metadata: plain topic numbers, extent and species.
const plateNumeral = (topic: RenderedTopic) => String(Number(topic.number));
const chapterCount = (topic: RenderedTopic) => topic.rendered.reduce((count, doc) => count + doc.headings.filter(heading => heading.level === 2).length, 0);
const speciesHTML = (topic: RenderedTopic) => {
  const species = topic.illustrations?.species;
  return species ? `<i lang="la">${escape(species.latin)}</i>${species.common ? ` · ${escape(species.common)}` : ''}` : '';
};
const portrait = (topic: RenderedTopic, className: string) => topic.illustrations?.thumbnail ? `<img class="${className}" src="${topic.illustrations.thumbnail}" alt="" decoding="async">` : '';
const latestDate = (topics: RenderedTopic[]) => topics.flatMap(topic => [topic.created, topic.updated]).filter((date): date is string => Boolean(date)).map(date => date.slice(0, 10)).sort().at(-1);
function atlasStamp(collection: Collection, topics: RenderedTopic[], className: string) {
  const latest = latestDate(topics);
  const ring = `${collection.title} · Field Atlas${latest ? ` · ${latest.slice(0, 4)}` : ''} · `.toUpperCase();
  return `<div class="atlas-stamp atlas-only ${className}" aria-hidden="true"><svg viewBox="0 0 200 200" focusable="false"><circle cx="100" cy="100" r="97"/><circle cx="100" cy="100" r="91" class="thin"/><circle cx="100" cy="100" r="64" class="thin"/><path id="atlas-stamp-ring" d="M100,100 m-77,0 a77,77 0 1,1 154,0 a77,77 0 1,1 -154,0"/><text><textPath href="#atlas-stamp-ring" textLength="480" lengthAdjust="spacing">${escape(ring)}</textPath></text></svg><span class="wordmark">${wordmarkContent(collection, false)}</span></div>`;
}

// GitHub mark from Primer Octicons; license retained in design-system/licenses.
const githubMark = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656"/></svg>';
const icon = (content: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
const icons = {
  sidebar: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m4-11 3 3-3 3"/>'),
  light: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>'),
  dark: icon('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>'),
  search: icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'),
  focus: icon('<path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/>'),
  navigation: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),
  design: icon('<path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.7 1.8-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4.3-4-7.3-9-7.3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>'),
  link: icon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  share: icon('<path d="M12 15V3m-4 4 4-4 4 4"/><path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1"/>'),
  plates: icon('<rect x="3" y="4" width="7.5" height="7" rx="1"/><rect x="13.5" y="4" width="7.5" height="7" rx="1"/><rect x="3" y="13" width="7.5" height="7" rx="1"/><rect x="13.5" y="13" width="7.5" height="7" rx="1"/>'),
};
function designSwitch() {
  return `<div class="design-switch js-only" role="group" aria-label="Design">${[['atlas', 'Atlas', 'Field Atlas design (D)'], ['folio', 'Folio', 'Folio design (D)']].map(([choice, label, title]) => `<button type="button" data-design-choice="${choice}" aria-pressed="${choice === 'atlas'}" title="${title}">${icons.design}<span class="design-label">${label}</span></button>`).join('')}</div>`;
}
/** A native disclosure, so plate navigation works without JavaScript; the reader enhances it into a drawer. */
function platesDrawer(topics: RenderedTopic[], prefix: string, page: string) {
  return `<details class="plates-menu atlas-only"><summary class="plates-trigger" aria-label="All topics" title="All topics (G then T)">${icons.plates}<span>All topics</span></summary><div class="plates-drawer" role="region" aria-labelledby="plates-title"><div class="drawer-head"><h2 id="plates-title">All topics</h2><button type="button" class="icon-button js-only" data-close-plates aria-label="Close the topic list" title="Close (Esc)"><span aria-hidden="true">×</span></button></div><nav aria-label="Topics">${topics.map(topic => `<a class="drawer-plate" href="${prefix}topics/${topic.id}/index.html"${topic.id === page ? ' aria-current="page"' : ''}>${portrait(topic, 'drawer-portrait')}<span class="plate-tag">Topic ${plateNumeral(topic)}</span><strong>${escape(topic.title)}</strong>${topic.illustrations?.species ? `<span class="plate-species">${speciesHTML(topic)}</span>` : ''}</a>`).join('')}</nav><div class="drawer-foot"><a href="${prefix}index.html">The collection</a><a href="${prefix}general-index/index.html">A–Z index</a></div></div></details>`;
}
/** Short footer labels come from page folders: `about` becomes “About”. */
const pageLabel = (item: PageLink) => item.id[0].toUpperCase() + item.id.slice(1);
/** Copyright years come from authored topic dates, never the build clock; the notice links to the licensing terms. */
function copyright(collection: Collection, topics: RenderedTopic[], sitePages: PageLink[], prefix: string) {
  const years = topics.flatMap(topic => [topic.created, topic.updated]).filter((date): date is string => Boolean(date)).map(date => date.slice(0, 4)).sort();
  if (!years.length) return '';
  const span = years[0] === years.at(-1) ? years[0] : `${years[0]}–${years.at(-1)}`;
  const notice = `© ${span} ${escape(collection.author.name)}`;
  return `<span class="copyright">${sitePages.some(item => item.id === 'licensing') ? `<a href="${prefix}licensing/index.html">${notice}</a>` : notice}</span>`;
}
/** Keys this page understands, opened with “?”, grouped as Move, Open, Go and Change. Rows for one design carry its class. */
function shortcutsDialog(page: string, isTopic: boolean) {
  // Each combination stays on one line; long rows wrap between combinations.
  const key = (...keys: string[]) => `<span class="key-combo">${keys.map(name => `<kbd>${name}</kbd>`).join(' ')}</span>`;
  const then = (first: string, second: string) => `${key(first)} then ${key(second)}`;
  type Row = [keys: string, action: string, className?: string];
  const home = page === 'collection';
  const sections = isTopic ? 'chapter' : page === 'index' ? 'letter' : 'section';
  const groups: [title: string, rows: Row[]][] = [
    ['Move', [
      home ? [key('J', 'K'), 'Next or previous topic in the list'] : [key('J', 'K'), `Next or previous ${sections}`],
      ...(home ? [[key('←', '→'), 'Previous or next topic in “Browse the topics”', 'atlas-only'], [key('Home', 'End'), 'First or last topic']] as Row[] : []),
      ...(isTopic ? [[key('/'), 'Find on this page']] as Row[] : []),
      [key('Tab'), 'The next link or control'],
    ]],
    ...(home ? [['Open', [[key('Enter'), 'Open the selected topic'], [`${key('⌘', 'Enter')} or ${key('Ctrl', 'Enter')}`, 'Open it in a new tab']]] as [string, Row[]]] : []),
    ['Go', [
      [`${key('⌘', 'K')} or ${key('Ctrl', 'K')}`, 'Search all topics'],
      ...(isTopic ? [[key('[', ']'), 'Previous or next topic']] as Row[] : []),
      [then('G', 'T'), 'All topics'],
      [then('G', 'H'), 'Home page'],
      [then('G', 'I'), 'A–Z index'],
      [then('G', 'A'), 'About'],
    ]],
    ['Change', [
      ...(isTopic ? [[key('F'), 'Focus on reading, or show navigation again'], [key('C'), 'Copy a link to the current section']] as Row[] : []),
      [key('S'), `Share this ${isTopic ? 'topic' : 'page'}`],
      [key('T'), 'Light or dark'],
      [key('D'), 'Atlas or Folio design'],
      [key('Esc'), isTopic ? 'Back out: close, clear the find box, or leave focus mode' : 'Close a dialog or panel'],
      [key('?'), 'Show this panel'],
    ]],
  ];
  // Settings come first: a reader who needs them should not have to read past every key. Both apply to every page.
  const preferences = `<section class="preference-group" aria-labelledby="preferences-title"><h3 id="preferences-title" class="for-keys">Preferences</h3><label class="preference"><input type="checkbox" role="switch" data-preference="motion" checked><span><strong>Animations</strong><small>Moving text, entrances and logo tricks. <span data-motion-device hidden>Your device asks for reduced motion, so they are off.</span></small></span></label><label class="preference for-keys"><input type="checkbox" role="switch" data-preference="shortcuts" checked><span><strong>Single-key shortcuts</strong><small>Turn these off for speech input or accidental presses. Turn them back on through Settings at the bottom of any page. ⌘ K or Ctrl K still searches.</small></span></label></section>`;
  // Settings always have the same name and entry point, even when shortcuts are off.
  // Touch screens keep the preferences without the keyboard reference.
  return `<dialog class="shortcuts-dialog" aria-labelledby="shortcuts-title"><div class="dialog-head"><h2 id="shortcuts-title">Settings</h2><button type="button" class="small-button" data-close-dialog aria-label="Close (Esc)">Esc</button></div>${preferences}<div class="for-keys"><h3 class="shortcut-heading">Keyboard shortcuts</h3><div class="shortcut-columns">${groups.map(([title, rows]) => `<section class="shortcut-group"><h3>${title}</h3><dl class="shortcut-list">${rows.map(([keys, action, className]) => `<div${className ? ` class="${className}"` : ''}><dt>${keys}</dt><dd>${escape(action)}</dd></div>`).join('')}</dl></section>`).join('')}</div></div></dialog>`;
}
// Network marks from Simple Icons (CC0), drawn in the current colour; each tile takes its network's colour on hover.
const mark = (path: string) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;
const shareMarks: Record<string, string> = {
  email: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  linkedin: mark('M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z'),
  bluesky: mark('M12 10.8C10.91 8.69 7.95 4.75 5.2 2.8 2.57.94 1.56 1.27.9 1.57.14 1.91 0 3.08 0 3.77c0 .69.38 5.65.62 6.48.82 2.74 3.71 3.66 6.38 3.36-3.91.58-7.39 2.01-2.83 7.08 5.01 5.19 6.87-1.11 7.83-4.31.95 3.2 2.05 9.27 7.73 4.31 4.27-4.31 1.17-6.5-2.74-7.08 2.67.3 5.57-.62 6.38-3.36.25-.83.63-5.79.63-6.48 0-.69-.14-1.86-.9-2.2-.66-.3-1.67-.62-4.3 1.24C16.05 4.75 13.09 8.69 12 10.8z'),
  x: mark('M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.59-6.64 7.59H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41z'),
};
/**
 * Filled from the page's own Open Graph tags by reader.ts. A row of icon tiles: Copy link first and focused on open,
 * the device share sheet where supported, then email and social sites. The link field appears only if copying fails.
 */
function shareDialog(isTopic: boolean) {
  const targets = [['email', 'Email'], ['linkedin', 'LinkedIn'], ['bluesky', 'Bluesky'], ['x', 'X']];
  const tile = (glyph: string, label: string) => `<span class="share-disc">${glyph}</span><span class="share-label">${label}</span>`;
  return `<dialog class="share-dialog" aria-labelledby="share-title"><div class="dialog-head"><h2 id="share-title">Share this ${isTopic ? 'topic' : 'page'}</h2><button type="button" class="small-button" data-close-dialog aria-label="Close (Esc)">Esc</button></div><span class="sr-only" role="status" data-copy-status></span><figure class="sharing-card" data-share-card><img alt="" decoding="async"><figcaption><span class="sharing-site"></span><span class="sharing-title"></span><span class="sharing-description"></span></figcaption></figure><div class="share-targets"><button type="button" class="share-tile share-copy" data-copy-link autofocus>${tile(icons.link, 'Copy link')}</button><button type="button" class="share-tile" data-share-native hidden>${tile(icons.share, 'More…')}</button>${targets.map(([target, label]) => `<a class="share-tile" data-share-target="${target}"${target === 'email' ? '' : ` target="_blank" rel="noopener noreferrer" aria-label="${label} (opens in a new tab)"`}>${tile(shareMarks[target], label)}</a>`).join('')}</div><div class="share-link" hidden><label class="sr-only" for="share-url">Link</label><input id="share-url" type="url" readonly></div></dialog>`;
}
/** The build's edition: when it was built, from which commit. Not an authored content date. */
function editionStamp(edition: Edition, prefix: string) {
  const label = `Edition ${escape(edition.version)}`;
  return `<span class="edition"><a href="${prefix}version.json" title="Build date and source revision">${label}</a></span>`;
}
function themeToggle() {
  return `<button type="button" class="icon-button theme-toggle js-only" aria-label="Switch color theme">${(['light', 'dark'] as const).map(choice => `<span class="theme-target theme-${choice}">${icons[choice]}</span>`).join('')}</button>`;
}
export function shell({ title, description, body, files, themeJS, csp, edition, collection, topics, prefix = '', page = 'collection', wordmarkBackground = false, created, updated, headMetadata = '', sitePages = [] }: ShellOptions) {
  const articleMetadata = `${created ? `<meta property="article:published_time" content="${escape(created)}">` : ''}${updated ? `<meta property="article:modified_time" content="${escape(updated)}">` : ''}`;
  // Focus mode belongs to topic pages, the only pages with navigation columns to set aside.
  const isTopic = topics.some(topic => topic.id === page);
  const focusButton = !isTopic ? '' : `<button type="button" class="icon-button focus-toggle js-only" data-focus aria-label="Focus on reading" title="Focus on reading (F)" aria-pressed="false"><span class="focus-enter">${icons.focus}</span><span class="focus-exit">${icons.navigation}</span></button>`;
  const homeLink = page === 'collection' ? '' : `<a class="brand" href="${prefix}index.html" aria-label="${escape(collection.title)} — home" title="Home (G then H)"><span class="wordmark" aria-hidden="true">${wordmarkContent(collection, wordmarkBackground)}</span></a>`;
  const ambient = page === 'collection' && collection.ambientBackground === 'F'
    ? `<canvas class="ambient-canvas" aria-hidden="true" style="--ambient-intensity:${escape(collection.ambientIntensity ?? .2)}"></canvas>` : '';
  return `<!doctype html>
<!-- Generated by npm run build. Edit Markdown and design-system sources. -->
<html lang="en" data-design="atlas"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escape(csp)}"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${escape(description)}"><meta name="color-scheme" content="light dark">${articleMetadata}${headMetadata}<meta name="generator" content="${escape(`${collection.title} ${edition.version}`)}"><title>${title ? `${escape(title)} · ` : ''}${escape(collection.title)}</title>
<script>${themeJS.replaceAll('</script', '<\\/script')}</script><link rel="stylesheet" href="${prefix}${files.stylesheet}">
</head><body data-page="${escape(page)}" data-ambient="${escape(collection.ambientBackground ?? '')}">${isTopic ? '<a class="skip-link" href="#text">Skip to the text</a><a class="skip-link" href="#outline">Skip to the outline</a>' : '<a class="skip-link" href="#main">Skip to content</a>'}${ambient}
<div class="site-shell"><header class="masthead">${homeLink}${page === 'collection' ? '' : platesDrawer(topics, prefix, page)}<button type="button" class="search-trigger js-only" data-open-search aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K" title="Search all topics (⌘ K or Ctrl K)">${icons.search}<span>Search all topics</span><kbd>⌘ K</kbd></button><div class="header-actions">${designSwitch()}${focusButton}<button type="button" class="icon-button share-trigger js-only" data-open-share aria-haspopup="dialog" aria-label="Share this ${isTopic ? 'topic' : 'page'}" title="Share this ${isTopic ? 'topic' : 'page'} (S)">${icons.share}</button>${themeToggle()}${collection.repositoryUrl ? `<a class="repo-link" href="${escape(collection.repositoryUrl)}" target="_blank" rel="noopener noreferrer" aria-label="View the repository on GitHub (opens in a new tab)" title="View on GitHub">${githubMark}</a>` : ''}</div></header>
${body}
<footer class="footer"><span class="footer-identity"><span class="brand-name">${escape(collection.title)}</span>${copyright(collection, topics, sitePages, prefix)}</span><nav class="footer-links" aria-label="Site"><a href="${prefix}general-index/index.html"${page === 'index' ? ' aria-current="page"' : ''}>A–Z index</a>${sitePages.map(item => `<a href="${prefix}${item.id}/index.html"${item.id === page ? ' aria-current="page"' : ''}>${escape(pageLabel(item))}</a>`).join('')}</nav><span class="footer-end">${editionStamp(edition, prefix)}<button type="button" class="footer-shortcuts js-only" data-open-shortcuts aria-haspopup="dialog">Settings<kbd class="for-keys" aria-hidden="true">?</kbd></button><a href="#main">Back to top <span aria-hidden="true">↑</span></a></span></footer></div>
<dialog class="search-dialog" aria-labelledby="search-title"><div class="dialog-head"><h2 id="search-title">Search all topics</h2><button type="button" class="small-button" data-close-search aria-label="Close (Esc)">Esc</button></div><label class="sr-only" for="collection-search">Search all topics</label><input id="collection-search" type="search" data-search-index="${prefix}${files.searchIndex}" data-search-root="${prefix}" placeholder="Titles, chapters and full text…" autocomplete="off"><p class="search-result-status" role="status"></p><div class="search-results"></div></dialog>
${shortcutsDialog(page, isTopic)}
${shareDialog(isTopic)}
<div class="toast" aria-hidden="true" hidden></div><div class="sr-only" role="status" data-announcer></div>${files.scripts.map(script => `<script src="${prefix}${script}"></script>`).join('')}</body></html>\n`;
}

/**
 * `animated` splits the large home page wordmark into movable parts at word boundaries,
 * so kerning inside words is untouched: first-line words, the shared stem (the first line's
 * last word), and the last line's initial and rest. Other wordmarks stay unsplit.
 */
export function wordmarkContent(collection: Collection, withBackground: boolean, animated = false) {
  const titleLines = collection.displayTitle.split('\n');
  const displayTitle = titleLines.map((line, index) => {
    const text = escape(line);
    const [initial = '', ...rest] = [...line];
    let content = index === 0
      ? text.replace(/^(\S+)(\s+)/, '<span class="title-prefix">$1</span>$2')
      : index === titleLines.length - 1
        ? `<span class="title-initial">${escape(initial)}</span>${escape(rest.join(''))}`
        : text;
    if (animated && index === 0) {
      const words = line.split(/(\s+)/);
      const last = words.length - 1;
      content = words.map((word, position) => /^\s+$/.test(word) ? word
        : position === last && last > 0 ? `<span class="logo-part logo-stem">${escape(word)}</span>`
        : `<span class="${position === 0 ? 'title-prefix ' : ''}logo-part logo-word" style="--logo-order:${position / 2}">${escape(word)}</span>`).join('');
    } else if (animated && index === titleLines.length - 1) {
      content = `<span class="title-initial logo-part logo-arrive">${escape(initial)}</span><span class="logo-part logo-arrive logo-rest">${escape(rest.join(''))}</span>`;
    }
    return `<span class="title-line">${content}</span>`;
  }).join('');
  return `${withBackground ? '<span class="title-art" aria-hidden="true"></span>' : ''}${displayTitle}`;
}

function dateLabel(value: string) {
  const day = value.slice(0, 10);
  return { value, label: new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`)) };
}
function topicDates(topic: RenderedTopic, className: string) {
  const updated = topic.created?.slice(0, 10) === topic.updated?.slice(0, 10) ? undefined : topic.updated;
  const dates = [['Created', topic.created], ['Updated', updated]].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return dates.length ? `<dl class="${className}">${dates.map(([label, value]) => { const date = dateLabel(value); return `<div><dt>${label}</dt><dd><time datetime="${escape(date.value)}" data-age>${escape(date.label)}</time></dd></div>`; }).join('')}</dl>` : '';
}

/**
 * Collection copy may contain rotating phrases written as [first|second|third].
 * The static HTML shows the first phrase (no JavaScript, print, reduced motion);
 * screen readers get every phrase once instead of changing text.
 */
export function introText(text: string) {
  const segments = text.split(/(\[[^[\]]*\|[^[\]]*\])/);
  const isList = (segment = '') => /^\[[^[\]]*\|[^[\]]*\]$/.test(segment);
  return segments.map((segment, position) => {
    const options = isList(segment) ? segment.slice(1, -1).split('|').map(option => option.trim()) : undefined;
    if (!options) {
      // Punctuation right after a list gets its own element, so it can chase each new phrase.
      const tail = isList(segments[position - 1]) ? /^[.,!?;:…]+/.exec(segment)?.[0] ?? '' : '';
      return `${tail ? `<span class="rotator-tail">${escape(tail)}</span>` : ''}${escape(segment.slice(tail.length)).replaceAll('\n', '<br>')}`;
    }
    if (options.some(option => !option)) throw new Error(`Rotating phrases must not be empty: ${segment}`);
    return `<span class="rotator"><span class="sr-only">${escape(options.join(', '))}</span><span class="rotator-window" aria-hidden="true">${options.map((option, index) => `<span class="rotator-item${index ? '' : ' is-current'}">${escape(option)}</span>`).join('')}</span></span>`;
  }).join('');
}

export function collectionBody(topics: RenderedTopic[], collection: Collection, withBackground = false) {
  const [statement = '', ...intro] = collection.introduction;
  const statementHTML = statement.split('\n').map(line => {
    const parts = collection.introductionAccent ? line.split(collection.introductionAccent) : [line];
    return `<span class="intro-line">${parts.map((part, index) => `${index ? `<span class="intro-accent">${escape(collection.introductionAccent)}</span>` : ''}${introText(part)}`).join('')}</span>`;
  }).join('');
  const habitats = [...new Set(topics.toReversed().map(topic => topic.category))];
  const plates = topics.toReversed().map(topic => {
    const date = topic.updated ?? topic.created;
    return { href: `topics/${topic.id}/index.html`, plate: plateNumeral(topic), title: topic.title, habitat: topic.category, thesis: topic.thesis,
      latin: topic.illustrations?.species?.latin, common: topic.illustrations?.species?.common, chapters: chapterCount(topic), revised: date ? dateLabel(date).label : undefined, revisedOn: date?.slice(0, 10) };
  });
  const spread = `<section class="atlas-spread-wrap atlas-only" aria-labelledby="spread-heading"><div class="section-label"><h2 id="spread-heading">Browse the topics</h2><span id="spread-keys">← → to browse · Enter to open · newest first</span></div><div class="atlas-spread" data-atlas-spread tabindex="0" role="group" aria-roledescription="carousel" aria-labelledby="spread-heading" aria-describedby="spread-keys"></div><p class="sr-only" aria-live="polite" data-spread-status></p><script type="application/json" id="atlas-plates">${safeJSON(plates)}</script></section>`;
  const filters = `<div class="habitat-filters atlas-only js-only" role="group" aria-label="Filter by category"><button type="button" data-habitat="" aria-pressed="true">All categories</button>${habitats.map(habitat => `<button type="button" data-habitat="${escape(habitat)}" aria-pressed="false">${escape(habitat)}</button>`).join('')}</div>`;
  return `<main id="main" class="collection-page"><section class="collection-hero">${atlasStamp(collection, topics, 'stamp-hero')}<div class="hero-wordmark"><h1 class="wordmark" aria-label="${escape(collection.displayTitle.split('\n').join(' '))}">${wordmarkContent(collection, withBackground, true)}</h1></div><div class="collection-intro"><h2>${statementHTML}</h2>${intro.map(paragraph => `<p>${introText(paragraph)}</p>`).join('')}</div></section>${spread}
  <section class="collection-list" aria-labelledby="topics-heading"><div class="section-label"><h2 id="topics-heading">The collection</h2>${filters}<span role="status" data-topic-count>${topics.length} ${topics.length === 1 ? 'topic' : 'topics'}</span></div><div class="topic-grid">${topics.toReversed().map(topic => `<a class="topic-card" href="topics/${topic.id}/index.html" data-habitat="${escape(topic.category)}"><span class="card-plate atlas-only" aria-hidden="true">No. ${plateNumeral(topic)}</span><div class="topic-visual${topic.illustrations?.homepage || topic.coverSVG ? '' : ' no-cover'}">${topic.illustrations?.homepage || topic.coverSVG || ''}</div><div class="topic-copy"><div class="card-meta"><span class="eyebrow"><span class="topic-number">${escape(topic.number)}</span><span class="topic-separator"> · </span>${escape(topic.category)}</span>${topicDates(topic, 'card-dates')}</div><h3 id="topic-${topic.id}-title">${escape(topic.title)}</h3>${topic.illustrations?.species ? `<p class="card-species atlas-only">${speciesHTML(topic)}</p>` : ''}<p>${escape(topic.description)}</p><span class="text-link">Read the topic <span aria-hidden="true">↗</span></span></div></a>`).join('')}</div><p class="index-link atlas-only"><a href="general-index/index.html">A–Z index of every chapter <span aria-hidden="true">→</span></a></p></section></main>`;
}

/** Article navigation follows the authored h2/h3 hierarchy, without a synthetic document group. */
function articleOutline(document: RenderedDocument, grouped: boolean) {
  const chapters: { heading: RenderedDocument['headings'][number]; children: RenderedDocument['headings'] }[] = [];
  for (const heading of document.headings) {
    if (heading.level === 2) chapters.push({ heading, children: [] });
    else if (heading.level === 3) {
      const chapter = chapters.at(-1);
      if (!chapter) throw new Error(`${document.file}: a level-three heading needs a preceding level-two chapter.`);
      chapter.children.push(heading);
    }
  }
  const link = (heading: RenderedDocument['headings'][number]) => `<a class="toc-link" href="#${heading.id}">${escape(heading.text)}</a>`;
  return `<div class="toc-document toc-article">${grouped ? `<a class="toc-document-title" href="#${document.id}-title">${escape(document.title)}</a>` : ''}<ol class="toc-list">${chapters.map(({ heading, children }) => `<li class="toc-chapter" data-subsection="false">${link(heading)}${children.length ? `<ol class="toc-list">${children.map(child => `<li data-subsection="true">${link(child)}</li>`).join('')}</ol>` : ''}</li>`).join('')}</ol></div>`;
}

export function readerBody(topic: RenderedTopic, topics: RenderedTopic[], documents: RenderedDocument[], explorer: string, collection: Collection) {
  const currentIndex = topics.findIndex(item => item.id === topic.id);
  const next = topics[(currentIndex + 1) % topics.length];
  const numeral = plateNumeral(topic);
  const [previousPlate, nextPlate] = [topics[currentIndex - 1], topics[currentIndex + 1]];
  const chapters = chapterCount(topic);
  const extent = `${documents.length > 1 ? `${documents.length} parts · ` : ''}${chapters} ${chapters === 1 ? 'chapter' : 'chapters'}`;
  const firstChapter = documents[0].headings.find(heading => heading.level === 2)?.text ?? '';
  // At either end of the canonical order there is no neighbour; say which end this is.
  const turnCard = (plate: RenderedTopic | undefined, direction: 'previous' | 'next') => plate
    ? `<a class="turn-card turn-${direction}" href="../${plate.id}/index.html" data-plate-${direction}>${portrait(plate, 'turn-portrait')}<span class="plate-tag">${direction === 'next' ? 'Next' : 'Previous'} topic · ${plateNumeral(plate)}</span><strong>${escape(plate.title)}</strong>${plate.illustrations?.species ? `<span class="plate-species">${speciesHTML(plate)}</span>` : ''}</a>`
    : `<span class="turn-card turn-end">${direction === 'next' ? 'This is the newest topic. No next one yet.' : 'This is the first topic. No previous one.'}</span>`;
  const runningHead = `<div class="running-head atlas-only" aria-hidden="true"><div class="running-inner"><span class="running-plate"><b>No. ${numeral}</b><span class="running-title"> · ${escape(topic.title)}</span></span><span class="running-chapter"><button type="button" tabindex="-1" data-chapter-step="-1">‹</button><em data-running-chapter>${escape(firstChapter)}</em><button type="button" tabindex="-1" data-chapter-step="1">›</button></span></div></div>`;
  const plateBar = `<nav class="plate-bar" aria-label="Quick navigation">${previousPlate ? `<a href="../${previousPlate.id}/index.html" data-bar-turn="previous"><span aria-hidden="true">‹</span> No. ${plateNumeral(previousPlate)}<span class="sr-only">, previous topic: ${escape(previousPlate.title)}</span></a>` : '<span></span>'}<button type="button" class="js-only" data-plate-contents>Contents</button>${nextPlate ? `<a class="plate-bar-next" href="../${nextPlate.id}/index.html" data-bar-turn="next">No. ${plateNumeral(nextPlate)}<span class="sr-only">, next topic: ${escape(nextPlate.title)}</span> <span aria-hidden="true">›</span></a>` : '<span></span>'}</nav>`;
  const margin = `<aside class="plate-margin atlas-only" aria-label="Topic notes"><div><span class="plate-tag">Topic ${numeral} of ${topics.length}</span>${topic.illustrations?.species ? `<p class="plate-species">${speciesHTML(topic)}</p>` : ''}</div><div><span class="plate-tag">Thesis</span><p>${escape(topic.thesis)}</p></div></aside>`;
  const plateEnd = `<div class="plate-end atlas-only">${atlasStamp(collection, topics, 'stamp-end')}<nav class="plate-turn" aria-label="Previous and next topics">${turnCard(previousPlate, 'previous')}${turnCard(nextPlate, 'next')}</nav></div>`;
  const outline = `<aside class="on-page" id="outline" tabindex="-1" aria-label="Section navigation"><details class="contents" open><summary>On this page</summary><div class="contents-inner"><span class="contents-label">On this page</span><div class="search-wrap js-only"><label class="sr-only" for="section-search">Find on this page</label><input id="section-search" type="search" placeholder="Find on this page…" autocomplete="off"><kbd aria-hidden="true">/</kbd></div><p class="search-status js-only" data-search-status aria-live="polite">Headings and text in this topic</p><nav aria-label="On this page">${documents.map(doc => articleOutline(doc, documents.length > 1)).join('')}</nav></div></details></aside>`;
  return `${runningHead}<div class="workspace"><aside class="collection-nav" aria-label="Collection navigation"><details class="collection-contents"><summary aria-label="The collection" title="Expand collection sidebar">${icons.sidebar}<span>The collection</span></summary><nav aria-label="Topics"><a class="nav-home" href="../../index.html">The collection</a>${topics.map(item => `<a class="nav-topic" href="../${item.id}/index.html" ${item.id === topic.id ? 'aria-current="page"' : ''}><span class="nav-number">${escape(item.number)}</span><span>${escape(item.title)}</span></a>`).join('')}<a class="nav-index" href="../../general-index/index.html">A–Z index</a></nav></details><div class="sidebar-resizer collection-resizer js-only" role="separator" aria-orientation="vertical" aria-label="Resize collection sidebar" aria-valuemin="160" aria-valuemax="360" tabindex="0"></div></aside>
  <main id="main" class="reading-layout">${outline}<div class="sidebar-resizer toc-resizer js-only" role="separator" aria-orientation="vertical" aria-label="Resize table of contents" aria-valuemin="140" aria-valuemax="320" tabindex="0"></div><div class="reading-main"><div class="sidebar-resizer reading-resizer js-only" role="separator" aria-orientation="vertical" aria-label="Resize reading column" aria-valuemin="520" aria-valuemax="1100" tabindex="0"></div><div class="breadcrumbs"><a href="../../index.html">The collection</a><span aria-hidden="true">/</span><span>${escape(topic.category)}</span></div><div class="frontis"><header class="topic-hero article-hero"><p class="plate-label atlas-only"><span>Topic ${numeral}</span><span>${escape(topic.category)}</span></p><h1 id="${documents[0].id}-title">${escape(topic.title)}</h1>${topic.illustrations?.species ? `<p class="plate-species atlas-only">${speciesHTML(topic)}</p>` : ''}<p class="lead">${escape(topic.description)}</p>${topicDates(topic, 'topic-dates')}<p class="plate-extent atlas-only">${extent}</p></header>
${topic.illustrations?.hero ? `<div class="plate-mount" data-plate="No. ${numeral}">${topic.illustrations.hero}</div>` : ''}</div>
${explorer ? `<details class="visual-guide"><summary>Explore the idea visually <span aria-hidden="true">↗</span></summary>${explorer}</details>` : ''}
  <article class="article article-presentation" id="text" tabindex="-1" aria-label="Complete topic text">${documents.map((doc, index) => `<section class="source-document" aria-labelledby="${doc.id}-title">${index === 0 ? '' : `<header class="document-heading"><p class="document-title" id="${doc.id}-title">${escape(doc.title)}</p></header>`}<div class="prose" data-source="${escape(doc.file)}">${doc.html}</div></section>`).join('')}${topic.illustrations?.thumbnail ? '<div class="tailpiece" aria-hidden="true" data-tailpiece></div>' : ''}<p class="share-end js-only"><button type="button" class="small-button" data-open-share aria-haspopup="dialog">${icons.share}Share this topic</button></p>
  ${next && next.id !== topic.id ? `<section class="next-topic folio-only">${next.illustrations?.thumbnail ? `<a class="next-topic-portrait" href="../${next.id}/index.html" tabindex="-1" aria-hidden="true">${portrait(next, 'next-portrait')}</a>` : ''}<span class="eyebrow">Next topic / ${escape(next.number)}</span><h2><a href="../${next.id}/index.html">${escape(next.title)}</a></h2><p>${escape(next.thesis)}</p></section>` : ''}</article>${margin}${plateEnd}</div>
  </main></div>${plateBar}`;
}

/** A generated, cross-topic index of authored chapters and subsections. Text is never rewritten. */
export function indexBody(topics: RenderedTopic[]) {
  const generic = new Set(['introduction', 'conclusion']);
  const entries = topics.flatMap(topic => topic.rendered.flatMap(doc => doc.headings
    .filter(heading => (heading.level === 2 || heading.level === 3) && !generic.has(heading.text.toLowerCase()))
    .map(heading => {
      // Leading numbers, phase labels and articles are not sorted on; they stay visible but quieter.
      const skip = /^(?:(?:\d+(?:\.\d+)*\.?|Phase \d+ —)\s*)?(?:(?:A|An|The)\s+(?=\S))?/i.exec(heading.text)![0];
      return { heading, topic, skip, key: heading.text.slice(skip.length) };
    })));
  entries.sort((a, b) => a.key.localeCompare(b.key, 'en', { sensitivity: 'base' }) || Number(a.topic.number) - Number(b.topic.number));
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const letter = /^[a-z]/i.test(entry.key) ? entry.key[0].toUpperCase() : '#';
    groups.set(letter, [...(groups.get(letter) ?? []), entry]);
  }
  const anchor = (letter: string) => `index-${letter === '#' ? 'symbols' : letter}`;
  return `<main id="main" class="index-page"><header class="index-head"><p class="eyebrow">The collection</p><h1>A–Z index</h1><p>Every chapter and subsection across ${topics.length} ${topics.length === 1 ? 'topic' : 'topics'}, sorted without leading numbers or articles. Each entry opens the authored heading in its topic.</p><nav class="index-letters" aria-label="Index letters">${[...groups.keys()].map(letter => `<a href="#${anchor(letter)}">${letter}</a>`).join('')}</nav></header>
  <div class="index-columns">${[...groups].map(([letter, items]) => `<section aria-labelledby="${anchor(letter)}"><h2 id="${anchor(letter)}">${letter}</h2><ul>${items.map(({ heading, topic, skip }) => `<li class="index-entry${heading.level === 3 ? ' index-sub' : ''}"><a href="../topics/${topic.id}/index.html#${heading.id}"><span class="index-text">${skip ? `<span class="index-skip">${escape(skip)}</span>` : ''}${escape(heading.text.slice(skip.length))}</span><span class="index-leader" aria-hidden="true"></span><span class="sr-only">, </span><span class="index-ref"><span class="atlas-only">No. ${plateNumeral(topic)}</span><span class="folio-only">${escape(topic.number)}</span></span></a><span class="index-topic">${escape(topic.title)}</span></li>`).join('')}</ul></section>`).join('')}</div></main>`;
}

/**
 * About, Privacy, Licensing and the 404 page share one layout. Authored chapters form the
 * outline beside the text; links to the other site pages close the page. A missing page
 * (`missing`) leads back to the topics instead of offering an outline.
 */
export function pageBody(page: RenderedPage, sitePages: PageLink[], topics: RenderedTopic[], collection: Collection, prefix: string, missing = false) {
  const chapters = page.headings.filter(heading => heading.level === 2);
  const outline = chapters.length > 1 ? `<nav class="info-toc" aria-label="On this page"><ol>${chapters.map(heading => `<li><a href="#${heading.id}">${escape(heading.text)}</a></li>`).join('')}</ol></nav>` : '';
  const others = sitePages.filter(item => item.id !== page.id);
  const topicLinks = missing ? `<section class="info-topics" aria-labelledby="info-topics-title"><h2 id="info-topics-title" class="info-section-label">Browse the topics</h2><div class="info-topic-list">${topics.toReversed().map(topic => `<a class="info-topic" href="${prefix}topics/${topic.id}/index.html">${portrait(topic, 'info-topic-portrait')}<span class="info-topic-number">Topic ${plateNumeral(topic)}</span><strong>${escape(topic.title)}</strong>${topic.illustrations?.species ? `<span class="plate-species atlas-only">${speciesHTML(topic)}</span>` : ''}<span class="info-topic-category folio-only">${escape(topic.category)}</span></a>`).join('')}</div></section>` : '';
  const pageLinks = others.length ? `<nav class="info-pages" aria-labelledby="info-pages-title"><h2 id="info-pages-title" class="info-section-label">About this site</h2><div class="info-card-list">${others.map(item => `<a class="info-card" href="${prefix}${item.id}/index.html"><strong>${escape(item.title)}</strong><span>${escape(item.description)}</span></a>`).join('')}</div></nav>` : '';
  return `<main id="main" class="info-page${missing ? ' info-missing' : ''}">${atlasStamp(collection, topics, 'stamp-info')}<header class="info-head"><p class="info-label"><span>${escape(collection.title)}</span><span>${missing ? 'Error 404' : 'About this site'}</span></p>${missing ? '<p class="info-code" aria-hidden="true"><span>404</span></p>' : ''}<h1 id="page-title">${escape(page.title)}</h1>${outline}</header>
  <article class="info-body article-presentation" aria-labelledby="page-title"><div class="prose">${page.html}</div></article>${topicLinks}${pageLinks}</main>`;
}
