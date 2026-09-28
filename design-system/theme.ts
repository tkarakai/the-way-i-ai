// Runs in the head: expire old overrides before first paint or recording navigation.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const system = matchMedia('(prefers-color-scheme: dark)');
  const key = 'the-way-i-ai-theme';
  const idleLimit = 2 * 60 * 60 * 1000;
  type Override = { preference: 'light' | 'dark'; lastActivity: number };
  let storageAvailable = true;
  const read = (): Override | null | undefined => {
    if (!storageAvailable) return undefined;
    try {
      const value = localStorage.getItem(key);
      if (!value) return null;
      try {
        const saved = JSON.parse(value) as Partial<Override> | null;
        if (saved && (saved.preference === 'light' || saved.preference === 'dark')
          && typeof saved.lastActivity === 'number' && Number.isFinite(saved.lastActivity)
          && saved.lastActivity >= 0 && saved.lastActivity <= Date.now()) return saved as Override;
      } catch { /* Legacy untimed choices cannot establish freshness. */ }
      localStorage.removeItem(key);
      return null;
    } catch { storageAvailable = false; return undefined; } // Preserve the in-memory choice.
  };
  let override = read() ?? null;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelSave = () => { clearTimeout(saveTimer); saveTimer = undefined; };
  const save = () => {
    cancelSave();
    if (!storageAvailable) return;
    try {
      if (override) localStorage.setItem(key, JSON.stringify(override));
      else localStorage.removeItem(key);
    } catch { storageAvailable = false; /* The in-memory choice and expiry still work. */ }
  };
  const apply = () => {
    const preference = override?.preference ?? 'system';
    const theme = override?.preference ?? (system.matches ? 'dark' : 'light');
    const changed = root.dataset.themePreference !== preference || root.dataset.theme !== theme;
    root.dataset.themePreference = preference;
    root.dataset.theme = theme;
    if (changed) document.dispatchEvent(new Event('theme-change'));
  };
  const expired = () => override && (Date.now() - override.lastActivity >= idleLimit || Date.now() < override.lastActivity);
  const schedule = () => {
    clearTimeout(expiryTimer);
    expiryTimer = override ? setTimeout(refresh, Math.max(1, idleLimit - (Date.now() - override.lastActivity))) : undefined;
  };
  function refresh() {
    // Another tab may have renewed or changed the choice while this one slept.
    const saved = read();
    if (saved !== undefined) {
      if (saved && override && saved.preference === override.preference) {
        override.lastActivity = Math.max(override.lastActivity, saved.lastActivity);
      } else {
        override = saved;
        cancelSave();
      }
    }
    if (expired()) { override = null; save(); }
    apply();
    schedule();
  }
  const activity = () => {
    // A delayed timer must not let the first interaction revive an expired choice.
    if (expired()) refresh();
    if (!override) return;
    override.lastActivity = Date.now();
    // At most one write per second while scrolling/typing; flush on leaving.
    if (saveTimer === undefined) saveTimer = setTimeout(save, 1000);
  };
  const navigation = () => {
    refresh();
    activity();
    if (override) save();
  };
  document.addEventListener('theme-preference-change', () => {
    const choice = root.dataset.themePreference;
    override = choice === 'light' || choice === 'dark' ? { preference: choice, lastActivity: Date.now() } : null;
    save(); apply(); schedule();
  });
  // Capture also sees scrolling inside the outline, search results, and code.
  document.addEventListener('scroll', activity, { capture: true, passive: true });
  document.addEventListener('keydown', activity);
  document.addEventListener('input', activity);
  document.addEventListener('click', event => {
    if (!event.defaultPrevented && event.target instanceof Element && event.target.closest('a[href]')) navigation();
  });
  addEventListener('hashchange', navigation);
  addEventListener('popstate', navigation);
  addEventListener('pageshow', event => { if (event.persisted) navigation(); });
  addEventListener('pagehide', () => { if (saveTimer !== undefined) save(); });
  document.addEventListener('visibilitychange', () => {
    refresh();
    if (document.hidden && saveTimer !== undefined) save();
  });
  addEventListener('focus', refresh); // Check elapsed time after sleep, not new activity.
  system.addEventListener('change', refresh);
  addEventListener('storage', event => { if (event.key === key || event.key === null) refresh(); });
  navigation();
})();
