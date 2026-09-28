import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../design-system/theme.ts', import.meta.url), 'utf8');
const script = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.None } }).outputText;
function browser(stored: string | null, dark: boolean, blockedStorage = false) {
  const document = new EventTarget();
  const window = new EventTarget();
  const media = Object.assign(new EventTarget(), { matches: dark });
  const root = { dataset: {} as Record<string, string>, classList: { add() {} } };
  const dom = Object.assign(document, { documentElement: root });
  let value = stored;
  runInNewContext(script, {
    document: dom, Event, matchMedia: () => media,
    addEventListener: window.addEventListener.bind(window),
    localStorage: {
      getItem: () => { if (blockedStorage) throw new Error('Unavailable'); return value; },
      setItem: (_key: string, next: string) => { if (blockedStorage) throw new Error('Unavailable'); value = next; },
    },
  });
  return {
    root,
    stored: () => value,
    choose: (preference: string) => { root.dataset.themePreference = preference; dom.dispatchEvent(new Event('theme-preference-change')); },
    system: (matches: boolean) => { media.matches = matches; media.dispatchEvent(new Event('change')); },
    storage: (next: string | null, key: string | null = 'the-way-i-ai-theme') => window.dispatchEvent(Object.assign(new Event('storage'), { key, newValue: next })),
  };
}

test('System is the default, resolves before rendering and follows live system changes', () => {
  for (const saved of [null, 'system', 'invalid']) {
    const page = browser(saved, true);
    assert.equal(page.root.dataset.themePreference, 'system');
    assert.equal(page.root.dataset.theme, 'dark');
    page.system(false);
    assert.equal(page.root.dataset.theme, 'light');
  }
});

test('explicit light/dark choices survive reload and ignore system changes until System is selected', () => {
  const page = browser('light', true);
  assert.equal(page.root.dataset.theme, 'light');
  page.choose('dark');
  assert.equal(page.stored(), 'dark');
  page.system(false);
  assert.equal(page.root.dataset.theme, 'dark');
  assert.equal(browser(page.stored(), false).root.dataset.theme, 'dark');
  page.choose('system');
  assert.equal(page.stored(), 'system');
  assert.equal(page.root.dataset.theme, 'light');
  page.system(true);
  assert.equal(page.root.dataset.theme, 'dark');
});

test('cross-tab preference changes and storage deletion update the page', () => {
  const page = browser('dark', false);
  page.storage('light');
  assert.equal(page.root.dataset.theme, 'light');
  page.storage(null);
  assert.equal(page.root.dataset.themePreference, 'system');
  page.system(true);
  assert.equal(page.root.dataset.theme, 'dark');
  page.storage('light', 'unrelated');
  assert.equal(page.root.dataset.theme, 'dark');
  page.storage(null, null);
  assert.equal(page.root.dataset.themePreference, 'system');
});

test('blocked storage does not prevent theme selection or System tracking', () => {
  const page = browser(null, false, true);
  page.choose('dark');
  assert.equal(page.root.dataset.theme, 'dark');
  page.choose('system');
  assert.equal(page.root.dataset.theme, 'light');
  page.system(true);
  assert.equal(page.root.dataset.theme, 'dark');
});
