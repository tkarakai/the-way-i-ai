(() => {
  'use strict';
  const root = document.documentElement;
  const themePicker = document.querySelector<HTMLDetailsElement>('.theme-picker')!;
  const themeSummary = themePicker.querySelector('summary')!;
  const themeChoices = [...themePicker.querySelectorAll<HTMLButtonElement>('[data-theme-choice]')];
  const syncTheme = () => {
    const choice = root.dataset.themePreference ?? 'system';
    const label = choice[0].toUpperCase() + choice.slice(1);
    themeSummary.setAttribute('aria-label', `Color theme: ${label}. Choose a theme`);
    themeSummary.title = `Color theme: ${label}`;
    themeChoices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === choice)));
  };
  syncTheme();
  document.addEventListener('theme-change', syncTheme);
  themeChoices.forEach(button => button.addEventListener('click', () => {
    root.dataset.themePreference = button.dataset.themeChoice;
    document.dispatchEvent(new Event('theme-preference-change'));
    themePicker.open = false;
    themeSummary.focus();
  }));
  document.addEventListener('click', event => {
    if (event.target instanceof Node && !themePicker.contains(event.target)) themePicker.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && themePicker.open) { themePicker.open = false; themeSummary.focus(); }
  });
  document.querySelector<HTMLButtonElement>('[data-print]')?.addEventListener('click', () => window.print());
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
  const showResults = () => {
    const terms = collectionInput.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const matches = terms.length ? searchableEntries.filter(entry => terms.every(term => entry.searchable.includes(term))) : searchableEntries.filter(entry => !entry.href.includes('#'));
    matches.sort((a, b) => Number(terms.every(term => b.heading.includes(term))) - Number(terms.every(term => a.heading.includes(term))));
    resultStatus.textContent = terms.length ? `${matches.length} matching result${matches.length === 1 ? '' : 's'}${matches.length > 30 ? ' · showing the first 30' : ''}` : 'Choose a topic or search the full text.';
    results.replaceChildren();
    matches.slice(0, 30).forEach(entry => {
      const link = document.createElement('a'); link.className = 'search-result'; link.href = entry.href;
      const label = document.createElement('small'); label.textContent = entry.topic;
      const title = document.createElement('strong'); title.textContent = entry.title;
      const excerpt = document.createElement('p');
      const start = terms.length ? Math.max(0, entry.text.toLocaleLowerCase().indexOf(terms[0]) - 45) : 0;
      excerpt.textContent = `${start ? '…' : ''}${entry.text.slice(start, start + 170)}${entry.text.length > start + 170 ? '…' : ''}`;
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
  document.querySelector<HTMLButtonElement>('[data-focus]')?.addEventListener('click', event => {
    const button = event.currentTarget as HTMLButtonElement;
    const focused = document.body.classList.toggle('focus-mode');
    button.setAttribute('aria-pressed', String(focused));
    button.textContent = focused ? 'Show navigation' : 'Focus on reading';
    dispatchEvent(new Event('resize'));
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
  collectionContents.addEventListener('toggle', () => {
    const label = `${collectionContents.open ? 'Collapse' : 'Expand'} collection sidebar`;
    collectionSummary.setAttribute('aria-label', label);
    collectionSummary.title = label;
  });
  const setContents = () => { contents.open = !mobile.matches; };
  setContents();
  mobile.addEventListener('change', setContents);
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
  search.addEventListener('input', () => {
    const words = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    links.forEach((link, index) => {
      const match = words.every(word => searchable[index].includes(word));
      const item = link.parentElement!;
      item.hidden = !match;
      item.classList.toggle('search-match', Boolean(words.length && match));
      if (match) count++;
    });
    document.querySelectorAll<HTMLElement>('.toc-document').forEach(group => { group.hidden = ![...group.querySelectorAll('li')].some(item => !item.hidden); });
    searchStatus.textContent = words.length ? `${count} matching section${count === 1 ? '' : 's'}` : 'Search headings and full text';
  });
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
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(track); } }, { passive: true });
  addEventListener('resize', track);
  document.fonts.ready.then(track);
  track();
})();
