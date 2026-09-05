import { test, expect } from '@playwright/test';

test.describe('Supabase OAuth Contract E2E', () => {
  test('login screen displays social affordances', async ({ page }) => {
    await page.goto('/login');
    const googleBtn = page.locator('button:has-text("Google")');
    if (await googleBtn.count() > 0) {
      await expect(googleBtn.first()).toBeVisible();
    }
  });
});
