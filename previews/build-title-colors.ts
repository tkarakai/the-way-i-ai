import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('index.html', root), 'utf8');
const styles = source.match(/<style>([\s\S]*?)<\/style>/)![1];
const hero = source.match(/<section class="collection-hero">[\s\S]*?<\/section>/)![0];
const lettering = hero.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1].replace(/<span class="title-art"[^>]*>[\s\S]*?<\/span>/, '');
const edition = source.match(/<div class="edition-line eyebrow">[\s\S]*?<\/div>/)![0];
const brand = source.match(/<a class="brand"[^>]*>([\s\S]*?)<\/a>/)![1];
const palettes = [
  { id: 'current', name: 'Current · forest', note: 'The starting point.', light: { top: '#252e29', ai: '#275b43' }, dark: { top: '#eeefe4', ai: '#b4d3ac' } },
  { id: 'ember', name: 'Ink & copper', note: 'A warm, distinct accent.', light: { top: '#252e29', ai: '#ba4b2b' }, dark: { top: '#eeefe4', ai: '#ff986d' } },
  { id: 'cobalt', name: 'Ink & cobalt', note: 'A crisp, saturated blue.', light: { top: '#252e29', ai: '#315cd4' }, dark: { top: '#eeefe4', ai: '#88adff' } },
  { id: 'gold', name: 'Pine & gold', note: 'Forest green with a golden counterpoint.', light: { top: '#244d3b', ai: '#ac7412' }, dark: { top: '#c2d8c8', ai: '#edbd56' } },
  { id: 'teal', name: 'Plum & teal', note: 'Two distinct color families.', light: { top: '#4b2e4a', ai: '#147c86' }, dark: { top: '#edd7e8', ai: '#64cfd3' } },
  { id: 'mono', name: 'Stone & ink', note: 'Emphasis through light and dark.', light: { top: '#747b72', ai: '#17231e' }, dark: { top: '#87928a', ai: '#eeefe4' } },
];
const uiSource = await readFile(new URL('title-colors-ui.ts', import.meta.url), 'utf8');
const ui = ts.transpileModule(uiSource, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.None } }).outputText;
const cards = palettes.map((palette, index) => `<label class="palette-card" data-palette="${palette.id}">
  <span class="card-top"><span class="card-index">${String(index).padStart(2, '0')}</span><input type="radio" name="palette" value="${palette.id}" ${palette.id === 'teal' ? 'checked' : ''} aria-label="${palette.name}"></span>
  <span class="wordmark" aria-label="the way I AI">${lettering}</span>
  <span class="palette-name">${palette.name}</span><span class="palette-note">${palette.note}</span>
</label>`).join('\n');
const html = `<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Title color studies · The Way I AI</title><style>${styles}
.review { width:min(1320px, calc(100% - 64px)); margin:0 auto; padding:48px 0 60px; }
.review-head { display:flex; align-items:end; justify-content:space-between; gap:28px; padding-bottom:28px; border-bottom:1px solid var(--ink); }
.review-head > div { min-width:0; }
.review-head h1 { font:450 clamp(36px,4vw,54px)/1.05 var(--serif); letter-spacing:-.025em; margin:12px 0; }
.review-head p { color:var(--muted); max-width:58ch; margin:0; font-size:15px; }
.theme-switch { display:flex; flex-shrink:0; gap:4px; border:1px solid var(--line); padding:4px; }
.theme-switch button { border:0; background:transparent; padding:10px 18px; font-size:13px; }
.theme-switch button[aria-pressed=true] { background:var(--ink); color:var(--paper); }
.palette-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; padding:28px 0; margin:0; border:0; min-width:0; }
.palette-card { display:flex; flex-direction:column; min-width:0; border:1px solid var(--line); padding:22px 26px 24px; cursor:pointer; background:var(--paper); }
.palette-card[data-selected=true] { border-color:var(--ink); box-shadow:inset 0 0 0 1px var(--ink); }
.palette-card:focus-within { outline:2px solid var(--accent); outline-offset:4px; }
.card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:32px; }
.card-index { font-size:12px; color:var(--muted); letter-spacing:.1em; }
input[type=radio] { width:18px; height:18px; accent-color:var(--ink); margin:0; }
.palette-card .wordmark { display:block; width:max-content; max-width:100%; font:450 88px/.645 var(--serif); letter-spacing:-.045em; color:var(--title-top); margin-bottom:25px; }
.palette-card .wordmark .title-line:last-child { color:var(--title-ai); text-align:right; }
.palette-name { font-size:16px; font-weight:600; margin-bottom:4px; }
.palette-note { font-size:13px; color:var(--muted); line-height:1.5; }
.selection { padding:25px 28px; border:1px solid var(--line); background:var(--surface); }
.selection-copy { min-width:0; }
.selection h2 { font:450 30px/1.2 var(--serif); margin:4px 0 12px; }
.color-controls { display:flex; flex-wrap:wrap; gap:12px 26px; align-items:center; }
.color-control { display:grid; grid-template-columns:38px auto; column-gap:10px; align-items:center; font-size:13px; }
.color-control input { grid-row:span 2; width:38px; height:38px; padding:2px; border:1px solid var(--line); background:var(--paper); cursor:pointer; }
.color-control output { font:11px var(--mono); color:var(--muted); }
.context-label { display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; align-items:baseline; margin:36px 0 16px; }
.context-label h2 { font:450 27px var(--serif); margin:0; }
.context-label p { margin:0; color:var(--muted); font-size:13px; }
.site-preview { border:1px solid var(--line); padding:0 36px; background:var(--paper); min-width:0; }
.preview-masthead { display:flex; gap:20px; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); min-height:80px; }
.preview-masthead > span:last-child { font-size:13px; color:var(--muted); }
.site-preview .collection-hero { gap:40px; }
.site-preview .collection-hero h1 { color:var(--title-top); }
.site-preview .collection-hero h1 .title-line:last-child { color:var(--title-ai); }
.review-footer { margin-top:20px; color:var(--muted); font-size:12px; }
@media(max-width:1100px) { .palette-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .site-preview .collection-hero { grid-template-columns:minmax(0,1fr); } }
@media(max-width:640px) { .review { width:calc(100% - 32px); padding-top:28px; } .review-head { display:block; } .theme-switch { margin-top:20px; width:max-content; } .palette-grid { grid-template-columns:minmax(0,1fr); } .palette-card { padding:20px 24px; } .palette-card .wordmark { font-size:80px; } .selection { padding:22px; } .site-preview { padding:0 20px; } .preview-masthead { flex-wrap:wrap; padding:16px 0; gap:8px; } .site-preview .collection-hero h1 { font-size:56px; } }
</style></head><body>
<main class="review">
  <header class="review-head"><div><span class="eyebrow">The Way I AI · Color studies</span><h1>Give AI its own color.</h1><p>Compare six palettes on the site's own backgrounds. Select a direction, switch themes, and fine-tune either title color.</p></div><div class="theme-switch" role="group" aria-label="Preview theme"><button type="button" data-theme-choice="light" aria-pressed="true">Light</button><button type="button" data-theme-choice="dark" aria-pressed="false">Dark</button></div></header>
  <section aria-label="Title color variations">
    <fieldset class="palette-grid"><legend class="sr-only">Choose a title palette</legend>${cards}</fieldset>
    <div class="selection"><div class="selection-copy"><span class="eyebrow">Selected palette · adjust the colors below</span><h2 id="selection-name">Plum &amp; teal</h2><div class="color-controls"><span id="editing-theme" class="eyebrow">Light mode colors</span><label class="color-control"><input type="color" id="top-color" value="#4b2e4a"><span>the way I</span><output id="top-hex">#4B2E4A</output></label><label class="color-control"><input type="color" id="ai-color" value="#147c86"><span>AI</span><output id="ai-hex">#147C86</output></label></div></div></div>
  </section>
  <div class="context-label"><h2>In context</h2><p>Your selected palette on the collection header.</p></div>
  <div id="site-preview" class="site-preview"><div class="preview-masthead"><span class="brand">${brand}</span><span>Contents</span></div>${edition}${hero}</div>
  <p class="review-footer">Uses the site's Newsreader / DM Sans typography, paper and forest backgrounds, and exact letter alignment. Color adjustments stay in this preview.</p>
</main>
<script type="application/json" id="palette-data">${JSON.stringify(palettes)}</script><script>${ui.replaceAll('</script', '<\\/script')}</script>
</body></html>`;
await writeFile(new URL('title-colors.html', import.meta.url), html);
console.log('Built previews/title-colors.html');
