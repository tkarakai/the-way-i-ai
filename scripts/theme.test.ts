import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../design-system/theme.ts', import.meta.url), 'utf8');
const script = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.None } }).outputText;
const hour = 60 * 60 * 1000;
const start = 1_000_000_000_000;
const key = 'the-way-i-ai-theme';
const saved = (preference: string, lastActivity = start) => JSON.stringify({ preference, lastActivity });
function browser(options: { stored?: string | null; dark?: boolean; now?: number; blocked?: 'all' | 'write' } = {}) {
  const document = new EventTarget();
  const window = new EventTarget();
  const media = Object.assign(new EventTarget(), { matches: options.dark ?? false });
  const root = { dataset: {} as Record<string, string>, classList: { add() {} } };
  const dom = Object.assign(document, { documentElement: root, hidden: false });
  let value = options.stored ?? null, now = options.now ?? start, writes = 0, nextTimer = 0, changes = 0;
  dom.addEventListener('theme-change', () => { changes++; });
  const timers = new Map<number, { at: number; callback: () => void }>();
  class Element { closest() { return null; } }
  runInNewContext(script, {
    document: dom, Event, Element, matchMedia: () => media, Date: { now: () => now },
    addEventListener: window.addEventListener.bind(window),
    setTimeout: (callback: () => void, delay: number) => {
      timers.set(++nextTimer, { at: now + delay, callback }); return nextTimer;
    },
    clearTimeout: (id: number) => timers.delete(id),
    localStorage: {
      getItem: () => { if (options.blocked === 'all') throw new Error('Unavailable'); return value; },
      setItem: (_key: string, next: string) => { if (options.blocked) throw new Error('Unavailable'); value = next; writes++; },
      removeItem: () => { if (options.blocked) throw new Error('Unavailable'); value = null; writes++; },
    },
  });
  const advance = (ms: number, runTimers = true) => {
    const end = now + ms;
    while (runTimers) {
      const next = [...timers].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = Math.max(now, next[1].at); timers.delete(next[0]); next[1].callback();
    }
    now = end;
  };
  return {
    root, advance,
    now: () => now,
    stored: () => value,
    writes: () => writes,
    changes: () => changes,
    choose: (preference: string) => { root.dataset.themePreference = preference; dom.dispatchEvent(new Event('theme-preference-change')); },
    system: (matches: boolean) => { media.matches = matches; media.dispatchEvent(new Event('change')); },
    activity: (type: string) => dom.dispatchEvent(new Event(type)),
    windowEvent: (type: string, persisted = false) => window.dispatchEvent(Object.assign(new Event(type), { persisted })),
    visibility: (hidden: boolean) => { dom.hidden = hidden; dom.dispatchEvent(new Event('visibilitychange')); },
    storage: (next: string | null, changedKey: string | null = key, dispatch = true) => {
      if (changedKey === key || changedKey === null) value = next;
      if (dispatch) window.dispatchEvent(Object.assign(new Event('storage'), { key: changedKey, newValue: next }));
    },
  };
}

test('System is the pre-paint default and follows device changes; untimed/invalid records reset safely', () => {
  for (const stored of [null, 'system', 'dark', 'invalid', saved('invalid'), saved('dark', start + 1), '{"preference":"dark"}']) {
    const page = browser({ stored, dark: true });
    assert.equal(page.root.dataset.themePreference, 'system');
    assert.equal(page.root.dataset.theme, 'dark');
    assert.equal(page.stored(), null);
    page.system(false);
    assert.equal(page.root.dataset.theme, 'light');
  }
});

test('fresh overrides survive navigation and ignore system changes until two idle hours pass', () => {
  const page = browser({ dark: true });
  page.choose('light');
  assert.equal(page.stored(), saved('light'));
  page.system(false); page.system(true);
  assert.equal(page.root.dataset.theme, 'light');
  const next = browser({ stored: page.stored(), dark: true, now: start + hour });
  assert.equal(next.root.dataset.theme, 'light');
  next.advance(2 * hour - 1);
  assert.equal(next.root.dataset.themePreference, 'light');
  next.advance(1);
  assert.equal(next.root.dataset.themePreference, 'system');
  assert.equal(next.root.dataset.theme, 'dark');
  assert.equal(next.stored(), null);
  next.system(false);
  assert.equal(next.root.dataset.theme, 'light');
});

test('navigation expires stale records before recording new activity, with no stale first paint', () => {
  for (const idle of [2 * hour, 3 * hour]) {
    const page = browser({ stored: saved('dark'), now: start + idle });
    assert.equal(page.root.dataset.themePreference, 'system');
    assert.equal(page.root.dataset.theme, 'light');
    assert.equal(page.stored(), null);
  }
});

test('scrolling and keyboard/input activity each renew the complete two-hour window', () => {
  for (const type of ['scroll', 'keydown', 'input']) {
    const page = browser(); page.choose('dark');
    page.advance(hour); page.activity(type);
    page.advance(2 * hour - 1);
    assert.equal(page.root.dataset.themePreference, 'dark', type);
    page.advance(1);
    assert.equal(page.root.dataset.themePreference, 'system', type);
  }
});

test('same-page and back/forward navigation count, but focus, visibility, pointer and theme changes do not', () => {
  for (const type of ['hashchange', 'popstate', 'pageshow']) {
    const page = browser(); page.choose('dark');
    page.advance(hour); page.windowEvent(type, true);
    page.advance(2 * hour - 1);
    assert.equal(page.root.dataset.themePreference, 'dark', type);
    page.advance(1);
    assert.equal(page.root.dataset.themePreference, 'system', type);
  }
  const page = browser(); page.choose('dark');
  page.advance(hour);
  page.windowEvent('focus'); page.visibility(true); page.visibility(false);
  page.activity('pointermove'); page.activity('click'); page.system(true); page.system(false);
  page.advance(hour);
  assert.equal(page.root.dataset.themePreference, 'system');
});

test('sleep and throttled timers cannot revive an expired override on interaction or page restore', () => {
  for (const resume of ['scroll', 'input', 'focus', 'pageshow', 'visibility']) {
    const page = browser(); page.choose('dark');
    page.advance(3 * hour, false);
    if (resume === 'focus' || resume === 'pageshow') page.windowEvent(resume, true);
    else if (resume === 'visibility') page.visibility(false);
    else page.activity(resume);
    assert.equal(page.root.dataset.themePreference, 'system', resume);
  }
});

test('activity writes are throttled, flushed on leaving, and do not repeatedly redraw the theme', () => {
  const page = browser(); page.choose('dark');
  const writes = page.writes(), changes = page.changes();
  for (let i = 0; i < 100; i++) { page.advance(5); page.activity('scroll'); }
  assert.equal(page.writes(), writes);
  assert.equal(page.changes(), changes);
  page.windowEvent('pagehide');
  assert.equal(page.writes(), writes + 1);
  assert.equal(page.stored(), saved('dark', start + 500));
  page.advance(1000);
  assert.equal(page.writes(), writes + 1, 'No leftover trailing write after flushing');
});

test('cross-tab activity extends expiry; newer choices, deletion, and storage.clear synchronize', () => {
  const page = browser(); page.choose('dark');
  page.advance(hour);
  page.storage(saved('dark', page.now()));
  page.advance(2 * hour - 1);
  assert.equal(page.root.dataset.themePreference, 'dark');
  page.storage(saved('light', page.now()));
  assert.equal(page.root.dataset.themePreference, 'light');
  page.system(true);
  assert.equal(page.root.dataset.theme, 'light');
  page.storage(null);
  assert.equal(page.root.dataset.themePreference, 'system');
  assert.equal(page.root.dataset.theme, 'dark');
  page.choose('light');
  page.storage(null, 'unrelated');
  assert.equal(page.root.dataset.themePreference, 'light');
  page.storage(null, null);
  assert.equal(page.root.dataset.themePreference, 'system');
  assert.equal(page.root.dataset.theme, 'dark');
});

test('an old timer checks current shared activity even if its storage event was delayed', () => {
  const page = browser(); page.choose('dark');
  page.advance(hour);
  page.storage(saved('dark', page.now()), key, false);
  page.advance(hour);
  assert.equal(page.root.dataset.themePreference, 'dark');
  page.advance(hour);
  assert.equal(page.root.dataset.themePreference, 'system');
});

test('blocked reads or writes preserve in-memory selection, activity expiry, and System tracking', () => {
  for (const blocked of ['all', 'write'] as const) {
    const page = browser({ blocked }); page.choose('dark');
    page.system(true); page.system(false);
    assert.equal(page.root.dataset.theme, 'dark');
    page.advance(hour); page.activity('keydown'); page.visibility(false);
    page.advance(2 * hour);
    assert.equal(page.root.dataset.themePreference, 'system');
    assert.equal(page.root.dataset.theme, 'light');
    page.system(true);
    assert.equal(page.root.dataset.theme, 'dark');
  }
});
