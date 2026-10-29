// Design switching and Field Atlas behavior: the home view switch, paged spread, habitat filter,
// plates drawer, running head and plate navigation. Folio ignores all of it.
(() => {
  'use strict';
  const root = document.documentElement;
  const storageKey = 'the-way-i-ai-design';
  type Design = 'atlas' | 'folio';
  const design = (): Design => root.dataset.design === 'folio' ? 'folio' : 'atlas';
  const reducedMotion = { get matches() { return document.documentElement.dataset.motion === 'reduce'; } };

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
  /** A gentle tilt that follows the pointer over `area`, as if lifting `plate` towards the reader (CSS reads --tilt-x/y). */
  const followPointer = (area: HTMLElement, plate: HTMLElement) => {
    area.addEventListener('pointermove', event => {
      if (reducedMotion.matches || event.pointerType === 'touch') return;
      const box = plate.getBoundingClientRect();
      const clamp = (value: number) => Math.max(-.5, Math.min(.5, value));
      area.style.setProperty('--tilt-x', `${clamp((event.clientX - box.left) / box.width - .5) * 7}deg`);
      area.style.setProperty('--tilt-y', `${clamp(.5 - (event.clientY - box.top) / box.height) * 7}deg`);
    });
    area.addEventListener('pointerleave', () => { area.style.removeProperty('--tilt-x'); area.style.removeProperty('--tilt-y'); });
  };
  const ageDates = (window as Window & { ageDates?: (scope: ParentNode) => void }).ageDates ?? (() => {});
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
      // Fonts are preloaded, but a late font would reflow the page once more. Scheduled from the swap itself:
      // a View Transition runs it asynchronously, and an earlier removal would leave transitions disabled.
      document.fonts.ready.then(() => requestAnimationFrame(() => { restore(); root.classList.remove('design-switching'); }));
    };
    // The home page replays its arrival, as after a reload; other pages cross-fade.
    if (document.body.dataset.page === 'collection') { swap(); replayEntrance(); }
    else transitionPage(swap);
  };
  function replayEntrance() {
    if (reducedMotion.matches) return;
    document.querySelectorAll<HTMLElement>('.collection-intro, .hero-wordmark .logo-part, .hero-wordmark .title-art, .collection-list').forEach(section => {
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

  /* Plates drawer: a native <details>, enhanced with Escape, outside clicks and focus handling.
     With JavaScript it is a modal dialog: everything outside it is inert while it is open (WCAG 2.4.3). */
  const plates = document.querySelector<HTMLDetailsElement>('.plates-menu');
  if (plates) {
    const summary = plates.querySelector('summary')!;
    const drawer = plates.querySelector<HTMLElement>('.plates-drawer')!;
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    let inerted: HTMLElement[] = [];
    const setModal = (modal: boolean) => {
      inerted.forEach(element => { element.inert = false; });
      inerted = [];
      if (!modal) return;
      for (let node: HTMLElement = plates; node.parentElement && node !== document.body; node = node.parentElement) {
        for (const sibling of node.parentElement.children) {
          if (sibling !== node && sibling instanceof HTMLElement && !sibling.inert && !(sibling instanceof HTMLScriptElement)) { sibling.inert = true; inerted.push(sibling); }
        }
      }
    };
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
      setModal(plates.open);
      if (plates.open) (plates.querySelector<HTMLElement>('[aria-current="page"]') ?? plates.querySelector<HTMLElement>('.drawer-plate'))?.focus({ preventScroll: true });
    });
    plates.querySelector('[data-close-plates]')?.addEventListener('click', () => close());
    plates.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    // The backdrop is the open <details> itself, outside its panel and summary.
    plates.addEventListener('click', event => { if (event.target === plates) close(false); });
    document.addEventListener('design-change', () => { if (design() === 'folio') close(false); });
  }

  /* Home: Browse shows the paged spread, List the cards. The choice persists; design.ts applies it before first paint. */
  const viewKey = 'the-way-i-ai-home-view';
  type View = 'browse' | 'list';
  const view = (): View => root.dataset.homeView === 'list' ? 'list' : 'browse';
  const viewChoices = [...document.querySelectorAll<HTMLButtonElement>('[data-home-view-choice]')];
  const syncViews = () => viewChoices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.homeViewChoice === view())));
  const applyView = (next: View, persist: boolean) => {
    if (next === view()) return;
    if (persist) { try { localStorage.setItem(viewKey, next); } catch { /* The choice still applies to this page. */ } }
    transitionPage(() => {
      if (next === 'list') root.dataset.homeView = 'list'; else delete root.dataset.homeView;
      syncViews();
    });
  };
  syncViews();
  viewChoices.forEach(button => button.addEventListener('click', () => applyView(button.dataset.homeViewChoice === 'list' ? 'list' : 'browse', true)));
  addEventListener('storage', event => { if (event.key === viewKey || event.key === null) applyView(event.newValue === 'list' ? 'list' : 'browse', false); });
  // V switches the view (reader.ts owns the keyboard model).
  document.addEventListener('home-view-toggle', () => { if (viewChoices.length && design() === 'atlas') applyView(view() === 'list' ? 'browse' : 'list', true); });

  /* Home: the paged spread, newest plate first, limited to the chosen category. Images are the cards' own images. */
  type Plate = { href: string; plate: string; title: string; habitat: string; thesis: string; latin?: string; common?: string; chapters: number; revised?: string; revisedOn?: string; card: HTMLAnchorElement };
  const spread = document.querySelector<HTMLElement>('[data-atlas-spread]');
  const plateData = document.getElementById('atlas-plates');
  if (spread && plateData) {
    // Each plate is tied to its topic card. The spread's links and images come from the card itself, never from the
    // embedded data, so it opens exactly what the list links to; the data's href only identifies the card.
    const cards = [...document.querySelectorAll<HTMLAnchorElement>('.topic-card')];
    const allPlates = (JSON.parse(plateData.textContent ?? '[]') as Omit<Plate, 'card'>[]).flatMap(data => {
      const card = cards.find(item => item.getAttribute('href') === data.href);
      return card ? [{ ...data, card }] : [];
    });
    let plates = allPlates;
    const address = (plate: Plate) => plate.card.getAttribute('href') ?? '';
    const status = document.querySelector<HTMLElement>('[data-spread-status]');
    const image = (plate: Plate) => {
      const source = plate.card.querySelector<HTMLImageElement>('.editorial-homepage');
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
      plateLink.href = address(plate);
      plateLink.tabIndex = -1;
      plateLink.setAttribute('aria-hidden', 'true');
      const mount = element('div', 'plate-mount');
      mount.dataset.plate = `No. ${plate.plate}`;
      const picture = image(plate);
      if (picture) mount.append(picture);
      plateLink.append(mount);
      followPointer(plateLink, plateLink);
      verso.append(plateLink);
      const recto = element('div', 'spread-recto');
      const heading = element('h3');
      const link = element('a', undefined, plate.title);
      link.href = address(plate);
      heading.append(link);
      const species = element('p', 'plate-species');
      if (plate.latin) {
        const latin = element('i', undefined, plate.latin);
        latin.lang = 'la';
        species.append(latin, plate.common ? ` · ${plate.common}` : '');
      }
      const facts = element('p', 'spread-facts', `${plate.chapters} chapters${plate.revised ? ' · Revised ' : ''}`);
      if (plate.revised && plate.revisedOn) {
        const revised = element('time', undefined, plate.revised);
        revised.dateTime = plate.revisedOn;
        revised.dataset.age = '';
        facts.append(revised);
        ageDates(facts);
      }
      const open = element('a', 'spread-open', `Open topic ${plate.plate} `);
      open.href = address(plate);
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
      // The spread is one Tab stop: arrows turn it, Enter opens its topic. Its links and buttons stay for pointers.
      spread.querySelectorAll<HTMLElement>('a, button').forEach(control => { control.tabIndex = -1; });
      spread.dataset.href = address(plate);
      // Announce only while the spread has focus; a topic chosen in the list is already read out there.
      if (direction && status && spread.contains(document.activeElement)) status.textContent = `Topic ${plate.plate}, ${plate.title}`;
      // Centre the current thumbnail by scrolling the strip only, never the page.
      const selected = film.querySelector<HTMLElement>('[aria-current="true"]');
      if (selected) film.scrollTo({ left: selected.offsetLeft - film.offsetLeft - (film.clientWidth - selected.offsetWidth) / 2, behavior: 'instant' });
    };
    const show = (index: number) => {
      if (index < 0 || index >= plates.length || index === current) return;
      const step = index - current;
      current = index;
      render(step);
    };
    const turn = (step: number) => show(current + step);
    // ← → (and Home/End) turn the spread while it has focus, or while nothing else does (focus on the page itself);
    // they never pull focus away from another control. Focus then rests on the spread, so Enter opens its topic.
    const keys: Record<string, () => number> = { ArrowRight: () => current + 1, ArrowLeft: () => current - 1, Home: () => 0, End: () => plates.length - 1 };
    document.addEventListener('keydown', event => {
      if (design() !== 'atlas' || spread.offsetParent === null || !keys[event.key] || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable],dialog,.logo-picker')) return;
      // Home/End belong to the spread only while it has focus; elsewhere they scroll the page.
      if ((event.key === 'Home' || event.key === 'End') && document.activeElement !== spread) return;
      if (document.activeElement !== spread && document.activeElement !== document.body && document.activeElement !== null) return;
      const box = spread.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) return;
      event.preventDefault();
      if (document.activeElement !== spread) spread.focus({ preventScroll: true });
      show(keys[event.key]());
    });
    spread.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.target !== spread) return;
      event.preventDefault();
      // Like a link: ⌘/Ctrl+Enter opens a new tab.
      if (event.metaKey || event.ctrlKey) open(address(plates[current]), '_blank', 'noopener');
      else location.href = address(plates[current]);
    });
    // A topic chosen in the list (J/K in reader.ts) turns the spread to the same topic.
    document.addEventListener('topic-select', event => {
      const href = (event as CustomEvent<string>).detail;
      show(plates.findIndex(plate => plate.href === href));
    });
    // In Browse, J/K (and Home/End after them) turn the spread itself and focus it, so Enter opens its topic.
    document.addEventListener('spread-step', event => {
      const to = (event as CustomEvent<number | 'first' | 'last'>).detail;
      spread.focus({ preventScroll: true });
      spread.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'nearest' });
      show(to === 'first' ? 0 : to === 'last' ? plates.length - 1 : current + to);
    });
    // A category keeps the current topic when it belongs there; otherwise the spread opens at the category's newest.
    document.addEventListener('habitat-change', event => {
      const habitat = (event as CustomEvent<string>).detail;
      const href = plates[current]?.href;
      plates = habitat ? allPlates.filter(plate => plate.habitat === habitat) : allPlates;
      current = Math.max(0, plates.findIndex(plate => plate.href === href));
      if (plates.length) render();
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
  const count = document.querySelector<HTMLElement>('[data-topic-count]');
  const filter = (habitat: string) => {
    document.querySelector('.topic-grid')?.classList.add('is-filtering');
    filterButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.habitat === habitat)));
    cards.forEach(card => { card.hidden = Boolean(habitat) && card.dataset.habitat !== habitat; });
    // The visible count is a status region, so screen readers hear how many topics match.
    const shown = cards.filter(card => !card.hidden).length;
    if (count) count.textContent = `${shown} ${shown === 1 ? 'topic' : 'topics'}`;
    document.dispatchEvent(new CustomEvent('habitat-change', { detail: habitat }));
  };
  filterButtons.forEach(button => button.addEventListener('click', () => filter(button.dataset.habitat ?? '')));
  document.addEventListener('design-change', () => { if (design() === 'folio') filter(''); });

  /* Plate pages: running head, chapter stepping and plate turning. */
  const runningHead = document.querySelector<HTMLElement>('.running-head');
  const hero = document.querySelector<HTMLElement>('.topic-hero');
  if (runningHead && hero) {
    const chapterLabel = runningHead.querySelector<HTMLElement>('[data-running-chapter]')!;
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
      if (chapter) chapterLabel.textContent = chapter.textContent;
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
  // The bottom bar shows the neighbouring animals, reusing the topic cards' thumbnails instead of embedding them again.
  document.querySelectorAll<HTMLAnchorElement>('[data-bar-turn]').forEach(link => {
    const source = document.querySelector<HTMLImageElement>(`[data-plate-${link.dataset.barTurn}] img`);
    if (!source) return;
    const thumb = document.createElement('img');
    thumb.className = 'bar-portrait'; thumb.src = source.src; thumb.alt = ''; thumb.decoding = 'async';
    if (link.dataset.barTurn === 'next') link.insertBefore(thumb, link.lastElementChild); else link.insertBefore(thumb, link.firstElementChild!.nextSibling);
  });
  document.querySelector('[data-plate-contents]')?.addEventListener('click', () => {
    const contents = document.querySelector<HTMLDetailsElement>('.contents');
    if (!contents) return;
    contents.open = true;
    contents.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    contents.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
  });
})();
