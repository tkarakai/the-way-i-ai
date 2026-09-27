import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const styles = source.match(/<style>([\s\S]*?)<\/style>/)![1];
const hero = source.match(/<section class="collection-hero">[\s\S]*?<\/section>/)![0];
const lettering = hero.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1];
const refined = process.argv.includes('--refine');
const choices = refined ? [
  { number: 'A', name: 'Closer to previous 01', note: 'The widest of these four intermediate positions.', scale: .79 },
  { number: 'B', name: 'Just left of halfway', note: 'A little more inward, approaching the letter diagonal.', scale: .755 },
  { number: 'C', name: 'Just right of halfway', note: 'A slightly tighter wave through the y / A junction.', scale: .72 },
  { number: 'D', name: 'Closer to previous 02', note: 'The narrowest of these four intermediate positions.', scale: .685 },
] : [
  { number: '01', name: 'Halfway back', note: 'A wider wave. The left edge returns halfway toward its original position.', scale: .825 },
  { number: '02', name: 'Earlier live version', note: 'The previously shipped version, for comparison.', scale: .65 },
  { number: '03', name: 'A little further right', note: 'The left edge is tucked in a little more.', scale: .5625 },
  { number: '04', name: 'Further right', note: 'The shortest reach to the left.', scale: .475 },
];
// Keep the current rotated image's rightmost edge exactly fixed while varying
// its screen-space width. The source image is 2:1 and rotates by -6 degrees.
const rotatedWidth = Math.cos(Math.PI / 30) + Math.sin(Math.PI / 30) / 2;
const cards = choices.map(choice => {
  const shift = 17.5 + (.65 - choice.scale) * rotatedWidth * 50;
  return `<article class="wave-option" style="--wave-scale:${choice.scale};--wave-shift:${shift}%" aria-labelledby="option-${choice.number}">
    <div class="option-heading"><h2 id="option-${choice.number}"><span class="option-number">${choice.number}</span>${choice.name}</h2>${choice.number === '02' ? '<span class="current-label">Previous version</span>' : ''}</div>
    <div class="sample-stage"><div class="wave-logo" role="img" aria-label="the way I AI">${lettering}</div></div>
    <p class="option-note">${choice.note}</p>
  </article>`;
}).join('\n');
const uiSource = await readFile(new URL('title-wave-edges-ui.ts', import.meta.url), 'utf8');
const ui = ts.transpileModule(uiSource, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.None } }).outputText;
const html = `<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${refined ? 'Wave stroke alignment' : 'Wave edge variations'} · The Way I AI</title><style>${styles}
.wave-review { width:min(1240px, calc(100% - 48px)); margin:auto; padding:42px 0; }
.review-header { display:flex; justify-content:space-between; align-items:end; gap:28px; padding-bottom:24px; border-bottom:1px solid var(--ink); }
.review-header > div { min-width:0; }
.review-header h1 { margin:10px 0 12px; font:450 clamp(34px,4vw,50px)/1.05 var(--serif); letter-spacing:-.025em; }
.review-header p { margin:0; max-width:58ch; color:var(--muted); font-size:14px; }
.theme-switch { display:flex; flex-shrink:0; border:1px solid var(--line); padding:4px; gap:4px; }
.theme-switch button { border:0; padding:10px 17px; background:transparent; font-size:12px; }
.theme-switch button[aria-pressed=true] { color:var(--paper); background:var(--ink); }
.wave-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:22px; padding-top:24px; }
.wave-option { min-width:0; padding:22px 28px 20px; border:1px solid var(--line); container-type:inline-size; }
.option-heading { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:8px 16px; }
.option-heading h2 { display:flex; align-items:baseline; gap:14px; margin:0; font-size:15px; font-weight:550; line-height:1.4; }
.option-number { color:var(--muted); font-size:12px; letter-spacing:.08em; }
.current-label { font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:var(--accent); }
.sample-stage { display:grid; place-items:center; height:clamp(210px,58cqw,310px); }
.wave-logo { position:relative; isolation:isolate; width:max-content; max-width:100%; font:450 clamp(56px,22cqw,112px)/.645 var(--serif); letter-spacing:-.045em; color:var(--title-ink); }
.wave-logo .title-line:last-child { text-align:right; color:var(--title-accent); }
.wave-logo .title-art { left:-.45em; top:-.42em; width:calc(100% + 1em); height:auto; aspect-ratio:2; transform-origin:center; transform:translateX(var(--wave-shift)) scaleX(var(--wave-scale)) rotate(-6deg); }
.option-note { border-top:1px solid var(--line); padding-top:14px; margin:0; color:var(--muted); font-size:13px; line-height:1.5; }
.review-footer { font-size:12px; color:var(--muted); margin:22px 0 0; }
@media(max-width:760px) { .wave-review { width:calc(100% - 32px); padding-top:28px; } .review-header { display:block; } .theme-switch { margin-top:20px; width:max-content; } .wave-options { grid-template-columns:minmax(0,1fr); gap:16px; } .wave-option { padding:20px 24px; } }
@media print { .theme-switch { display:none; } .wave-logo .title-art { display:block; } }
</style></head><body><main class="wave-review">
  <header class="review-header"><div><span class="eyebrow">The Way I AI · Wave study</span><h1>${refined ? 'Follow the letter strokes.' : 'Where should the wave begin?'}</h1><p>${refined ? 'Four finer positions between the previous 01 and 02. Compare the wave through the y / A junction; the lettering, wave height, and right edge stay fixed.' : 'Four positions for the left edge. The lettering, wave height, and right edge stay fixed. Compare the options and choose a number.'}</p></div><div class="theme-switch" role="group" aria-label="Preview theme"><button type="button" data-wave-theme="light" aria-pressed="true">Light</button><button type="button" data-wave-theme="dark" aria-pressed="false">Dark</button></div></header>
  <section class="wave-options" aria-label="Four wave edge variations">${cards}</section>
  <p class="review-footer">The same Plum &amp; teal lettering and embedded wave as the site. This sample is self-contained and opens offline.</p>
</main><script>${ui.replaceAll('</script', '<\\/script')}</script></body></html>`;
const output = refined ? 'title-wave-alignment.html' : 'title-wave-edges.html';
await writeFile(new URL(output, import.meta.url), html);
console.log(`Built previews/${output}`);
