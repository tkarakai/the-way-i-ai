// Runs in the head: apply the saved design before first paint. Field Atlas is the default.
(() => {
  try {
    const saved = localStorage.getItem('the-way-i-ai-design');
    if (saved === 'atlas' || saved === 'folio') document.documentElement.dataset.design = saved;
    // The Field Atlas home page shows Browse (the paged spread) unless the reader chose List.
    if (localStorage.getItem('the-way-i-ai-home-view') === 'list') document.documentElement.dataset.homeView = 'list';
  } catch { /* Without storage, the generated default design is used. */ }
})();
// Motion follows the device's reduced-motion setting; readers can also turn animations off here.
// data-motion="reduce" is the one switch every script and stylesheet checks; it changes live.
(() => {
  const root = document.documentElement;
  const system = matchMedia('(prefers-reduced-motion: reduce)');
  const key = 'the-way-i-ai-motion';
  const apply = () => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(key); } catch { /* The device setting still applies. */ }
    // This page's own choice wins when storage is unavailable.
    const reduce = system.matches || (root.dataset.motionChoice ?? saved) === 'reduce';
    if ((root.dataset.motion === 'reduce') === reduce) return;
    if (reduce) root.dataset.motion = 'reduce'; else delete root.dataset.motion;
    document.dispatchEvent(new Event('motion-change'));
  };
  system.addEventListener('change', apply);
  addEventListener('storage', event => { if (event.key === key || event.key === null) { delete root.dataset.motionChoice; apply(); } });
  document.addEventListener('motion-preference-change', apply);
  apply();
})();
