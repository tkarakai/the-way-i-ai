import type { WavePosition } from './types.ts';

const keys = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;

export function parseWavePosition(value: unknown): WavePosition {
  const position = value as Partial<WavePosition> | null;
  if (!position || position.version !== 1 || position.mapping !== 'projective'
    || position.units !== 'em of the main title font size'
    || position.origin !== 'top-left of the two-line title layout box'
    || typeof position.source !== 'string' || !position.source
    || JSON.stringify(position.cornerOrder) !== JSON.stringify(keys)) {
    throw new Error('Invalid wave positioning: expected the version 1 editor export in title-relative em units.');
  }
  const points = keys.map(key => position.corners?.[key]);
  if (points.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error('Invalid wave positioning: all four corners need finite X/Y coordinates.');
  }
  const complete = points as { x: number; y: number }[];
  if (!complete.every((a, index) => {
    const b = complete[(index + 1) % 4], c = complete[(index + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > 1e-8;
  })) throw new Error('Invalid wave positioning: corners must form a convex clockwise quadrilateral.');
  return position as WavePosition;
}

/** Map a 1em-square image to four title-relative corners without runtime JS. */
export function waveTransform(position: WavePosition): string {
  const [p0, p1, p2, p3] = keys.map(key => position.corners[key]);
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y;
  // Perspective(1em) supplies the inverse-font-size terms. Moving the origin
  // outside the perspective keeps all remaining matrix coefficients unitless.
  const matrix = [a - p0.x * g, d - p0.y * g, -g, 0, b - p0.x * h, e - p0.y * h, -h, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  if (!matrix.every(Number.isFinite)) throw new Error('Invalid wave positioning: the projection is singular.');
  return `translate(${p0.x}em, ${p0.y}em) perspective(1em) matrix3d(${matrix.map(value => Number(value.toFixed(12))).join(',')})`;
}

export function wordmarkStyles(background: string, position?: WavePosition): string {
  if (!background) return '';
  // One embedded asset per page, shared by the header and collection title.
  return `:root { --wordmark-wave-image: url("${background}"); }\n${position ? `.title-art { left: 0; top: 0; width: 1em; height: 1em; transform-origin: 0 0; transform: ${waveTransform(position)}; }` : ''}`;
}
