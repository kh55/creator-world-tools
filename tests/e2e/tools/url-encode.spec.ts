import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

test.describe('URL エンコード・デコード', () => {
  test('エンコードする', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/url-encode/');
    await page.locator('[data-input]').fill('東京 タワー');
    await expect(page.locator('[data-output]')).toHaveValue('%E6%9D%B1%E4%BA%AC%20%E3%82%BF%E3%83%AF%E3%83%BC');
    expect(w.external).toEqual([]);
  });

  test('URL を入力するとクエリを表に分解する（URL へはアクセスしない）', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/url-encode/');
    await page.locator('[data-opt="mode"]').selectOption('decode');
    await page.locator('[data-input]').fill('https://example.com/?q=%E3%81%82&n=1');
    await expect(page.locator('[data-query-table] tbody tr')).toHaveCount(2);
    await expect(page.locator('[data-query-table] tbody tr').first()).toContainText('あ');
    expect(w.external).toEqual([]);
  });

  test('不正な入力はエラーを表示する', async ({ page }) => {
    await page.goto('/tools/url-encode/');
    await page.locator('[data-opt="mode"]').selectOption('decode');
    await page.locator('[data-input]').fill('%E3%81');
    await expect(page.locator('[data-msg]')).toContainText('パーセントエンコーディング');
  });
});
