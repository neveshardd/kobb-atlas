import { test, expect } from '@playwright/test';

test('mapa real carrega terreno e camadas com worker local', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#map-status')).toBeHidden({ timeout: 35_000 });
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('#north-up')).toHaveCount(0);
  await expect(page.locator('#map-compass svg text')).toHaveCount(8);
  await page.getByRole('button', { name: '2D', exact: true }).click(); await expect(page.locator('#view-2d')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.locator('#time').fill('12:00'); await page.locator('#time').dispatchEvent('change');
  await page.waitForTimeout(3500);
  await expect(page.locator('#map svg path[fill=\"#ff7900\"]')).toHaveAttribute('d', /M.+L/);
  await expect(page.locator('#map svg text')).toHaveCount(13);
  await page.screenshot({ path: process.env.USERPROFILE + '/.tools/kobb-atlas/atlas-ribbon-3d.png', fullPage: true });
  const compass3d = await page.locator('#map-compass svg path').first().getAttribute('d');
  const arc = await page.locator('#map svg path[fill="#ff7900"]').getAttribute('d');
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.locator('#map svg path[fill="#ff7900"]')).not.toHaveAttribute('d', arc);
  await expect(page.locator('#map-compass svg path').first()).not.toHaveAttribute('d', compass3d);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.waitForTimeout(700);
  const coordinates = await page.locator('#coordinates').textContent();
  const compassNodes = await page.locator('#map-compass svg path').elementHandles();
  const canvas = await page.locator('.maplibregl-canvas').boundingBox();
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.locator('#view-2d')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(canvas.x + canvas.width / 2 + 30, canvas.y + canvas.height / 2, { steps: 8 });
  await page.mouse.up({ button: 'middle' });
  await expect(page.locator('#view-3d')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#view-2d')).toHaveAttribute('aria-pressed', 'false');
  for (const button of ['middle', 'right']) {
    const compassBefore = await page.locator('#map-compass').getAttribute('aria-label');
    const before = await page.locator('#map svg path[fill="#ff7900"]').getAttribute('d');
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.down({ button });
    await page.mouse.move(canvas.x + canvas.width / 2 + 110, canvas.y + canvas.height / 2 + 35, { steps: 8 });
    await page.mouse.up({ button });
    await expect(page.locator('#map svg path[fill="#ff7900"]')).not.toHaveAttribute('d', before);
    await expect(page.locator('#coordinates')).toHaveText(coordinates);
    await expect(page.locator('#map-compass')).not.toHaveAttribute('aria-label', compassBefore);
  }
  expect(await compassNodes[0].evaluate(node => node.isConnected)).toBe(true);
  const labels = await page.locator('#map svg text:visible').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }; }));
  expect(labels.length).toBeGreaterThan(1);
  for (let index = 0; index < labels.length; index++) for (const other of labels.slice(index + 1)) {
    const box = labels[index];
    expect(box.right <= other.left || box.left >= other.right || box.bottom <= other.top || box.top >= other.bottom).toBe(true);
  }
  await page.locator('#points-all').uncheck();
  for (const category of ['transport', 'worship', 'institution', 'commerce', 'other']) await expect(page.locator(`#points-${category}`)).not.toBeChecked();
  await page.locator('#points-worship').check();
  expect(await page.locator('#points-all').evaluate(input => input.indeterminate)).toBe(true);
  const satellite = page.waitForResponse(response => response.url().includes('World_Imagery/MapServer/tile/') && response.ok(), { timeout: 30_000 });
  await page.locator('#basemap').selectOption('satellite');
  expect((await satellite).headers()['content-type']).toContain('image');
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('Esri');
  await expect(page.locator('#map svg path[fill="#ff7900"]')).toHaveAttribute('d', /M.+L/);
  await page.screenshot({ path: process.env.USERPROFILE + '/.tools/kobb-atlas/atlas-map-real.png', fullPage: true });
  expect(errors).toEqual([]);
});
