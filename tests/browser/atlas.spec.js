import { test, expect } from '@playwright/test';

test('estudo solar, campos estáveis e exportação com dados indisponíveis', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ status: 503, body: '' }));
  await page.route('https://archive-api.open-meteo.com/**', route => route.fulfill({ status: 503, body: '' }));
  await page.goto('/');
  await expect(page.locator('#solar-altitude')).not.toHaveText('—');
  await expect(page.locator('#wind-kind')).toHaveText('Indisponível');
  const box = await page.locator('#latitude').boundingBox();
  await page.locator('#latitude').focus(); await page.locator('#latitude').selectText();
  expect(await page.locator('#latitude').boundingBox()).toEqual(box);
  await page.locator('#date').fill('2026-06-21'); await page.locator('#date').dispatchEvent('change');
  await page.locator('#time').fill('12:00'); await page.locator('#time').dispatchEvent('change');
  await expect(page.locator('#season-name')).toHaveText('Inverno');
  await page.getByRole('button', { name: 'Fontes', exact: true }).click(); await expect(page.locator('#sources-dialog')).toBeVisible(); await page.keyboard.press('Escape');
  const download = page.waitForEvent('download'); await page.locator('#export-button').click();
  expect((await download).suggestedFilename()).toBe('atlas-2026-06-21.json');
  await page.screenshot({ path: process.env.USERPROFILE + '/.tools/kobb-atlas/atlas-interface.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('consulta do entorno não inventa níveis sonoros', async ({ page }) => {
  await page.route('https://overpass-api.de/**', route => route.fulfill({ json: { elements: [{ type: 'node', id: 1, lat: -23.5504, lon: -46.6332, tags: { amenity: 'school', name: 'Instituição de teste' } }, { type: 'node', id: 2, lat: -23.55, lon: -46.633, tags: { building: 'industrial', name: 'Indústria de teste' } }] } }));
  await page.goto('/'); await page.locator('#noise-layer').check();
  await expect(page.locator('#status')).toContainText('2 usos cadastrados');
  await expect(page.locator('#noise-legend')).toBeVisible();
  await page.locator('#noise-places').selectOption('node/1');
  await expect(page.locator('#poi-name')).toHaveText('Instituição de teste');
  await expect(page.locator('#poi-kind')).toContainText('Receptor sensível');
  await expect(page.locator('#poi-noise')).toHaveText('Nível sonoro não medido');
  const pending = page.waitForEvent('download'); await page.locator('#export-button').click();
  const download = await pending; const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const report = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(report.surroundings.measuredSoundLevels).toBe(false); expect(report.surroundings.items.every(item => item.soundLevel === null)).toBe(true);
});

test('vento calmo preserva direção e ícone na borda', async ({ page }) => {
  const hourly = { time: [], wind_speed_10m: [], wind_direction_10m: [], temperature_2m: [] };
  const start = new Date(); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - 2);
  for (let index = 0; index < 120; index++) { hourly.time.push(new Date(start.getTime() + index * 3_600_000).toISOString().slice(0, 16)); hourly.wind_speed_10m.push(.2); hourly.wind_direction_10m.push(270); hourly.temperature_2m.push(20); }
  await page.route('https://api.open-meteo.com/v1/forecast**', route => route.fulfill({ json: { hourly } }));
  await page.goto('/');
  await expect(page.locator('#wind-speed')).toHaveText('0,2 m/s');
  await expect(page.locator('#wind-from')).toHaveText('O · 270°'); await expect(page.locator('#wind-to')).toHaveText('L · 90°');
  await expect(page.locator('#wind-diagram path[stroke="#236d8e"]')).toHaveCount(1);
  await expect(page.locator('#wind-diagram g[data-wind-icons]')).toHaveAttribute('data-wind-icons', '1');
});
