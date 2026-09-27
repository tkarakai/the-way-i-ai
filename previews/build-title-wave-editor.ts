import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { parseWavePosition } from '../design-system/wordmark.ts';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const styles = source.match(/<style>([\s\S]*?)<\/style>/)![1];
const hero = source.match(/<section class="collection-hero">[\s\S]*?<\/section>/)![0];
const lettering = hero.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1];
const registry = JSON.parse(await readFile(new URL('../topics/topics.json', import.meta.url), 'utf8')) as { titleBackgroundPosition: string };
const approved = parseWavePosition(JSON.parse(await readFile(new URL(`../topics/${registry.titleBackgroundPosition}`, import.meta.url), 'utf8')));
const corners = [
  ['topLeft', 'TL', 'Top left'], ['topRight', 'TR', 'Top right'],
  ['bottomRight', 'BR', 'Bottom right'], ['bottomLeft', 'BL', 'Bottom left'],
];
const handles = corners.map(([key, short, label]) => `<button class="corner-handle" data-corner="${key}" type="button" aria-label="${label} wave corner" title="Drag ${label.toLowerCase()}; arrow keys nudge, Shift makes larger steps">${short}</button>`).join('');
const fields = corners.map(([key, short, label]) => `<tr><th scope="row"><span class="corner-abbr">${short}</span><span class="sr-only">${label}</span></th>${['x', 'y'].map(axis => `<td><input type="number" step="0.00001" data-point="${key}" data-axis="${axis}" aria-label="${label} ${axis.toUpperCase()} position"></td>`).join('')}</tr>`).join('');
const uiSource = await readFile(new URL('title-wave-editor-ui.ts', import.meta.url), 'utf8');
const ui = ts.transpileModule(uiSource, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.None } }).outputText;
const html = `<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wave positioning editor · The Way I AI</title><style>${styles}
.editor { width:min(1360px,calc(100% - 48px)); margin:auto; padding:36px 0 44px; }
.editor-head { display:flex; justify-content:space-between; align-items:end; gap:28px; padding-bottom:24px; border-bottom:1px solid var(--ink); }
.editor-head h1 { font:450 clamp(34px,4vw,50px)/1.05 var(--serif); letter-spacing:-.025em; margin:10px 0 12px; }
.editor-head p { margin:0; color:var(--muted); font-size:14px; max-width:60ch; }
.theme-switch { display:flex; flex-shrink:0; border:1px solid var(--line); gap:4px; padding:4px; }
.theme-switch button { border:0; background:transparent; padding:10px 16px; font-size:12px; }
.theme-switch button[aria-pressed=true] { color:var(--paper); background:var(--ink); }
.editor-grid { display:grid; grid-template-columns:minmax(0,1fr) 310px; gap:24px; align-items:start; margin-top:24px; }
.workspace { min-width:0; border:1px solid var(--line); }
.stage-toolbar { padding:14px 18px; border-bottom:1px solid var(--line); display:flex; align-items:center; flex-wrap:wrap; justify-content:space-between; gap:10px; }
.stage-toolbar label { display:inline-flex; align-items:center; gap:9px; font-size:12px; }
.stage-toolbar select { max-width:100%; min-width:0; padding:7px 10px; background:var(--paper); color:var(--ink); border:1px solid var(--line); font:12px var(--sans); }
.stage-toolbar button { min-height:34px; }
.editor-stage { position:relative; width:100%; aspect-ratio:1.45; min-height:360px; overflow:hidden; container-type:inline-size; }
.editor-logo { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); isolation:isolate; width:max-content; font:450 clamp(40px,18cqw,156px)/.645 var(--serif); letter-spacing:-.045em; color:var(--title-ink); }
.editor-logo .title-line:last-child { text-align:right; color:var(--title-accent); }
.editor-logo .title-art { left:0; top:0; width:1em; height:1em; transform-origin:0 0; }
.editor-logo .title-background { width:100%; height:100%; }
.guides { position:absolute; inset:0; pointer-events:none; }
.guides svg { position:absolute; inset:0; width:100%; height:100%; overflow:hidden; }
.wave-outline { fill:none; stroke:var(--muted); stroke-width:1; stroke-dasharray:5 5; opacity:.65; }
.corner-handle { position:absolute; width:38px; height:38px; padding:0; transform:translate(-50%,-50%); border:1px solid var(--title-accent); border-radius:50%; color:var(--title-accent); background:var(--paper); font:600 10px var(--sans); pointer-events:auto; touch-action:none; cursor:grab; box-shadow:0 2px 8px #0001; }
.corner-handle:active { cursor:grabbing; }
.corner-handle:focus-visible { outline:2px solid var(--title-accent); outline-offset:4px; }
.title-origin { position:absolute; width:12px; height:12px; transform:translate(-50%,-50%); opacity:.55; }
.title-origin::before,.title-origin::after { content:''; position:absolute; background:var(--muted); }
.title-origin::before { left:5px; top:0; width:1px; height:11px; }
.title-origin::after { left:0; top:5px; width:11px; height:1px; }
.stage-help { border-top:1px solid var(--line); padding:13px 18px; margin:0; font-size:12px; color:var(--muted); }
.controls { min-width:0; }
.controls h2 { font:450 28px/1.2 var(--serif); margin:0 0 10px; }
.controls p { font-size:12px; color:var(--muted); margin:0 0 18px; }
.coordinate-table { border-collapse:collapse; width:100%; table-layout:fixed; font-size:12px; }
.coordinate-table th { text-align:left; font-weight:500; padding:6px 0; }
.coordinate-table th:first-child { width:46px; }
.coordinate-table td { padding:5px 0 5px 9px; }
.coordinate-table thead th:not(:first-child) { padding-left:9px; color:var(--muted); }
.coordinate-table input { width:100%; min-width:0; border:1px solid var(--line); padding:8px; font:12px var(--mono); background:var(--surface); color:var(--ink); }
.corner-abbr { display:inline-grid; place-items:center; width:30px; height:30px; border:1px solid var(--line); border-radius:50%; color:var(--title-accent); font-size:10px; }
.utility-row { display:flex; gap:8px; margin:16px 0 22px; }
.utility-row button { flex:1; }
button:disabled { opacity:.4; cursor:default; }
.export-controls { border-top:1px solid var(--line); padding-top:20px; }
.primary-button { width:100%; border:1px solid var(--title-accent); background:var(--title-accent); color:var(--paper); padding:12px 16px; font:550 13px var(--sans); cursor:pointer; }
.download-button { width:100%; margin:8px 0 12px; }
.save-status { min-height:2.5em; font-size:11px!important; margin:0 0 16px!important; }
.values-details { border-top:1px solid var(--line); padding-top:12px; font-size:12px; }
.values-details summary { color:var(--muted); }
.values-details textarea { display:block; resize:vertical; width:100%; min-height:260px; margin-top:12px; border:1px solid var(--line); background:var(--surface); color:var(--ink); padding:12px; font:11px/1.55 var(--mono); }
.feedback { min-height:1.6em; margin:14px 0 0; font-size:12px; color:var(--title-accent); }
.editor-footer { margin:22px 0 0; color:var(--muted); font-size:12px; }
@media(max-width:900px) { .editor-grid { grid-template-columns:minmax(0,1fr); } .controls { max-width:520px; width:100%; } }
@media(max-width:540px) { .editor { width:calc(100% - 28px); padding-top:24px; } .editor-head { display:block; } .theme-switch { margin-top:18px; width:max-content; } .stage-toolbar { padding:12px; align-items:start; } .stage-toolbar label { flex-wrap:wrap; } .editor-stage { min-height:340px; } }
@media print { .theme-switch,.guides,.stage-toolbar,.utility-row,.export-controls { display:none; } .editor-grid { display:block; } .editor-logo .title-art { display:block; } }
</style></head><body><main class="editor">
<header class="editor-head"><div><span class="eyebrow">The Way I AI · Wave editor</span><h1>Find the perfect wave.</h1><p>Drag any of the four corners to reshape the wave behind the lettering. When it looks right, copy the values and send them back.</p></div><div class="theme-switch" role="group" aria-label="Editor theme"><button type="button" data-editor-theme="light" aria-pressed="true">Light</button><button type="button" data-editor-theme="dark" aria-pressed="false">Dark</button></div></header>
<div class="editor-grid"><section class="workspace" aria-label="Interactive wave preview">
<div class="stage-toolbar"><label for="wave-preset">Start from <select id="wave-preset"><option value="approved" selected>Approved positioning</option><option value="C">Refined C</option><option value="A">Refined A</option><option value="B">Refined B</option><option value="D">Refined D</option><option value="current">Earlier live version</option><option value="wide">Original option 01</option><option value="custom" disabled>Custom positioning</option></select></label><button class="small-button" type="button" id="toggle-guides" aria-pressed="true">Hide handles</button></div>
<div class="editor-stage"><div class="editor-logo" role="img" aria-label="the way I AI">${lettering}</div><div class="guides"><svg aria-hidden="true"><polygon class="wave-outline"></polygon></svg><span class="title-origin" role="img" aria-label="Title origin" title="Title origin: X 0, Y 0"></span>${handles}</div></div>
<p class="stage-help">Drag a corner, or focus it and use the arrow keys. Hold Shift for larger steps. Hide the handles to judge the lettering and wave together.</p>
</section><aside class="controls" aria-label="Wave coordinates"><h2>Corner positions</h2><p>Values scale with the title. X moves right; Y moves down. The small cross marks the title’s origin.</p><table class="coordinate-table"><thead><tr><th scope="col">Corner</th><th scope="col">X · em</th><th scope="col">Y · em</th></tr></thead><tbody>${fields}</tbody></table>
<div class="utility-row"><button type="button" class="small-button" id="undo-wave" disabled>Undo</button><button type="button" class="small-button" id="reset-wave">Reset to approved</button></div>
<div class="export-controls"><button type="button" class="primary-button" id="copy-wave">Copy positioning</button><button type="button" class="small-button download-button" id="download-wave">Download JSON</button><p class="save-status" id="save-status"></p></div>
<details class="values-details"><summary>View implementation values</summary><textarea id="wave-config" readonly spellcheck="false" aria-label="Wave positioning JSON"></textarea></details>
<p class="feedback" id="editor-feedback" role="status" aria-live="polite"></p></aside></div>
<p class="editor-footer">A self-contained sample with the site’s exact font, colors, and wave. Your edits stay in this editor.</p>
<noscript><p>This editor needs JavaScript enabled to move the wave corners.</p></noscript>
</main><script type="application/json" id="approved-wave">${JSON.stringify(approved.corners)}</script><script>${ui.replaceAll('</script', '<\\/script')}</script></body></html>`;
await writeFile(new URL('title-wave-editor.html', import.meta.url), html);
console.log('Built previews/title-wave-editor.html');
