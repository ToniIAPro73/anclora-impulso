import { defineConfig, devices } from '@playwright/test';

/**
 * E2E test config for Anclora Impulso.
 *
 * Run: pnpm test:e2e
 * Debug: npx playwright test --ui
 *
 * The webServer block starts `next dev` before the tests run.
 * Set BASE_URL env to override (e.g. for CI pointing at a preview URL).
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
