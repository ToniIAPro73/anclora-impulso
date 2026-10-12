/** Playwright `test` with the preventive network policy applied to every context and API request fixture. */
import { test as base, expect } from '@playwright/test';
import { guardApiRequests, installNetworkPolicy } from './network-policy';

export const test = base.extend({
  context: async ({ context }, use) => {
    await installNetworkPolicy(context);
    await use(context);
  },
  request: async ({ request }, use) => {
    await use(guardApiRequests(request));
  },
});

export { expect };
export type { Page } from '@playwright/test';
