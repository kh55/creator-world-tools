import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

test.describe('UNIX 時間の変換', () => {
  test('タイムスタンプを日時に変換し、外部通信は発生しない', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/unix-time/');
    await page.locator('[data-ts-input]').fill('1700000000');
    await expect(page.locator('[data-out="unit"]')).toHaveText('秒');
    await expect(page.locator('[data-out="zoned"]')).toHaveText('2023-11-15 07:13:20 (+09:00)');
    await expect(page.locator('[data-out="iso"]')).toHaveText('2023-11-14T22:13:20.000Z');
    expect(w.external).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('日時をタイムスタンプに変換し、タイムゾーンの選択はリロード後も残る', async ({ page }) => {
    await page.goto('/tools/unix-time/');
    await page.locator('[data-opt="timeZone"]').selectOption('America/New_York');
    await page.locator('[data-dt-input]').fill('2023-07-22 00:26:40');
    await expect(page.locator('[data-out="seconds"]')).toHaveText('1690000000');
    await page.reload();
    await expect(page.locator('[data-opt="timeZone"]')).toHaveValue('America/New_York');
  });

  test('読めない入力はエラーを表示する', async ({ page }) => {
    await page.goto('/tools/unix-time/');
    await page.locator('[data-dt-input]').fill('2023-02-30');
    await expect(page.locator('[data-dt-msg]')).toContainText('存在しない日時');
    await page.locator('[data-ts-input]').fill('abc');
    await expect(page.locator('[data-ts-msg]')).toContainText('数値');
  });

  test('現在時刻を入れると両方の欄が埋まる', async ({ page }) => {
    await page.goto('/tools/unix-time/');
    await page.locator('[data-now]').click();
    await expect(page.locator('[data-ts-input]')).toHaveValue(/^\d{10}$/);
    await expect(page.locator('[data-out="seconds"]')).toHaveText(/^\d{10}$/);
  });
});
