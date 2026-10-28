import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import type { Collection, RenderedTopic } from '../design-system/types.ts';
import { escape, wordmarkContent } from '../design-system/layout.ts';

export interface SharingCard {
  path: string;
  html: string;
  alt: string;
  width: 1200;
  height: 630;
}
export interface SharingSources {
  collection: Collection;
  fonts: string;
  css: string;
  sharingCSS: string;
  wordmarkBackground: boolean;
}

/** Pure, source-addressed documents: browser rasterization is publication-only. */
export function sharingCard(sources: SharingSources, topic?: RenderedTopic): SharingCard {
  const { collection, fonts, css, sharingCSS, wordmarkBackground } = sources;
  const wordmark = `<div class="wordmark" aria-hidden="true">${wordmarkContent(collection, wordmarkBackground)}</div>`;
  const foot = `<div class="share-foot"><span>${escape(new URL(collection.siteUrl).hostname)}</span><span>${escape(collection.author.name)}</span></div>`;
  const image = topic?.illustrations?.homepage ?? '';
  const species = topic?.illustrations?.species;
  const speciesText = species ? `${species.latin}${species.common ? ` · ${species.common}` : ''}` : '';
  const title = topic?.title ?? collection.title;
  const body = topic
    ? `<main class="share-card article-card${image ? '' : ' no-artwork'}"><p class="share-kicker">Topic ${Number(topic.number)}</p>${image ? `<div class="article-mount">${image}${speciesText ? `<p class="article-species">${escape(speciesText)}</p>` : ''}</div>` : ''}<div class="article-copy"><p class="share-category">${escape(topic.category)}</p><h1 class="share-title">${escape(topic.title)}</h1></div><div class="article-brand">${wordmark}</div>${foot}</main>`
    : `<main class="share-card home-card"><p class="share-kicker">${escape(collection.eyebrow)}</p><div class="home-ring"></div><div class="home-logo">${wordmark}</div><div class="home-rule"></div><p class="home-copy">${escape(collection.description)}</p>${foot}</main>`;
  const html = `<!doctype html><html lang="en" data-design="atlas" data-theme="light"><head><meta charset="utf-8"><title>${escape(title)}</title><style>${fonts}\n${css}\n${sharingCSS}</style></head><body>${body}</body></html>`;
  // Change URLs when copy, artwork, fonts, or styling changes. Include a renderer
  // revision to invalidate cached cards if fitting or JPEG options change.
  const hash = createHash('sha256').update('sharing-renderer-v1\n' + html).digest('hex').slice(0, 20);
  return { path: `assets/sharing/${topic?.id ?? 'collection'}-${hash}.jpg`, html, alt: title, width: 1200, height: 630 };
}

/** No browser is needed for standalone HTML builds, checks, or metadata tests. */
export async function renderSharingCards(cards: SharingCard[]): Promise<Map<string, Buffer>> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, javaScriptEnabled: false, colorScheme: 'light', reducedMotion: 'reduce' });
    await page.route(/^https?:/, route => route.abort());
    const images = new Map<string, Buffer>();
    for (const card of cards) {
      await page.setContent(card.html);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(image => image.decode()));
        const fit = (selector: string, maxBottom: number, minimum: number) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) return;
          let size = parseFloat(getComputedStyle(element).fontSize);
          while ((element.getBoundingClientRect().bottom > maxBottom || element.scrollWidth > element.clientWidth) && size > minimum) element.style.fontSize = `${--size}px`;
          if (element.getBoundingClientRect().bottom > maxBottom || element.scrollWidth > element.clientWidth) throw new Error(`Sharing copy does not fit: ${selector}`);
        };
        fit('.share-title', 458, 24);
        fit('.home-copy', 500, 24);
      });
      images.set(card.path, await page.screenshot({ type: 'jpeg', quality: 90 }));
    }
    return images;
  } finally {
    await browser.close();
  }
}
