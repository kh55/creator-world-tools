import { expect, test } from '@playwright/test';
import { toolSlugs, watchPage } from './helpers';

const slugs = toolSlugs();

test('トップページ: 外部通信・CSP 違反・JS エラーがない', async ({ page }) => {
  const w = watchPage(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creator World Tools');
  await expect(page.locator('#tool-search')).toBeVisible();
  expect(w.external).toEqual([]);
  expect(w.cspViolations).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('CSP などのセキュリティヘッダーが付く', async ({ page }) => {
  const res = await page.goto('/');
  const headers = res!.headers();
  expect(headers['content-security-policy']).toContain("connect-src 'self'");
  expect(headers['x-content-type-options']).toBe('nosniff');
});

for (const path of ['/about/', '/privacy/', '/robots.txt', '/sitemap-index.xml', '/ads.txt']) {
  test(`${path} が 200 を返す`, async ({ request }) => {
    expect((await request.get(path)).status()).toBe(200);
  });
}

test('存在しないページは 404', async ({ request }) => {
  expect((await request.get('/no-such-page/')).status()).toBe(404);
});

test('トップにすべてのツールのカードがある', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('section[data-category] .tool-card')).toHaveCount(slugs.length);
});

for (const slug of slugs) {
  test(`${slug}: ページ表示で外部通信・CSP 違反・JS エラーがない`, async ({ page }) => {
    const w = watchPage(page);
    await page.goto(`/tools/${slug}/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator(`[data-tool="${slug}"]`)).toBeVisible();
    expect(w.external).toEqual([]);
    expect(w.cspViolations).toEqual([]);
    expect(w.errors).toEqual([]);
  });
}

test('検索でカードを絞り込み、該当なしを表示する', async ({ page }) => {
  test.skip(slugs.length === 0, 'ツールがまだない');
  await page.goto('/');
  const cards = page.locator('section[data-category] .tool-card');
  const firstTitle = await cards.first().locator('.tool-title').innerText();
  await page.locator('#tool-search').fill(firstTitle);
  await expect(cards.filter({ visible: true }).first()).toContainText(firstTitle);
  await page.locator('#tool-search').fill('存在しないツール名xyz');
  await expect(page.locator('#no-results')).toBeVisible();
});

test('ツールを開くと「最近使ったツール」に出る', async ({ page }) => {
  test.skip(slugs.length === 0, 'ツールがまだない');
  await page.goto(`/tools/${slugs[0]}/`);
  await page.goto('/');
  await expect(page.locator(`#recent .tool-card[data-slug="${slugs[0]}"]`)).toBeVisible();
});
