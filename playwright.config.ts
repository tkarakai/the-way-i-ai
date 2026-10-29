import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  webServer: { command: 'node scripts/server.ts', url: 'http://127.0.0.1:4193/', env: { PORT: '4193' }, reuseExistingServer: false },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { browserName: 'chromium', headless: true, trace: 'retain-on-failure' },
});
