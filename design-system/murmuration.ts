/** Shared browser-script renderer for the homepage and the motion-study preview.
 * Both builders prepend this script before their controller; no runtime imports.
 * Geometry, timing, palette and density are the approved study F, unchanged.
 */
declare global {
  interface Window {
    drawMurmuration(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dark: boolean): void;
  }
}
window.drawMurmuration = (ctx, w, h, t, dark) => {
  type RGB = [number, number, number];
  const rgb = (color: RGB, alpha: number) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  const mix = (a: RGB, b: RGB, amount: number): RGB => a.map((value, i) => Math.round(value + (b[i] - value) * amount)) as RGB;
  const [teal, plum, gold]: RGB[] = dark
    ? [[100, 207, 211], [217, 163, 184], [223, 177, 131]]
    : [[20, 124, 134], [125, 70, 103], [166, 112, 50]];
  const tau = Math.PI * 2;
  const count = 1300, size = Math.min(w * .44, h * .7);
  const point = (i: number, clock: number) => {
    const r = Math.sqrt((i + .5) / count);
    const a = i * 2.3999632297 + clock * .09;
    const fold = 1 + .36 * Math.sin(a * 3 + clock * .16) * r;
    const x = Math.cos(a) * r * fold;
    const y = Math.sin(a) * r * fold;
    const z = Math.sin(a * 2 - clock * .12) * r * .48;
    const tilt = .55 + Math.sin(clock * .075) * .35;
    return { x: w * .5 + (x + z * Math.sin(clock * .04)) * size, y: h * .52 + (y * Math.cos(tilt) + z * Math.sin(tilt)) * size * .74, depth: z };
  };
  for (let i = 0; i < count; i++) {
    const p = point(i, t), previous = point(i, t - .22);
    const color = i % 7 === 0 ? gold : mix(teal, plum, (Math.sin(i * .013) + 1) / 2);
    const alpha = .2 + (p.depth + .5) * .45;
    ctx.strokeStyle = rgb(color, alpha * .6); ctx.lineWidth = .85;
    ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.fillStyle = rgb(color, alpha);
    ctx.beginPath(); ctx.arc(p.x, p.y, .85 + (p.depth + .5) * 1.15, 0, tau); ctx.fill();
  }
}
