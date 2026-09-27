(() => {
  'use strict';
  const root = document.documentElement;
  const themeButton = document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!;
  const syncTheme = () => {
    const dark = root.dataset.theme === 'dark';
    themeButton.textContent = dark ? 'Light mode' : 'Dark mode';
    themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  };
  syncTheme();
  themeButton.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('the-way-i-ai-theme', root.dataset.theme); } catch { /* File/locked-down contexts may disallow storage. */ }
    syncTheme();
  });
  document.querySelector<HTMLButtonElement>('[data-print]')!.addEventListener('click', () => window.print());

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
  const mobile = matchMedia('(max-width: 760px)');
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
    if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !(event.target instanceof Element && event.target.closest('input,textarea,[contenteditable]'))) {
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
    const rect = article.getBoundingClientRect();
    const distance = Math.max(1, rect.height - innerHeight);
    const progress = Math.min(100, Math.max(0, Math.round(-rect.top / distance * 100)));
    document.querySelector<HTMLElement>('[data-progress]')!.style.width = `${progress}%`;
    document.querySelector<HTMLElement>('[data-progress-text]')!.textContent = `${progress}%`;
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
