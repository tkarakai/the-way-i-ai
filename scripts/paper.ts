import { readFile } from 'node:fs/promises';

/**
 * Pixel work shared by the wildlife artwork tools. Images are RGBA byte arrays, so the
 * same code runs on sharp's raw output in Node and in tests, without a browser.
 */

export type RGB = [number, number, number];
export interface Box { left: number; top: number; width: number; height: number }

/** Folio's light-theme --paper colour: the colour every delivered image's clear paper must match. */
export async function lightPaper(): Promise<RGB> {
  const css = await readFile(new URL('../design-system/theme.css', import.meta.url), 'utf8');
  const hex = css.match(/--paper:\s*#([a-f0-9]{6})\b/i)?.[1];
  if (!hex) throw new Error('Expected a six-digit light-theme --paper color');
  return [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16)) as RGB;
}

/** Estimates the source paper from pale, low-chroma samples along the image's perimeter. */
export function estimatePaper(rgba: Uint8Array, width: number, height: number): RGB | undefined {
  const samples: number[][] = [[], [], []];
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    if (x > width * .025 && x < width * .975 && y > height * .025 && y < height * .975) continue;
    const p = (y * width + x) * 4;
    const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    if (Math.min(r, g, b) < 215 || Math.max(r, g, b) - Math.min(r, g, b) > 25) continue;
    samples[0].push(r); samples[1].push(g); samples[2].push(b);
  }
  if (samples[0].length < 100) return undefined;
  return samples.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]) as RGB;
}

const distanceFrom = (rgba: Uint8Array, source: RGB) => (pixel: number) =>
  Math.max(...source.map((value, channel) => Math.abs(rgba[pixel * 4 + channel] - value)));

/** Clear paper connected to the image's edges, found before any pixel changes. */
export function paperMask(rgba: Uint8Array, width: number, height: number, source: RGB) {
  const distance = distanceFrom(rgba, source);
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const visit = (pixel: number) => {
    if (visited[pixel]) return;
    visited[pixel] = 1;
    const p = pixel * 4;
    const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    if (rgba[p + 3] !== 255 || Math.min(r, g, b) < 210 || Math.max(r, g, b) - Math.min(r, g, b) > 30 || distance(pixel) >= 28) return;
    queue[tail++] = pixel;
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const pixel = queue[head++], x = pixel % width, y = Math.floor(pixel / width);
    if (x > 0) visit(pixel - 1); if (x < width - 1) visit(pixel + 1);
    if (y > 0) visit(pixel - width); if (y < height - 1) visit(pixel + width);
  }
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < tail; i++) mask[queue[i]] = 1;
  return { mask, pixels: queue.subarray(0, tail), count: tail, distance };
}

/**
 * Matches edge-connected pale paper to the target colour in place; ink and coloured
 * watercolour are never changed. With `recenter`, the drawing's horizontal extent is
 * also centred; columns that slide in are clear paper. Re-running is harmless.
 */
export function matchPaper(rgba: Uint8Array, width: number, height: number, target: RGB, { recenter = false } = {}) {
  const source = estimatePaper(rgba, width, height);
  if (!source) throw new Error('Not enough clear paper to estimate the source background');
  const { mask, pixels, count, distance } = paperMask(rgba, width, height, source);
  if (count < width * height * .1) throw new Error('Unexpectedly little connected paper; refusing to overwrite the asset');
  for (const pixel of pixels) {
    const p = pixel * 4;
    // Exact target on clear paper; feather into pale antialiasing and wash edges.
    const blend = Math.min(1, (28 - distance(pixel)) / 18);
    for (let channel = 0; channel < 3; channel++) rgba[p + channel] = Math.round(rgba[p + channel] * (1 - blend) + target[channel] * blend);
  }
  let shift = 0;
  if (recenter) {
    let left = width, right = 0;
    for (let pixel = 0; pixel < width * height; pixel++) if (!mask[pixel]) { const x = pixel % width; left = Math.min(left, x); right = Math.max(right, x); }
    shift = Math.round(width / 2 - (left + right) / 2);
    if (left + shift < 0 || right + shift >= width) throw new Error('The animal is too wide to re-centre safely');
    const moved = new Uint8Array(rgba.length);
    for (let i = 0; i < width * height; i++) moved.set([...target, 255], i * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const to = x + shift;
      if (to >= 0 && to < width) moved.set(rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4), (y * width + to) * 4);
    }
    rgba.set(moved);
  }
  for (const pixel of [0, width - 1, (height - 1) * width, width * height - 1]) {
    if (mask[pixel] && target.some((value, channel) => rgba[pixel * 4 + channel] !== value)) throw new Error('A paper corner did not match the target color');
  }
  return { source, coverage: Math.round(count / (width * height) * 100), shift };
}

/**
 * The drawing's extent: everything that is not edge-connected paper. Rows and columns
 * need a few drawn pixels to count, so stray specks near the edges are ignored.
 */
export function drawingBox(rgba: Uint8Array, width: number, height: number, source: RGB): Box | undefined {
  const { mask } = paperMask(rgba, width, height, source);
  const columns = new Uint32Array(width), rows = new Uint32Array(height);
  for (let pixel = 0; pixel < width * height; pixel++) if (!mask[pixel]) { columns[pixel % width]++; rows[Math.floor(pixel / width)]++; }
  const columnMin = Math.max(2, height * .003), rowMin = Math.max(2, width * .003);
  const left = columns.findIndex(count => count >= columnMin), top = rows.findIndex(count => count >= rowMin);
  if (left < 0 || top < 0) return undefined;
  const right = columns.findLastIndex(count => count >= columnMin), bottom = rows.findLastIndex(count => count >= rowMin);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Chooses the window of a generated image to publish at `ratio` (width / height).
 * Image tools rarely return the exact ratio, and never 4:1, but the artwork sits on
 * plain paper. Prefer the largest window inside the image that keeps the whole drawing
 * plus a margin; otherwise take the smallest window that does and let the caller pad
 * the parts outside the image with paper. Never crops into the drawing.
 */
export function frameDrawing(width: number, height: number, drawing: Box | undefined, ratio: number, margin = .04): Box {
  const centre = (box: Box) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  const marginX = Math.round(width * margin), marginY = Math.round(height * margin);
  const needed: Box = drawing
    ? { left: drawing.left - marginX, top: drawing.top - marginY, width: drawing.width + 2 * marginX, height: drawing.height + 2 * marginY }
    : { left: 0, top: 0, width, height };
  const { x, y } = centre(needed);
  const inside = width / height >= ratio ? { width: Math.round(height * ratio), height } : { width, height: Math.round(width / ratio) };
  if (needed.width <= inside.width && needed.height <= inside.height) {
    const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
    return { ...inside, left: Math.round(clamp(x - inside.width / 2, width - inside.width)), top: Math.round(clamp(y - inside.height / 2, height - inside.height)) };
  }
  const windowWidth = Math.round(Math.max(needed.width, needed.height * ratio));
  const windowHeight = Math.round(windowWidth / ratio);
  return { left: Math.round(x - windowWidth / 2), top: Math.round(y - windowHeight / 2), width: windowWidth, height: windowHeight };
}
