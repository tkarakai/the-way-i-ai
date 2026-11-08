/**
 * Visit statistics, counted only on the published site. The build includes this script only when the GOATCOUNTER_CODE
 * and/or CLOUDFLARE_WEB_ANALYTICS_TOKEN environment variables are set (repository variables in the Pages workflow), and
 * each page carries those public identifiers as JSON (#analytics-config).
 *
 * The same bundle is deployed, previewed and downloaded, so the decision happens here, in the browser. Nothing loads
 * or is sent unless the page is served over HTTPS from the canonical host, is the top-level page, has actually been
 * shown (not only prerendered), the browser sends neither Global Privacy Control nor Do Not Track, and this browser has
 * not been switched off. A blocked or failing provider never affects reading.
 *
 * Switching a browser off or on needs no control in the interface: open /nocount (or /no-count, #nocount, #no-count)
 * to stop counting this browser, and /count (or #count) to resume. The choice is `the-way-i-ai-analytics=off` in this
 * site's local storage, so it applies to this browser profile only. The path forms arrive on the 404 page, which then
 * returns to the home page with a confirmation; none of these loads is counted.
 *
 * - GoatCounter (readership) gets one request per page view through its documented pixel: the canonical path (never a
 *   query or fragment, which can hold search words), the title, the referrer only when it is another site and reduced
 *   to its origin and path, the screen size, and a bot flag for automated browsers. No GoatCounter script runs.
 * - Cloudflare Web Analytics (loading performance) runs its beacon, which can report until the page is hidden. It is
 *   skipped when the page's address or a same-site referrer carries a query, which can hold search words.
 */
(() => {
  'use strict';
  const source = document.getElementById('analytics-config');
  if (!source) return;
  let config: { site: string; goatcounter?: string; cloudflare?: string };
  let site: URL;
  try { config = JSON.parse(source.textContent || ''); site = new URL(config.site); } catch { return; }
  const storageKey = 'the-way-i-ai-analytics';
  const noticeKey = 'the-way-i-ai-analytics-notice';
  const messages = { off: 'Visits from this browser are no longer counted.', on: 'Visits from this browser are counted again.' };
  const say = (message: string) => (window as Window & { announce?: (message: string) => void }).announce?.(message);
  const readerDeclined = () => { try { return localStorage.getItem(storageKey) === 'off'; } catch { return false; } };

  // The hidden switch: one word at the site root or in the fragment, in any letter case.
  const word = (text: string) => {
    const normalized = text.toLowerCase().replace(/\/$/, '');
    return normalized === 'nocount' || normalized === 'no-count' ? 'off' : normalized === 'count' ? 'on' : undefined;
  };
  const viaPath = location.pathname.toLowerCase().startsWith(site.pathname.toLowerCase()) ? word(location.pathname.slice(site.pathname.length)) : undefined;
  const choice = viaPath ?? word(location.hash.slice(1));
  if (choice) {
    try { if (choice === 'off') localStorage.setItem(storageKey, 'off'); else localStorage.removeItem(storageKey); } catch { return; }
    if (viaPath) {
      // Leave the 404 page for the home page, which confirms the change.
      try { sessionStorage.setItem(noticeKey, choice); } catch { /* The change still applies, unannounced. */ }
      location.replace(location.origin + site.pathname);
    } else {
      history.replaceState(history.state, '', location.pathname + location.search);
      say(messages[choice]);
    }
    return;
  }
  // The home page reached from a path toggle confirms the change; that arrival is not a visit either.
  let notice: string | null = null;
  try { notice = sessionStorage.getItem(noticeKey); if (notice) sessionStorage.removeItem(noticeKey); } catch { /* No confirmation without session storage. */ }
  if (notice === 'off' || notice === 'on') { say(messages[notice]); return; }

  const privacySignals = navigator as Navigator & { globalPrivacyControl?: boolean };
  const browserDeclines = privacySignals.globalPrivacyControl === true || navigator.doNotTrack === '1';
  if (location.protocol !== 'https:' || location.host !== site.host || window.top !== window || browserDeclines || readerDeclined()) return;

  const parse = (address: string) => { try { return address ? new URL(address) : undefined; } catch { return undefined; } };
  const count = () => {
    const referrer = parse(document.referrer);
    if (config.goatcounter) {
      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      // The 404 page has no canonical address; its own path shows which link is broken.
      const path = (canonical && parse(canonical.href)?.pathname) || location.pathname;
      const parameters = new URLSearchParams({ p: path, t: document.title });
      if (referrer && referrer.host !== location.host && /^https?:$/.test(referrer.protocol)) parameters.set('r', referrer.origin + referrer.pathname);
      parameters.set('s', `${screen.width},${screen.height},${devicePixelRatio || 1}`);
      // 153 is GoatCounter's flag for a WebDriver-controlled browser.
      if (navigator.webdriver) parameters.set('b', '153');
      parameters.set('rnd', Math.random().toString(36).slice(2, 10));
      new Image().src = `https://${config.goatcounter}.goatcounter.com/count?${parameters}`;
    }
    const sameSiteQuery = Boolean(referrer && referrer.host === location.host && referrer.search);
    if (config.cloudflare && !location.search && !sameSiteQuery) {
      const beacon = document.createElement('script');
      beacon.defer = true;
      beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
      // Pages are separate documents: route tracking would only report the find box rewriting the address.
      beacon.dataset.cfBeacon = JSON.stringify({ token: config.cloudflare, spa: false });
      document.body.append(beacon);
    }
  };
  if ((document as Document & { prerendering?: boolean }).prerendering) document.addEventListener('prerenderingchange', () => { if (!readerDeclined()) count(); }, { once: true });
  else count();
})();
