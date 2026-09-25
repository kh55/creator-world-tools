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

  test('ファイルをエンコードした後に URL セーフ形式へ切り替えると変換し直す', async ({ page }) => {
    await page.goto('/tools/base64/');
    await page.locator('[data-file]').setInputFiles({
      name: 'x.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from([0xfb, 0xff, 0xbf]),
    });
    await expect(page.locator('[data-output]')).toHaveValue('+/+/');
    await page.locator('[data-opt="urlSafe"]').check();
    await expect(page.locator('[data-output]')).toHaveValue('-_-_');
    await page.locator('[data-input]').fill('a');
    await expect(page.locator('[data-output]')).toHaveValue('YQ');
  });

  test('ファイルをエンコードした後にクリアすると、設定を変えても前のファイルは使わない', async ({ page }) => {
    await page.goto('/tools/base64/');
    await page.locator('[data-file]').setInputFiles({ name: 'x.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([1, 2, 3]) });
    await expect(page.locator('[data-output]')).toHaveValue('AQID');
    await page.locator('[data-clear]').click();
    await page.locator('[data-opt="urlSafe"]').check();
    await expect(page.locator('[data-output]')).toHaveValue('');
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
