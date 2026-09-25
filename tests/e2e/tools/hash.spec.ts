import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

test.describe('ハッシュ計算', () => {
  test('テキストのハッシュ値を計算し、外部通信は発生しない', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/hash/');
    await page.locator('[data-input]').fill('abc');
    await expect(page.locator('[data-hash="SHA-256"]')).toHaveText(SHA256_ABC);
    await expect(page.locator('[data-hash="MD5"]')).toHaveText('900150983cd24fb0d6963f7d28e17f72');
    expect(w.external).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('ファイルのハッシュ値を計算し、期待値と照合できる', async ({ page }) => {
    await page.goto('/tools/hash/');
    await page.locator('[data-file]').setInputFiles({ name: 'a.bin', mimeType: 'application/octet-stream', buffer: Buffer.from('abc') });
    await expect(page.locator('[data-hash="SHA-256"]')).toHaveText(SHA256_ABC);
    await expect(page.locator('[data-msg]')).toContainText('a.bin');
    await page.locator('[data-expected]').fill(`${SHA256_ABC.toUpperCase()}  a.bin`);
    await expect(page.locator('[data-match]')).toHaveText('✓ SHA-256 と一致しました');
    await page.locator('[data-expected]').fill('deadbeef');
    await expect(page.locator('[data-match]')).toContainText('一致しません');
  });

  test('大文字表示の設定はリロード後も残る', async ({ page }) => {
    await page.goto('/tools/hash/');
    await page.locator('[data-opt="upper"]').check();
    await page.reload();
    await page.locator('[data-input]').fill('abc');
    await expect(page.locator('[data-hash="SHA-256"]')).toHaveText(SHA256_ABC.toUpperCase());
  });
});
