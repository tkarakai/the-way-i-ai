import { test as base, expect } from '@playwright/test';

/** These specs describe the Folio design. Field Atlas, the default, is covered in atlas.spec.ts. */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try { if (!localStorage.getItem('the-way-i-ai-design')) localStorage.setItem('the-way-i-ai-design', 'folio'); } catch { /* Storage-blocking tests stub this. */ }
    });
    await use(context);
  },
});
export { expect };
export type { Page } from '@playwright/test';
