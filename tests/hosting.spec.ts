import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('demonstração informa limites e não promete recuperação por e-mail', async ({ page }) => {
  // UI contract exercised against the runtime-config response; backend guards have integration coverage.
  await page.route('**/api/config', (route) =>
    route.fulfill({
      json: { preview: true, mailEnabled: false },
    }),
  );
  await page.goto('/entrar');
  await expect(page.getByRole('complementary', { name: 'Ambiente de demonstração' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Esqueci minha senha' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Entrar na minha conta' })).toBeVisible();
  await page.goto('/recuperar-senha');
  await expect(
    page.getByText('Envio de e-mail indisponível nesta demonstração.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar instruções' })).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
