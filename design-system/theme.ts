// Runs in the head so explicit preferences and System resolve before first paint.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const system = matchMedia('(prefers-color-scheme: dark)');
  const normalize = (value: string | null | undefined) => value === 'light' || value === 'dark' ? value : 'system';
  let preference = 'system';
  try { preference = normalize(localStorage.getItem('the-way-i-ai-theme')); } catch { /* Storage can be unavailable in standalone files. */ }
  const apply = () => {
    root.dataset.themePreference = preference;
    root.dataset.theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    document.dispatchEvent(new Event('theme-change'));
  };
  document.addEventListener('theme-preference-change', () => {
    preference = normalize(root.dataset.themePreference);
    try { localStorage.setItem('the-way-i-ai-theme', preference); } catch { /* The in-memory choice still works. */ }
    apply();
  });
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  addEventListener('storage', event => {
    if (event.key === 'the-way-i-ai-theme' || event.key === null) {
      preference = normalize(event.newValue);
      apply();
    }
  });
  apply();
})();
