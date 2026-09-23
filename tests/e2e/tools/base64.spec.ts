import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

test.describe('Base64', () => {
  test('テキストをエンコードする', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/base64/');
    await page.locator('[data-input]').fill('こんにちは');
    await expect(page.locator('[data-output]')).toHaveValue('44GT44KT44Gr44Gh44Gv');
    expect(w.external).toEqual([]);
  });

  test('ファイルをエンコードする', async ({ page }) => {
    await page.goto('/tools/base64/');
    await page.locator('[data-file]').setInputFiles({
      name: 'x.png',
      mimeType: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    await expect(page.locator('[data-output]')).toHaveValue('iVBORw==');
    await expect(page.locator('[data-msg]')).toContainText('x.png');
  });

  test('バイナリにデコードされたらダウンロードを促す', async ({ page }) => {
    await page.goto('/tools/base64/');
    await page.locator('[data-opt="mode"]').selectOption('decode');
    await page.locator('[data-input]').fill('iVBORw0KGgo=');
    await expect(page.locator('[data-output]')).toHaveValue(/バイナリデータ.*png/);
    await expect(page.locator('[data-copy]')).toBeDisabled();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-download]').click()]);
    expect(download.suggestedFilename()).toBe('decoded.png');
  });

  test('不正な Base64 はエラーを表示する', async ({ page }) => {
    await page.goto('/tools/base64/');
    await page.locator('[data-opt="mode"]').selectOption('decode');
    await page.locator('[data-input]').fill('abc$');
    await expect(page.locator('[data-msg]')).toContainText('使えない文字');
  });
});
