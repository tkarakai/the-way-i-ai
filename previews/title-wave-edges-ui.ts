document.querySelectorAll<HTMLButtonElement>('[data-wave-theme]').forEach(button => {
  button.addEventListener('click', () => {
    const theme = button.dataset.waveTheme!;
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll<HTMLButtonElement>('[data-wave-theme]').forEach(choice => {
      choice.setAttribute('aria-pressed', String(choice.dataset.waveTheme === theme));
    });
  });
});
