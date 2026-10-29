import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import sharp from 'sharp';
import { assertSafeSVG } from './safety.ts';

/**
 * Pages refer to shared files through this token; the build replaces it with each
 * page's relative path to the site root once the page's location is known.
 */
export const ROOT = '@@root@@/';

/** Responsive widths for raster artwork. Sources are never upscaled. */
export const imageWidths = [320, 640, 960, 1280, 1600] as const;
const webp = { quality: 78, effort: 6 } as const;
// Transparent pixels in small thumbnails sit on the artwork's warm paper.
const paper = { r: 246, g: 242, b: 234 };

export interface PublishedImage { src: string; srcset?: string; width: number; height: number }

/**
 * Content-addressed files shared by every page: images, fonts, styles, scripts and the
 * search index. A file's name changes whenever its bytes do, so browsers and caches can
 * keep it, and one copy serves every page.
 */
export class Assets {
  readonly files = new Map<string, Buffer>();
  private readonly images = new Map<string, Promise<PublishedImage>>();

  /** Returns the file's path relative to the site root, for example `assets/site-1a2b3c4d5e6f.css`. */
  add(name: string, data: Buffer | string, directory = 'assets'): string {
    const bytes = typeof data === 'string' ? Buffer.from(data) : data;
    const extension = extname(name);
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    const stem = basename(name, extension).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
    const path = `${directory}/${stem}-${hash}${extension}`;
    const existing = this.files.get(path);
    if (existing && !existing.equals(bytes)) throw new Error(`Asset hash collision: ${path}`);
    this.files.set(path, bytes);
    return path;
  }

  /**
   * Raster artwork becomes WebP at each responsive width up to the source width; SVG stays
   * as authored. `maxWidth` caps artwork that never displays large.
   */
  image(file: string, options: { maxWidth?: number; flatten?: boolean } = {}): Promise<PublishedImage> {
    const key = `${file}\n${options.maxWidth ?? ''}\n${options.flatten ?? ''}`;
    if (!this.images.has(key)) this.images.set(key, this.render(file, options));
    return this.images.get(key)!;
  }

  private async render(file: string, { maxWidth, flatten }: { maxWidth?: number; flatten?: boolean }): Promise<PublishedImage> {
    const source = await readFile(file);
    const name = basename(file, extname(file));
    const extension = extname(file).slice(1).toLowerCase();
    if (extension === 'svg') {
      assertSafeSVG(source.toString('utf8'), file);
      const viewBox = /\bviewBox\s*=\s*["']([^"']+)["']/.exec(source.toString('utf8'))?.[1].trim().split(/[\s,]+/).map(Number);
      if (!viewBox || viewBox.length !== 4 || !viewBox.every(Number.isFinite) || viewBox[2] <= 0 || viewBox[3] <= 0) throw new Error(`${file}: SVG needs a valid viewBox.`);
      return { src: this.add(`${name}.svg`, source), width: Math.round(viewBox[2]), height: Math.round(viewBox[3]) };
    }
    if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) throw new Error(`Unsupported image format: ${file}`);
    const { width = 0, height = 0 } = await sharp(source).metadata();
    if (!width || !height) throw new Error(`Unreadable image: ${file}`);
    const limit = Math.min(width, maxWidth ?? 1600);
    const widths = [...new Set([...imageWidths.filter(candidate => candidate < limit), limit])];
    const variants = await Promise.all(widths.map(async target => {
      let pipeline = sharp(source).resize({ width: target });
      if (flatten) pipeline = pipeline.flatten({ background: paper });
      return { width: target, path: this.add(`${name}-${target}.webp`, await pipeline.webp(webp).toBuffer()) };
    }));
    const largest = variants.at(-1)!;
    return {
      src: largest.path,
      ...(variants.length > 1 ? { srcset: variants.map(variant => `${ROOT}${variant.path} ${variant.width}w`).join(', ') } : {}),
      width: largest.width,
      height: Math.round(height * largest.width / width)
    };
  }
}

/** `<img>` attributes for published artwork; `sizes` describes the slot the image fills. */
export function imageAttributes(image: PublishedImage, sizes: string): string {
  return `src="${ROOT}${image.src}"${image.srcset ? ` srcset="${image.srcset}" sizes="${sizes}"` : ''} width="${image.width}" height="${image.height}"`;
}
