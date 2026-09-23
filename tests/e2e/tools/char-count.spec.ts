import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

test.describe('文字数カウント', () => {
  test('入力と同時に数える', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/char-count/');
    await page.locator('[data-input]').fill('こんにちは 世界\n😀');
    await expect(page.locator('[data-stat="chars"]')).toHaveText('9');
    await expect(page.locator('[data-stat="charsNoSpace"]')).toHaveText('8');
    await expect(page.locator('[data-stat="lines"]')).toHaveText('2');
    await expect(page.locator('[data-note]')).toContainText('1 文字');
    expect(w.external).toEqual([]);
  });

  test('クリアすると 0 に戻る', async ({ page }) => {
    await page.goto('/tools/char-count/');
    await page.locator('[data-input]').fill('abc');
    await expect(page.locator('[data-stat="chars"]')).toHaveText('3');
    await page.locator('[data-clear]').click();
    await expect(page.locator('[data-stat="chars"]')).toHaveText('0');
  });
});
