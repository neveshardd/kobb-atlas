import { test, expect } from '@playwright/test';

test('DWG integrado informa o destino somente depois de salvar e exibe falhas', async ({ page }) => {
  await page.addInitScript(() => {
    let listener;
    window.exportFailure = false;
    window.chrome = { webview: {
      addEventListener: (name, handler) => { listener = handler; },
      postMessage: message => {
        let result;
        if (message.type === 'export-capabilities') result = { data: { dwg: true } };
        else if (message.type === 'export-file') {
          window.exportPayload = message.data;
          result = window.exportFailure ? { error: 'Falha ao gravar o arquivo.' } : { data: { saved: true, path: 'C:\\Estudos\\atlas.dwg' } };
        } else result = { error: 'Dados indisponíveis no teste.' };
        setTimeout(() => listener({ data: { id: message.id, ...result } }), 20);
      }
    } };
  });
  await page.goto('/');
  await expect(page.locator('#solar-altitude')).not.toHaveText('—');
  await page.locator('#export-button').click();
  await expect(page.locator('#export-format option[value="dwg"]')).toBeEnabled();
  await expect(page.locator('#export-format')).not.toContainText('requer AutoCAD');
  await page.locator('#export-format').selectOption('dwg');
  await page.locator('#export-save').click();
  await expect(page.locator('#status')).toHaveText('Arquivo salvo: C:\\Estudos\\atlas.dwg');
  await expect(page.locator('#export-dialog')).not.toBeVisible();
  expect(await page.evaluate(() => window.exportPayload.format)).toBe('dwg');
  expect(await page.evaluate(() => atob(window.exportPayload.content))).toContain('\r\nENTITIES\r\n');
  await page.evaluate(() => { window.exportFailure = true; });
  await page.locator('#export-button').click();
  await page.locator('#export-save').click();
  await expect(page.locator('#status')).toHaveText('Falha ao gravar o arquivo.');
  await expect(page.locator('#export-dialog')).toBeVisible();
  await expect(page.locator('#export-save')).toBeEnabled();
});
