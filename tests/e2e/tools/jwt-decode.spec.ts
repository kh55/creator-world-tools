import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const token = (exp: number) =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: '123', name: '太郎', exp })}.c2ln`;

test.describe('JWT デコード', () => {
  test('ヘッダーとペイロードを表示し、外部通信は発生しない', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/jwt-decode/');
    await page.locator('[data-input]').fill(`Bearer ${token(4102444800)}`);
    await expect(page.locator('[data-json="payload"]')).toContainText('"name": "太郎"');
    await expect(page.locator('[data-json="header"]')).toContainText('"alg": "HS256"');
    await expect(page.locator('[data-status]')).toContainText('有効期限内');
    await expect(page.locator('[data-times] tr')).toHaveCount(1);
    expect(w.external).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('期限切れを表示する', async ({ page }) => {
    await page.goto('/tools/jwt-decode/');
    await page.locator('[data-input]').fill(token(1700000000));
    await expect(page.locator('[data-status]')).toContainText('有効期限が切れています');
  });

  test('形式が違えばエラーを表示し、トークンは保存されない', async ({ page }) => {
    await page.goto('/tools/jwt-decode/');
    await page.locator('[data-input]').fill('not-a-jwt');
    await expect(page.locator('[data-msg]')).toContainText('3 つの部分');
    await page.locator('[data-input]').fill(token(4102444800));
    await expect(page.locator('[data-result]')).toBeVisible();
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).not.toContain('eyJ');
  });
});
