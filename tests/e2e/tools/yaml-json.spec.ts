import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

test.describe('YAML ⇔ JSON 変換', () => {
  test('YAML を JSON に変換し、外部通信は発生しない', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/yaml-json/');
    await page.locator('[data-input]').fill('name: app\nports: [80, 443]');
    await expect(page.locator('[data-output]')).toHaveValue(
      '{\n  "name": "app",\n  "ports": [\n    80,\n    443\n  ]\n}',
    );
    expect(w.external).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('JSON を YAML に変換し、設定はリロード後も残る', async ({ page }) => {
    await page.goto('/tools/yaml-json/');
    await page.locator('[data-opt="direction"]').selectOption('json-to-yaml');
    await page.locator('[data-input]').fill('{"a":{"b":[1,2]}}');
    await expect(page.locator('[data-output]')).toHaveValue('a:\n  b:\n    - 1\n    - 2\n');
    await page.reload();
    await expect(page.locator('[data-opt="direction"]')).toHaveValue('json-to-yaml');
  });

  test('構文エラーの位置を表示する', async ({ page }) => {
    await page.goto('/tools/yaml-json/');
    await page.locator('[data-input]').fill('a: [1, 2\nb: 3');
    await expect(page.locator('[data-msg]')).toContainText('2 行 1 列');
  });
});
