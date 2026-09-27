(() => {
  type Point = { x: number; y: number };
  const keys = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;
  type Corner = typeof keys[number];
  type Corners = Record<Corner, Point>;
  const stage = document.querySelector<HTMLElement>('.editor-stage')!;
  const logo = document.querySelector<HTMLElement>('.editor-logo')!;
  const art = logo.querySelector<HTMLElement>('.title-art')!;
  const guides = document.querySelector<HTMLElement>('.guides')!;
  const outline = guides.querySelector<SVGPolygonElement>('polygon')!;
  const origin = guides.querySelector<HTMLElement>('.title-origin')!;
  const fields = [...document.querySelectorAll<HTMLInputElement>('[data-point]')];
  const handles = [...document.querySelectorAll<HTMLButtonElement>('[data-corner]')];
  const config = document.querySelector<HTMLTextAreaElement>('#wave-config')!;
  const feedback = document.querySelector<HTMLElement>('#editor-feedback')!;
  const saveStatus = document.querySelector<HTMLElement>('#save-status')!;
  const preset = document.querySelector<HTMLSelectElement>('#wave-preset')!;
  const undo = document.querySelector<HTMLButtonElement>('#undo-wave')!;
  const storageKey = 'the-way-i-ai-wave-editor-v1';
  const scales: Record<string, number> = { A: .79, B: .755, C: .72, D: .685, current: .65, wide: .825 };
  const approved: Corners = JSON.parse(document.querySelector('#approved-wave')!.textContent!);
  let corners: Corners;
  const history: Corners[] = [];
  let drag: { key: Corner; id: number; x: number; y: number; point: Point; before: Corners; size: number } | undefined;
  const clone = (value: Corners): Corners => structuredClone(value);
  const size = () => parseFloat(getComputedStyle(logo).fontSize);
  const round = (value: number) => Math.round(value * 100000) / 100000;
  const report = (text: string) => { feedback.textContent = text; };

  function valid(value: unknown): value is Corners {
    if (!value || typeof value !== 'object') return false;
    const points = keys.map(key => (value as Corners)[key]);
    if (points.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 20 || Math.abs(point.y) > 20)) return false;
    // A convex, clockwise quadrilateral keeps the image continuous and prevents
    // a corner from crossing its neighbors or passing through the projective pole.
    return points.every((a, index) => {
      const b = points[(index + 1) % 4];
      const c = points[(index + 2) % 4];
      return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > .015;
    });
  }

  function initial(scale: number): Corners {
    const width = logo.getBoundingClientRect().width / size() + 1;
    const height = width / 2;
    const angle = -Math.PI / 30, cos = Math.cos(angle), sin = Math.sin(angle);
    const rotatedWidth = cos - sin / 2;
    const shift = .175 + (.65 - scale) * rotatedWidth / 2;
    const points = [[0, 0], [width, 0], [width, height], [0, height]];
    return Object.fromEntries(keys.map((key, index) => {
      const [x, y] = points[index];
      const rx = cos * (x - width / 2) - sin * (y - height / 2);
      const ry = sin * (x - width / 2) + cos * (y - height / 2);
      return [key, { x: round(-.45 + width / 2 + scale * rx + shift * width), y: round(-.42 + height / 2 + ry) }];
    })) as Corners;
  }

  function matrix(points: Corners, pixels: number): number[] {
    const [p0, p1, p2, p3] = keys.map(key => points[key]);
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
    const determinant = dx1 * dy2 - dx2 * dy1;
    const g = (dx3 * dy2 - dx2 * dy3) / determinant;
    const h = (dx1 * dy3 - dx3 * dy1) / determinant;
    const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x;
    const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y;
    // CSS matrix3d uses column-major order. A 1em-square image maps to the
    // four title-relative corners; translation and perspective scale with em.
    return [a, d, 0, g / pixels, b, e, 0, h / pixels, 0, 0, 1, 0, p0.x * pixels, p0.y * pixels, 0, 1];
  }

  function configuration() {
    return {
      version: 1,
      source: 'topics/assets/logo-bg.png',
      mapping: 'projective',
      units: 'em of the main title font size',
      origin: 'top-left of the two-line title layout box',
      cornerOrder: keys,
      corners: Object.fromEntries(keys.map(key => [key, { x: round(corners[key].x), y: round(corners[key].y) }])),
    };
  }

  function render() {
    if (!corners) return;
    const pixels = size(), box = stage.getBoundingClientRect(), title = logo.getBoundingClientRect();
    const ox = title.left - box.left, oy = title.top - box.top;
    art.style.transform = `matrix3d(${matrix(corners, pixels).join(',')})`;
    origin.style.left = `${ox}px`; origin.style.top = `${oy}px`;
    const locations = keys.map(key => ({ x: ox + corners[key].x * pixels, y: oy + corners[key].y * pixels }));
    outline.setAttribute('points', locations.map(point => `${point.x},${point.y}`).join(' '));
    handles.forEach((handle, index) => {
      handle.style.left = `${locations[index].x}px`;
      handle.style.top = `${locations[index].y}px`;
      const point = corners[keys[index]];
      handle.setAttribute('aria-description', `X ${round(point.x)}, Y ${round(point.y)} em. Arrow keys move by 0.01 em; Shift moves by 0.1 em.`);
    });
    fields.forEach(field => { field.value = String(round(corners[field.dataset.point as Corner][field.dataset.axis as keyof Point])); });
    config.value = JSON.stringify(configuration(), null, 2);
    undo.disabled = history.length === 0;
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(configuration()));
      saveStatus.textContent = 'Position saved in this browser. Copy or download it to send back.';
    } catch { saveStatus.textContent = 'Copy or download your positioning to keep it.'; }
  }

  function record(before: Corners) {
    if (JSON.stringify(before) === JSON.stringify(corners)) return;
    history.push(before);
    if (history.length > 60) history.shift();
    preset.value = 'custom';
    render(); save();
  }

  function update(key: Corner, point: Point): boolean {
    const next = { ...corners, [key]: point };
    if (!valid(next)) { report('Keep the corners apart and in their original order.'); return false; }
    corners = next; report(''); render(); return true;
  }

  handles.forEach(handle => {
    const key = handle.dataset.corner as Corner;
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      drag = { key, id: event.pointerId, x: event.clientX, y: event.clientY, point: { ...corners[key] }, before: clone(corners), size: size() };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const box = stage.getBoundingClientRect(), title = logo.getBoundingClientRect();
      const x = drag.point.x + (event.clientX - drag.x) / drag.size;
      const y = drag.point.y + (event.clientY - drag.y) / drag.size;
      update(key, {
        x: Math.max((box.left + 21 - title.left) / drag.size, Math.min((box.right - 21 - title.left) / drag.size, x)),
        y: Math.max((box.top + 21 - title.top) / drag.size, Math.min((box.bottom - 21 - title.top) / drag.size, y)),
      });
    });
    const finish = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const before = drag.before;
      drag = undefined;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      record(before);
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    handle.addEventListener('lostpointercapture', finish);
    handle.addEventListener('keydown', event => {
      const moves: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
      const move = moves[event.key];
      if (!move) return;
      event.preventDefault();
      const before = clone(corners), step = event.shiftKey ? .1 : .01;
      if (update(key, { x: round(corners[key].x + move.x * step), y: round(corners[key].y + move.y * step) })) record(before);
    });
  });

  fields.forEach(field => field.addEventListener('change', () => {
    const key = field.dataset.point as Corner, axis = field.dataset.axis as keyof Point;
    const before = clone(corners);
    if (update(key, { ...corners[key], [axis]: field.valueAsNumber })) record(before);
    else render();
  }));
  function loadPreset(value: string) {
    const before = clone(corners);
    corners = value === 'approved' ? clone(approved) : initial(scales[value]);
    record(before); preset.value = value; report('');
  }
  preset.addEventListener('change', () => { if (preset.value === 'approved' || preset.value in scales) loadPreset(preset.value); });
  document.querySelector('#reset-wave')!.addEventListener('click', () => loadPreset('approved'));
  undo.addEventListener('click', () => {
    const previous = history.pop();
    if (previous) { corners = previous; preset.value = 'custom'; render(); save(); report('Last change undone.'); }
  });
  const guideButton = document.querySelector<HTMLButtonElement>('#toggle-guides')!;
  guideButton.addEventListener('click', () => {
    guides.hidden = !guides.hidden;
    guideButton.setAttribute('aria-pressed', String(!guides.hidden));
    guideButton.textContent = guides.hidden ? 'Show handles' : 'Hide handles';
  });
  document.querySelectorAll<HTMLButtonElement>('[data-editor-theme]').forEach(button => button.addEventListener('click', () => {
    document.documentElement.dataset.theme = button.dataset.editorTheme!;
    document.querySelectorAll<HTMLButtonElement>('[data-editor-theme]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
  }));
  document.querySelector('#copy-wave')!.addEventListener('click', async () => {
    const text = config.value;
    const fallback = () => {
      const field = document.createElement('textarea');
      field.value = text; field.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.append(field); field.select();
      const copied = document.execCommand('copy'); field.remove();
      if (!copied) throw new Error('Copy unavailable');
    };
    try {
      if (navigator.clipboard?.writeText) { try { await navigator.clipboard.writeText(text); } catch { fallback(); } }
      else fallback();
      report('Positioning copied. Paste it into our conversation.');
    } catch {
      document.querySelector<HTMLDetailsElement>('.values-details')!.open = true;
      config.focus(); config.select(); report('The values are selected. Copy them with your keyboard.');
    }
  });
  document.querySelector('#download-wave')!.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([config.value + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'wave-positioning.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    report('Downloaded wave-positioning.json. Send that file or paste its contents.');
  });
  void document.fonts.ready.then(() => {
    corners = clone(approved);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null') as { version?: number; corners?: unknown } | null;
      if (saved?.version === 1 && valid(saved.corners)) { corners = saved.corners; preset.value = 'custom'; report('Restored your last positioning.'); }
    } catch { /* Storage is optional in standalone file contexts. */ }
    render(); save();
    new ResizeObserver(render).observe(stage);
  });
})();
