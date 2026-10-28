// Design switching and Field Atlas behavior: the paged spread, habitat filter,
// plates drawer, running head and plate navigation. Folio ignores all of it.
(() => {
  'use strict';
  const root = document.documentElement;
  const storageKey = 'the-way-i-ai-design';
  type Design = 'atlas' | 'folio';
  const design = (): Design => root.dataset.design === 'folio' ? 'folio' : 'atlas';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /* Design switch: same page and content, different presentation. */
  const choices = [...document.querySelectorAll<HTMLButtonElement>('[data-design-choice]')];
  const syncChoices = () => choices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.designChoice === design())));
  // Keep the reader's place: remember the heading nearest the top and restore its offset.
  const readingAnchor = () => {
    if (scrollY < 16) return undefined;
    const top = parseFloat(getComputedStyle(root).getPropertyValue('--header-height')) || 0;
    const candidates = [...document.querySelectorAll<HTMLElement>('main h1, main h2, main h3, .topic-card')].filter(element => element.offsetParent !== null);
    const element = candidates.find(candidate => candidate.getBoundingClientRect().bottom > top);
    return element ? { element, offset: element.getBoundingClientRect().top } : undefined;
  };
  const transitionPage = (window as Window & { transitionPage?: (update: () => void) => void }).transitionPage ?? ((update: () => void) => update());
  const applyDesign = (next: Design, persist: boolean) => {
    if (next === design()) return;
    const anchor = readingAnchor();
    const restore = () => { if (anchor) scrollBy({ top: anchor.element.getBoundingClientRect().top - anchor.offset, behavior: 'instant' }); };
    // A 200ms cross-fade between the designs. Layout changes inside it happen in one step:
    // column and header transitions would otherwise move the text after restoring the position.
    const swap = () => {
      root.classList.add('design-switching');
      root.dataset.design = next;
      if (persist) { try { localStorage.setItem(storageKey, next); } catch { /* The choice still applies to this page. */ } }
      syncChoices();
      document.dispatchEvent(new Event('design-change'));
      restore();
    };
    // The home page replays its arrival, as after a reload; other pages cross-fade.
    if (document.body.dataset.page === 'collection') { swap(); replayEntrance(); }
    else transitionPage(swap);
    // Fonts are preloaded, but a late font would reflow the page once more.
    document.fonts.ready.then(() => requestAnimationFrame(() => { restore(); root.classList.remove('design-switching'); }));
  };
  function replayEntrance() {
    if (reducedMotion.matches) return;
    document.querySelectorAll<HTMLElement>('.collection-intro, .hero-wordmark .logo-part, .hero-wordmark .title-art, .atlas-spread-wrap, .collection-list').forEach(section => {
      section.style.animation = 'none';
      void section.offsetWidth; // Restart the CSS entrance with its original delays.
      section.style.animation = '';
    });
  }
  // Decode the other design's fonts while idle, so switching never waits on them.
  const preloadFonts = () => ['DM Sans', 'Newsreader', 'Cormorant Garamond', 'Spectral', 'IBM Plex Mono']
    .forEach(family => { document.fonts.load(`16px "${family}"`).catch(() => undefined); document.fonts.load(`italic 16px "${family}"`).catch(() => undefined); });
  if ('requestIdleCallback' in window) requestIdleCallback(preloadFonts, { timeout: 2000 }); else setTimeout(preloadFonts, 800);
  syncChoices();
  choices.forEach(button => button.addEventListener('click', () => applyDesign(button.dataset.designChoice === 'folio' ? 'folio' : 'atlas', true)));
  addEventListener('storage', event => {
    if (event.key === storageKey && (event.newValue === 'atlas' || event.newValue === 'folio')) applyDesign(event.newValue, false);
  });

  /* Plates drawer: a native <details>, enhanced with Escape, outside clicks and focus handling. */
  const plates = document.querySelector<HTMLDetailsElement>('.plates-menu');
  if (plates) {
    const summary = plates.querySelector('summary')!;
    // Closing slides the drawer out before the <details> actually closes.
    const close = (restoreFocus = true) => {
      if (!plates.open || plates.classList.contains('is-closing')) return;
      if (restoreFocus) summary.focus({ preventScroll: true });
      if (reducedMotion.matches) { plates.open = false; return; }
      plates.classList.add('is-closing');
      const finish = () => { if (plates.classList.contains('is-closing')) { plates.classList.remove('is-closing'); plates.open = false; } };
      plates.querySelector('.plates-drawer')!.addEventListener('animationend', finish, { once: true });
      setTimeout(finish, 360);
    };
    summary.addEventListener('click', event => { if (plates.open) { event.preventDefault(); close(); } });
    plates.addEventListener('toggle', () => {
      document.body.classList.toggle('plates-open', plates.open);
      if (plates.open) (plates.querySelector<HTMLElement>('[aria-current="page"]') ?? plates.querySelector<HTMLElement>('.drawer-plate'))?.focus({ preventScroll: true });
    });
    plates.querySelector('[data-close-plates]')?.addEventListener('click', () => close());
    plates.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    // The backdrop is the open <details> itself, outside its panel and summary.
    plates.addEventListener('click', event => { if (event.target === plates) close(false); });
    document.addEventListener('design-change', () => { if (design() === 'folio') close(false); });
  }

  /* Home: the paged spread, newest plate first. Images are the cards' own images. */
  type Plate = { href: string; plate: string; title: string; habitat: string; thesis: string; latin?: string; common?: string; chapters: number; revised?: string };
  const spread = document.querySelector<HTMLElement>('[data-atlas-spread]');
  const plateData = document.getElementById('atlas-plates');
  if (spread && plateData) {
    const plates = JSON.parse(plateData.textContent ?? '[]') as Plate[];
    const status = document.querySelector<HTMLElement>('[data-spread-status]');
    const image = (plate: Plate) => {
      const card = [...document.querySelectorAll<HTMLAnchorElement>('.topic-card')].find(item => item.getAttribute('href') === plate.href);
      const source = card?.querySelector<HTMLImageElement>('.editorial-homepage');
      const copy = source?.cloneNode() as HTMLImageElement | undefined;
      copy?.removeAttribute('class');
      return copy;
    };
    const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    let current = 0;
    const render = (direction = 0) => {
      const plate = plates[current];
      spread.replaceChildren();
      spread.dataset.turn = direction > 0 ? 'next' : direction < 0 ? 'previous' : '';
      const verso = element('div', 'spread-verso');
      // The specimen opens its plate. The title link carries the accessible name, so this one is hidden from assistive technology.
      const plateLink = element('a', 'spread-plate-link');
      plateLink.href = plate.href;
      plateLink.tabIndex = -1;
      plateLink.setAttribute('aria-hidden', 'true');
      const mount = element('div', 'plate-mount');
      mount.dataset.plate = `No. ${plate.plate}`;
      const picture = image(plate);
      if (picture) mount.append(picture);
      plateLink.append(mount);
      // A gentle tilt that follows the pointer, as if lifting the plate towards the reader.
      plateLink.addEventListener('pointermove', event => {
        if (reducedMotion.matches || event.pointerType === 'touch') return;
        const box = plateLink.getBoundingClientRect();
        plateLink.style.setProperty('--tilt-x', `${(((event.clientX - box.left) / box.width) - .5) * 7}deg`);
        plateLink.style.setProperty('--tilt-y', `${(.5 - ((event.clientY - box.top) / box.height)) * 7}deg`);
      });
      plateLink.addEventListener('pointerleave', () => { plateLink.style.removeProperty('--tilt-x'); plateLink.style.removeProperty('--tilt-y'); });
      verso.append(plateLink);
      const recto = element('div', 'spread-recto');
      const heading = element('h3');
      const link = element('a', undefined, plate.title);
      link.href = plate.href;
      heading.append(link);
      const species = element('p', 'plate-species');
      if (plate.latin) {
        const latin = element('i', undefined, plate.latin);
        latin.lang = 'la';
        species.append(latin, plate.common ? ` · ${plate.common}` : '');
      }
      const facts = element('p', 'spread-facts', `${plate.chapters} chapters${plate.revised ? ` · Revised ${plate.revised}` : ''}`);
      const open = element('a', 'spread-open', `Open topic ${plate.plate} `);
      open.href = plate.href;
      open.append(Object.assign(element('span', undefined, '→'), { ariaHidden: 'true' }));
      recto.append(element('p', 'plate-label', `Topic ${plate.plate} · ${plate.habitat}`), heading);
      if (plate.latin) recto.append(species);
      recto.append(element('p', 'spread-thesis', plate.thesis), facts, open);
      const pager = element('div', 'spread-pager');
      const arrow = (step: number, label: string, glyph: string) => {
        const button = element('button', 'spread-arrow', glyph);
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.disabled = current + step < 0 || current + step >= plates.length;
        button.addEventListener('click', () => turn(step));
        return button;
      };
      const film = element('div', 'spread-film');
      plates.forEach((item, index) => {
        const button = element('button');
        button.type = 'button';
        button.setAttribute('aria-label', `Topic ${item.plate}, ${item.title}`);
        button.setAttribute('aria-current', String(index === current));
        const thumbnail = image(item);
        if (thumbnail) button.append(thumbnail);
        button.append(element('span', undefined, item.plate));
        button.addEventListener('click', () => { if (index !== current) { const step = index - current; current = index; render(step); } });
        film.append(button);
      });
      pager.append(arrow(-1, 'Newer topic', '‹'), film, element('span', 'spread-folio', `${current + 1} of ${plates.length}`), arrow(1, 'Older topic', '›'));
      spread.append(verso, recto, pager);
      if (direction && status) status.textContent = `Topic ${plate.plate}, ${plate.title}`;
      // Centre the current thumbnail by scrolling the strip only, never the page.
      const selected = film.querySelector<HTMLElement>('[aria-current="true"]');
      if (selected) film.scrollTo({ left: selected.offsetLeft - film.offsetLeft - (film.clientWidth - selected.offsetWidth) / 2, behavior: 'instant' });
    };
    const turn = (step: number) => {
      const next = current + step;
      if (next < 0 || next >= plates.length) return;
      current = next;
      render(step);
    };
    spread.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); turn(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); turn(-1); }
    });
    let touchX: number | undefined;
    spread.addEventListener('touchstart', event => { touchX = event.touches[0].clientX; }, { passive: true });
    spread.addEventListener('touchend', event => {
      if (touchX === undefined) return;
      const distance = event.changedTouches[0].clientX - touchX;
      if (Math.abs(distance) > 50) turn(distance < 0 ? 1 : -1);
      touchX = undefined;
    });
    if (plates.length) render();
  }

  /* Home: filter the plate list by habitat (the topic category). */
  const filterButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-habitat]')].filter(button => button.matches('button'));
  const cards = [...document.querySelectorAll<HTMLElement>('.topic-card[data-habitat]')];
  const filter = (habitat: string) => {
    document.querySelector('.topic-grid')?.classList.add('is-filtering');
    filterButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.habitat === habitat)));
    cards.forEach(card => { card.hidden = Boolean(habitat) && card.dataset.habitat !== habitat; });
  };
  filterButtons.forEach(button => button.addEventListener('click', () => filter(button.dataset.habitat ?? '')));
  document.addEventListener('design-change', () => { if (design() === 'folio') filter(''); });

  /* Plate pages: running head, margin note, chapter stepping and plate turning. */
  const runningHead = document.querySelector<HTMLElement>('.running-head');
  const hero = document.querySelector<HTMLElement>('.topic-hero');
  if (runningHead && hero) {
    const chapterLabel = runningHead.querySelector<HTMLElement>('[data-running-chapter]')!;
    const marginLabel = document.querySelector<HTMLElement>('[data-plate-current]');
    const chapterLinks = [...document.querySelectorAll<HTMLAnchorElement>('.toc-chapter > .toc-link')];
    const activeChapter = () => {
      const link = document.querySelector<HTMLAnchorElement>('.toc-link[aria-current="location"]');
      return link?.closest('.toc-chapter')?.querySelector<HTMLAnchorElement>(':scope > .toc-link') ?? undefined;
    };
    let queued = false;
    const update = () => {
      queued = false;
      if (design() !== 'atlas') return;
      const headerHeight = parseFloat(getComputedStyle(root).getPropertyValue('--header-height')) || 0;
      runningHead.classList.toggle('is-on', hero.getBoundingClientRect().bottom < headerHeight);
      const chapter = activeChapter();
      const current = document.querySelector<HTMLAnchorElement>('.toc-link[aria-current="location"]');
      if (chapter) chapterLabel.textContent = chapter.textContent;
      if (current && marginLabel) marginLabel.textContent = current.textContent;
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    document.addEventListener('design-change', queue);
    queue();
    runningHead.querySelectorAll<HTMLButtonElement>('[data-chapter-step]').forEach(button => button.addEventListener('click', () => {
      const chapter = activeChapter();
      const index = chapter ? chapterLinks.indexOf(chapter) : -1;
      chapterLinks[Math.max(0, Math.min(chapterLinks.length - 1, index + Number(button.dataset.chapterStep)))]?.click();
    }));
  }
  document.addEventListener('keydown', event => {
    if (design() !== 'atlas' || event.metaKey || event.ctrlKey || event.altKey || (event.target instanceof Element && event.target.closest('input,textarea,[contenteditable],dialog'))) return;
    const link = document.querySelector<HTMLAnchorElement>(event.key === '[' ? '[data-plate-previous]' : event.key === ']' ? '[data-plate-next]' : ':not(*)');
    if (link) { event.preventDefault(); location.href = link.href; }
  });
  document.querySelector('[data-plate-contents]')?.addEventListener('click', () => {
    const contents = document.querySelector<HTMLDetailsElement>('.contents');
    if (!contents) return;
    contents.open = true;
    contents.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    contents.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
  });
})();
