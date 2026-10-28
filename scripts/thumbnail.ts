import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

/**
 * A small, deterministic JPEG thumbnail of a portrait, for navigation that shows
 * other topics' animals (plate drawer, previous/next links) without embedding
 * their full-size images in every page. Unsupported formats return undefined.
 */
export function thumbnail(data: Buffer, extension: string, width = 360): string | undefined {
  let source: { width: number; height: number; data: Uint8Array } | undefined;
  try {
    source = extension === 'png' ? PNG.sync.read(data)
      : extension === 'jpg' || extension === 'jpeg' ? jpeg.decode(data, { useTArray: true, formatAsRGBA: true })
      : undefined;
  } catch { return undefined; } // Undecodable files fall back to the full image.
  if (!source || source.width <= width) return undefined;
  const height = Math.round(source.height * width / source.width);
  const pixels = Buffer.alloc(width * height * 4);
  const scale = source.width / width;
  // Box filter: average every source pixel that falls inside each target pixel.
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * scale), y1 = Math.min(source.height, Math.floor((y + 1) * scale));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * scale), x1 = Math.min(source.width, Math.floor((x + 1) * scale));
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const offset = (sy * source.width + sx) * 4;
          const alpha = source.data[offset + 3] / 255;
          // Composite transparency onto the artwork's warm paper.
          r += source.data[offset] * alpha + 246 * (1 - alpha);
          g += source.data[offset + 1] * alpha + 242 * (1 - alpha);
          b += source.data[offset + 2] * alpha + 234 * (1 - alpha);
          a++; count++;
        }
      }
      const target = (y * width + x) * 4;
      pixels[target] = Math.round(r / count);
      pixels[target + 1] = Math.round(g / count);
      pixels[target + 2] = Math.round(b / count);
      pixels[target + 3] = a ? 255 : 0;
    }
  }
  return `data:image/jpeg;base64,${jpeg.encode({ data: pixels, width, height }, 78).data.toString('base64')}`;
}
