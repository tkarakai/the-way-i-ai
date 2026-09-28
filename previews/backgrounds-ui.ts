(() => {
  'use strict';
  type Study = { id: string; name: string; kind: string; note: string; detail: string; cue: string; engine: string };
  type RGB = [number, number, number];
  type Surface = { host: HTMLElement; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; width: number; height: number; ratio: number; visible: boolean; buffer: HTMLCanvasElement; pixels?: ImageData };
  const studies = JSON.parse(document.querySelector('#lab-studies')!.textContent!) as Study[];
  const root = document.documentElement;
  const dialog = document.querySelector<HTMLDialogElement>('.lab-viewer')!;
  const stage = document.querySelector<HTMLElement>('#lab-stage-effect')!;
  const stageViewport = document.querySelector<HTMLElement>('.lab-stage')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let dark = systemTheme.matches;
  let explicitTheme = false;
  let paused = reduced.matches;
  let selected = studies[0];
  let opener: HTMLButtonElement | null = null;
  let time = 12;
  let last = 0;
  let frame = 0;
  let dirty = true;
  const tau = Math.PI * 2;
  const rgb = (color: RGB, alpha = 1) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  const mix = (a: RGB, b: RGB, t: number): RGB => a.map((value, i) => Math.round(value + (b[i] - value) * t)) as RGB;
  const palette = (): [RGB, RGB, RGB] => dark ? [[100, 207, 211], [217, 163, 184], [223, 177, 131]] : [[20, 124, 134], [125, 70, 103], [166, 112, 50]];
  const surfaces: Surface[] = [...document.querySelectorAll<HTMLElement>('.lab-effect')].map(host => {
    const canvas = host.querySelector('canvas')!;
    const ctx = canvas.getContext('2d')!;
    return { host, canvas, ctx, width: 0, height: 0, ratio: 1, visible: false, buffer: document.createElement('canvas') };
  });
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { const surface = surfaces.find(item => item.host === entry.target)!; surface.visible = entry.isIntersecting; });
    dirty = true; wake();
  });
  const resizeObserver = new ResizeObserver(entries => {
    entries.forEach(entry => {
      const surface = surfaces.find(item => item.host === entry.target)!;
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      surface.width = width;
      surface.height = height;
      surface.ratio = Math.min(devicePixelRatio || 1, 1.5);
      surface.canvas.width = Math.round(width * surface.ratio);
      surface.canvas.height = Math.round(height * surface.ratio);
      // Paint one still for offscreen thumbnails too; only visible ones animate.
      paint(surface);
    });
    dirty = true; wake();
  });
  surfaces.forEach(surface => { observer.observe(surface.host); resizeObserver.observe(surface.host); });

  // B: two ruled surfaces. Their cross-sections twist, producing actual folds,
  // not a stack of identical sine waves translated by a few pixels.
  function silk(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
    const colors = palette();
    for (let band = 0; band < 2; band++) {
      for (let thread = 0; thread < 96; thread++) {
        const v = thread / 95 - .5;
        const color = mix(colors[band], colors[2], thread / 190);
        ctx.strokeStyle = rgb(color, .2 + .14 * Math.pow(Math.abs(v) * 2, 3));
        ctx.lineWidth = .8;
        ctx.beginPath();
        for (let step = 0; step <= 140; step++) {
          const u = step / 140;
          const twist = u * 7.3 + t * .16 + band * 2.4;
          const spread = 170 + 90 * Math.sin(u * 5 + t * .13 + band);
          const x = (u * 1.3 - .15) * w + v * spread * Math.sin(twist);
          const y = h * (.3 + band * .42) + Math.sin(u * 5.5 + t * .12 + band * 1.7) * h * .22
            + v * spread * Math.cos(twist) + Math.sin(u * 12 - t * .09) * v * 28;
          if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  // C: a low-resolution refractive field, smoothly upsampled. Rendering a small
  // buffer makes this practical on laptops without shaders or runtime libraries.
  function water(surface: Surface, w: number, h: number, t: number) {
    const bw = 420, bh = Math.max(140, Math.min(360, Math.round(bw * h / w)));
    if (surface.buffer.width !== bw || surface.buffer.height !== bh) {
      surface.buffer.width = bw; surface.buffer.height = bh;
      surface.pixels = new ImageData(bw, bh);
    }
    const image = surface.pixels!;
    const [teal, , gold] = palette();
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const u = x / bw * 7, v = y / bw * 7;
        const a = u + .42 * Math.sin(v * 2.1 + t * .22) + .22 * Math.sin(u * 1.5 - t * .13);
        const b = v + .38 * Math.cos(u * 1.7 - t * .17) + .24 * Math.sin(v * 1.2 + t * .16);
        const wave = Math.sin(a * 3.4) + Math.cos(b * 3.1) + .44 * Math.sin((a + b) * 2.2 + t * .09);
        const ridge = Math.exp(-Math.abs(wave) * 8);
        const glow = Math.exp(-Math.abs(wave) * 2.1);
        const tint = (Math.sin(a * .65 + b * .8 + t * .045) + 1) * .27;
        const offset = (y * bw + x) * 4;
        image.data[offset] = teal[0] + (gold[0] - teal[0]) * tint;
        image.data[offset + 1] = teal[1] + (gold[1] - teal[1]) * tint;
        image.data[offset + 2] = teal[2] + (gold[2] - teal[2]) * tint;
        image.data[offset + 3] = Math.round((.025 + .1 * glow + .43 * ridge) * 255);
      }
    }
    surface.buffer.getContext('2d')!.putImageData(image, 0, 0);
    surface.ctx.imageSmoothingEnabled = true;
    surface.ctx.drawImage(surface.buffer, 0, 0, w, h);
  }

  // D: an engraved torus, projected in perspective. Rotation reveals the hollow
  // center and changes the moiré naturally where near and far strands overlap.
  function orbital(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
    const [teal, , gold] = palette();
    const size = Math.min(w * .48, h * .66);
    const yaw = t * .095, tilt = .55 + Math.sin(t * .055) * .35;
    const point = (u: number, v: number) => {
      const r = .72 + .26 * Math.cos(v + u * 3);
      const x = r * Math.cos(u), y = r * Math.sin(u), z = .26 * Math.sin(v + u * 3);
      const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
      const rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
      const ry = y * Math.cos(tilt) - rz * Math.sin(tilt);
      const depth = y * Math.sin(tilt) + rz * Math.cos(tilt);
      const perspective = 1 / (1 + depth * .18);
      return { x: w * .52 + rx * size * perspective, y: h * .52 + ry * size * perspective, depth };
    };
    for (let strand = 0; strand < 42; strand++) {
      ctx.strokeStyle = rgb(mix(teal, gold, strand / 41), .33);
      ctx.lineWidth = .72;
      ctx.beginPath();
      for (let j = 0; j <= 220; j++) {
        const p = point(j / 220 * tau, strand / 42 * tau);
        if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    for (let bead = 0; bead < 4; bead++) {
      const p = point(t * .12 + bead * tau / 4, bead * 1.4);
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.1 + p.depth * .6, 0, tau);
      ctx.fillStyle = rgb(gold, .8); ctx.fill();
    }
  }

  // E: opaque, tonal layers with directional shadows. Unlike the other studies,
  // its motion is perceived through changing negative space rather than lines.
  function eclipse(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
    const paper: RGB = dark ? [36, 34, 31] : [248, 245, 238];
    const colors = palette();
    const unit = Math.min(w, h * 1.7);
    const discs = [
      { x: w * .21 + Math.sin(t * .08) * unit * .06, y: h * .24 + Math.cos(t * .07) * unit * .05, r: unit * .36 },
      { x: w * .71 + Math.cos(t * .085) * unit * .065, y: h * .68 + Math.sin(t * .06) * unit * .055, r: unit * .37 },
      { x: w * .48 + Math.sin(t * .065 + 2) * unit * .08, y: h * .32 + Math.cos(t * .075 + 1) * unit * .09, r: unit * .27 },
    ];
    discs.forEach((disc, i) => {
      ctx.save();
      ctx.shadowColor = dark ? 'rgba(0,0,0,.65)' : 'rgba(65,52,37,.23)';
      ctx.shadowBlur = 42; ctx.shadowOffsetX = -8; ctx.shadowOffsetY = 18;
      const tint = mix(paper, colors[i], dark ? .13 : .075);
      const gradient = ctx.createLinearGradient(disc.x - disc.r, disc.y - disc.r, disc.x + disc.r, disc.y + disc.r);
      gradient.addColorStop(0, rgb(mix(paper, dark ? [205, 216, 210] : [255, 255, 255], .06)));
      gradient.addColorStop(.55, rgb(paper)); gradient.addColorStop(1, rgb(tint));
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(disc.x, disc.y, disc.r, 0, tau); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = dark ? 'rgba(237,232,217,.14)' : 'rgba(255,255,255,.85)';
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(disc.x, disc.y, disc.r - 1, Math.PI, tau * .87); ctx.stroke();
      // Almost imperceptible concentric tooling marks on the cut surface.
      ctx.strokeStyle = rgb(colors[i], .075); ctx.lineWidth = .6;
      for (let j = 1; j <= 8; j++) {
        ctx.beginPath(); ctx.arc(disc.x, disc.y, disc.r - j * 4, .15, Math.PI * .95); ctx.stroke();
      }
      ctx.restore();
    });
  }

  function paint(surface: Surface) {
    if (!surface.width || !surface.height || surface.host.dataset.effect === 'A') return;
    const w = 1000, h = surface.height / surface.width * w;
    const scale = surface.canvas.width / w;
    const ctx = surface.ctx;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    switch (surface.host.dataset.effect) {
      case 'B': silk(ctx, w, h, time); break;
      case 'C': water(surface, w, h, time); break;
      case 'D': orbital(ctx, w, h, time); break;
      case 'E': eclipse(ctx, w, h, time); break;
      case 'F': window.drawMurmuration(ctx, w, h, time, dark); break;
    }
    surface.host.dataset.frame = time.toFixed(3);
  }
  function tick(now: number) {
    frame = 0;
    if (document.hidden) { last = 0; return; }
    if (last && now - last < 1000 / 30 && !dirty) { wake(); return; }
    if (!paused && last) time += Math.min((now - last) / 1000, .1);
    last = now;
    const modal = dialog.open;
    surfaces.forEach(surface => {
      if (surface.visible && (surface.host === stage ? modal : !modal)) paint(surface);
    });
    dirty = false;
    if (!paused) wake();
  }
  function wake() { if (!frame && !document.hidden) frame = requestAnimationFrame(tick); }
  function syncMotion() {
    document.body.classList.toggle('lab-paused', paused);
    document.body.classList.toggle('lab-playing', !paused);
    document.querySelectorAll<HTMLButtonElement>('[data-lab-pause]').forEach(button => {
      button.textContent = paused ? 'Play motion' : 'Pause motion';
      button.setAttribute('aria-pressed', String(paused));
    });
    document.querySelector('[data-motion-note]')!.textContent = reduced.matches
      ? 'Reduced motion detected. Use Play motion to preview intentionally.'
      : 'All effects run locally. No video, libraries or network.';
    last = 0; dirty = true; wake();
  }
  function setTheme(value: boolean) {
    dark = value; root.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll<HTMLButtonElement>('[data-lab-theme]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.labTheme === root.dataset.theme));
    });
    dirty = true; wake();
  }
  function choose(id: string) {
    selected = studies.find(study => study.id === id) ?? studies[0];
    stage.dataset.effect = selected.id;
    delete stage.dataset.frame;
    paint(surfaces.find(surface => surface.host === stage)!);
    document.querySelector('#lab-viewer-id')!.textContent = selected.id;
    document.querySelector('#lab-viewer-title')!.textContent = selected.name;
    document.querySelector('#lab-detail')!.textContent = selected.detail;
    document.querySelector('#lab-cue')!.textContent = selected.cue;
    document.querySelector('.lab-background-caption strong')!.textContent = selected.name;
    document.querySelectorAll<HTMLButtonElement>('[data-lab-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.labChoice === selected.id)));
    const url = new URL(location.href); url.hash = selected.id;
    try { history.replaceState(null, '', url); } catch { /* Sandboxed previews may restrict history. */ }
    dirty = true; wake();
  }
  document.querySelectorAll<HTMLButtonElement>('[data-open-study]').forEach(button => {
    button.addEventListener('click', () => {
      opener = button;
      dialog.showModal(); choose(button.dataset.openStudy!);
      document.querySelector<HTMLButtonElement>('[data-lab-close]')!.focus();
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-lab-choice]').forEach(button => button.addEventListener('click', () => choose(button.dataset.labChoice!)));
  document.querySelectorAll<HTMLButtonElement>('[data-lab-theme]').forEach(button => button.addEventListener('click', () => { explicitTheme = true; setTheme(button.dataset.labTheme === 'dark'); }));
  document.querySelectorAll('[data-lab-pause]').forEach(button => button.addEventListener('click', () => { paused = !paused; syncMotion(); }));
  document.querySelector('[data-lab-close]')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    try { history.replaceState(null, '', `${location.pathname}${location.search}`); } catch { /* file/sandbox fallback */ }
    opener?.focus({ preventScroll: true }); dirty = true; wake();
  });
  dialog.addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const index = studies.indexOf(selected);
    choose(studies[(index + (event.key === 'ArrowRight' ? 1 : studies.length - 1)) % studies.length].id);
  });
  document.querySelector('.lab-site')!.addEventListener('click', event => { if ((event.target as Element).closest('a')) event.preventDefault(); });
  document.querySelector<HTMLButtonElement>('[data-lab-content-toggle]')!.addEventListener('click', event => {
    const button = event.currentTarget as HTMLButtonElement;
    const content = document.querySelector<HTMLElement>('[data-lab-content]')!;
    content.hidden = !content.hidden;
    document.querySelector<HTMLElement>('.lab-background-caption')!.hidden = !content.hidden;
    button.textContent = content.hidden ? 'Show site content' : 'Background only';
    button.setAttribute('aria-pressed', String(content.hidden));
  });
  const strength = document.querySelector<HTMLInputElement>('#lab-strength')!;
  strength.addEventListener('input', () => {
    stageViewport.style.setProperty('--lab-effect-strength', String(Number(strength.value) / 100));
    document.querySelector('output[for="lab-strength"]')!.textContent = `${strength.value}%`;
  });
  reduced.addEventListener('change', () => { paused = reduced.matches; syncMotion(); });
  systemTheme.addEventListener('change', () => { if (!explicitTheme) setTheme(systemTheme.matches); });
  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('lab-paused', paused || document.hidden);
    last = 0;
    if (!document.hidden) { dirty = true; wake(); }
  });
  setTheme(dark); syncMotion();
  const initial = location.hash.slice(1).toUpperCase();
  if (studies.some(study => study.id === initial)) { dialog.showModal(); choose(initial); }
})();
