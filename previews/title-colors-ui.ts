type Theme = 'light' | 'dark';
type Colors = { top: string; ai: string };
type Palette = { id: string; name: string; light: Colors; dark: Colors };

const paletteData = document.querySelector<HTMLScriptElement>('#palette-data')!;
const palettes = JSON.parse(paletteData.textContent!) as Palette[];
let theme: Theme = 'light';
let selected = palettes.find(palette => palette.id === 'teal')!;
const topInput = document.querySelector<HTMLInputElement>('#top-color')!;
const aiInput = document.querySelector<HTMLInputElement>('#ai-color')!;
const selectionName = document.querySelector<HTMLElement>('#selection-name')!;
const preview = document.querySelector<HTMLElement>('#site-preview')!;

function paint() {
  document.documentElement.dataset.theme = theme;
  for (const palette of palettes) {
    const card = document.querySelector<HTMLElement>(`[data-palette="${palette.id}"]`)!;
    card.style.setProperty('--title-top', palette[theme].top);
    card.style.setProperty('--title-ai', palette[theme].ai);
    card.dataset.selected = String(palette.id === selected.id);
    card.querySelector<HTMLInputElement>('input')!.checked = palette.id === selected.id;
  }
  document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  });
  preview.style.setProperty('--title-top', selected[theme].top);
  preview.style.setProperty('--title-ai', selected[theme].ai);
  topInput.value = selected[theme].top;
  aiInput.value = selected[theme].ai;
  selectionName.textContent = selected.name;
  document.querySelector('#editing-theme')!.textContent = `${theme === 'light' ? 'Light' : 'Dark'} mode colors`;
  document.querySelector('#top-hex')!.textContent = selected[theme].top.toUpperCase();
  document.querySelector('#ai-hex')!.textContent = selected[theme].ai.toUpperCase();
}

document.querySelectorAll<HTMLInputElement>('input[name="palette"]').forEach(input => {
  input.addEventListener('change', () => {
    selected = palettes.find(palette => palette.id === input.value)!;
    paint();
  });
});
document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach(button => {
  button.addEventListener('click', () => { theme = button.dataset.themeChoice as Theme; paint(); });
});
for (const [input, key] of [[topInput, 'top'], [aiInput, 'ai']] as const) {
  input.addEventListener('input', () => {
    selected[theme][key] = input.value;
    paint();
  });
}
paint();
