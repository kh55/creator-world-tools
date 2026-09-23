import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

// 「名前,年齢\r\n太郎,20\r\n」の Shift_JIS バイト列
const SJIS_CSV = Buffer.from([
  0x96, 0xbc, 0x91, 0x4f, 0x2c, 0x94, 0x4e, 0x97, 0xee, 0x0d, 0x0a, 0x91, 0xbe, 0x98, 0x59, 0x2c,
  0x32, 0x30, 0x0d, 0x0a,
]);

test.describe('CSV ⇔ JSON 変換', () => {
  test('CSV を JSON にしてプレビューを表示する', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/csv-json/');
    await page.locator('[data-input]').fill('name,age\n太郎,20');
    await expect(page.locator('[data-output]')).toHaveValue('[\n  {\n    "name": "太郎",\n    "age": "20"\n  }\n]');
    await expect(page.locator('[data-preview-table] td').first()).toHaveText('太郎');
    expect(w.external).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('Shift_JIS の CSV ファイルを自動判定で読み込める', async ({ page }) => {
    await page.goto('/tools/csv-json/');
    await page.locator('[data-file]').setInputFiles({ name: 'excel.csv', mimeType: 'text/csv', buffer: SJIS_CSV });
    await expect(page.locator('[data-detected]')).toHaveText('読み込んだ文字コード: Shift_JIS');
    await expect(page.locator('[data-output]')).toHaveValue('[\n  {\n    "名前": "太郎",\n    "年齢": "20"\n  }\n]');
  });

  test('JSON を CSV にし、BOM 付きでダウンロードできる', async ({ page }) => {
    await page.goto('/tools/csv-json/');
    await page.locator('[data-opt="direction"]').selectOption('json-to-csv');
    await page.locator('[data-input]').fill('[{"a":1,"b":"x,y"}]');
    // textarea は表示時に改行を LF に正規化する。ダウンロードする中身は CRLF のまま
    await expect(page.locator('[data-output]')).toHaveValue('a,b\n1,"x,y"');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-download]').click()]);
    expect(download.suggestedFilename()).toBe('data.csv');
    const body = await (await download.createReadStream()).toArray();
    expect(Buffer.concat(body)).toEqual(Buffer.from('\uFEFFa,b\r\n1,"x,y"'));
  });

  test('13 万行の CSV ファイルも変換できる', async ({ page }, testInfo) => {
    const file = testInfo.outputPath('large.csv');
    writeFileSync(file, ['n', ...Array.from({ length: 130_000 }, (_, i) => String(i))].join('\n'));
    await page.goto('/tools/csv-json/');
    await page.locator('[data-file]').setInputFiles(file);
    await expect(page.locator('[data-preview-caption]')).toHaveText('プレビュー（全 130000 行中、先頭 100 行）');
    await expect(page.locator('[data-msg]')).not.toHaveClass(/msg-error/);
  });

  test('50MB を超えるファイルは読み込まない', async ({ page }, testInfo) => {
    const big = testInfo.outputPath('big.csv');
    writeFileSync(big, Buffer.alloc(50 * 1024 * 1024 + 1, 0x61));
    await page.goto('/tools/csv-json/');
    await page.locator('[data-file]').setInputFiles(big);
    await expect(page.locator('[data-msg]')).toContainText('50MB');
    await expect(page.locator('[data-input]')).toHaveValue('');
  });
});
