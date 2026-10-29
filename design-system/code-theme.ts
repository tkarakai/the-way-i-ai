import { getResolvedOrResolveTheme, registerCustomTheme } from '@pierre/diffs';

/** Adapt low-contrast GitHub syntax colours to both designs' code surfaces. */
export function registerCodeThemes(): void {
  for (const [mode, comment] of [['light', '#59636e'], ['dark', '#aab2bd']] as const) {
    registerCustomTheme(`reader-${mode}`, async () => {
      const theme = await getResolvedOrResolveTheme(`github-${mode}`, 'shiki-js');
      if (!theme.textmate) throw new Error(`Missing GitHub ${mode} syntax theme.`);
      return {
        ...theme.textmate,
        name: `reader-${mode}`,
        settings: theme.textmate.settings.map(token => {
          const scopes = typeof token.scope === 'string' ? [token.scope] : token.scope ?? [];
          const foreground = scopes.some(scope => /\bcomment\b/.test(scope)) ? comment
            : mode === 'light' && token.settings.foreground?.toLowerCase() === '#d73a49' ? '#b12636'
            : token.settings.foreground;
          return { ...token, settings: { ...token.settings, foreground } };
        }),
      };
    }, 'textmate');
  }
}
