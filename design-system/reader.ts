(() => {
  'use strict';
  const root = document.documentElement;
  const storagePrefix = 'the-way-i-ai-';
  const readPreference = (key: string) => { try { return localStorage.getItem(storagePrefix + key); } catch { return null; } };
  const writePreference = (key: string, value: string) => { try { localStorage.setItem(storagePrefix + key, value); } catch { /* Preferences remain available for this page. */ } };
  const themeToggle = document.querySelector<HTMLButtonElement>('.theme-toggle')!;
  const oppositeTheme = () => root.dataset.theme === 'dark' ? 'light' : 'dark';
  const syncTheme = () => {
    const action = `Switch to ${oppositeTheme()} theme`;
    const current = root.dataset.themePreference === 'system' ? `System (${root.dataset.theme})` : root.dataset.theme;
    themeToggle.setAttribute('aria-label', action);
    themeToggle.title = `${action}. Current: ${current}. Resets to System after 2 hours of inactivity.`;
  };
  syncTheme();
  document.addEventListener('theme-change', syncTheme);
  themeToggle.addEventListener('click', () => {
    root.dataset.themePreference = oppositeTheme();
    document.dispatchEvent(new Event('theme-preference-change'));
  });
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
  const results = searchDialog.querySelector<HTMLElement>('.search-results')!;
  const resultStatus = searchDialog.querySelector<HTMLElement>('.search-result-status')!;
  type SearchEntry = { title: string; topic: string; href: string; text: string };
  const index = JSON.parse(document.querySelector('#collection-search-data')!.textContent!) as SearchEntry[];
  const searchableEntries = index.map(entry => ({ ...entry, searchable: `${entry.title} ${entry.topic} ${entry.text}`.toLocaleLowerCase(), heading: entry.title.toLocaleLowerCase() }));
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
      link.addEventListener('click', () => searchDialog.close());
    });
    if (!matches.length) { const empty = document.createElement('p'); empty.textContent = 'No matches. Try a different search.'; results.append(empty); }
  };
  const openSearch = () => { showResults(); searchDialog.showModal(); collectionInput.focus(); };
  document.querySelector('[data-open-search]')!.addEventListener('click', openSearch);
  document.querySelector('[data-close-search]')!.addEventListener('click', () => searchDialog.close());
  searchDialog.addEventListener('click', event => {
    const rect = searchDialog.getBoundingClientRect();
    if (event.target === searchDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) searchDialog.close();
  });
  searchDialog.addEventListener('keydown', event => {
    // Search inputs may consume Escape to clear text before the native dialog does.
    if (event.key === 'Escape') { event.preventDefault(); searchDialog.close(); }
  });
  collectionInput.addEventListener('input', showResults);
  collectionInput.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector<HTMLAnchorElement>('a')?.focus(); }
    if (event.key === 'Enter') { event.preventDefault(); results.querySelector<HTMLAnchorElement>('a')?.click(); }
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault(); if (searchDialog.open) searchDialog.close(); else openSearch();
    }
  });
  const focusButton = document.querySelector<HTMLButtonElement>('[data-focus]');
  const setFocusMode = (focused: boolean, animate = true, persist = true) => {
    if (!focusButton || document.body.classList.contains('focus-mode') === focused) return;
    focusButton.getAnimations().forEach(animation => animation.cancel());
    const before = focusButton.getBoundingClientRect();
    document.body.classList.toggle('focus-mode', focused);
    focusButton.setAttribute('aria-pressed', String(focused));
    const label = focused ? 'Show navigation' : 'Focus on reading';
    focusButton.setAttribute('aria-label', label);
    focusButton.title = focused ? 'Show navigation (Esc)' : label;
    const after = focusButton.getBoundingClientRect();
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    if (event.key !== 'Escape' || !document.body.classList.contains('focus-mode') || !focusButton) return;
    event.preventDefault();
    setFocusMode(false);
    focusButton.focus({ preventScroll: true });
  });

  // Declarative shadow DOM is static and requires no library at runtime.
  // This fallback supports browsers that do not parse it natively.
  document.querySelectorAll<HTMLTemplateElement>('template[shadowrootmode]').forEach(template => {
    if (!template.parentElement!.shadowRoot) template.parentElement!.attachShadow({ mode: 'open' }).append(template.content.cloneNode(true));
    template.remove();
  });

  let toastTimer: ReturnType<typeof setTimeout>;
  const announce = (message: string) => {
    const toast = document.querySelector<HTMLElement>('.toast')!;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
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
  const contents = document.querySelector<HTMLDetailsElement>('.contents')!;
  const mobile = matchMedia('(max-width: 980px)');
  const collectionContents = document.querySelector<HTMLDetailsElement>('.collection-contents')!;
  const collectionSummary = collectionContents.querySelector('summary')!;
  collectionContents.open = readPreference('collection-open') === 'true';
  const syncCollection = () => {
    const label = `${collectionContents.open ? 'Collapse' : 'Expand'} collection sidebar`;
    collectionSummary.setAttribute('aria-label', label);
    collectionSummary.title = label;
  };
  syncCollection();
  collectionContents.addEventListener('toggle', () => {
    syncCollection();
    writePreference('collection-open', String(collectionContents.open));
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
  makeResizable(document.querySelector<HTMLElement>('.toc-resizer')!, shell, '--toc-width', 'toc-width', 140, 320, () => readingLayout.getBoundingClientRect().left);
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
    let text = heading.textContent ?? '';
    let sibling = heading.nextElementSibling;
    while (sibling && !(sibling.matches('h2,h3,h4,h5,h6') && Number(sibling.tagName.slice(1)) <= Number(heading.tagName.slice(1)))) {
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
    const words = termsOf(search.value);
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
    searchStatus.textContent = words.length ? `${count} matching section${count === 1 ? '' : 's'}` : 'Search headings and full text';
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
    if (event.key === '/' && !searchDialog.open && !event.metaKey && !event.ctrlKey && !event.altKey && !(event.target instanceof Element && event.target.closest('input,textarea,[contenteditable]'))) {
      event.preventDefault(); contents.open = true; search.focus();
    }
    if (event.key === 'Escape' && document.activeElement === search) {
      search.value = ''; search.dispatchEvent(new Event('input')); search.blur();
    }
  });
  links.forEach(link => link.addEventListener('click', () => {
    if (mobile.matches) contents.open = false;
  }));
  let queued = false;
  const track = () => {
    queued = false;
    // Hysteresis exceeds the header's height delta, avoiding resize/scroll oscillation.
    if (scrollY > 120) root.classList.add('is-scrolled');
    else if (scrollY < 16) root.classList.remove('is-scrolled');
    let active = -1;
    headings.forEach((heading, index) => { if (heading.getBoundingClientRect().top < innerHeight * .35) active = index; });
    // Keep the parent chapter active when its subsection is not shown in the index.
    while (active > 0 && links[active].parentElement!.dataset.subsection === 'true') active--;
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
