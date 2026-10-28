import { test as base, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** These specs describe the Folio design. Field Atlas, the default, is covered in atlas.spec.ts. */
export const test = base.extend<{}, { siteURL: string }>({
  // file:// storage semantics are implementation-defined. Persistence and
  // cross-tab tests need a real shared origin, as on the published site.
  siteURL: [async ({}, use) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/preview.ts', import.meta.url))], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Storage-test preview did not start')), 10_000);
        let output = '';
        child.stdout.on('data', chunk => {
          output += String(chunk);
          const match = output.match(/Preview: (http:\/\/127\.0\.0\.1:\d+\/)/);
          if (match) { clearTimeout(timer); resolve(match[1]); }
        });
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('exit', code => { clearTimeout(timer); reject(new Error(`Storage-test preview exited: ${code}`)); });
      });
      await use(url);
    } finally {
      child.kill('SIGTERM');
      await new Promise<void>(resolve => {
        if (child.exitCode !== null || child.signalCode) resolve();
        else child.once('exit', () => resolve());
      });
    }
  }, { scope: 'worker' }],
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try { if (!localStorage.getItem('the-way-i-ai-design')) localStorage.setItem('the-way-i-ai-design', 'folio'); } catch { /* Storage-blocking tests stub this. */ }
    });
    await use(context);
  },
});
export { expect };
export type { Page } from '@playwright/test';
