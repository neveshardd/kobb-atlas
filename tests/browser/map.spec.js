import { test, expect } from '@playwright/test';

test('mapa real carrega terreno e camadas com worker local', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#map-status')).toBeHidden({ timeout: 35_000 });
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await page.getByRole('button', { name: '2D', exact: true }).click(); await expect(page.locator('#view-2d')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.locator('#time').fill('12:00'); await page.locator('#time').dispatchEvent('change');
  await page.waitForTimeout(3500);
  await expect(page.locator('#map svg path[stroke=\"#bf7800\"]')).toHaveAttribute('d', /M.+L/);
  await expect(page.locator('#map svg text')).toHaveCount(13);
  const arc = await page.locator('#map svg path[stroke="#bf7800"]').getAttribute('d');
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.locator('#map svg path[stroke="#bf7800"]')).not.toHaveAttribute('d', arc);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: process.env.USERPROFILE + '/.tools/kobb-atlas/atlas-map-real.png', fullPage: true });
  expect(errors).toEqual([]);
});
