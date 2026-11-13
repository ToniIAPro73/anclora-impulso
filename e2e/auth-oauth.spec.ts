import { test, expect } from '@playwright/test';

test.describe('Anclora Impulso Auth & OIDC Contract E2E', () => {
  test('login screen renders accessible email/password form and configured identity affordances', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/email|correo/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña|password/i).first()).toBeVisible();

    const identityBtn = page.getByRole('button', { name: /Anclora Identity/i });
    if (await identityBtn.count() > 0) {
      await expect(identityBtn.first()).toBeVisible();
    }

    const googleBtn = page.getByRole('button', { name: /Google/i });
    if (await googleBtn.count() > 0) {
      await expect(googleBtn.first()).toBeVisible();
    }
  });
});
