import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

test.describe('テキスト差分の比較', () => {
  test('行の差分を色分けし、外部通信は発生しない', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/text-diff/');
    await page.locator('[data-side="left"]').fill('a\nb\nc');
    await page.locator('[data-side="right"]').fill('a\nB\nc');
    await expect(page.locator('[data-output] del')).toHaveText('b\n');
    await expect(page.locator('[data-output] ins')).toHaveText('B\n');
    await expect(page.locator('[data-msg]')).toHaveText('+1 行 追加 / −1 行 削除');
    expect(w.external).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('HTML を含むテキストもそのまま文字として表示する', async ({ page }) => {
    await page.goto('/tools/text-diff/');
    await page.locator('[data-side="left"]').fill('<b>x</b>');
    await page.locator('[data-side="right"]').fill('<img src=x onerror=alert(1)>');
    await expect(page.locator('[data-output] ins')).toHaveText('<img src=x onerror=alert(1)>');
    await expect(page.locator('[data-output] img')).toHaveCount(0);
  });

  test('オプションで違いを無視でき、設定はリロード後も残る', async ({ page }) => {
    await page.goto('/tools/text-diff/');
    await page.locator('[data-opt="ignoreCase"]').check();
    await page.locator('[data-side="left"]').fill('Hello');
    await page.locator('[data-side="right"]').fill('hello');
    await expect(page.locator('[data-msg]')).toHaveText('✓ 違いはありません');
    await page.reload();
    await expect(page.locator('[data-opt="ignoreCase"]')).toBeChecked();
  });

  test('文字単位と左右の入れ替え', async ({ page }) => {
    await page.goto('/tools/text-diff/');
    await page.locator('[data-opt="mode"]').selectOption('char');
    await page.locator('[data-side="left"]').fill('今日は晴れです');
    await page.locator('[data-side="right"]').fill('今日は雨です');
    await expect(page.locator('[data-output] del')).toHaveText('晴れ');
    await page.locator('[data-swap]').click();
    await expect(page.locator('[data-output] del')).toHaveText('雨');
  });
});
