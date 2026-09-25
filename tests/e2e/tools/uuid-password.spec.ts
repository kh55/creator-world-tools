import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

test.describe('UUID・パスワード生成', () => {
  test('開いた時点で UUID とパスワードが生成されている', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/uuid-password/');
    const uuids = (await page.locator('[data-uuid-output]').inputValue()).split('\n');
    expect(uuids).toHaveLength(5);
    for (const u of uuids) expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const pws = (await page.locator('[data-pw-output]').inputValue()).split('\n');
    expect(pws).toHaveLength(5);
    for (const p of pws) expect(p).toHaveLength(16);
    expect(w.external).toEqual([]);
  });

  test('オプションを変えると作り直され、設定はリロード後も残る', async ({ page }) => {
    await page.goto('/tools/uuid-password/');
    await page.locator('[data-opt="pwLength"]').fill('32');
    await page.locator('[data-opt="pwLength"]').dispatchEvent('change');
    await expect(page.locator('[data-pw-output]')).toHaveValue(/^.{32}(\n.{32}){4}$/);
    await page.reload();
    await expect(page.locator('[data-opt="pwLength"]')).toHaveValue('32');
  });

  test('UUID とパスワードをテキストファイルでダウンロードできる', async ({ page }) => {
    await page.goto('/tools/uuid-password/');
    for (const [btn, name, output] of [
      ['[data-uuid-download]', 'uuids.txt', '[data-uuid-output]'],
      ['[data-pw-download]', 'passwords.txt', '[data-pw-output]'],
    ] as const) {
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator(btn).click()]);
      expect(download.suggestedFilename()).toBe(name);
      const body = Buffer.concat(await (await download.createReadStream()).toArray()).toString('utf8');
      expect(body).toBe(`${await page.locator(output).inputValue()}\n`);
    }
  });

  test('文字種をすべて外すとエラーを表示する', async ({ page }) => {
    await page.goto('/tools/uuid-password/');
    for (const f of ['upper', 'lower', 'digits']) await page.locator(`[data-opt="${f}"]`).uncheck();
    await expect(page.locator('[data-pw-msg]')).toContainText('文字の種類');
  });

  test('生成したパスワードは localStorage に保存されない', async ({ page }) => {
    await page.goto('/tools/uuid-password/');
    const pw = (await page.locator('[data-pw-output]').inputValue()).split('\n')[0];
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).not.toContain(pw);
  });
});
