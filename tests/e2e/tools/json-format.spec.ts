import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

test.describe('JSON 整形・検証', () => {
  test('入力すると整形され、外部通信は発生しない', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/json-format/');
    await page.locator('[data-input]').fill('{"b":1,"a":[1,2]}');
    await expect(page.locator('[data-output]')).toHaveValue('{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n}');
    await expect(page.locator('[data-download]')).toBeEnabled();
    expect(w.external).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('構文エラーの位置を表示する', async ({ page }) => {
    await page.goto('/tools/json-format/');
    await page.locator('[data-input]').fill('{"a":1,}');
    await expect(page.locator('[data-msg]')).toContainText('1 行 8 列');
    await expect(page.locator('[data-output]')).toHaveValue('');
  });

  test('オプションはリロード後も保持される', async ({ page }) => {
    await page.goto('/tools/json-format/');
    await page.locator('[data-opt="mode"]').selectOption('minify');
    await page.locator('[data-opt="sortKeys"]').check();
    await page.reload();
    await expect(page.locator('[data-opt="mode"]')).toHaveValue('minify');
    await expect(page.locator('[data-opt="sortKeys"]')).toBeChecked();
    await page.locator('[data-input]').fill('{"b":1,"a":2}');
    await expect(page.locator('[data-output]')).toHaveValue('{"a":2,"b":1}');
  });

  test('保存された設定が壊れていても既定値で動く', async ({ page }) => {
    await page.goto('/tools/json-format/');
    await page.evaluate(() => localStorage.setItem('cwt:tool:json-format:mode', '"???"'));
    await page.reload();
    await expect(page.locator('[data-opt="mode"]')).toHaveValue('format');
  });

  test('ファイルを選択して読み込める', async ({ page }) => {
    await page.goto('/tools/json-format/');
    await page.locator('[data-file]').setInputFiles({
      name: 'a.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"x":true}'),
    });
    await expect(page.locator('[data-input]')).toHaveValue('{"x":true}');
    await expect(page.locator('[data-output]')).toHaveValue('{\n  "x": true\n}');
  });

  test('入力データは localStorage に保存されない', async ({ page }) => {
    await page.goto('/tools/json-format/');
    await page.locator('[data-input]').fill('{"secret":"TOPSECRET"}');
    await expect(page.locator('[data-output]')).not.toHaveValue('');
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).not.toContain('TOPSECRET');
  });
});
