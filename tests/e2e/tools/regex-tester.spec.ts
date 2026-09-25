import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

test.describe('正規表現テスター', () => {
  test('マッチを強調表示し、Worker が CSP 違反なく動き、外部通信は発生しない', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/regex-tester/');
    await page.locator('[data-pattern]').fill('(?<year>\\d{4})-(\\d{2})');
    await page.locator('[data-text]').fill('2026-09 と 2027-01');
    await expect(page.locator('[data-msg]')).toHaveText('2 件マッチ');
    await expect(page.locator('[data-highlight] mark')).toHaveText(['2026-09', '2027-01']);
    await expect(page.locator('[data-matches] tr').first()).toContainText('year: 2026');
    expect(w.external).toEqual([]);
    expect(w.cspViolations).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('置換結果を表示し、設定はリロード後も残る', async ({ page }) => {
    await page.goto('/tools/regex-tester/');
    await page.locator('[data-opt="replace"]').check();
    await page.locator('[data-flag="i"]').check();
    await page.locator('[data-pattern]').fill('(?<year>\\d{4})-(\\d{2})');
    await page.locator('[data-text]').fill('2026-09');
    await page.locator('[data-replacement]').fill('$2/$<year>');
    await expect(page.locator('[data-replaced]')).toHaveText('09/2026');
    await page.reload();
    await expect(page.locator('[data-opt="replace"]')).toBeChecked();
    await expect(page.locator('[data-flag="i"]')).toBeChecked();
  });

  test('構文エラーを表示する', async ({ page }) => {
    await page.goto('/tools/regex-tester/');
    await page.locator('[data-text]').fill('abc');
    await page.locator('[data-pattern]').fill('(');
    await expect(page.locator('[data-msg]')).toContainText('正規表現の構文エラー');
  });

  test('暴走する正規表現は 1 秒で中止し、その後も使い続けられる', async ({ page }) => {
    await page.goto('/tools/regex-tester/');
    await page.locator('[data-text]').fill(`${'a'.repeat(40)}b`);
    await page.locator('[data-pattern]').fill('(a+)+$');
    await expect(page.locator('[data-msg]')).toContainText('1 秒以上かかったため中止', { timeout: 5000 });
    await page.locator('[data-pattern]').fill('b$');
    await expect(page.locator('[data-msg]')).toHaveText('1 件マッチ');
  });
});
