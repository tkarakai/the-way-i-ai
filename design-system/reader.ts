(() => {
  'use strict';
  const root = document.documentElement;
  const storagePrefix = 'the-way-i-ai-';
  const readPreference = (key: string) => { try { return localStorage.getItem(storagePrefix + key); } catch { return null; } };
  const writePreference = (key: string, value: string) => { try { localStorage.setItem(storagePrefix + key, value); } catch { /* Preferences remain available for this page. */ } };
  // Set by the head script from the device setting or the reader's own choice.
  const reducedMotion = { get matches() { return document.documentElement.dataset.motion === 'reduce'; } };
  // Cross-fade whole-page changes (theme, design) where View Transitions are available.
  const transitionPage = (update: () => void) => {
    const start = (document as Document & { startViewTransition?: (callback: () => void) => unknown }).startViewTransition;
    if (start && !reducedMotion.matches && !document.hidden) start.call(document, update);
    else update();
  };
  (window as Window & { transitionPage?: typeof transitionPage }).transitionPage = transitionPage;
  /*
   * Safari's default Tab order (macOS “Keyboard navigation” off) skips links, buttons, disclosures and checkboxes,
   * reaching only text fields. An explicit tabindex brings them back, so every control is reachable with Tab in every
   * browser. Controls that set their own tabindex (-1 for roving focus or mouse-only duplicates) keep it, and controls
   * added later, such as search results and copy buttons, are included as they appear.
   */
  const tabbable = 'a[href], button, summary, input:not([type="hidden"]), select, textarea';
  const keepTabbable = (scope: ParentNode) => scope.querySelectorAll<HTMLElement>(tabbable).forEach(control => { if (!control.hasAttribute('tabindex')) control.tabIndex = 0; });
  keepTabbable(document);
  // Links count once they have an address, which some (the share targets) get only after load.
  const include = (node: Node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.matches(tabbable) && !node.hasAttribute('tabindex')) node.tabIndex = 0;
    keepTabbable(node);
  };
  new MutationObserver(records => records.forEach(record => { if (record.type === 'attributes') include(record.target); else record.addedNodes.forEach(include); }))
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  /**
   * Dates read as how long ago, to the month (“8 months ago”, “last month”); the exact date appears on hover,
   * and on a tap outside links. This runs in the browser, so generated HTML never depends on the build date;
   * without JavaScript the exact date shows. Screen readers always get the exact date.
   */
  const age = (iso: string, now = new Date()) => {
    const [year, month, day] = iso.split('-').map(Number);
    let months = (now.getFullYear() - year) * 12 + now.getMonth() + 1 - month;
    if (now.getDate() < day) months -= 1;
    if (months <= 0) return now.getFullYear() === year && now.getMonth() + 1 === month ? 'this month' : 'last month';
    if (months < 12) return months === 1 ? 'a month ago' : `${months} months ago`;
    const years = Math.floor(months / 12), rest = months % 12;
    return `${years === 1 ? 'a year' : `${years} years`}${rest ? ` and ${rest === 1 ? 'a month' : `${rest} months`}` : ''} ago`;
  };
  const ageDates = (scope: ParentNode = document) => scope.querySelectorAll<HTMLTimeElement>('time[data-age]:not(.has-age)').forEach(time => {
    if (!/^\d{4}-\d{2}-\d{2}/.test(time.dateTime)) return;
    const exact = document.createElement('span');
    exact.className = 'date-face date-exact';
    exact.textContent = time.textContent;
    const relative = document.createElement('span');
    relative.className = 'date-face date-relative';
    relative.ariaHidden = 'true';
    relative.textContent = age(time.dateTime.slice(0, 10));
    time.replaceChildren(relative, exact);
    time.classList.add('has-age');
    // A tap shows the exact date. Outside links a date is also a Tab stop, so keyboard readers can see it
    // on focus (WCAG 2.1.1); Escape hides it again. Inside links, focusing the link shows it.
    if (!time.closest('a')) {
      time.tabIndex = 0;
      time.addEventListener('click', () => time.classList.toggle('is-exact'));
      time.addEventListener('keydown', event => { if (event.key === 'Escape' && time.classList.contains('is-exact')) { event.stopPropagation(); time.classList.remove('is-exact'); } });
    }
  });
  (window as Window & { ageDates?: typeof ageDates }).ageDates = ageDates;
  ageDates();
  // Disclosures open and close by animating their height, so readers see where content goes.
  const animateDisclosure = (details: HTMLDetailsElement, enabled: () => boolean = () => true) => {
    const summary = details.querySelector<HTMLElement>(':scope > summary');
    if (!summary) return;
    let running: Animation | undefined;
    summary.addEventListener('click', event => {
      if (reducedMotion.matches || !enabled() || getComputedStyle(summary).display === 'none') return;
      event.preventDefault();
      running?.cancel();
      const style = getComputedStyle(details);
      const closedHeight = summary.offsetHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      const startHeight = details.offsetHeight;
      const closing = details.open;
      if (!closing) details.open = true;
      const endHeight = closing ? closedHeight : details.offsetHeight;
      details.style.overflow = 'hidden';
      running = details.animate({ height: [`${startHeight}px`, `${endHeight}px`] }, { duration: 260, easing: 'cubic-bezier(.2, .7, .2, 1)' });
      running.onfinish = () => {
        if (closing) details.open = false;
        details.style.overflow = '';
        running = undefined;
      };
    });
  };
  document.querySelectorAll<HTMLDetailsElement>('.visual-guide').forEach(details => animateDisclosure(details));
  // Rotating phrases: each slides up and out as the next slides up into its place, in order, looping.
  // Each phrase stays 3s; hovering pauses. The window eases to each phrase's width, and a phrase
  // too long for the rest of its line shrinks its font to fit, so the line never wraps. If the longest
  // phrase would drop below 60% there, the phrases move to a line of their own (stable for all phrases).
  document.querySelectorAll<HTMLElement>('.rotator-window').forEach(frame => {
    const items = [...frame.querySelectorAll<HTMLElement>('.rotator-item')];
    if (items.length < 2) return;
    let index = 0, paused = false, timer: ReturnType<typeof setTimeout> | undefined;
    const measure = document.createElement('canvas').getContext('2d')!;
    const holder = frame.closest<HTMLElement>('p, h2') ?? frame.parentElement!;
    const rotator = frame.closest<HTMLElement>('.rotator') ?? frame;
    // The full stop notices the new phrase a beat late, swells, then hurries after its new end,
    // overshooting a little and squashing as it lands, like a cartoon character catching up.
    const tail = rotator.nextElementSibling?.matches('.rotator-tail') ? rotator.nextElementSibling as HTMLElement : undefined;
    let chaseFrame = 0;
    const chase = (from: number) => {
      if (!tail) return;
      cancelAnimationFrame(chaseFrame);
      tail.style.transform = '';
      const start = performance.now(), target = frame.getBoundingClientRect().left + parseFloat(frame.style.width);
      const notice = 120, travel = 420, land = 160;
      const overshoot = (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;
      const tick = (now: number) => {
        const t = now - start, p = Math.min(1, Math.max(0, (t - notice) / travel));
        const x = from + (target - from) * overshoot(p) - frame.getBoundingClientRect().right;
        let scaleX = 1, scaleY = 1;
        if (t < notice) scaleX = scaleY = 1 + .45 * t / notice;
        else if (p < 1) scaleX = scaleY = 1.45 - .45 * p;
        else { const q = Math.min(1, (t - notice - travel) / land); scaleX = 1 + .25 * Math.sin(Math.PI * q); scaleY = 1 - .2 * Math.sin(Math.PI * q); }
        tail.style.transform = `translateX(${x}px) scale(${scaleX}, ${scaleY})`;
        if (t < notice + travel + land) chaseFrame = requestAnimationFrame(tick);
        else tail.style.transform = '';
      };
      chaseFrame = requestAnimationFrame(tick);
    };
    const fit = () => {
      const style = getComputedStyle(holder);
      measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const textWidth = (text: string) => measure.measureText(text).width + 1;
      const natural = textWidth(items[index].textContent ?? '');
      const longest = Math.max(...items.map(item => textWidth(item.textContent ?? '')));
      // Punctuation right after the phrase must fit on the line too.
      const trailing = textWidth(/^\S*/.exec(rotator.nextSibling?.textContent ?? '')?.[0] ?? '');
      const end = holder.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
      // Measure where the phrase starts with no width of its own, so it cannot have wrapped.
      const width = frame.style.width;
      frame.style.transition = 'none';
      const room = () => { frame.style.width = '0px'; return end - frame.getBoundingClientRect().left - trailing; };
      rotator.classList.remove('own-line');
      let available = room();
      if (available / longest < .6) { rotator.classList.add('own-line'); available = room(); }
      frame.style.width = width;
      void frame.offsetWidth;
      frame.style.transition = '';
      const scale = Math.min(1, available / natural);
      frame.style.fontSize = scale < 1 ? `${scale}em` : '';
      frame.style.width = `${natural * scale}px`;
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(step, 3000); };
    function step() {
      if (paused || document.hidden || reducedMotion.matches) { schedule(); return; }
      const leaving = items[index];
      const from = tail?.getBoundingClientRect().left ?? 0;
      index = (index + 1) % items.length;
      leaving.classList.replace('is-current', 'is-leaving');
      items[index].classList.add('is-current');
      fit();
      chase(from);
      setTimeout(() => leaving.classList.remove('is-leaving'), 500);
      schedule();
    }
    holder.addEventListener('pointerenter', () => { paused = true; });
    holder.addEventListener('pointerleave', () => { paused = false; });
    holder.addEventListener('focusin', () => { paused = true; });
    holder.addEventListener('focusout', () => { paused = false; });
    document.fonts.ready.then(fit);
    addEventListener('resize', fit);
    document.addEventListener('design-change', () => requestAnimationFrame(fit));
    schedule();
  });
  const themeToggle = document.querySelector<HTMLButtonElement>('.theme-toggle')!;
  const oppositeTheme = () => root.dataset.theme === 'dark' ? 'light' : 'dark';
  const syncTheme = () => {
    const action = `Switch to ${oppositeTheme()} theme`;
    const current = root.dataset.themePreference === 'system' ? `System (${root.dataset.theme})` : root.dataset.theme;
    themeToggle.setAttribute('aria-label', action);
    themeToggle.title = `${action} (T). Current: ${current}. Resets to System after 2 hours of inactivity.`;
  };
  syncTheme();
  document.addEventListener('theme-change', syncTheme);
  themeToggle.addEventListener('click', () => transitionPage(() => {
    root.dataset.themePreference = oppositeTheme();
    document.dispatchEvent(new Event('theme-preference-change'));
  }));
  // Do not make keyboard users wait for the homepage's delayed entrance.
  const collectionPage = document.querySelector('.collection-page');
  collectionPage?.addEventListener('focusin', () => {
    collectionPage.getAnimations({ subtree: true }).forEach(animation => {
      if (animation instanceof CSSAnimation && animation.animationName === 'collection-enter') animation.finish();
    });
  });
  let printDetails: HTMLDetailsElement[] = [];
  addEventListener('beforeprint', () => {
    printDetails = [...document.querySelectorAll<HTMLDetailsElement>('.visual-guide:not([open])')];
    printDetails.forEach(details => { details.open = true; });
  });
  addEventListener('afterprint', () => { printDetails.forEach(details => { details.open = false; }); });

  const searchDialog = document.querySelector<HTMLDialogElement>('.search-dialog')!;
  const collectionInput = document.querySelector<HTMLInputElement>('#collection-search')!;
  const searchTrigger = document.querySelector<HTMLButtonElement>('[data-open-search]')!;
  let searchReturnFocus: HTMLElement = searchTrigger;
  const closeSearch = () => {
    if (!searchDialog.open || searchDialog.classList.contains('is-closing')) return;
    const close = () => {
      searchDialog.close();
      // Explicitly restore a useful target even when the dialog was opened with
      // a shortcut while <body> held focus. Do not leave focus in its hidden input.
      (searchReturnFocus.isConnected ? searchReturnFocus : searchTrigger).focus({ preventScroll: true });
    };
    if (reducedMotion.matches) { close(); return; }
    // Play the closing animation, then close; a stale timer cannot close a reopened dialog.
    searchDialog.classList.add('is-closing');
    const finish = () => { if (searchDialog.classList.contains('is-closing')) { searchDialog.classList.remove('is-closing'); close(); } };
    searchDialog.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 260);
  };
  const results = searchDialog.querySelector<HTMLElement>('.search-results')!;
  const resultStatus = searchDialog.querySelector<HTMLElement>('.search-result-status')!;
  type SearchEntry = { title: string; topic: string; href: string; text: string };
  // One shared index file for every page, fetched the first time search opens. Its links start at the site root.
  type SearchableEntry = SearchEntry & { searchable: string; heading: string };
  let searchableEntries: SearchableEntry[] | undefined;
  let searchIndex: Promise<void> | undefined;
  let searchFailed = false;
  const loadSearchIndex = () => searchIndex ??= fetch(collectionInput.dataset.searchIndex!)
    .then(response => { if (!response.ok) throw new Error(String(response.status)); return response.json() as Promise<SearchEntry[]>; })
    .then(index => {
      const root = collectionInput.dataset.searchRoot ?? '';
      searchableEntries = index.map(entry => ({ ...entry, href: root + entry.href, searchable: `${entry.title} ${entry.topic} ${entry.text}`.toLocaleLowerCase(), heading: entry.title.toLocaleLowerCase() }));
    })
    // A failed load is retried the next time search opens.
    .catch(() => { searchFailed = true; searchIndex = undefined; })
    .then(() => { if (searchDialog.open) showResults(); });
  const termsOf = (value: string) => value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const appendHighlightedText = (element: HTMLElement, text: string, terms: string[]) => {
    if (!terms.length) { element.textContent = text; return; }
    const pattern = new RegExp(`(${[...terms].sort((a, b) => b.length - a.length).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    for (const part of text.split(pattern)) {
      if (!part) continue;
      if (terms.some(term => part.toLocaleLowerCase() === term)) {
        const mark = document.createElement('mark'); mark.className = 'search-hit'; mark.textContent = part; element.append(mark);
      } else element.append(document.createTextNode(part));
    }
  };
  const resultHref = (href: string, query: string) => {
    if (!query) return href;
    const hashAt = href.indexOf('#');
    const path = hashAt < 0 ? href : href.slice(0, hashAt);
    const hash = hashAt < 0 ? '' : href.slice(hashAt);
    return `${path}${path.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}${hash}`;
  };
  const showResults = () => {
    if (!searchableEntries) {
      results.replaceChildren();
      resultStatus.textContent = searchFailed ? 'Search could not load. Check your connection and try again.' : 'Loading search…';
      return;
    }
    const terms = termsOf(collectionInput.value);
    const matches = terms.length ? searchableEntries.filter(entry => terms.every(term => entry.searchable.includes(term))) : searchableEntries.filter(entry => !entry.href.includes('#'));
    matches.sort((a, b) => Number(terms.every(term => b.heading.includes(term))) - Number(terms.every(term => a.heading.includes(term))));
    resultStatus.textContent = terms.length ? `${matches.length} matching result${matches.length === 1 ? '' : 's'}${matches.length > 30 ? ' · showing the first 30' : ''}` : 'Choose a topic or search the full text.';
    results.replaceChildren();
    matches.slice(0, 30).forEach(entry => {
      const link = document.createElement('a'); link.className = 'search-result'; link.href = resultHref(entry.href, collectionInput.value.trim());
      const label = document.createElement('small'); appendHighlightedText(label, entry.topic, terms);
      const title = document.createElement('strong'); appendHighlightedText(title, entry.title, terms);
      const excerpt = document.createElement('p');
      const start = terms.length ? Math.max(0, entry.text.toLocaleLowerCase().indexOf(terms[0]) - 45) : 0;
      appendHighlightedText(excerpt, `${start ? '…' : ''}${entry.text.slice(start, start + 170)}${entry.text.length > start + 170 ? '…' : ''}`, terms);
      link.append(label, title, excerpt); results.append(link);
      link.addEventListener('click', closeSearch);
    });
    if (!matches.length) { const empty = document.createElement('p'); empty.textContent = 'No matches. Try a different search.'; results.append(empty); }
  };
  const openSearch = () => {
    searchReturnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : searchTrigger;
    searchDialog.classList.remove('is-closing');
    searchFailed = false; void loadSearchIndex();
    showResults(); if (!searchDialog.open) searchDialog.showModal(); collectionInput.focus();
  };
  searchTrigger.addEventListener('click', openSearch);
  // Start loading when the reader reaches for search, so results are usually ready on open.
  ['pointerenter', 'focus'].forEach(type => searchTrigger.addEventListener(type, () => void loadSearchIndex(), { once: true }));
  document.querySelector('[data-close-search]')!.addEventListener('click', closeSearch);
  searchDialog.addEventListener('click', event => {
    const rect = searchDialog.getBoundingClientRect();
    if (event.target === searchDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeSearch();
  });
  searchDialog.addEventListener('keydown', event => {
    // Search inputs may consume Escape to clear text before the native dialog does.
    if (event.key === 'Escape') { event.preventDefault(); closeSearch(); }
  });
  collectionInput.addEventListener('input', showResults);
  collectionInput.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector<HTMLAnchorElement>('a')?.focus(); }
    if (event.key === 'Enter') { event.preventDefault(); results.querySelector<HTMLAnchorElement>('a')?.click(); }
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault(); if (searchDialog.open) closeSearch(); else openSearch();
    }
  });
  /** Modal dialogs that scale in and out, close on Escape or a backdrop click, and return focus where it was. */
  const modal = (dialog: HTMLDialogElement) => {
    let returnFocus: Element | null = null;
    const open = () => {
      if (dialog.open) return;
      returnFocus = document.activeElement;
      dialog.showModal();
    };
    const close = () => {
      if (!dialog.open || dialog.classList.contains('is-closing')) return;
      const finish = () => {
        dialog.classList.remove('is-closing');
        dialog.close();
        if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
      };
      if (reducedMotion.matches) { finish(); return; }
      dialog.classList.add('is-closing');
      dialog.addEventListener('animationend', finish, { once: true });
    };
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    // A click on the backdrop lands on the dialog itself, outside its box.
    dialog.addEventListener('click', event => {
      const box = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) close();
    });
    dialog.querySelector('[data-close-dialog]')?.addEventListener('click', close);
    return { open, close };
  };
  /*
   * Single-key shortcuts can be turned off in the Settings panel (WCAG 2.1.4), for speech input and
   * anyone who presses keys by accident. Modifier shortcuts (⌘/Ctrl K) and keys inside a focused control stay.
   */
  const shortcutsKey = 'shortcuts';
  const syncShortcuts = () => {
    if (readPreference(shortcutsKey) === 'off') root.dataset.shortcuts = 'off';
    else delete root.dataset.shortcuts;
  };
  syncShortcuts();
  addEventListener('storage', event => { if (event.key === storagePrefix + shortcutsKey || event.key === null) syncShortcuts(); });
  /** Dialogs, the topic drawer and the logo-trick menu take the keyboard while open. */
  const overlayOpen = () => Boolean(document.querySelector('dialog[open], .plates-menu[open], .logo-picker'));
  const typing = (event: KeyboardEvent) => root.dataset.shortcuts === 'off' || event.metaKey || event.ctrlKey || event.altKey || (event.target instanceof Element && Boolean(event.target.closest('input,textarea,select,[contenteditable],.logo-picker')));

  // Keyboard shortcuts: “?” (or the footer button) opens a short list of the keys this page understands.
  const shortcutsDialog = document.querySelector<HTMLDialogElement>('.shortcuts-dialog');
  if (shortcutsDialog) {
    const shortcuts = modal(shortcutsDialog);
    document.querySelectorAll('[data-open-shortcuts]').forEach(button => button.addEventListener('click', shortcuts.open));
    const motionSwitch = shortcutsDialog.querySelector<HTMLInputElement>('[data-preference="motion"]');
    const shortcutSwitch = shortcutsDialog.querySelector<HTMLInputElement>('[data-preference="shortcuts"]');
    const deviceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreferences = () => {
      if (motionSwitch) {
        motionSwitch.checked = !reducedMotion.matches;
        // The device setting cannot be overridden from here; say so instead of offering a switch that does nothing.
        motionSwitch.disabled = deviceMotion.matches;
        shortcutsDialog.querySelector<HTMLElement>('[data-motion-device]')!.hidden = !deviceMotion.matches;
      }
      if (shortcutSwitch) shortcutSwitch.checked = root.dataset.shortcuts !== 'off';
    };
    syncPreferences();
    document.addEventListener('motion-change', syncPreferences);
    deviceMotion.addEventListener('change', syncPreferences);
    addEventListener('storage', syncPreferences);
    shortcutsDialog.addEventListener('toggle', syncPreferences);
    motionSwitch?.addEventListener('change', () => {
      const choice = motionSwitch.checked ? 'full' : 'reduce';
      root.dataset.motionChoice = choice;
      try { if (choice === 'reduce') localStorage.setItem(storagePrefix + 'motion', choice); else localStorage.removeItem(storagePrefix + 'motion'); } catch { /* This page keeps the choice. */ }
      document.dispatchEvent(new Event('motion-preference-change'));
    });
    shortcutSwitch?.addEventListener('change', () => {
      try { if (shortcutSwitch.checked) localStorage.removeItem(storagePrefix + shortcutsKey); else localStorage.setItem(storagePrefix + shortcutsKey, 'off'); } catch { /* This page keeps the choice. */ }
      if (shortcutSwitch.checked) delete root.dataset.shortcuts; else root.dataset.shortcuts = 'off';
    });
    document.addEventListener('keydown', event => {
      if (event.key !== '?' || typing(event) || searchDialog.open || shareDialog?.open || document.querySelector('.plates-menu[open], .logo-picker')) return;
      event.preventDefault();
      if (shortcutsDialog.open) shortcuts.close(); else shortcuts.open();
    });
  }

  // Sharing: the page's own Open Graph card, its canonical link to copy, the device's share sheet where there is one,
  // and plain links to email and social sites (nothing loads from them until the reader follows one).
  // Publication builds include the card image; builds without sharing JPEGs fall back to the published copy.
  const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[property="${name}"], meta[name="${name}"]`)?.content ?? '';
  const shareDialog = document.querySelector<HTMLDialogElement>('.share-dialog');
  if (shareDialog) {
    const share = modal(shareDialog);
    const url = meta('og:url') || location.href;
    const title = meta('og:title') || document.title;
    const description = meta('og:description');
    const image = meta('og:image');
    const card = shareDialog.querySelector<HTMLElement>('[data-share-card]')!;
    card.querySelector('.sharing-site')!.textContent = new URL(url).hostname;
    card.querySelector('.sharing-title')!.textContent = title;
    card.querySelector('.sharing-description')!.textContent = description;
    const picture = card.querySelector('img')!;
    if (image) {
      const base = image.slice(0, image.indexOf('assets/sharing/'));
      const local = '../'.repeat(url.slice(base.length).split('/').length - 1) + image.slice(base.length);
      picture.alt = meta('og:image:alt');
      picture.addEventListener('error', () => { if (picture.getAttribute('src') !== image) picture.src = image; else card.classList.add('no-image'); });
      // The image loads only when the dialog first opens.
      shareDialog.addEventListener('share-open', () => { if (!picture.getAttribute('src')) picture.src = local; });
    } else card.classList.add('no-image');
    const field = shareDialog.querySelector<HTMLInputElement>('#share-url')!;
    field.value = url;
    field.addEventListener('focus', () => field.select());
    const encoded = encodeURIComponent(url);
    const targets: Record<string, string> = {
      email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${description}\n\n${url}`)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
      bluesky: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${url}`)}`,
      x: `https://x.com/intent/post?url=${encoded}&text=${encodeURIComponent(title)}`,
    };
    shareDialog.querySelectorAll<HTMLAnchorElement>('[data-share-target]').forEach(link => { link.href = targets[link.dataset.shareTarget!]; });
    const copy = shareDialog.querySelector<HTMLButtonElement>('[data-copy-link]')!;
    const copyLabel = copy.querySelector<HTMLElement>('.share-label')!;
    let copiedTimer: ReturnType<typeof setTimeout>;
    const copyStatus = shareDialog.querySelector<HTMLElement>('[data-copy-status]')!;
    copy.addEventListener('click', async () => {
      let copied = true;
      // Where the clipboard is unavailable, the link field appears, selected, so it can still be copied by hand.
      try { await navigator.clipboard.writeText(url); } catch { field.parentElement!.hidden = false; field.focus(); field.select(); copied = document.execCommand('copy'); }
      copyLabel.textContent = copied ? 'Copied ✓' : 'Copy failed';
      copy.classList.toggle('is-copied', copied);
      speak(copyStatus, copied ? 'Link copied' : 'Copy failed. The link is selected; copy it with your keyboard.');
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => { copyLabel.textContent = 'Copy link'; copy.classList.remove('is-copied'); }, 2000);
    });
    const native = shareDialog.querySelector<HTMLButtonElement>('[data-share-native]')!;
    if (typeof navigator.share === 'function') {
      native.hidden = false;
      native.addEventListener('click', () => { navigator.share({ title, text: description, url }).catch(() => {}); });
    }
    // ← → Home End move between the tiles, as well as Tab.
    const tiles = shareDialog.querySelector<HTMLElement>('.share-targets')!;
    tiles.addEventListener('keydown', event => {
      const visible = [...tiles.querySelectorAll<HTMLElement>('.share-tile:not([hidden])')];
      const index = visible.indexOf(document.activeElement as HTMLElement);
      const next = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: visible.length - 1 }[event.key];
      if (next === undefined || index < 0) return;
      event.preventDefault();
      visible[(next + visible.length) % visible.length].focus();
    });
    document.querySelectorAll('[data-open-share]').forEach(button => button.addEventListener('click', () => { shareDialog.dispatchEvent(new Event('share-open')); share.open(); }));
  }
  // A tailpiece closes the topic with its own animal, reusing the topic list's thumbnail rather than embedding it twice.
  const tailpiece = document.querySelector<HTMLElement>('[data-tailpiece]');
  const ownPortrait = document.querySelector<HTMLImageElement>('.drawer-plate[aria-current="page"] img');
  if (tailpiece && ownPortrait) {
    const image = document.createElement('img');
    image.src = ownPortrait.src; image.alt = ''; image.decoding = 'async';
    tailpiece.append(image);
  }
  const focusButton = document.querySelector<HTMLButtonElement>('[data-focus]');
  const setFocusMode = (focused: boolean, animate = true, persist = true) => {
    if (!focusButton || document.body.classList.contains('focus-mode') === focused) return;
    focusButton.getAnimations().forEach(animation => animation.cancel());
    const before = focusButton.getBoundingClientRect();
    document.body.classList.toggle('focus-mode', focused);
    focusButton.setAttribute('aria-pressed', String(focused));
    // The name stays the same and aria-pressed says whether it is on; only the tooltip describes the next step.
    focusButton.title = focused ? 'Show navigation (F or Esc)' : 'Focus on reading (F)';
    const after = focusButton.getBoundingClientRect();
    if (animate && !reducedMotion.matches) {
      focusButton.animate([
        { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)` },
        { transform: 'translate(0, 0)' }
      ], { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    }
    if (persist) writePreference('focus-mode', String(focused));
    dispatchEvent(new Event('resize'));
  };
  if (focusButton && readPreference('focus-mode') === 'true') setFocusMode(true, false, false);
  focusButton?.addEventListener('click', () => setFocusMode(!document.body.classList.contains('focus-mode')));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !document.body.classList.contains('focus-mode') || !focusButton || overlayOpen()) return;
    event.preventDefault();
    setFocusMode(false);
    focusButton.focus({ preventScroll: true });
  });
  /*
   * Keyboard model, listed by “?”, the same in both designs. None of these act while typing or with a dialog open.
   * Move: J/K go to the next or previous item on any page (topics on the home page, chapters, letters, sections),
   *   moving real focus so Enter, Tab and screen readers follow. Home/End jump to the first or last topic.
   * Open: Enter opens the selected topic (it is a focused link, or the focused spread).
   * Go: G then H home, I A–Z index, T all topics, A About; [ and ] previous or next topic.
   * Change: T theme, D design, V the Atlas home view, F focus mode, S share, C copies a link to the current section.
   */
  const page = document.body.dataset.page ?? '';
  // Keys that need navigation (find on page, all topics, the outline skip link) leave focus mode first;
  // keys that work without it (chapters, topics, search, share, theme, design) keep it.
  const showNavigation = () => { if (document.body.classList.contains('focus-mode')) setFocusMode(false); };
  document.querySelectorAll<HTMLAnchorElement>('.skip-link').forEach(link => { if (link.hash === '#outline') link.addEventListener('click', showNavigation); });
  const smooth = (): ScrollBehavior => reducedMotion.matches ? 'instant' : 'smooth';
  const chapterLinks = [...document.querySelectorAll<HTMLAnchorElement>('.toc-chapter > .toc-link')];
  const currentLink = () => document.querySelector<HTMLAnchorElement>('.toc-link[aria-current="location"]');
  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* Fall back below. */ }
    const active = document.activeElement;
    const field = document.createElement('textarea');
    field.value = text;
    field.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    if (active instanceof HTMLElement) active.focus({ preventScroll: true });
    return copied;
  };
  // Topic pages step through authored chapters; the A–Z index through letters; site pages through their sections.
  const sectionHeadings = chapterLinks.length
    ? chapterLinks.map(link => document.getElementById(decodeURIComponent(link.hash.slice(1)))).filter((heading): heading is HTMLElement => Boolean(heading))
    : [...document.querySelectorAll<HTMLElement>('.index-columns h2, .info-body .prose h2')];
  // A press during a jump's smooth scroll counts from where that jump is heading, not from the scroll position.
  let lastJump = { index: -1, at: -Infinity };
  const moveSection = (step: 1 | -1) => {
    if (!sectionHeadings.length) return false;
    const offset = (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) + 8;
    let index = sectionHeadings.findLastIndex(heading => heading.getBoundingClientRect().top <= offset);
    if (performance.now() - lastJump.at < 900) index = lastJump.index;
    // Inside a section, K first returns to its start; at its start, to the previous one.
    else if (step < 0 && index >= 0 && sectionHeadings[index].getBoundingClientRect().top < offset - 16) index += 1;
    const target = Math.max(0, Math.min(sectionHeadings.length - 1, index + step));
    lastJump = { index: target, at: performance.now() };
    const heading = sectionHeadings[target];
    // Outline links also update the address and reveal the section; other pages scroll directly.
    const link = chapterLinks[target];
    if (link) link.click();
    else heading.scrollIntoView({ behavior: smooth(), block: 'start' });
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    return true;
  };
  // The home page steps through its topic list; the Field Atlas spread follows the selected topic.
  // In the Atlas Browse view the list is hidden, so the keys turn the spread instead.
  const spread = document.querySelector<HTMLElement>('[data-atlas-spread]');
  const topicCards = () => [...document.querySelectorAll<HTMLAnchorElement>('.topic-card')].filter(card => !card.hidden && card.offsetParent !== null);
  const selectTopic = (card: HTMLAnchorElement) => {
    card.focus({ preventScroll: true });
    card.scrollIntoView({ behavior: smooth(), block: 'center' });
    document.dispatchEvent(new CustomEvent('topic-select', { detail: card.getAttribute('href') }));
  };
  const moveTopic = (to: 1 | -1 | 'first' | 'last') => {
    const cards = topicCards();
    if (!cards.length && spread && spread.offsetParent !== null) {
      document.dispatchEvent(new CustomEvent('spread-step', { detail: to }));
      return true;
    }
    if (!cards.length) return false;
    const active = document.activeElement;
    let index = active instanceof Element ? cards.indexOf(active.closest<HTMLAnchorElement>('.topic-card')!) : -1;
    if (index < 0 && spread && spread.contains(active)) index = cards.findIndex(card => card.getAttribute('href') === spread.dataset.href);
    const target = to === 'first' ? 0 : to === 'last' ? cards.length - 1 : index < 0 ? 0 : Math.max(0, Math.min(cards.length - 1, index + to));
    selectTopic(cards[target]);
    return true;
  };
  const footerLink = (path: string) => document.querySelector<HTMLAnchorElement>(`.footer-links a[href$="${path}"]`)?.href;
  const homeHref = () => footerLink('general-index/index.html')?.replace(/general-index\/index\.html$/, 'index.html');
  const showAllTopics = () => {
    const drawer = document.querySelector<HTMLDetailsElement>('.plates-menu');
    if (drawer && drawer.offsetParent !== null) { drawer.open = true; return true; }
    const sidebar = document.querySelector<HTMLDetailsElement>('.collection-contents');
    if (sidebar && sidebar.offsetParent !== null) {
      sidebar.open = true;
      requestAnimationFrame(() => (sidebar.querySelector<HTMLElement>('[aria-current="page"]') ?? sidebar.querySelector<HTMLElement>('.nav-topic'))?.focus());
      return true;
    }
    if (page === 'collection') return moveTopic('first');
    const home = homeHref();
    if (home) location.href = `${home}#topics-heading`;
    return Boolean(home);
  };
  let pressedG = 0;
  document.addEventListener('keydown', event => {
    if (event.shiftKey || typing(event) || overlayOpen()) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const go = (href?: string) => { if (href) { event.preventDefault(); location.href = href; } };
    if (pressedG > 0 && performance.now() - pressedG < 1200 && ['h', 'i', 't', 'a'].includes(key)) {
      pressedG = 0;
      event.preventDefault();
      if (key === 'h') go(homeHref());
      else if (key === 'i') go(footerLink('general-index/index.html'));
      else if (key === 'a') go(footerLink('about/index.html'));
      else { showNavigation(); showAllTopics(); }
      return;
    }
    pressedG = key === 'g' ? performance.now() : 0;
    const onCard = document.activeElement instanceof Element && Boolean(document.activeElement.closest('.topic-card'));
    if (key === 'j' || key === 'k') {
      const step = key === 'j' ? 1 : -1;
      if (page === 'collection' ? moveTopic(step) : moveSection(step)) event.preventDefault();
    } else if ((key === 'Home' || key === 'End') && onCard) {
      event.preventDefault();
      moveTopic(key === 'Home' ? 'first' : 'last');
    } else if (key === '[' || key === ']') {
      go(document.querySelector<HTMLAnchorElement>(key === '[' ? '[data-plate-previous]' : '[data-plate-next]')?.href);
    } else if (key === 's') {
      const share = document.querySelector<HTMLElement>('[data-open-share]');
      if (share) { event.preventDefault(); share.click(); }
    } else if (key === 'c' && chapterLinks.length) {
      event.preventDefault();
      const link = currentLink();
      const address = meta('og:url') || location.href.split('#')[0];
      copyText(link ? address + link.hash : address).then(copied => announce(!copied ? 'Copy unavailable in this browser' : link ? `Link to “${link.textContent}” copied` : 'Link to this topic copied'));
    } else if (key === 't') {
      event.preventDefault();
      themeToggle.click();
    } else if (key === 'v' && page === 'collection' && document.querySelector('.view-switch')?.checkVisibility()) {
      event.preventDefault();
      document.dispatchEvent(new Event('home-view-toggle'));
    } else if (key === 'd') {
      const other = document.querySelector<HTMLButtonElement>('[data-design-choice][aria-pressed="false"]');
      if (other) { event.preventDefault(); other.click(); }
    }
  });
  // F turns focus mode on and off; Ctrl/⌘+F stays the browser's find.
  document.addEventListener('keydown', event => {
    if (event.key.toLowerCase() !== 'f' || event.shiftKey || !focusButton || typing(event) || overlayOpen()) return;
    event.preventDefault();
    setFocusMode(!document.body.classList.contains('focus-mode'));
  });

  // Declarative shadow DOM is static and requires no library at runtime.
  // This fallback supports browsers that do not parse it natively.
  document.querySelectorAll<HTMLTemplateElement>('template[shadowrootmode]').forEach(template => {
    if (!template.parentElement!.shadowRoot) template.parentElement!.attachShadow({ mode: 'open' }).append(template.content.cloneNode(true));
    template.remove();
  });

  /**
   * Status messages go to a live region that is always in the page: one that appears together with its text
   * is often not read. Emptying it first makes a repeated message read again.
   */
  function speak(region: HTMLElement, message: string) {
    region.textContent = '';
    setTimeout(() => { region.textContent = message; }, 60);
  }
  let toastTimer: ReturnType<typeof setTimeout>;
  const announce = (message: string) => {
    speak(document.querySelector<HTMLElement>('[data-announcer]')!, message);
    const toast = document.querySelector<HTMLElement>('.toast')!;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toast.classList.remove('is-leaving');
    toastTimer = setTimeout(() => {
      // Fade out before hiding; a new message cancels the exit.
      toast.classList.add('is-leaving');
      toastTimer = setTimeout(() => { toast.hidden = true; toast.classList.remove('is-leaving'); }, reducedMotion.matches ? 0 : 200);
    }, 2600);
  };
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(button => {
    button.addEventListener('click', async () => {
      const text = JSON.parse(document.getElementById(button.dataset.copy!)!.textContent!);
      const fallback = () => {
        const field = document.createElement('textarea');
        field.value = text;
        field.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.append(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        button.focus({ preventScroll: true });
        if (!copied) throw new Error('Copy unavailable');
      };
      try {
        if (navigator.clipboard?.writeText) {
          try { await navigator.clipboard.writeText(text); } catch { fallback(); }
        } else fallback();
        announce('Copied to clipboard');
      } catch { announce('Copy unavailable. Select and copy the example directly.'); }
    });
  });

  document.querySelectorAll('[data-explorer]').forEach(explorer => {
    const buttons = [...explorer.querySelectorAll<HTMLButtonElement>('[data-select]')];
    const select = (value: string) => {
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.select === value)));
      explorer.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== value; });
      explorer.querySelectorAll<SVGElement>('[data-node]').forEach(node => node.classList.toggle('is-active', node.dataset.node!.split(' ').includes(value)));
    };
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => select(button.dataset.select!));
      button.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        buttons[next].focus();
        select(buttons[next].dataset.select!);
      });
    });
    select(buttons[0].dataset.select!);
  });

  const article = document.querySelector('.article');
  if (!article) return;

  // Progressive enhancement: source headings stay intact, and each h2/h3 block
  // gets its own once-only entrance. Subsections are peers, not nested transforms.
  let revealSection = (_target: Element | null) => {};
  let revealAllSections = () => {};
  let revealVisibleSections = () => {};
  const proses = [...article.querySelectorAll<HTMLElement>('.prose')];
  if (proses.length) {
    const hero = document.querySelector<HTMLElement>('.article-hero');
    const finishHero = () => { if (hero) hero.dataset.reveal = 'shown'; };
    hero?.addEventListener('animationend', event => {
      if (event.target === hero && event.animationName === 'collection-enter') finishHero();
    });
    const groups: HTMLElement[] = [];
    for (const prose of proses) {
      let group: HTMLElement | undefined;
      for (const node of [...prose.childNodes]) {
        if (node instanceof HTMLElement && node.matches('h2,h3')) {
          group = document.createElement('section');
          group.className = 'article-reveal';
          prose.insertBefore(group, node);
          groups.push(group);
        }
        group?.append(node);
      }
    }
    const motion = reducedMotion;
    let observer: IntersectionObserver | undefined;
    const finish = (section: HTMLElement) => {
      section.dataset.reveal = 'shown';
      observer?.unobserve(section);
    };
    revealSection = target => {
      if (target?.closest('.article-hero')) finishHero();
      const section = target?.closest<HTMLElement>('.article-reveal');
      if (section) finish(section);
    };
    revealAllSections = () => { finishHero(); groups.forEach(finish); observer?.disconnect(); };
    revealVisibleSections = () => groups.forEach(section => {
      const box = section.getBoundingClientRect();
      if (box.top < innerHeight && box.bottom > 0) finish(section);
    });
    if (!motion.matches && typeof IntersectionObserver === 'function') {
      let initialObservation = true;
      const enter = (section: HTMLElement, startTime?: number) => {
        if (section.dataset.reveal !== 'pending') return;
        if (startTime !== undefined) section.dataset.entranceDelay = 'true';
        section.dataset.reveal = 'entering';
        if (startTime !== undefined) {
          const animation = section.getAnimations().find(item => item instanceof CSSAnimation && item.animationName === 'collection-enter');
          if (animation) animation.startTime = startTime;
        }
        observer!.unobserve(section);
      };
      observer = new IntersectionObserver(entries => {
        if (initialObservation) {
          initialObservation = false;
          if (!location.hash && scrollY < 16) {
            // Snapshot before starting any transforms, including the viewport's
            // bottom edge that the normal scroll observer deliberately defers.
            const visible = groups.filter(section => {
              const box = section.getBoundingClientRect();
              return box.top < innerHeight && box.bottom > 0;
            });
            const heroAnimation = hero?.getAnimations().find(item => item instanceof CSSAnimation && item.animationName === 'collection-enter');
            const startTime = typeof heroAnimation?.startTime === 'number' ? heroAnimation.startTime : Number(document.timeline.currentTime ?? performance.now());
            visible.forEach(section => enter(section, startTime));
          }
        }
        entries.forEach(entry => { if (entry.isIntersecting) enter(entry.target as HTMLElement); });
      }, { rootMargin: '0px 0px -48px 0px', threshold: 0 });
      groups.forEach(section => {
        section.dataset.reveal = 'pending';
        section.addEventListener('animationend', event => {
          if (event.target === section && event.animationName === 'collection-enter') finish(section);
        });
        observer!.observe(section);
      });
    } else revealAllSections();
    const revealHash = (hash: string) => {
      try { revealSection(document.getElementById(decodeURIComponent(hash.slice(1)))); } catch { /* Ignore malformed fragment identifiers. */ }
    };
    revealHash(location.hash);
    addEventListener('hashchange', () => revealHash(location.hash));
    document.addEventListener('focusin', event => { if (event.target instanceof Element) revealSection(event.target); });
    document.addEventListener('click', event => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (link && link.origin === location.origin && link.pathname === location.pathname && link.hash) revealHash(link.hash);
    }, true);
    document.addEventListener('keydown', event => {
      if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') || event.key === 'F3') revealAllSections();
    });
    document.addEventListener('motion-change', () => { if (motion.matches) revealAllSections(); });
    addEventListener('beforeprint', () => revealAllSections());
    addEventListener('pageshow', event => { if (event.persisted) revealVisibleSections(); });
  }
  const contents = document.querySelector<HTMLDetailsElement>('.contents')!;
  const mobile = matchMedia('(max-width: 980px)');
  animateDisclosure(contents, () => mobile.matches);
  // A soft fade shows that the outline continues beyond the sidebar's scrolling edges.
  const markOverflow = () => {
    contents.toggleAttribute('data-more-below', contents.scrollHeight - contents.clientHeight - contents.scrollTop > 2);
    contents.toggleAttribute('data-more-above', contents.scrollTop > 2);
  };
  contents.addEventListener('scroll', markOverflow, { passive: true });
  const outlineSize = new ResizeObserver(markOverflow);
  outlineSize.observe(contents);
  const outlineNav = contents.querySelector('nav');
  if (outlineNav) outlineSize.observe(outlineNav);
  // Below desktop width the collection sidebar is a disclosure too; on desktop its column animates instead.
  animateDisclosure(document.querySelector<HTMLDetailsElement>('.collection-contents')!, () => mobile.matches);
  const collectionContents = document.querySelector<HTMLDetailsElement>('.collection-contents')!;
  const collectionSummary = collectionContents.querySelector('summary')!;
  const collectionToggle = document.querySelector<HTMLButtonElement>('.collection-toggle');
  collectionContents.open = readPreference('collection-open') === 'true';
  const syncCollection = () => {
    collectionSummary.title = `${collectionContents.open ? 'Collapse' : 'Expand'} collection sidebar`;
    collectionToggle?.setAttribute('aria-expanded', String(collectionContents.open));
    if (collectionToggle) collectionToggle.title = `${collectionContents.open ? 'Hide' : 'Show'} the collection sidebar (G then T)`;
  };
  /* On desktop "The collection" is one label that moves: at the top of the outline it opens the sidebar, then it
     flies into the new sidebar and becomes its title (the native summary, which closes it), and flies back on closing.
     A fixed copy makes the flight, following its destination as the columns animate; focus moves with it. */
  let flightStart: DOMRect | undefined;
  const labelIcon = (element: Element | null) => element?.querySelector('svg')?.getBoundingClientRect();
  const fly = (start: DOMRect, target: () => DOMRect | undefined, opening: boolean) => {
    if (!collectionToggle || reducedMotion.matches || mobile.matches) return;
    const ghost = document.createElement('span');
    ghost.className = 'collection-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.append(...[...collectionToggle.childNodes].map(node => node.cloneNode(true)));
    document.body.append(ghost);
    shell.classList.add('collection-flying');
    const began = performance.now(), duration = 300;
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / duration), eased = 1 - (1 - progress) ** 3;
      const end = target() ?? start;
      ghost.style.translate = `${start.left + (end.left - start.left) * eased}px ${start.top + (end.top - start.top) * eased}px`;
      ghost.style.setProperty('--flip', String(opening ? 1 - 2 * eased : 2 * eased - 1));
      if (progress < 1) requestAnimationFrame(step);
      else { ghost.remove(); shell.classList.remove('collection-flying'); }
    };
    step(began);
    requestAnimationFrame(step);
  };
  collectionToggle?.addEventListener('click', () => {
    flightStart = labelIcon(collectionToggle);
    collectionContents.open = true;
    if (!mobile.matches) collectionSummary.focus({ preventScroll: true });
  });
  collectionSummary.addEventListener('click', () => { flightStart = collectionContents.open ? labelIcon(collectionSummary) : undefined; });
  syncCollection();
  collectionContents.addEventListener('toggle', () => {
    syncCollection();
    writePreference('collection-open', String(collectionContents.open));
    if (!collectionContents.open && document.activeElement === collectionSummary && !mobile.matches) collectionToggle?.focus({ preventScroll: true });
    if (flightStart) fly(flightStart, () => labelIcon(collectionContents.open ? collectionSummary : collectionToggle), collectionContents.open);
    flightStart = undefined;
  });
  const setContents = () => { contents.open = !mobile.matches; };
  setContents();
  mobile.addEventListener('change', setContents);

  const shell = document.querySelector<HTMLElement>('.site-shell')!;
  const readingLayout = document.querySelector<HTMLElement>('.reading-layout')!;
  const workspace = document.querySelector<HTMLElement>('.workspace')!;
  const readingMain = document.querySelector<HTMLElement>('.reading-main')!;
  const makeResizable = (handle: HTMLElement, target: HTMLElement, property: string, storageKey: string, min: number, max: number, origin: () => number, scale = 1) => {
    const value = () => Math.round(parseFloat(getComputedStyle(target).getPropertyValue(property)));
    const setValue = (next: number, persist = true) => {
      const bounded = Math.min(max, Math.max(min, Math.round(next)));
      target.style.setProperty(property, `${bounded}px`);
      handle.setAttribute('aria-valuenow', String(bounded));
      if (persist) writePreference(storageKey, String(bounded));
    };
    const stored = Number(readPreference(storageKey));
    if (Number.isFinite(stored) && stored >= min && stored <= max) setValue(stored, false);
    else handle.setAttribute('aria-valuenow', String(value()));
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || mobile.matches) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      document.body.classList.add('is-resizing');
      const move = (moveEvent: PointerEvent) => setValue((moveEvent.clientX - origin()) * scale);
      const stop = () => {
        document.body.classList.remove('is-resizing');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    });
    handle.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      setValue(value() + (event.key === 'ArrowRight' ? 10 : -10));
    });
  };
  makeResizable(document.querySelector<HTMLElement>('.collection-resizer')!, shell, '--collection-open-width', 'collection-width', 160, 360, () => workspace.getBoundingClientRect().left);
  makeResizable(document.querySelector<HTMLElement>('.toc-resizer')!, shell, '--toc-width', 'toc-width', 140, 320, () => readingLayout.getBoundingClientRect().left + (parseFloat(getComputedStyle(readingLayout).getPropertyValue('--outline-inset')) || 0) + 20);
  makeResizable(document.querySelector<HTMLElement>('.reading-resizer')!, shell, '--reading-width', 'reading-width', 520, 1100, () => {
    const box = readingMain.getBoundingClientRect();
    return box.left + box.width / 2;
  }, 2);

  const links = [...document.querySelectorAll<HTMLAnchorElement>('.toc-link')];
  const headings = links.map(link => document.getElementById(decodeURIComponent(link.hash.slice(1)))!);
  const search = document.querySelector<HTMLInputElement>('#section-search')!;
  const searchStatus = document.querySelector<HTMLElement>('[data-search-status]')!;
  // Read the actual rendered prose, including pre-rendered code in shadow roots.
  const textOf = (element: Element) => {
    const clone = element.cloneNode(true) as Element;
    clone.querySelectorAll('script,style,.code-toolbar').forEach(node => node.remove());
    let text = clone.textContent ?? '';
    element.querySelectorAll('script[type="application/json"]').forEach(script => { text += ' ' + JSON.parse(script.textContent!); });
    return text;
  };
  const searchable = headings.map(heading => {
    const group = heading.closest('.article-reveal');
    let text = group ? textOf(group) : heading.textContent ?? '';
    let sibling = (group ?? heading).nextElementSibling;
    while (sibling) {
      const nextHeading = sibling.matches('.article-reveal') ? sibling.querySelector('h2,h3') : sibling.matches('h2,h3,h4,h5,h6') ? sibling : null;
      if (nextHeading && Number(nextHeading.tagName.slice(1)) <= Number(heading.tagName.slice(1))) break;
      text += ' ' + textOf(sibling);
      sibling = sibling.nextElementSibling;
    }
    return text.toLocaleLowerCase();
  });
  const highlightRoots = [
    ...document.querySelectorAll<HTMLElement>('.topic-hero,.visual-guide,.article,.contents nav'),
    ...[...document.querySelectorAll('diffs-container')].flatMap(host => host.shadowRoot ? [host.shadowRoot] : [])
  ];
  const clearLocalHighlights = () => highlightRoots.forEach(highlightRoot => {
    highlightRoot.querySelectorAll('mark.search-hit').forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent ?? '')));
    highlightRoot.normalize();
  });
  const highlightLocal = (terms: string[]) => {
    clearLocalHighlights();
    if (!terms.length) return;
    highlightRoots.forEach(highlightRoot => {
      const walker = document.createTreeWalker(highlightRoot, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          return node.textContent?.trim() && parent && !parent.closest('script,style,textarea,input,button,kbd,mark,svg,[aria-hidden="true"]')
            ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      const textNodes: Text[] = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
      textNodes.forEach(node => {
        const holder = document.createElement('span');
        appendHighlightedText(holder, node.data, terms);
        if (holder.querySelector('mark')) node.replaceWith(...holder.childNodes);
      });
    });
  };
  search.addEventListener('input', () => {
    // Matching entries fade in as the outline filters.
    document.querySelector('.contents nav')?.classList.add('is-filtering');
    const words = termsOf(search.value);
    if (words.length) revealAllSections();
    let count = 0;
    links.forEach((link, index) => {
      const match = words.every(word => searchable[index].includes(word));
      const item = link.parentElement!;
      item.hidden = !match;
      item.classList.toggle('search-match', Boolean(words.length && match));
      if (match) count++;
    });
    document.querySelectorAll<HTMLElement>('.toc-document').forEach(group => { group.hidden = ![...group.querySelectorAll('li')].some(item => !item.hidden); });
    highlightLocal(words);
    searchStatus.textContent = words.length ? `${count} matching section${count === 1 ? '' : 's'}` : 'Headings and text in this topic';
    const url = new URL(location.href);
    if (search.value.trim()) url.searchParams.set('q', search.value.trim());
    else url.searchParams.delete('q');
    history.replaceState(history.state, '', url);
  });
  const transferredSearch = new URLSearchParams(location.search).get('q');
  if (transferredSearch) {
    contents.open = true;
    search.value = transferredSearch;
    search.dispatchEvent(new Event('input'));
  }
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !overlayOpen() && !typing(event)) {
      event.preventDefault(); showNavigation(); contents.open = true; search.focus();
    }
    // Escape first clears the find box, keeping focus there; a second Escape steps out to the outline
    // (never to nowhere), so the page's single-key shortcuts work again.
    if (event.key === 'Escape' && document.activeElement === search) {
      if (search.value) { search.value = ''; search.dispatchEvent(new Event('input')); }
      else document.querySelector<HTMLElement>('#outline')?.focus({ preventScroll: true });
    }
  });
  links.forEach(link => link.addEventListener('click', () => {
    if (mobile.matches) contents.open = false;
  }));
  let queued = false;
  const track = () => {
    queued = false;
    // Hysteresis exceeds the header's height delta, avoiding resize/scroll oscillation.
    // While a saved position is restored the header stays compact, whatever the browser scrolls through first.
    if (scrollY > 120) root.classList.add('is-scrolled');
    else if (scrollY < 16 && !root.classList.contains('restoring-position')) root.classList.remove('is-scrolled');
    let active = -1;
    headings.forEach((heading, index) => { if (heading.getBoundingClientRect().top < innerHeight * .35) active = index; });
    links.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  const scrollKey = `scroll-${document.body.dataset.page}`;
  const savedScroll = Number(readPreference(scrollKey));
  const restoreScroll = Number.isFinite(savedScroll) && savedScroll > 0 && !location.hash;
  let scrollReady = !restoreScroll;
  let scrollTimer: ReturnType<typeof setTimeout>;
  const saveScroll = () => { if (scrollReady) writePreference(scrollKey, String(Math.round(scrollY))); };
  if (restoreScroll) {
    history.scrollRestoration = 'manual';
    if (savedScroll > 120) root.classList.add('restoring-position', 'is-scrolled');
    document.fonts.ready.then(() => requestAnimationFrame(() => {
      scrollReady = true;
      scrollTo({ top: savedScroll, behavior: 'instant' });
      revealVisibleSections();
      track();
      requestAnimationFrame(() => root.classList.remove('restoring-position'));
    }));
  }
  addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(track); }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(saveScroll, 150);
  }, { passive: true });
  addEventListener('pagehide', saveScroll);
  addEventListener('resize', track);
  document.fonts.ready.then(track);
  track();
})();
