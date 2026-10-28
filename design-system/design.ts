// Runs in the head: apply the saved design before first paint. Field Atlas is the default.
(() => {
  try {
    const saved = localStorage.getItem('the-way-i-ai-design');
    if (saved === 'atlas' || saved === 'folio') document.documentElement.dataset.design = saved;
  } catch { /* Without storage, the generated default design is used. */ }
})();
