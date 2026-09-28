// Homepage-only controller. The renderer is prepended at build time.
(() => {
  const canvas = document.querySelector<HTMLCanvasElement>('.ambient-canvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, time = 12, last = 0, frame = 0;
  let printing = false, suspended = false;
  const paint = () => {
    if (!width || !height) return;
    const w = 1000, h = height / width * w;
    const scale = canvas.width / w;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    window.drawMurmuration(ctx, w, h, time, document.documentElement.dataset.theme === 'dark');
  };
  const canAnimate = () => !reduced.matches && !document.hidden && !printing && !suspended;
  const tick = (now: number) => {
    frame = 0;
    if (!canAnimate()) { last = 0; return; }
    if (!last || now - last >= 1000 / 30) {
      if (last) time += Math.min((now - last) / 1000, .1);
      last = now;
      paint();
    }
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    // A still frame remains available when motion is reduced.
    if (!document.hidden && !suspended) paint();
    if (canAnimate()) frame = requestAnimationFrame(tick);
  };
  new ResizeObserver(() => {
    const box = canvas.getBoundingClientRect();
    width = box.width; height = box.height;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    sync();
  }).observe(canvas);
  reduced.addEventListener('change', sync);
  document.addEventListener('theme-change', sync);
  document.addEventListener('visibilitychange', sync);
  addEventListener('pagehide', () => { suspended = true; sync(); });
  addEventListener('pageshow', () => { suspended = false; sync(); });
  addEventListener('beforeprint', () => { printing = true; sync(); });
  addEventListener('afterprint', () => { printing = false; sync(); });
})();
