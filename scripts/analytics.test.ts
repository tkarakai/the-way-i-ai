import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { analyticsFromEnvironment, analyticsSources } from './discovery.ts';

const script = stripTypeScriptTypes(await readFile(new URL('../design-system/analytics.ts', import.meta.url), 'utf8'));
const token = '0123456789abcdef0123456789abcdef';
const config = { site: 'https://thewayiai.com/', goatcounter: 'example', cloudflare: token };

interface Options {
  url?: string;
  referrer?: string;
  canonical?: string | null;
  stored?: string | null;
  blocked?: boolean;
  gpc?: boolean;
  dnt?: string;
  webdriver?: boolean;
  framed?: boolean;
  prerendering?: boolean;
  config?: unknown;
  notice?: string | null;
}
/** Runs the analytics script against a small fake page and reports what it sent and changed. */
function visit(options: Options = {}) {
  const url = new URL(options.url ?? 'https://thewayiai.com/topics/worktrees/');
  const pixels: string[] = [];
  const appended: { src: string; defer: boolean; dataset: Record<string, string> }[] = [];
  let stored = options.stored ?? null;
  let notice = options.notice ?? null;
  const announced: string[] = [];
  const navigation: { replaced?: string; rewritten?: string } = {};
  const document = Object.assign(new EventTarget(), {
    title: 'Git Worktrees · The Way I AI',
    referrer: options.referrer ?? '',
    prerendering: options.prerendering ?? false,
    getElementById: (id: string) => id === 'analytics-config' && options.config !== null ? { textContent: typeof options.config === 'string' ? options.config : JSON.stringify(options.config ?? config) } : null,
    querySelector: (selector: string) => {
      if (selector === 'link[rel="canonical"]') return options.canonical === null ? null : { href: options.canonical ?? 'https://thewayiai.com/topics/worktrees/' };
      return null;
    },
    createElement: () => ({ src: '', defer: false, dataset: {} as Record<string, string> }),
    body: { append: (element: typeof appended[number]) => appended.push(element) },
  });
  const window = { top: null as unknown, announce: (message: string) => announced.push(message) };
  window.top = options.framed ? {} : window;
  runInNewContext(script, {
    document, window, URL, URLSearchParams, Math,
    location: Object.assign(url, { replace: (address: string) => { navigation.replaced = address; } }),
    history: { state: null, replaceState: (_state: unknown, _title: string, address: string) => { navigation.rewritten = address; } },
    navigator: { globalPrivacyControl: options.gpc, doNotTrack: options.dnt ?? null, webdriver: options.webdriver ?? false },
    screen: { width: 1440, height: 900 }, devicePixelRatio: 2,
    Image: class { set src(value: string) { pixels.push(value); } },
    localStorage: {
      getItem: () => { if (options.blocked) throw new Error('Unavailable'); return stored; },
      setItem: (_key: string, value: string) => { if (options.blocked) throw new Error('Unavailable'); stored = value; },
      removeItem: () => { if (options.blocked) throw new Error('Unavailable'); stored = null; },
    },
    sessionStorage: {
      getItem: () => notice,
      setItem: (_key: string, value: string) => { notice = value; },
      removeItem: () => { notice = null; },
    },
  });
  return {
    pixels, appended, document, announced, navigation,
    get stored() { return stored; },
    get notice() { return notice; },
    goatcounter: () => pixels.map(pixel => new URL(pixel)),
  };
}

test('the published site counts one GoatCounter page view with the canonical path and no query', () => {
  const page = visit({ url: 'https://thewayiai.com/topics/worktrees/index.html?q=secret#chapter' });
  const [pixel, ...rest] = page.goatcounter();
  assert.equal(rest.length, 0);
  assert.equal(pixel.origin + pixel.pathname, 'https://example.goatcounter.com/count');
  assert.equal(pixel.searchParams.get('p'), '/topics/worktrees/');
  assert.equal(pixel.searchParams.get('t'), 'Git Worktrees · The Way I AI');
  assert.equal(pixel.searchParams.get('s'), '1440,900,2');
  assert.equal(pixel.searchParams.get('b'), null);
  assert.equal(pixel.searchParams.get('r'), null);
  assert.doesNotMatch(pixel.href, /secret|chapter/);
});

test('GoatCounter receives external referrers without their query, and never same-site ones', () => {
  const external = visit({ referrer: 'https://www.google.com/search?q=private+words' }).goatcounter()[0];
  assert.equal(external.searchParams.get('r'), 'https://www.google.com/search');
  assert.equal(visit({ referrer: 'https://thewayiai.com/?q=x' }).goatcounter()[0].searchParams.get('r'), null);
  assert.equal(visit({ referrer: 'android-app://com.example/' }).goatcounter()[0].searchParams.get('r'), null);
});

test('the 404 page counts the missing path, and automated browsers are flagged as bots', () => {
  const missing = visit({ url: 'https://thewayiai.com/old/link/', canonical: null, webdriver: true }).goatcounter()[0];
  assert.equal(missing.searchParams.get('p'), '/old/link/');
  assert.equal(missing.searchParams.get('b'), '153');
});

test('Cloudflare loads its beacon with the site token and without route tracking', () => {
  const [beacon, ...rest] = visit().appended;
  assert.equal(rest.length, 0);
  assert.equal(beacon.src, 'https://static.cloudflareinsights.com/beacon.min.js');
  assert.equal(beacon.defer, true);
  assert.deepEqual(JSON.parse(beacon.dataset.cfBeacon), { token, spa: false });
});

test('Cloudflare is skipped when the address or a same-site referrer can carry search words', () => {
  assert.equal(visit({ url: 'https://thewayiai.com/topics/worktrees/?q=secret' }).appended.length, 0);
  assert.equal(visit({ referrer: 'https://thewayiai.com/topics/agent-roles/?q=secret' }).appended.length, 0);
  assert.equal(visit({ referrer: 'https://www.google.com/search?q=x' }).appended.length, 1);
  assert.equal(visit({ url: 'https://thewayiai.com/topics/worktrees/#chapter' }).appended.length, 1);
});

test('each provider runs only when it is configured', () => {
  const goatOnly = visit({ config: { site: config.site, goatcounter: 'example' } });
  assert.equal(goatOnly.pixels.length, 1);
  assert.equal(goatOnly.appended.length, 0);
  const cloudflareOnly = visit({ config: { site: config.site, cloudflare: token } });
  assert.equal(cloudflareOnly.pixels.length, 0);
  assert.equal(cloudflareOnly.appended.length, 1);
});

test('local builds, PR previews, downloaded bundles, frames and broken settings never count', () => {
  for (const url of ['http://127.0.0.1:4193/', 'http://localhost:8080/topics/worktrees/', 'http://thewayiai.com/', 'https://tkarakai.github.io/the-way-i-ai/', 'https://www.thewayiai.com/', 'file:///Users/someone/_site/index.html']) {
    const page = visit({ url });
    assert.deepEqual([page.pixels.length, page.appended.length], [0, 0], url);
  }
  for (const options of [{ framed: true }, { config: null }, { config: 'not json' }, { config: { site: 'not a url', goatcounter: 'example' } }] as Options[]) {
    const page = visit(options);
    assert.deepEqual([page.pixels.length, page.appended.length], [0, 0], JSON.stringify(options));
  }
});

test('Global Privacy Control, Do Not Track and the reader’s own choice stop all counting', () => {
  for (const options of [{ gpc: true }, { dnt: '1' }, { stored: 'off' }] as Options[]) {
    const page = visit(options);
    assert.deepEqual([page.pixels.length, page.appended.length], [0, 0], JSON.stringify(options));
  }
  // Blocked storage cannot record a choice, so the default applies.
  assert.equal(visit({ blocked: true }).pixels.length, 1);
});

test('a prerendered page counts only once it is shown', () => {
  const shown = visit({ prerendering: true });
  assert.equal(shown.pixels.length, 0);
  shown.document.dispatchEvent(new Event('prerenderingchange'));
  assert.equal(shown.pixels.length, 1);
  shown.document.dispatchEvent(new Event('prerenderingchange'));
  assert.equal(shown.pixels.length, 1);

});

test('/nocount, /no-count, #nocount and #no-count switch this browser off; /count and #count switch it back on', () => {
  for (const url of ['https://thewayiai.com/nocount', 'https://thewayiai.com/no-count/', 'https://thewayiai.com/NoCount']) {
    const page = visit({ url, canonical: null });
    assert.equal(page.stored, 'off', url);
    assert.equal(page.navigation.replaced, 'https://thewayiai.com/', url);
    assert.equal(page.notice, 'off', url);
    assert.deepEqual([page.pixels.length, page.appended.length], [0, 0], url);
  }
  for (const hash of ['#nocount', '#no-count', '#NO-COUNT']) {
    const page = visit({ url: `https://thewayiai.com/topics/worktrees/?q=x${hash}` });
    assert.equal(page.stored, 'off', hash);
    assert.equal(page.navigation.rewritten, '/topics/worktrees/?q=x', hash);
    assert.deepEqual(page.announced, ['Visits from this browser are no longer counted.'], hash);
    assert.deepEqual([page.pixels.length, page.appended.length], [0, 0], hash);
  }
  const resumed = visit({ url: 'https://thewayiai.com/count', canonical: null, stored: 'off' });
  assert.deepEqual([resumed.stored, resumed.notice, resumed.navigation.replaced, resumed.pixels.length], [null, 'on', 'https://thewayiai.com/', 0]);
  const resumedHash = visit({ url: 'https://thewayiai.com/#count', stored: 'off' });
  assert.deepEqual([resumedHash.stored, resumedHash.announced[0], resumedHash.pixels.length], [null, 'Visits from this browser are counted again.', 0]);
  // The home page confirms a change made on the 404 page, once, without counting that arrival.
  const home = visit({ url: 'https://thewayiai.com/', canonical: 'https://thewayiai.com/', notice: 'on' });
  assert.deepEqual([home.announced, home.notice, home.pixels.length, home.appended.length], [['Visits from this browser are counted again.'], null, 0, 0]);
  // Other paths and fragments are ordinary pages; the switch also works on local builds, where nothing counts anyway.
  assert.equal(visit({ url: 'https://thewayiai.com/topics/count/' }).stored, null);
  assert.equal(visit({ url: 'https://thewayiai.com/#counting' }).stored, null);
  assert.equal(visit({ url: 'http://127.0.0.1:4193/nocount' }).stored, 'off');
});

test('visit-statistics identifiers come from the environment and must be well formed', () => {
  assert.equal(analyticsFromEnvironment({}), undefined);
  assert.equal(analyticsFromEnvironment({ GOATCOUNTER_CODE: ' ', CLOUDFLARE_WEB_ANALYTICS_TOKEN: '' }), undefined);
  assert.deepEqual(analyticsFromEnvironment({ GOATCOUNTER_CODE: 'the-way-i-ai', CLOUDFLARE_WEB_ANALYTICS_TOKEN: token }), { goatcounter: 'the-way-i-ai', cloudflare: token });
  assert.deepEqual(analyticsFromEnvironment({ GOATCOUNTER_CODE: ' thewayiai\n' }), { goatcounter: 'thewayiai' });
  assert.deepEqual(analyticsFromEnvironment({ CLOUDFLARE_WEB_ANALYTICS_TOKEN: token }), { cloudflare: token });
  assert.throws(() => analyticsFromEnvironment({ GOATCOUNTER_CODE: 'https://x.goatcounter.com' }), /GOATCOUNTER_CODE must be the GoatCounter site code/);
  assert.throws(() => analyticsFromEnvironment({ GOATCOUNTER_CODE: 'Bad.Code' }), /site code/);
  assert.throws(() => analyticsFromEnvironment({ CLOUDFLARE_WEB_ANALYTICS_TOKEN: 'short' }), /CLOUDFLARE_WEB_ANALYTICS_TOKEN must be the 32-character token/);
});

test('the CSP gains only the configured providers’ endpoints', () => {
  assert.deepEqual(analyticsSources(undefined), { img: [], script: [], connect: [] });
  assert.deepEqual(analyticsSources({ goatcounter: 'example' }), { img: ['https://example.goatcounter.com/count'], script: [], connect: [] });
  assert.deepEqual(analyticsSources({ cloudflare: token }), { img: [], script: ['https://static.cloudflareinsights.com'], connect: ['https://cloudflareinsights.com'] });
});
