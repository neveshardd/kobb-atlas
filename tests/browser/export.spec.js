import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('exporta PDF, PNG e DXF reais e respeita a cobertura do satélite', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/World_Imagery/MapServer/tilemap/**', route => {
    const zoom = Number(route.request().url().split('/tilemap/')[1].split('/')[0]);
    return route.fulfill({ json: { data: [zoom >= 18 ? 0 : 1], valid: true } });
  });
  await page.goto('/');
  await expect(page.locator('#map-status')).toBeHidden({ timeout: 35_000 });
  await page.locator('#basemap').selectOption('satellite');
  await expect(page.locator('#satellite-limit')).toHaveAttribute('data-zoom', '17');
  const zooms = [];
  page.on('request', request => { const match = request.url().match(/World_Imagery\/MapServer\/tile\/(\d+)/); if (match) zooms.push(Number(match[1])); });
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -4000);
  await page.waitForTimeout(800);
  expect(zooms.every(zoom => zoom <= 17)).toBe(true);
  await page.locator('#time').fill('12:00');
  await expect(page.locator('#phase')).toHaveAttribute('aria-label', 'Dia');
  for (const format of ['png', 'pdf', 'dxf']) {
    await page.locator('#export-button').click();
    await page.locator('#export-format').selectOption(format);
    const pending = page.waitForEvent('download'); await page.locator('#export-save').click();
    const download = await pending, bytes = await readFile(await download.path());
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
    if (format === 'pdf') { expect(bytes.subarray(0, 5).toString()).toBe('%PDF-'); expect(bytes.length).toBeGreaterThan(20_000); }
    if (format === 'png') {
      expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      const varied = await page.evaluate(async base64 => {
        const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const data = context.getImageData(300, 300, 800, 400).data;
        let count = 0; for (let index = 0; index < data.length; index += 40) if (Math.abs(data[index] - data[index + 1]) > 8 || Math.abs(data[index + 1] - data[index + 2]) > 8) count++;
        return count;
      }, bytes.toString('base64'));
      expect(varied).toBeGreaterThan(200);
    }
    if (format === 'dxf') { expect(bytes.toString()).toContain('ATLAS_RADIUS'); expect(bytes.toString()).toContain('ATLAS_SOLAR_3D'); }
    await download.saveAs(`${process.env.USERPROFILE}/.tools/kobb-atlas/atlas-export.${format}`);
  }
  expect(errors).toEqual([]);
});
