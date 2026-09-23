# Creator World Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ブラウザ内だけで動く便利ツールのポータルサイト（初回 6 ツール）を Astro で構築し、`master` への push で Cloudflare Pages に自動デプロイする。

**Architecture:** Astro の静的出力。`src/tools/<slug>/` に置いたツールを `import.meta.glob` で自動登録し、トップページ・`/tools/<slug>/` ページ・サイトマップを生成する。変換処理は DOM 非依存の純粋関数（`logic.ts`、`Result` を返す）として Vitest でテストし、UI は Astro コンポーネント内の `<script>` から呼ぶ。セキュリティヘッダーと ads.txt はビルド後スクリプトで環境変数から生成し、E2E は `wrangler pages dev` 上で CSP 込みで検証する。

**Tech Stack:** Astro 7 / TypeScript 6 / Vitest 5 / Playwright 1.63 / PapaParse 5 / wrangler 4 / GitHub Actions / Cloudflare Pages

**Spec:** `docs/superpowers/specs/2026-09-23-creator-world-tools-design.md`

## Global Constraints

- Node.js `>=22.12.0`（`.nvmrc` は `22`）。Astro 7 の要件。
- TypeScript は `^6`（`@astrojs/check@0.9.10` の peer が `^5 || ^6` のため 7 は使わない）。
- サイト URL は `https://tools.creator-world.net`。`trailingSlash: 'always'` のため内部リンクは必ず `/` で終える（例: `/tools/csv-json/`、`/privacy/`）。
- ツールのコード（`src/` 配下すべて）で `fetch` / `XMLHttpRequest` / `sendBeacon` / `WebSocket` / `EventSource` を使わない（Task 4 の静的チェックテストで強制）。
- localStorage のキーは `cwt:` で始める。ツール設定は `cwt:tool:<slug>:<name>`、最近使ったツールは `cwt:recent`（最大 6 件）。入力・出力データは保存しない。
- `logic.ts` の関数は例外を投げず `Result<T>`（`src/lib/result.ts`）を返す。
- 入力ファイルの上限は 50MB（`MAX_FILE_BYTES = 50 * 1024 * 1024`）。
- UI の文言はすべて日本語。
- `<script is:inline>` で中身を書かない（CSP で inline script を禁止しているため）。外部 `src` を持つ `is:inline` は可。ユーザー入力は `textContent` / `value` でのみ DOM に出す（`innerHTML` 禁止）。
- 環境変数（すべて任意、未設定でビルド成功）: `PUBLIC_ADSENSE_CLIENT`、`PUBLIC_ADSENSE_SLOT_TOOL`、`PUBLIC_ADSENSE_SLOT_FOOTER`、`PUBLIC_CF_ANALYTICS_TOKEN`。
- デフォルトブランチは `master`。コミットメッセージ末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` を付ける。

## Review Focus

1. **localStorage に古い・壊れた設定値が残っている**（手で編集された、選択肢が変わった等）→ 既定値にフォールバックして動く。→ Task 2 の `readChoice` / `readInt` テストで固定。
2. **localStorage が使えない環境**（プライベートモード、ストレージ無効化で `getItem` が例外）→ ツールは設定を保存しないだけで正常に動く。→ Task 2 の「例外を投げるストレージ」テストで固定。
3. **JSON の大きな整数・小数表記**（`12345678901234567890`、`1.0`）→ 整形・CSV 変換で値が勝手に変わらない。→ Task 3 の `parseJson` テストと Task 7 / Task 8 のテストで固定。
4. **Excel 由来の Shift_JIS CSV や BOM 付き UTF-8 CSV のファイル投入** → 文字化けせず読み込める。→ Task 3 の `decodeBytes` テストと Task 8 の E2E（Shift_JIS ファイル投入）で固定。
5. **列数が揃っていない CSV・空や重複のヘッダー** → データが欠落せず JSON に出る。→ Task 8 のテストで固定。

---

## File Structure

```
creator-world-tools/
  package.json / package-lock.json / .nvmrc / .gitignore
  astro.config.mjs          サイト設定・sitemap・スクリプトのインライン化禁止
  tsconfig.json / vitest.config.ts / playwright.config.ts
  scripts/
    postbuild.mjs           dist/_headers（CSP 等）と dist/ads.txt を生成
    postbuild.test.mjs
  public/
    favicon.svg / robots.txt
  src/
    env.d.ts                環境変数と window.adsbygoogle の型
    styles/global.css       デザイントークン（ライト/ダーク）と共通スタイル
    lib/
      result.ts             Result 型・ok/err・describeError
      storage.ts            localStorage ラッパー（設定・最近使ったツール）
      file.ts               ファイルサイズ検査・読み込み・ダウンロード・コピー
      search.ts             トップページ検索の正規化とマッチ
      encoding.ts           UTF-8/Shift_JIS デコード・Shift_JIS バイト数
      json.ts               精度を保つ JSON パースとエラー位置
      tool-meta.ts          ToolMeta 型・カテゴリ定義
      registry-core.ts      ツール一覧の検証・並び替え・カテゴリ分け（純粋関数）
      registry.ts           import.meta.glob でツールを収集
      site.ts               サイト名・環境変数の読み出し
      io-panel.ts           IOPanel のクライアント側の振る舞い
      no-network.test.ts    src 配下に通信 API がないことの静的チェック
    components/
      IOPanel.astro / AdSlot.astro / ToolCard.astro / PrivacyBadge.astro
    layouts/
      BaseLayout.astro / ToolLayout.astro
    pages/
      index.astro / tools/[slug].astro / privacy.astro / about.astro / 404.astro
    tools/
      json-format/ csv-json/ base64/ url-encode/ char-count/ uuid-password/
        meta.ts / logic.ts / logic.test.ts / Tool.astro / guide.md
  tests/e2e/
    helpers.ts / site.spec.ts / tools/<slug>.spec.ts
  .github/workflows/ci.yml / deploy.yml
  README.md
```

---

### Task 1: プロジェクトの雛形

**Files:**
- Create: `package.json`, `.nvmrc`, `.gitignore`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `src/lib/result.ts`, `src/lib/result.test.ts`, `src/pages/index.astro`（仮。Task 5 で置き換え）

**Interfaces:**
- Produces:
  - `interface ToolError { message: string; line?: number; column?: number }`
  - `type Result<T> = { ok: true; value: T } | { ok: false; error: ToolError }`
  - `ok<T>(value: T): Result<T>`、`err(message: string, pos?: { line?: number; column?: number }): { ok: false; error: ToolError }`
  - `describeError(e: ToolError): string`
  - npm scripts: `dev`, `build`, `check`, `test`, `test:e2e`

- [ ] **Step 1: package.json・設定ファイルを作成**

`package.json`:

```json
{
  "name": "creator-world-tools",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "check": "astro check",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

`.nvmrc`:

```
22
```

`.gitignore`:

```
node_modules/
dist/
.astro/
.wrangler/
.env
test-results/
playwright-report/
```

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tools.creator-world.net',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  // CSP で inline script を禁止しているため、小さなスクリプトもインライン化させない
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [sitemap()],
});
```

`tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
});
```

- [ ] **Step 2: 依存をインストール**

Run:

```bash
npm install astro@^7.3.4 @astrojs/sitemap@^3.7.4 papaparse@^5.7.0
npm install -D @astrojs/check@^0.9.10 typescript@^6.0.3 vitest@^5.0.1 @playwright/test@^1.63.0 @types/papaparse@^5.5.2 @types/node@^22.20.4 wrangler@^4.136.3
```

Expected: `package-lock.json` が生成され、エラーなく完了。

- [ ] **Step 3: result の失敗するテストを書く**

`src/lib/result.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { describeError, err, ok } from './result';

describe('result', () => {
  it('ok は値を包む', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });

  it('err は位置情報を任意で持つ', () => {
    expect(err('だめ')).toEqual({ ok: false, error: { message: 'だめ' } });
    expect(err('だめ', { line: 2, column: 3 })).toEqual({
      ok: false,
      error: { message: 'だめ', line: 2, column: 3 },
    });
  });

  it('describeError は位置があれば先頭に付ける', () => {
    expect(describeError({ message: 'x' })).toBe('x');
    expect(describeError({ message: 'x', line: 2, column: 3 })).toBe('2 行 3 列: x');
    expect(describeError({ message: 'x', line: 2 })).toBe('2 行: x');
  });
});
```

- [ ] **Step 4: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`./result` が見つからない）

- [ ] **Step 5: result を実装**

`src/lib/result.ts`:

```ts
export interface ToolError {
  message: string;
  line?: number;
  column?: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ToolError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err(
  message: string,
  pos: { line?: number; column?: number } = {},
): { ok: false; error: ToolError } {
  return { ok: false, error: { message, ...pos } };
}

export function describeError(e: ToolError): string {
  if (e.line === undefined) return e.message;
  const where = e.column === undefined ? `${e.line} 行` : `${e.line} 行 ${e.column} 列`;
  return `${where}: ${e.message}`;
}
```

- [ ] **Step 6: 仮のトップページを作成**

`src/pages/index.astro`:

```astro
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>Creator World Tools</title>
  </head>
  <body>
    <h1>Creator World Tools</h1>
  </body>
</html>
```

- [ ] **Step 7: テスト・型チェック・ビルドが通ることを確認**

Run: `npm test && npm run check && npm run build`
Expected: テスト 3 件 PASS、`astro check` でエラー 0、`dist/index.html` と `dist/sitemap-index.xml` が生成される。

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "chore: scaffold Astro project with Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 共通ライブラリ（storage・file・search）

**Files:**
- Create: `src/lib/storage.ts`, `src/lib/storage.test.ts`, `src/lib/file.ts`, `src/lib/file.test.ts`, `src/lib/search.ts`, `src/lib/search.test.ts`

**Interfaces:**
- Consumes: `ok`, `err`, `Result`（Task 1）
- Produces:
  - storage: `readRaw(key: string): unknown`、`write(key: string, value: unknown): void`、`readChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T`、`readBool(key: string, fallback: boolean): boolean`、`readInt(key: string, fallback: number, min: number, max: number): number`、`toolKey(slug: string, name: string): string`、`getRecent(): string[]`、`pushRecent(slug: string): string[]`、`RECENT_MAX = 6`
  - file: `MAX_FILE_BYTES`、`formatBytes(n: number): string`、`checkFileSize(size: number): Result<true>`、`readFileBytes(file: Blob): Promise<Uint8Array<ArrayBuffer>>`、`downloadBlob(parts: BlobPart[], filename: string, mime: string): void`、`copyText(text: string, fallback?: HTMLTextAreaElement | null): Promise<'copied' | 'selected'>`
  - search: `normalizeForSearch(s: string): string`、`searchTextOf(parts: string[]): string`、`matchesQuery(haystack: string, query: string): boolean`

- [ ] **Step 1: storage の失敗するテストを書く**

`src/lib/storage.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getRecent,
  pushRecent,
  RECENT_MAX,
  readBool,
  readChoice,
  readInt,
  readRaw,
  toolKey,
  write,
} from './storage';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

class BrokenStorage {
  getItem(): string | null {
    throw new Error('SecurityError');
  }
  setItem() {
    throw new Error('QuotaExceededError');
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage', () => {
  it('cwt: プレフィックス付きの JSON で読み書きする', () => {
    const mem = new MemoryStorage();
    vi.stubGlobal('localStorage', mem);
    write('a', { x: 1 });
    expect(mem.getItem('cwt:a')).toBe('{"x":1}');
    expect(readRaw('a')).toEqual({ x: 1 });
  });

  it('toolKey はツール名前空間を作る', () => {
    expect(toolKey('csv-json', 'delimiter')).toBe('tool:csv-json:delimiter');
  });

  it('readChoice は許可された値だけを返し、それ以外は既定値', () => {
    const mem = new MemoryStorage();
    vi.stubGlobal('localStorage', mem);
    mem.setItem('cwt:c', '"tab"');
    expect(readChoice('c', ['comma', 'tab'] as const, 'comma')).toBe('tab');
    mem.setItem('cwt:c', '"pipe"');
    expect(readChoice('c', ['comma', 'tab'] as const, 'comma')).toBe('comma');
    mem.setItem('cwt:c', '{壊れた JSON');
    expect(readChoice('c', ['comma', 'tab'] as const, 'comma')).toBe('comma');
  });

  it('readBool / readInt は型と範囲を検査する', () => {
    const mem = new MemoryStorage();
    vi.stubGlobal('localStorage', mem);
    mem.setItem('cwt:b', 'true');
    expect(readBool('b', false)).toBe(true);
    mem.setItem('cwt:b', '"yes"');
    expect(readBool('b', false)).toBe(false);
    mem.setItem('cwt:n', '16');
    expect(readInt('n', 8, 4, 128)).toBe(16);
    mem.setItem('cwt:n', '999');
    expect(readInt('n', 8, 4, 128)).toBe(8);
    mem.setItem('cwt:n', '1.5');
    expect(readInt('n', 8, 4, 128)).toBe(8);
  });

  it('ストレージが例外を投げても既定値で動く', () => {
    vi.stubGlobal('localStorage', new BrokenStorage());
    expect(() => write('a', 1)).not.toThrow();
    expect(readChoice('c', ['a', 'b'] as const, 'a')).toBe('a');
    expect(getRecent()).toEqual([]);
    expect(pushRecent('x')).toEqual(['x']);
  });

  it('localStorage が存在しなくても動く', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readBool('b', true)).toBe(true);
    expect(() => write('a', 1)).not.toThrow();
  });

  it('pushRecent は重複を除いて先頭に追加し、最大件数で切る', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    for (const s of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) pushRecent(s);
    expect(getRecent()).toEqual(['g', 'f', 'e', 'd', 'c', 'b']);
    expect(getRecent()).toHaveLength(RECENT_MAX);
    pushRecent('d');
    expect(getRecent()).toEqual(['d', 'g', 'f', 'e', 'c', 'b']);
  });

  it('getRecent は文字列以外を捨てる', () => {
    const mem = new MemoryStorage();
    vi.stubGlobal('localStorage', mem);
    mem.setItem('cwt:recent', '["a", 1, null, "b"]');
    expect(getRecent()).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL（`./storage` が見つからない）

- [ ] **Step 3: storage を実装**

`src/lib/storage.ts`:

```ts
// localStorage のラッパー。保存するのは設定値と「最近使ったツール」だけで、入力データは保存しない。
// プライベートモード等でストレージが使えない場合は、保存せず既定値で動く。
const PREFIX = 'cwt:';

function getStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' || localStorage === null ? null : localStorage;
  } catch {
    return null;
  }
}

export function readRaw(key: string): unknown {
  const store = getStore();
  if (!store) return undefined;
  try {
    const raw = store.getItem(PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function write(key: string, value: unknown): void {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 容量超過・無効化時は保存しない
  }
}

export function readChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = readRaw(key);
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function readBool(key: string, fallback: boolean): boolean {
  const v = readRaw(key);
  return typeof v === 'boolean' ? v : fallback;
}

export function readInt(key: string, fallback: number, min: number, max: number): number {
  const v = readRaw(key);
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fallback;
}

export function toolKey(slug: string, name: string): string {
  return `tool:${slug}:${name}`;
}

const RECENT_KEY = 'recent';
export const RECENT_MAX = 6;

export function getRecent(): string[] {
  const v = readRaw(RECENT_KEY);
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is string => typeof s === 'string').slice(0, RECENT_MAX);
}

export function pushRecent(slug: string): string[] {
  const next = [slug, ...getRecent().filter((s) => s !== slug)].slice(0, RECENT_MAX);
  write(RECENT_KEY, next);
  return next;
}
```

- [ ] **Step 4: storage のテストが通ることを確認**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS（8 件）

- [ ] **Step 5: file・search の失敗するテストを書く**

`src/lib/file.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { checkFileSize, formatBytes, MAX_FILE_BYTES, readFileBytes } from './file';

describe('file', () => {
  it('上限は 50MB', () => {
    expect(MAX_FILE_BYTES).toBe(50 * 1024 * 1024);
  });

  it('上限以下は ok、超えたら日本語のエラー', () => {
    expect(checkFileSize(MAX_FILE_BYTES).ok).toBe(true);
    const r = checkFileSize(MAX_FILE_BYTES + 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('50MB');
  });

  it('formatBytes は単位を付ける', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('readFileBytes は Blob の中身を返す', async () => {
    const bytes = await readFileBytes(new Blob([new Uint8Array([1, 2, 3])]));
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });
});
```

`src/lib/search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchesQuery, normalizeForSearch, searchTextOf } from './search';

describe('search', () => {
  it('全角英数と大文字を正規化する', () => {
    expect(normalizeForSearch('ＣＳＶ Json')).toBe('csv json');
  });

  it('空のクエリはすべてにマッチ', () => {
    expect(matchesQuery('csv json', '')).toBe(true);
    expect(matchesQuery('csv json', '   ')).toBe(true);
  });

  it('空白区切りの語をすべて含むときだけマッチ（全角空白も区切り）', () => {
    const hay = searchTextOf(['CSV ⇔ JSON 変換', '表データを変換', 'excel']);
    expect(matchesQuery(hay, 'ｃｓｖ')).toBe(true);
    expect(matchesQuery(hay, 'csv　excel')).toBe(true);
    expect(matchesQuery(hay, 'csv yaml')).toBe(false);
  });
});
```

- [ ] **Step 6: テストが失敗することを確認**

Run: `npx vitest run src/lib/file.test.ts src/lib/search.test.ts`
Expected: FAIL（モジュールが見つからない）

- [ ] **Step 7: file・search を実装**

`src/lib/file.ts`:

```ts
import { err, ok, type Result } from './result';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function checkFileSize(size: number): Result<true> {
  if (size > MAX_FILE_BYTES) {
    return err(`ファイルが大きすぎます（上限 50MB、選択されたファイル ${formatBytes(size)}）`);
  }
  return ok(true);
}

export async function readFileBytes(file: Blob): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await file.arrayBuffer());
}

export function downloadBlob(parts: BlobPart[], filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob(parts, { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // クリック直後に revoke すると一部ブラウザでダウンロードが失敗するため少し待つ
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(
  text: string,
  fallback?: HTMLTextAreaElement | null,
): Promise<'copied' | 'selected'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    fallback?.focus();
    fallback?.select();
    return 'selected';
  }
}
```

`src/lib/search.ts`:

```ts
// トップページのツール検索（ブラウザ内で絞り込むだけで、通信はしない）
export function normalizeForSearch(s: string): string {
  return s.normalize('NFKC').toLowerCase();
}

export function searchTextOf(parts: string[]): string {
  return normalizeForSearch(parts.join(' '));
}

export function matchesQuery(haystack: string, query: string): boolean {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  return terms.every((t) => haystack.includes(t));
}
```

- [ ] **Step 8: 全テスト・型チェックが通ることを確認**

Run: `npm test && npm run check`
Expected: 全件 PASS、型エラー 0

- [ ] **Step 9: コミット**

```bash
git add -A
git commit -m "feat: add storage, file and search helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 文字コードと JSON のライブラリ

**Files:**
- Create: `src/lib/encoding.ts`, `src/lib/encoding.test.ts`, `src/lib/json.ts`, `src/lib/json.test.ts`

**Interfaces:**
- Consumes: `ok`, `err`, `Result`（Task 1）
- Produces:
  - encoding: `type InputEncoding = 'auto' | 'utf-8' | 'shift_jis'`、`INPUT_ENCODINGS: readonly InputEncoding[]`、`interface Decoded { text: string; encoding: 'utf-8' | 'shift_jis' }`、`decodeBytes(bytes: Uint8Array, encoding: InputEncoding): Result<Decoded>`、`interface SjisLength { bytes: number; unencodable: number }`、`sjisByteLength(text: string): SjisLength`
  - json: `interface ParsedJson { value: unknown; precisionWarning: boolean }`、`parseJson(text: string): Result<ParsedJson>`、`isRawNumber(v: unknown): v is { rawJSON: string }`、`locate(text: string, message: string): { line?: number; column?: number }`、`supportsRawJSON: boolean`

- [ ] **Step 1: encoding の失敗するテストを書く**

`src/lib/encoding.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decodeBytes, sjisByteLength } from './encoding';

const utf8 = (s: string) => new TextEncoder().encode(s);
// 「名前,年齢\r\n太郎,20\r\n」の Shift_JIS バイト列
const SJIS_CSV = new Uint8Array([
  0x96, 0xbc, 0x91, 0x4f, 0x2c, 0x94, 0x4e, 0x97, 0xee, 0x0d, 0x0a, 0x91, 0xbe, 0x98, 0x59, 0x2c,
  0x32, 0x30, 0x0d, 0x0a,
]);

describe('decodeBytes', () => {
  it('auto: UTF-8 として読めれば UTF-8', () => {
    expect(decodeBytes(utf8('あいう'), 'auto')).toEqual({
      ok: true,
      value: { text: 'あいう', encoding: 'utf-8' },
    });
  });

  it('auto: UTF-8 で読めなければ Shift_JIS', () => {
    expect(decodeBytes(SJIS_CSV, 'auto')).toEqual({
      ok: true,
      value: { text: '名前,年齢\r\n太郎,20\r\n', encoding: 'shift_jis' },
    });
  });

  it('UTF-8 の BOM を取り除く', () => {
    const r = decodeBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]), 'auto');
    expect(r.ok && r.value.text).toBe('a');
  });

  it('utf-8 指定で UTF-8 として不正ならエラー', () => {
    const r = decodeBytes(SJIS_CSV, 'utf-8');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('Shift_JIS');
  });

  it('shift_jis 指定なら Shift_JIS で読む', () => {
    const r = decodeBytes(SJIS_CSV, 'shift_jis');
    expect(r.ok && r.value.text).toBe('名前,年齢\r\n太郎,20\r\n');
  });

  it('auto でどちらでも読めなければエラー', () => {
    expect(decodeBytes(new Uint8Array([0xff, 0xff]), 'auto').ok).toBe(false);
  });
});

describe('sjisByteLength', () => {
  it('ASCII と半角カナは 1 バイト', () => {
    expect(sjisByteLength('abc\n')).toEqual({ bytes: 4, unencodable: 0 });
    expect(sjisByteLength('ｱｲｳ')).toEqual({ bytes: 3, unencodable: 0 });
  });

  it('全角文字（NEC 特殊文字を含む）は 2 バイト', () => {
    expect(sjisByteLength('あ漢①')).toEqual({ bytes: 6, unencodable: 0 });
  });

  it('Shift_JIS で表せない文字は件数を別に数える', () => {
    expect(sjisByteLength('a😀あ')).toEqual({ bytes: 3, unencodable: 1 });
  });

  it('空文字は 0', () => {
    expect(sjisByteLength('')).toEqual({ bytes: 0, unencodable: 0 });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/encoding.test.ts`
Expected: FAIL（`./encoding` が見つからない）

- [ ] **Step 3: encoding を実装**

`src/lib/encoding.ts`:

```ts
import { err, ok, type Result } from './result';

export type InputEncoding = 'auto' | 'utf-8' | 'shift_jis';
export const INPUT_ENCODINGS: readonly InputEncoding[] = ['auto', 'utf-8', 'shift_jis'];

export interface Decoded {
  text: string;
  encoding: 'utf-8' | 'shift_jis';
}

// TextDecoder は既定で UTF-8 の BOM を取り除く
export function decodeBytes(bytes: Uint8Array, encoding: InputEncoding): Result<Decoded> {
  if (encoding === 'shift_jis') {
    return ok({ text: new TextDecoder('shift_jis').decode(bytes), encoding: 'shift_jis' });
  }
  try {
    return ok({ text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' });
  } catch {
    if (encoding === 'utf-8') {
      return err('UTF-8 として読み込めませんでした。文字コードに「Shift_JIS」を選んでください');
    }
    try {
      return ok({
        text: new TextDecoder('shift_jis', { fatal: true }).decode(bytes),
        encoding: 'shift_jis',
      });
    } catch {
      return err('文字コードを判定できませんでした（UTF-8 / Shift_JIS 以外の可能性があります）');
    }
  }
}

// Shift_JIS の 2 バイト文字の集合。ブラウザ標準の Shift_JIS デコーダ（WHATWG 準拠、
// NEC/IBM 拡張を含む）で全 2 バイト符号を 1 度だけデコードして作る（約 9,600 文字、数ミリ秒）。
let doubleByteChars: Set<string> | null = null;

function getDoubleByteChars(): Set<string> {
  if (doubleByteChars) return doubleByteChars;
  const set = new Set<string>();
  const decoder = new TextDecoder('shift_jis');
  const pair = new Uint8Array(2);
  for (let lead = 0x81; lead <= 0xfc; lead++) {
    if (lead >= 0xa0 && lead <= 0xdf) continue;
    for (let trail = 0x40; trail <= 0xfc; trail++) {
      if (trail === 0x7f) continue;
      pair[0] = lead;
      pair[1] = trail;
      const s = decoder.decode(pair);
      const cp = s.codePointAt(0) ?? 0;
      const isPrivateUse = cp >= 0xe000 && cp <= 0xf8ff;
      if (s !== '�' && [...s].length === 1 && !isPrivateUse) set.add(s);
    }
  }
  doubleByteChars = set;
  return set;
}

export interface SjisLength {
  bytes: number;
  unencodable: number;
}

export function sjisByteLength(text: string): SjisLength {
  let bytes = 0;
  let unencodable = 0;
  const dbl = getDoubleByteChars();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0x7f || (cp >= 0xff61 && cp <= 0xff9f)) bytes += 1;
    else if (dbl.has(ch)) bytes += 2;
    else unencodable += 1;
  }
  return { bytes, unencodable };
}
```

- [ ] **Step 4: encoding のテストが通ることを確認**

Run: `npx vitest run src/lib/encoding.test.ts`
Expected: PASS（10 件）

- [ ] **Step 5: json の失敗するテストを書く**

`src/lib/json.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isRawNumber, locate, parseJson, supportsRawJSON } from './json';

describe('parseJson', () => {
  it('Node 22 では JSON.rawJSON が使える（テスト前提の確認）', () => {
    expect(supportsRawJSON).toBe(true);
  });

  it('オブジェクトを読める', () => {
    const r = parseJson('{"a":[1,"x",null,true]}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.value.value)).toBe('{"a":[1,"x",null,true]}');
  });

  it('大きな整数や小数表記をそのまま保つ', () => {
    const r = parseJson('{"id":12345678901234567890,"v":1.0,"e":1e3}');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.value.value)).toBe('{"id":12345678901234567890,"v":1.0,"e":1e3}');
    expect(r.value.precisionWarning).toBe(false);
    const obj = r.value.value as Record<string, unknown>;
    expect(isRawNumber(obj.id)).toBe(true);
    expect(isRawNumber({ rawJSON: '1' })).toBe(false);
  });

  it('空入力はエラー', () => {
    expect(parseJson('  \n').ok).toBe(false);
  });

  it('構文エラーは行・列を返す', () => {
    const r = parseJson('{\n  "a": 1,\n}');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain('JSON の構文エラー');
    expect(r.error.line).toBe(3);
    expect(r.error.column).toBe(1);
  });
});

describe('locate', () => {
  it('"line X column Y" 形式を読む', () => {
    expect(locate('', 'bad (line 2 column 5)')).toEqual({ line: 2, column: 5 });
  });

  it('"position N" 形式から行・列を計算する', () => {
    expect(locate('ab\ncd', 'Unexpected token at position 4')).toEqual({ line: 2, column: 2 });
  });

  it('位置情報がなければ空', () => {
    expect(locate('x', 'JSON Parse error: Expected')).toEqual({});
  });
});
```

- [ ] **Step 6: テストが失敗することを確認**

Run: `npx vitest run src/lib/json.test.ts`
Expected: FAIL（`./json` が見つからない）

- [ ] **Step 7: json を実装**

`src/lib/json.ts`:

```ts
import { err, ok, type Result } from './result';

// JSON.rawJSON / JSON.isRawJSON（ES2025）が使えるブラウザでは、数値を元の表記のまま保持して
// 大きな整数の精度落ちや 1.0 → 1 のような書き換えを防ぐ。使えない場合は警告だけ出す。
interface RawJSONApi {
  rawJSON(text: string): unknown;
  isRawJSON(v: unknown): boolean;
}
const api = JSON as unknown as Partial<RawJSONApi>;

export const supportsRawJSON =
  typeof api.rawJSON === 'function' && typeof api.isRawJSON === 'function';

export function isRawNumber(v: unknown): v is { rawJSON: string } {
  return supportsRawJSON && api.isRawJSON!(v);
}

export interface ParsedJson {
  value: unknown;
  precisionWarning: boolean;
}

const BIG_NUMBER = /(?<![\w.])-?\d{16,}/;

export function parseJson(text: string): Result<ParsedJson> {
  if (text.trim() === '') return err('入力が空です');
  try {
    if (supportsRawJSON) {
      const value: unknown = JSON.parse(text, (_key, v: unknown, ctx?: { source?: string }) =>
        typeof v === 'number' && ctx?.source !== undefined ? api.rawJSON!(ctx.source) : v,
      );
      return ok({ value, precisionWarning: false });
    }
    return ok({ value: JSON.parse(text) as unknown, precisionWarning: BIG_NUMBER.test(text) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err(`JSON の構文エラー: ${message}`, locate(text, message));
  }
}

// ブラウザごとに異なるエラーメッセージから位置を取り出す
// V8: "... at position 10 (line 2 column 3)" / Firefox: "... at line 2 column 3 of the JSON data"
export function locate(text: string, message: string): { line?: number; column?: number } {
  const lc = /line (\d+) column (\d+)/.exec(message);
  if (lc) return { line: Number(lc[1]), column: Number(lc[2]) };
  const pos = /position (\d+)/.exec(message);
  if (pos) {
    const lines = text.slice(0, Number(pos[1])).split('\n');
    return { line: lines.length, column: lines[lines.length - 1].length + 1 };
  }
  return {};
}
```

- [ ] **Step 8: 全テスト・型チェックが通ることを確認**

Run: `npm test && npm run check`
Expected: 全件 PASS、型エラー 0。`JSON.parse` の reviver の型でエラーになる場合は、reviver を `(key: string, v: unknown, ctx?: { source?: string }) => unknown` 型の変数に代入してから `JSON.parse(text, reviver as (this: unknown, key: string, value: unknown) => unknown)` と渡す。

- [ ] **Step 9: コミット**

```bash
git add -A
git commit -m "feat: add encoding detection and precision-safe JSON parsing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: ツール登録の仕組みと通信 API の静的チェック

**Files:**
- Create: `src/lib/tool-meta.ts`, `src/lib/registry-core.ts`, `src/lib/registry-core.test.ts`, `src/lib/registry.ts`, `src/lib/no-network.test.ts`

**Interfaces:**
- Produces:
  - `CATEGORIES = ['convert', 'format', 'encode', 'text', 'generate'] as const`、`type Category`、`CATEGORY_LABELS: Record<Category, string>`
  - `interface ToolMeta { slug: string; title: string; description: string; category: Category; icon: string; keywords: string[]; order?: number }`
  - `interface ToolSources { metas: Record<string, { meta?: ToolMeta }>; components: string[]; guides: string[] }`
  - `buildRegistry(src: ToolSources): ToolMeta[]`（不正があれば `Error` を投げてビルドを止める）
  - `compareTools(a: ToolMeta, b: ToolMeta): number`
  - `groupByCategory(tools: ToolMeta[]): { category: Category; label: string; tools: ToolMeta[] }[]`
  - `registry.ts`: `export const tools: ToolMeta[]`

- [ ] **Step 1: registry-core の失敗するテストを書く**

`src/lib/registry-core.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildRegistry, groupByCategory, type ToolSources } from './registry-core';
import type { ToolMeta } from './tool-meta';

const meta = (slug: string, over: Partial<ToolMeta> = {}): ToolMeta => ({
  slug,
  title: slug,
  description: `${slug} の説明`,
  category: 'convert',
  icon: '🔧',
  keywords: [],
  ...over,
});

const sources = (metas: ToolMeta[], opts: { noComponent?: string; noGuide?: string } = {}): ToolSources => ({
  metas: Object.fromEntries(metas.map((m) => [`../tools/${m.slug}/meta.ts`, { meta: m }])),
  components: metas.filter((m) => m.slug !== opts.noComponent).map((m) => `../tools/${m.slug}/Tool.astro`),
  guides: metas.filter((m) => m.slug !== opts.noGuide).map((m) => `../tools/${m.slug}/guide.md`),
});

describe('buildRegistry', () => {
  it('カテゴリ順 → order → タイトル順に並べる', () => {
    const tools = buildRegistry(
      sources([
        meta('gen', { category: 'generate' }),
        meta('b-conv', { title: 'B' }),
        meta('a-conv', { title: 'A' }),
        meta('first', { title: 'Z', order: 1 }),
      ]),
    );
    expect(tools.map((t) => t.slug)).toEqual(['first', 'a-conv', 'b-conv', 'gen']);
  });

  it('slug とフォルダ名が違えばエラー', () => {
    const src = sources([meta('abc')]);
    src.metas = { '../tools/xyz/meta.ts': { meta: meta('abc') } };
    src.components = ['../tools/xyz/Tool.astro'];
    src.guides = ['../tools/xyz/guide.md'];
    expect(() => buildRegistry(src)).toThrow(/フォルダ名 "xyz"/);
  });

  it('Tool.astro や guide.md がなければエラー', () => {
    expect(() => buildRegistry(sources([meta('a')], { noComponent: 'a' }))).toThrow(/Tool.astro/);
    expect(() => buildRegistry(sources([meta('a')], { noGuide: 'a' }))).toThrow(/guide.md/);
  });

  it('meta.ts のないツールフォルダはエラー', () => {
    const src = sources([meta('a')]);
    src.components.push('../tools/orphan/Tool.astro');
    expect(() => buildRegistry(src)).toThrow(/orphan: meta.ts/);
  });

  it('meta を export していなければエラー', () => {
    const src = sources([]);
    src.metas = { '../tools/a/meta.ts': {} };
    expect(() => buildRegistry(src)).toThrow(/meta を export/);
  });

  it('slug の書式・カテゴリ・説明文の長さを検査する', () => {
    expect(() => buildRegistry(sources([meta('Bad_Slug')]))).toThrow(/英小文字/);
    expect(() =>
      buildRegistry(sources([meta('a', { category: 'nope' as ToolMeta['category'] })])),
    ).toThrow(/カテゴリ/);
    expect(() => buildRegistry(sources([meta('a', { description: 'あ'.repeat(121) })]))).toThrow(
      /120/,
    );
  });

  it('ツールが 0 件でも動く', () => {
    expect(buildRegistry(sources([]))).toEqual([]);
  });
});

describe('groupByCategory', () => {
  it('空のカテゴリを除き、カテゴリ順で返す', () => {
    const groups = groupByCategory([meta('g', { category: 'generate' }), meta('c')]);
    expect(groups.map((g) => [g.category, g.label, g.tools.length])).toEqual([
      ['convert', '変換', 1],
      ['generate', '生成', 1],
    ]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/registry-core.test.ts`
Expected: FAIL（モジュールが見つからない）

- [ ] **Step 3: tool-meta・registry-core・registry を実装**

`src/lib/tool-meta.ts`:

```ts
export const CATEGORIES = ['convert', 'format', 'encode', 'text', 'generate'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  convert: '変換',
  format: '整形',
  encode: 'エンコード',
  text: 'テキスト',
  generate: '生成',
};

export interface ToolMeta {
  /** URL: /tools/<slug>/。フォルダ名と一致させる */
  slug: string;
  title: string;
  /** meta description とカードの説明文（120 字以内） */
  description: string;
  category: Category;
  /** 絵文字 1 文字 */
  icon: string;
  /** トップページ検索用 */
  keywords: string[];
  /** カテゴリ内の並び順（昇順、未指定は末尾） */
  order?: number;
}
```

`src/lib/registry-core.ts`:

```ts
import { CATEGORIES, CATEGORY_LABELS, type Category, type ToolMeta } from './tool-meta';

export interface ToolSources {
  /** import.meta.glob('../tools/*/meta.ts', { eager: true }) の結果 */
  metas: Record<string, { meta?: ToolMeta }>;
  /** Tool.astro のパス一覧 */
  components: string[];
  /** guide.md のパス一覧 */
  guides: string[];
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function folderOf(path: string): string {
  return /\/tools\/([^/]+)\/[^/]+$/.exec(path)?.[1] ?? path;
}

export function compareTools(a: ToolMeta, b: ToolMeta): number {
  const byCategory = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
  if (byCategory !== 0) return byCategory;
  const ao = a.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.title.localeCompare(b.title, 'ja');
}

export function buildRegistry(src: ToolSources): ToolMeta[] {
  const problems: string[] = [];
  const tools: ToolMeta[] = [];
  const seen = new Set<string>();
  const components = new Set(src.components.map(folderOf));
  const guides = new Set(src.guides.map(folderOf));
  const metaFolders = new Set(Object.keys(src.metas).map(folderOf));

  for (const [path, mod] of Object.entries(src.metas)) {
    const folder = folderOf(path);
    const meta = mod.meta;
    if (!meta) {
      problems.push(`${folder}: meta.ts が meta を export していません`);
      continue;
    }
    if (meta.slug !== folder) {
      problems.push(`${folder}: slug "${meta.slug}" がフォルダ名 "${folder}" と一致しません`);
    }
    if (!SLUG_PATTERN.test(meta.slug)) {
      problems.push(`${folder}: slug "${meta.slug}" は英小文字・数字・ハイフンのみ使えます`);
    }
    if (seen.has(meta.slug)) problems.push(`slug "${meta.slug}" が重複しています`);
    if (!(CATEGORIES as readonly string[]).includes(meta.category)) {
      problems.push(`${folder}: カテゴリ "${meta.category}" は未定義です`);
    }
    if (meta.description.length > 120) {
      problems.push(`${folder}: description は 120 字以内にしてください`);
    }
    if (!components.has(folder)) problems.push(`${folder}: Tool.astro がありません`);
    if (!guides.has(folder)) problems.push(`${folder}: guide.md がありません`);
    seen.add(meta.slug);
    tools.push(meta);
  }

  for (const folder of new Set([...components, ...guides])) {
    if (!metaFolders.has(folder)) problems.push(`${folder}: meta.ts がありません`);
  }

  if (problems.length > 0) {
    throw new Error(`ツール登録エラー:\n- ${problems.join('\n- ')}`);
  }
  return tools.sort(compareTools);
}

export function groupByCategory(
  tools: ToolMeta[],
): { category: Category; label: string; tools: ToolMeta[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    tools: tools.filter((t) => t.category === category).sort(compareTools),
  })).filter((g) => g.tools.length > 0);
}
```

`src/lib/registry.ts`:

```ts
// src/tools/<slug>/ を自動で収集する。ツールの追加はフォルダを置くだけでよい。
import { buildRegistry } from './registry-core';
import type { ToolMeta } from './tool-meta';

const metas = import.meta.glob<{ meta?: ToolMeta }>('../tools/*/meta.ts', { eager: true });
const components = import.meta.glob('../tools/*/Tool.astro');
const guides = import.meta.glob('../tools/*/guide.md');

export const tools: ToolMeta[] = buildRegistry({
  metas,
  components: Object.keys(components),
  guides: Object.keys(guides),
});
```

- [ ] **Step 4: registry-core のテストが通ることを確認**

Run: `npx vitest run src/lib/registry-core.test.ts`
Expected: PASS（8 件）

- [ ] **Step 5: 通信 API の静的チェックテストを書く**

`src/lib/no-network.test.ts`:

```ts
// 入力データを外部へ送れないよう、src 配下のコードに通信 API が書かれていないことを検査する。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../', import.meta.url));

const FORBIDDEN: [string, RegExp][] = [
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['sendBeacon', /\bsendBeacon\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['外部 URL の動的 import', /\bimport\s*\(\s*['"`]https?:/],
];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    const isSource = /\.(ts|astro|mjs|js)$/.test(name) && !/\.test\.(ts|mjs)$/.test(name);
    return isSource ? [path] : [];
  });
}

describe('通信 API の静的チェック', () => {
  it('src 配下に通信 API の呼び出しがない', () => {
    const violations: string[] = [];
    for (const file of walk(SRC)) {
      const code = readFileSync(file, 'utf8');
      for (const [name, pattern] of FORBIDDEN) {
        if (pattern.test(code)) violations.push(`${file.slice(SRC.length)}: ${name}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 6: 静的チェックが検出できることを確認してから元に戻す**

Run:

```bash
echo "fetch('https://example.com');" > src/lib/tmp-bad.ts && npx vitest run src/lib/no-network.test.ts; rm src/lib/tmp-bad.ts
```

Expected: FAIL し、`lib/tmp-bad.ts: fetch` が表示される。その後 `npx vitest run src/lib/no-network.test.ts` で PASS。

- [ ] **Step 7: 全テスト・型チェック・ビルドが通ることを確認**

Run: `npm test && npm run check && npm run build`
Expected: 全件 PASS、型エラー 0、ビルド成功（ツールは 0 件）。

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "feat: add tool registry with build-time validation and network API guard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: レイアウト・共通コンポーネント・ページ

**Files:**
- Create: `src/env.d.ts`, `src/lib/site.ts`, `src/styles/global.css`, `src/layouts/BaseLayout.astro`, `src/layouts/ToolLayout.astro`, `src/components/AdSlot.astro`, `src/components/PrivacyBadge.astro`, `src/components/ToolCard.astro`, `src/pages/tools/[slug].astro`, `src/pages/privacy.astro`, `src/pages/about.astro`, `src/pages/404.astro`, `public/favicon.svg`, `public/robots.txt`
- Modify: `src/pages/index.astro`（全面置き換え）

**Interfaces:**
- Consumes: `tools`（registry.ts）、`groupByCategory`、`CATEGORY_LABELS`、`ToolMeta`、`getRecent`、`pushRecent`、`searchTextOf`、`matchesQuery`
- Produces:
  - `SITE: { name: string; tagline: string; url: string }`、`env: { adsenseClient: string; slotTool: string; slotFooter: string; cfAnalyticsToken: string }`（site.ts）
  - `BaseLayout` props: `{ title: string; description: string; noindex?: boolean }`
  - `ToolLayout` props: `{ tool: ToolMeta; related: ToolMeta[] }`、名前付きスロット `tool` と `guide`
  - `AdSlot` props: `{ adSlot: string }`（`slot` は Astro の予約属性なので使わない）
  - `ToolCard` props: `{ tool: ToolMeta }`、`<li class="tool-card" data-slug data-search>` を出力
  - トップページの要素: `#tool-search`、`#recent`、`[data-recent-list]`、`section[data-category]`（`id="cat-<category>"`）、`#no-results`
  - CSS クラス（以降のタスクで使う）: `.btn`、`.btn-primary`、`.options`、`.field`、`.msg`、`.msg-error`、`.msg-info`、`.table-wrap`、`.stats`、`.visually-hidden`

- [ ] **Step 1: 型・サイト設定・スタイルを作成**

`src/env.d.ts`:

```ts
interface ImportMetaEnv {
  readonly PUBLIC_ADSENSE_CLIENT?: string;
  readonly PUBLIC_ADSENSE_SLOT_TOOL?: string;
  readonly PUBLIC_ADSENSE_SLOT_FOOTER?: string;
  readonly PUBLIC_CF_ANALYTICS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  adsbygoogle?: unknown[];
}
```

`src/lib/site.ts`:

```ts
export const SITE = {
  name: 'Creator World Tools',
  tagline: 'ブラウザだけで完結する、登録不要の便利ツール集',
  url: 'https://tools.creator-world.net',
} as const;

// すべて任意。未設定なら広告・解析のタグを出力しない
export const env = {
  adsenseClient: import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '',
  slotTool: import.meta.env.PUBLIC_ADSENSE_SLOT_TOOL ?? '',
  slotFooter: import.meta.env.PUBLIC_ADSENSE_SLOT_FOOTER ?? '',
  cfAnalyticsToken: import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN ?? '',
};
```

`src/styles/global.css`:

```css
:root {
  --bg: #f7f7f5;
  --surface: #ffffff;
  --text: #1d1d1f;
  --muted: #5f6368;
  --border: #d9d9d6;
  --accent: #2f6fde;
  --accent-text: #ffffff;
  --error: #c62828;
  --error-bg: #fdecea;
  --info-bg: #e8f0fe;
  --radius: 10px;
  --font: system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic UI', sans-serif;
  --mono: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #161618;
    --surface: #202023;
    --text: #ececec;
    --muted: #a0a0a8;
    --border: #3a3a40;
    --accent: #6b9cff;
    --accent-text: #0d0d0f;
    --error: #ff8a80;
    --error-bg: #3a1f1f;
    --info-bg: #1f2a3d;
  }
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

[hidden] {
  display: none !important;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  line-height: 1.7;
}

a {
  color: var(--accent);
}

.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 16px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.site-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.site-header .container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
}
.brand {
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
}
.site-header nav {
  display: flex;
  gap: 16px;
  font-size: 0.9rem;
}

main.container {
  padding-top: 24px;
  padding-bottom: 48px;
}

.site-footer {
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.85rem;
  padding: 24px 0;
}

.hero h1 {
  font-size: 1.8rem;
  margin: 0 0 4px;
}
.privacy-note,
.privacy-badge {
  background: var(--info-bg);
  border-radius: var(--radius);
  padding: 8px 12px;
  font-size: 0.9rem;
}

.search input {
  width: 100%;
  max-width: 480px;
  padding: 10px 12px;
  font: inherit;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
}

.tool-grid {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.tool-card a {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 10px;
  height: 100%;
  padding: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  text-decoration: none;
}
.tool-card a:hover,
.tool-card a:focus-visible {
  border-color: var(--accent);
}
.tool-icon {
  grid-row: span 2;
  font-size: 1.6rem;
}
.tool-title {
  font-weight: 700;
}
.tool-desc {
  color: var(--muted);
  font-size: 0.85rem;
}

.breadcrumb ol {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 0.85rem;
  color: var(--muted);
}
.breadcrumb li + li::before {
  content: '›';
  margin-right: 4px;
}

.tool {
  margin: 16px 0 24px;
}

.io {
  display: grid;
  gap: 12px;
}
.io textarea {
  width: 100%;
  min-height: 200px;
  padding: 10px;
  font-family: var(--mono);
  font-size: 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  resize: vertical;
}
.io-drop.dragging textarea {
  border-color: var(--accent);
  outline: 2px dashed var(--accent);
}
.io-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  font: inherit;
  font-size: 0.9rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 14px;
  margin: 0;
}
.options legend {
  font-size: 0.85rem;
  color: var(--muted);
}
.field select,
.field input[type='number'] {
  font: inherit;
  padding: 2px 6px;
  margin-left: 4px;
}

.msg {
  margin: 4px 0 0;
  min-height: 1.5em;
  font-size: 0.9rem;
}
.msg-error {
  color: var(--error);
  background: var(--error-bg);
  border-radius: 6px;
  padding: 4px 8px;
}
.msg-info {
  color: var(--muted);
}

.table-wrap {
  overflow-x: auto;
  margin-top: 12px;
}
.table-wrap table {
  border-collapse: collapse;
  font-size: 0.85rem;
}
.table-wrap th,
.table-wrap td {
  border: 1px solid var(--border);
  padding: 4px 8px;
  text-align: left;
  white-space: pre;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  margin: 12px 0 0;
}
.stats div {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
}
.stats dt {
  color: var(--muted);
  font-size: 0.8rem;
}
.stats dd {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
}

.ad-slot {
  margin: 24px 0;
  min-height: 280px;
}
.ad-slot ins {
  display: block;
  min-height: 250px;
}
.ad-label {
  font-size: 0.75rem;
  color: var(--muted);
}

.guide {
  margin-top: 32px;
}
.guide h2 {
  font-size: 1.2rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
}

.related ul {
  padding-left: 1.2em;
}
```

- [ ] **Step 2: レイアウトとコンポーネントを作成**

`src/layouts/BaseLayout.astro`:

```astro
---
import '../styles/global.css';
import { env, SITE } from '../lib/site';

interface Props {
  title: string;
  description: string;
  noindex?: boolean;
}

const { title, description, noindex = false } = Astro.props;
const fullTitle = title === SITE.name ? title : `${title} | ${SITE.name}`;
const canonical = new URL(Astro.url.pathname, Astro.site).href;
const beacon = JSON.stringify({ token: env.cfAnalyticsToken });
---

<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    {noindex && <meta name="robots" content="noindex" />}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content={SITE.name} />
    <meta property="og:title" content={fullTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta name="twitter:card" content="summary" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="sitemap" href="/sitemap-index.xml" />
    {
      env.adsenseClient && (
        <script
          is:inline
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${env.adsenseClient}`}
          crossorigin="anonymous"></script>
      )
    }
  </head>
  <body>
    <header class="site-header">
      <div class="container">
        <a class="brand" href="/">{SITE.name}</a>
        <nav aria-label="サイト">
          <a href="/about/">このサイトについて</a>
          <a href="/privacy/">プライバシーポリシー</a>
        </nav>
      </div>
    </header>
    <main class="container">
      <slot />
    </main>
    <footer class="site-footer">
      <div class="container">
        <p>入力したデータはブラウザ内だけで処理され、サーバーへ送信・保存されません。</p>
        <p><a href="/about/">このサイトについて</a> ・ <a href="/privacy/">プライバシーポリシー</a></p>
        <p>© {new Date().getFullYear()} {SITE.name}</p>
      </div>
    </footer>
    {
      env.cfAnalyticsToken && (
        <script
          is:inline
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={beacon}></script>
      )
    }
  </body>
</html>
```

`src/components/PrivacyBadge.astro`:

```astro
<p class="privacy-badge">
  🔒 入力したデータはブラウザ内で処理され、サーバーへ送信・保存されません。
</p>
```

`src/components/AdSlot.astro`:

```astro
---
import { env } from '../lib/site';

interface Props {
  adSlot: string;
}

const { adSlot } = Astro.props;
const enabled = Boolean(env.adsenseClient && adSlot);
---

{
  enabled && (
    <aside class="ad-slot" aria-label="広告">
      <span class="ad-label">広告</span>
      <ins
        class="adsbygoogle"
        data-ad-client={env.adsenseClient}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
    </aside>
  )
}

<script>
  // スクリプトはページ内で 1 度だけ実行されるので、まだ push していない広告枠をまとめて処理する
  document.querySelectorAll('ins.adsbygoogle:not([data-cwt-pushed])').forEach((el) => {
    el.setAttribute('data-cwt-pushed', '');
    (window.adsbygoogle = window.adsbygoogle ?? []).push({});
  });
</script>
```

`src/components/ToolCard.astro`:

```astro
---
import { searchTextOf } from '../lib/search';
import type { ToolMeta } from '../lib/tool-meta';

interface Props {
  tool: ToolMeta;
}

const { tool } = Astro.props;
---

<li
  class="tool-card"
  data-slug={tool.slug}
  data-search={searchTextOf([tool.title, tool.description, ...tool.keywords])}
>
  <a href={`/tools/${tool.slug}/`}>
    <span class="tool-icon" aria-hidden="true">{tool.icon}</span>
    <span class="tool-title">{tool.title}</span>
    <span class="tool-desc">{tool.description}</span>
  </a>
</li>
```

`src/layouts/ToolLayout.astro`:

```astro
---
import AdSlot from '../components/AdSlot.astro';
import PrivacyBadge from '../components/PrivacyBadge.astro';
import { env } from '../lib/site';
import { CATEGORY_LABELS, type ToolMeta } from '../lib/tool-meta';
import BaseLayout from './BaseLayout.astro';

interface Props {
  tool: ToolMeta;
  related: ToolMeta[];
}

const { tool, related } = Astro.props;
---

<BaseLayout title={tool.title} description={tool.description}>
  <nav class="breadcrumb" aria-label="パンくずリスト">
    <ol>
      <li><a href="/">トップ</a></li>
      <li><a href={`/#cat-${tool.category}`}>{CATEGORY_LABELS[tool.category]}</a></li>
      <li aria-current="page">{tool.title}</li>
    </ol>
  </nav>
  <h1>{tool.icon} {tool.title}</h1>
  <p class="lead">{tool.description}</p>
  <PrivacyBadge />
  <section class="tool" data-tool={tool.slug}>
    <slot name="tool" />
  </section>
  <AdSlot adSlot={env.slotTool} />
  <article class="guide">
    <slot name="guide" />
  </article>
  <AdSlot adSlot={env.slotFooter} />
  {
    related.length > 0 && (
      <section class="related">
        <h2>同じカテゴリのツール</h2>
        <ul>
          {related.map((t) => (
            <li>
              <a href={`/tools/${t.slug}/`}>
                {t.icon} {t.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
    )
  }
</BaseLayout>

<script>
  import { pushRecent } from '../lib/storage';

  const slug = document.querySelector<HTMLElement>('[data-tool]')?.dataset.tool;
  if (slug) pushRecent(slug);
</script>
```

- [ ] **Step 3: ページを作成**

`src/pages/index.astro`（全面置き換え）:

```astro
---
import ToolCard from '../components/ToolCard.astro';
import BaseLayout from '../layouts/BaseLayout.astro';
import { tools } from '../lib/registry';
import { groupByCategory } from '../lib/registry-core';
import { SITE } from '../lib/site';

const groups = groupByCategory(tools);
---

<BaseLayout
  title={SITE.name}
  description="CSV・JSON 変換や文字数カウントなど、ブラウザだけで使える無料ツール集。データはサーバーに送信されず、ログインも不要です。"
>
  <section class="hero">
    <h1>{SITE.name}</h1>
    <p>{SITE.tagline}</p>
    <p class="privacy-note">
      🔒 入力・アップロードしたデータはブラウザ内だけで処理され、サーバーへ送信・保存されません。
    </p>
  </section>

  <div class="search">
    <label for="tool-search" class="visually-hidden">ツールを検索</label>
    <input
      id="tool-search"
      type="search"
      placeholder="ツールを検索（例: CSV、文字数）"
      autocomplete="off"
      hidden
    />
  </div>

  <section id="recent" hidden>
    <h2>最近使ったツール</h2>
    <ul class="tool-grid" data-recent-list></ul>
  </section>

  {
    groups.map((g) => (
      <section id={`cat-${g.category}`} data-category>
        <h2>{g.label}</h2>
        <ul class="tool-grid">
          {g.tools.map((t) => (
            <ToolCard tool={t} />
          ))}
        </ul>
      </section>
    ))
  }
  <p id="no-results" hidden>該当するツールが見つかりませんでした。</p>
  {tools.length === 0 && <p>ツールは準備中です。</p>}
</BaseLayout>

<script>
  import { matchesQuery } from '../lib/search';
  import { getRecent } from '../lib/storage';

  const input = document.querySelector<HTMLInputElement>('#tool-search')!;
  const recent = document.querySelector<HTMLElement>('#recent')!;
  const recentList = document.querySelector<HTMLElement>('[data-recent-list]')!;
  const noResults = document.querySelector<HTMLElement>('#no-results')!;
  const sections = [...document.querySelectorAll<HTMLElement>('section[data-category]')];
  const cards = sections.flatMap((s) => [...s.querySelectorAll<HTMLElement>('.tool-card')]);

  input.hidden = false;

  const bySlug = new Map(cards.map((c) => [c.dataset.slug, c]));
  for (const slug of getRecent()) {
    const card = bySlug.get(slug);
    if (card) recentList.append(card.cloneNode(true));
  }
  const hasRecent = recentList.children.length > 0;
  recent.hidden = !hasRecent;

  input.addEventListener('input', () => {
    const q = input.value;
    for (const c of cards) c.hidden = !matchesQuery(c.dataset.search ?? '', q);
    for (const s of sections) s.hidden = !s.querySelector('.tool-card:not([hidden])');
    noResults.hidden = cards.length === 0 || cards.some((c) => !c.hidden);
    recent.hidden = !hasRecent || q.trim() !== '';
  });
</script>
```

`src/pages/tools/[slug].astro`:

```astro
---
import type { AstroInstance, MarkdownInstance } from 'astro';
import ToolLayout from '../../layouts/ToolLayout.astro';
import { tools } from '../../lib/registry';
import type { ToolMeta } from '../../lib/tool-meta';

export function getStaticPaths() {
  return tools.map((tool) => ({ params: { slug: tool.slug }, props: { tool } }));
}

interface Props {
  tool: ToolMeta;
}

const { tool } = Astro.props;
const components = import.meta.glob<AstroInstance>('../../tools/*/Tool.astro', { eager: true });
const guides = import.meta.glob<MarkdownInstance<Record<string, never>>>('../../tools/*/guide.md', {
  eager: true,
});
const Tool = components[`../../tools/${tool.slug}/Tool.astro`].default;
const Guide = guides[`../../tools/${tool.slug}/guide.md`].Content;
const related = tools.filter((t) => t.category === tool.category && t.slug !== tool.slug);
---

<ToolLayout tool={tool} related={related}>
  <Tool slot="tool" />
  <Guide slot="guide" />
</ToolLayout>
```

`src/pages/privacy.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { SITE } from '../lib/site';
---

<BaseLayout title="プライバシーポリシー" description={`${SITE.name} のプライバシーポリシーです。`}>
  <h1>プライバシーポリシー</h1>
  <p>{SITE.name}（以下「当サイト」）における利用者情報の取り扱いについて説明します。</p>

  <h2>入力・アップロードしたデータについて</h2>
  <p>
    当サイトのツールは、入力したテキストや選択したファイルをすべてお使いのブラウザ内で処理します。これらのデータを当サイトのサーバーや第三者へ送信することはなく、保存することもありません。ページを閉じると、入力したデータは破棄されます。
  </p>

  <h2>ブラウザに保存する情報</h2>
  <p>利便性のため、次の情報をお使いのブラウザの localStorage に保存します。これらは当サイトのサーバーへ送信されません。</p>
  <ul>
    <li>各ツールの設定値（区切り文字、インデント幅、文字種の選択など）</li>
    <li>最近使ったツールの一覧（最大 6 件）</li>
  </ul>
  <p>ブラウザの設定からサイトデータを削除すると、これらの情報も削除されます。</p>

  <h2>広告について</h2>
  <p>
    当サイトは第三者配信の広告サービス「Google アドセンス」を利用しています（利用を開始している場合）。広告配信事業者は、利用者の興味に応じた広告を表示するために Cookie を使用することがあります。Cookie を使用することで、当サイトや他のサイトへのアクセス情報に基づいて広告を配信できます。
  </p>
  <p>
    パーソナライズ広告は <a href="https://adssettings.google.com/" rel="noopener">Google の広告設定</a> で無効にできます。Google による Cookie の利用については
    <a href="https://policies.google.com/technologies/ads?hl=ja" rel="noopener">Google のポリシーと規約</a> をご覧ください。
  </p>
  <p>欧州経済領域（EEA）・英国・スイスからのアクセスでは、Google の同意管理メッセージにより Cookie 利用への同意を確認します。</p>

  <h2>アクセス解析について</h2>
  <p>
    当サイトはアクセス状況の把握のため Cloudflare Web Analytics を利用する場合があります。このサービスは Cookie を使用せず、個人を特定する情報を収集しません。
  </p>

  <h2>免責事項</h2>
  <p>
    当サイトのツールの結果の正確性には努めていますが、その内容を保証するものではありません。重要なデータは結果を確認のうえご利用ください。当サイトの利用により生じた損害について、当サイトは責任を負いかねます。
  </p>

  <h2>改定</h2>
  <p>本ポリシーは必要に応じて改定することがあります。改定後の内容は本ページに掲載した時点から効力を生じます。</p>
  <p>制定日: 2026 年 9 月 23 日</p>
</BaseLayout>
```

`src/pages/about.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { SITE } from '../lib/site';
---

<BaseLayout title="このサイトについて" description={`${SITE.name} の目的と運営方針です。`}>
  <h1>このサイトについて</h1>
  <p>
    {SITE.name} は、CSV・JSON の変換や文字数カウントなど、仕事や創作でちょっと必要になる作業をブラウザだけで済ませられる無料のツール集です。
  </p>

  <h2>データを送信しない設計</h2>
  <p>
    すべてのツールはお使いのブラウザ内で動作し、入力したテキストやファイルをサーバーへ送信しません。サーバー側に処理プログラムを持たない静的サイトとして公開しているため、アップロードしたデータがどこかに保存されることもありません。
  </p>

  <h2>ログイン不要</h2>
  <p>会員登録やログインは不要です。ツールの設定はお使いのブラウザにだけ保存されます。</p>

  <h2>運営</h2>
  <p>運営: Creator World（creator-world.net）</p>
  <p>当サイトは広告収入によって運営しています。</p>
</BaseLayout>
```

`src/pages/404.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="ページが見つかりません" description="お探しのページは見つかりませんでした。" noindex>
  <h1>ページが見つかりません</h1>
  <p>URL が変更されたか、削除された可能性があります。</p>
  <p><a href="/">トップページへ戻る</a></p>
</BaseLayout>
```

`public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://tools.creator-world.net/sitemap-index.xml
```

`public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#2f6fde"/><path d="M9 11h14M9 16h10M9 21h14" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>
```

- [ ] **Step 4: 型チェック・ビルドが通り、ページが生成されることを確認**

Run: `npm run check && npm run build && ls dist dist/privacy dist/about`
Expected: 型エラー 0。`dist/index.html`、`dist/privacy/index.html`、`dist/about/index.html`、`dist/404.html`、`dist/robots.txt`、`dist/favicon.svg`、`dist/sitemap-index.xml` がある。

- [ ] **Step 5: 中身のない inline script が出力されていないことを確認**

Run: `grep -o '<script[^>]*>[^<]' dist/index.html dist/privacy/index.html || echo "inline script なし"`
Expected: `inline script なし`（`<script type="module" src=...></script>` のように src 付きだけが出力されている）。inline script が出ている場合は `astro.config.mjs` の `vite.build.assetsInlineLimit: 0` が効いているか確認し、原因を調べて解消する（CSP で inline script を禁止するため）。

- [ ] **Step 6: 全テストが通ることを確認してコミット**

Run: `npm test`
Expected: 全件 PASS

```bash
git add -A
git commit -m "feat: add layouts, portal page, tool page route and static pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: セキュリティヘッダー・ads.txt の生成と E2E 基盤

**Files:**
- Create: `scripts/postbuild.mjs`, `scripts/postbuild.test.mjs`, `playwright.config.ts`, `tests/e2e/helpers.ts`, `tests/e2e/site.spec.ts`
- Modify: `package.json`（`build` と `preview` スクリプト）

**Interfaces:**
- Produces:
  - `buildCsp(env: Record<string, string | undefined>): string`、`buildHeaders(env): string`、`buildAdsTxt(env): string`（postbuild.mjs）
  - E2E ヘルパー: `ORIGIN = 'http://localhost:8788'`、`toolSlugs(): string[]`（`dist/tools/` 配下のフォルダ名）、`watchPage(page: Page): { external: string[]; cspViolations: string[]; errors: string[] }`
  - npm scripts: `build` = `astro build && node scripts/postbuild.mjs`、`preview` = `wrangler pages dev dist --port 8788`

- [ ] **Step 1: postbuild の失敗するテストを書く**

`scripts/postbuild.test.mjs`:

```js
import { describe, expect, it } from 'vitest';
import { buildAdsTxt, buildCsp, buildHeaders } from './postbuild.mjs';

const directive = (csp, name) => csp.split('; ').find((d) => d.startsWith(`${name} `));

describe('buildCsp', () => {
  it('広告・解析なしでは自サイト以外へ通信できない', () => {
    const csp = buildCsp({});
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self'");
    expect(directive(csp, 'script-src')).toBe("script-src 'self'");
    expect(directive(csp, 'frame-src')).toBe("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('https:');
  });

  it('解析トークンがあれば Cloudflare Web Analytics だけ許可', () => {
    const csp = buildCsp({ PUBLIC_CF_ANALYTICS_TOKEN: 'abc' });
    expect(directive(csp, 'script-src')).toBe(
      "script-src 'self' https://static.cloudflareinsights.com",
    );
    expect(directive(csp, 'connect-src')).toBe(
      "connect-src 'self' https://cloudflareinsights.com",
    );
  });

  it('AdSense を有効にすると https を広く許可する', () => {
    const csp = buildCsp({ PUBLIC_ADSENSE_CLIENT: 'ca-pub-1' });
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' https:");
    expect(directive(csp, 'frame-src')).toBe('frame-src https:');
    expect(directive(csp, 'script-src')).toContain('https:');
  });
});

describe('buildHeaders', () => {
  it('全パスにセキュリティヘッダーを付ける', () => {
    const h = buildHeaders({});
    expect(h.startsWith('/*\n')).toBe(true);
    expect(h).toContain('  Content-Security-Policy: ');
    expect(h).toContain('  X-Content-Type-Options: nosniff');
    expect(h).toContain('  Referrer-Policy: strict-origin-when-cross-origin');
    expect(h).toContain('  Permissions-Policy: camera=(), microphone=(), geolocation=()');
  });
});

describe('buildAdsTxt', () => {
  it('パブリッシャー ID から ads.txt の行を作る', () => {
    expect(buildAdsTxt({ PUBLIC_ADSENSE_CLIENT: 'ca-pub-1234567890' })).toBe(
      'google.com, pub-1234567890, DIRECT, f08c47fec0942fa0\n',
    );
  });

  it('未設定なら空', () => {
    expect(buildAdsTxt({})).toBe('');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run scripts/postbuild.test.mjs`
Expected: FAIL（`./postbuild.mjs` が見つからない）

- [ ] **Step 3: postbuild を実装**

`scripts/postbuild.mjs`:

```js
// ビルド後に dist/_headers（Cloudflare Pages のレスポンスヘッダー）と dist/ads.txt を生成する。
// 環境変数で広告・解析の有無が変わるため、public/ に固定ファイルとして置かずにここで作る。
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CF_ANALYTICS_SCRIPT = 'https://static.cloudflareinsights.com';
const CF_ANALYTICS_BEACON = 'https://cloudflareinsights.com';

/** @param {Record<string, string | undefined>} env */
export function buildCsp(env) {
  const script = ["'self'"];
  const connect = ["'self'"];
  const img = ["'self'", 'data:', 'blob:'];
  let frame = ["'none'"];

  if (env.PUBLIC_CF_ANALYTICS_TOKEN) {
    script.push(CF_ANALYTICS_SCRIPT);
    connect.push(CF_ANALYTICS_BEACON);
  }
  if (env.PUBLIC_ADSENSE_CLIENT) {
    // AdSense は国別ドメインを含む多数の Google ドメインから配信されるため、ドメインを列挙する CSP は
    // 保守できない。広告を有効にしたときは https を広く許可し、入力データを送らないことは
    // コード側（no-network.test.ts）と E2E（広告なしビルドで外部通信ゼロ）で担保する。
    script.push("'unsafe-inline'", 'https:');
    connect.push('https:');
    img.push('https:');
    frame = ['https:'];
  }

  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img.join(' ')}`,
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    `frame-src ${frame.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** @param {Record<string, string | undefined>} env */
export function buildHeaders(env) {
  return [
    '/*',
    `  Content-Security-Policy: ${buildCsp(env)}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
    '',
  ].join('\n');
}

/** @param {Record<string, string | undefined>} env */
export function buildAdsTxt(env) {
  const client = env.PUBLIC_ADSENSE_CLIENT;
  if (!client) return '';
  return `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // .env がなければ環境変数だけを使う
  }
  const dist = new URL('../dist/', import.meta.url);
  writeFileSync(new URL('_headers', dist), buildHeaders(process.env));
  writeFileSync(new URL('ads.txt', dist), buildAdsTxt(process.env));
  console.log('postbuild: dist/_headers と dist/ads.txt を生成しました');
}
```

`package.json` の `scripts` を次のように変更（他は変えない）:

```json
    "build": "astro build && node scripts/postbuild.mjs",
    "preview": "wrangler pages dev dist --port 8788",
```

- [ ] **Step 4: テストが通り、ビルドで _headers が生成されることを確認**

Run: `npx vitest run scripts/postbuild.test.mjs && npm run build && cat dist/_headers`
Expected: PASS（6 件）。`dist/_headers` の CSP に `connect-src 'self'` が含まれる。

- [ ] **Step 5: Playwright の設定・ヘルパー・サイト全体の E2E を書く**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

// wrangler pages dev は dist/_headers を適用するので、CSP 込みで検証できる
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:8788', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx wrangler pages dev dist --port 8788',
    url: 'http://localhost:8788',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
```

`tests/e2e/helpers.ts`:

```ts
import { existsSync, readdirSync } from 'node:fs';
import type { Page } from '@playwright/test';

export const ORIGIN = 'http://localhost:8788';

// E2E は広告・解析の環境変数なしでビルドした dist を対象にする
export function toolSlugs(): string[] {
  const dir = 'dist/tools';
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function watchPage(page: Page) {
  const external: string[] = [];
  const cspViolations: string[] = [];
  const errors: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== ORIGIN) {
      external.push(req.url());
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text())) {
      cspViolations.push(msg.text());
    }
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return { external, cspViolations, errors };
}
```

`tests/e2e/site.spec.ts`:

```ts
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
```

- [ ] **Step 6: E2E を実行**

Run: `npx playwright install chromium && npm run build && npm run test:e2e`
Expected: ツール依存のテストは skip、それ以外は PASS。`wrangler pages dev` が起動しない場合はエラー内容を確認する（初回はダウンロードに時間がかかる。ログインは不要）。

- [ ] **Step 7: 全テストが通ることを確認してコミット**

Run: `npm test && npm run check`
Expected: 全件 PASS、型エラー 0

```bash
git add -A
git commit -m "feat: generate security headers and ads.txt, add E2E harness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 入出力パネル（IOPanel）と JSON 整形・検証ツール

**Files:**
- Create: `src/components/IOPanel.astro`, `src/lib/io-panel.ts`, `src/tools/json-format/meta.ts`, `src/tools/json-format/logic.ts`, `src/tools/json-format/logic.test.ts`, `src/tools/json-format/Tool.astro`, `src/tools/json-format/guide.md`, `tests/e2e/tools/json-format.spec.ts`

**Interfaces:**
- Consumes: `checkFileSize`、`readFileBytes`、`downloadBlob`、`copyText`、`formatBytes`（file.ts）、`decodeBytes`（encoding.ts）、`parseJson`、`isRawNumber`（json.ts）、`readChoice`、`readBool`、`write`、`toolKey`（storage.ts）、`describeError`、`ok`、`Result`
- Produces:
  - `IOPanel.astro` props: `{ id: string; inputLabel: string; placeholder?: string; accept?: string; runLabel?: string; showOutput?: boolean }`。名前付きスロット `options`。ルート要素は `<div class="io" data-io={id}>`
  - DOM フック: `[data-input]`、`[data-file]`、`[data-drop]`、`[data-run]`、`[data-clear]`、`[data-output]`、`[data-copy]`、`[data-download]`、`[data-msg]`
  - `io-panel.ts`: `AUTO_RUN_MAX_CHARS = 1_000_000`、`interface DownloadSpec { filename: string; mime: string; data: BlobPart[] }`、`interface IOPanelOptions { run(input: string): void; readFile?(file: File, bytes: Uint8Array<ArrayBuffer>): string | null | Promise<string | null>; runOnEmpty?: boolean }`、`interface IOPanel { input: HTMLTextAreaElement; output: HTMLTextAreaElement | null; setOutput(text: string, download?: DownloadSpec, opts?: { copyable?: boolean }): void; setError(message: string): void; setInfo(message: string): void; clearMessages(): void; rerun(): void }`、`bindIOPanel(root: HTMLElement, options: IOPanelOptions): IOPanel`
  - json-format logic: `MODES = ['format', 'minify'] as const`、`INDENTS = ['2', '4', 'tab'] as const`、`type Mode`、`type Indent`、`interface FormatOptions { mode: Mode; indent: Indent; sortKeys: boolean }`、`interface Formatted { text: string; precisionWarning: boolean }`、`sortKeysDeep(v: unknown): unknown`、`formatJson(text: string, opts: FormatOptions): Result<Formatted>`

- [ ] **Step 1: IOPanel を作成**

`src/components/IOPanel.astro`:

```astro
---
interface Props {
  id: string;
  inputLabel: string;
  placeholder?: string;
  accept?: string;
  runLabel?: string;
  showOutput?: boolean;
}

const {
  id,
  inputLabel,
  placeholder = '',
  accept = '',
  runLabel = '変換',
  showOutput = true,
} = Astro.props;
---

<div class="io" data-io={id}>
  <section>
    <label for={`${id}-input`}><strong>{inputLabel}</strong></label>
    <div class="io-drop" data-drop>
      <textarea
        id={`${id}-input`}
        data-input
        spellcheck="false"
        autocomplete="off"
        placeholder={placeholder}></textarea>
    </div>
    <div class="io-actions">
      <label class="btn">
        ファイルを選択
        <input type="file" data-file accept={accept || undefined} class="visually-hidden" />
      </label>
      <button type="button" class="btn" data-clear>クリア</button>
      <button type="button" class="btn btn-primary" data-run>{runLabel}</button>
      <span class="msg-info">ファイルをここにドラッグ&ドロップすることもできます</span>
    </div>
  </section>
  <slot name="options" />
  <p class="msg" data-msg role="status" aria-live="polite"></p>
  {
    showOutput && (
      <section>
        <label for={`${id}-output`}>
          <strong>出力</strong>
        </label>
        <textarea id={`${id}-output`} data-output readonly spellcheck="false"></textarea>
        <div class="io-actions">
          <button type="button" class="btn" data-copy disabled>
            コピー
          </button>
          <button type="button" class="btn" data-download disabled>
            ダウンロード
          </button>
        </div>
      </section>
    )
  }
  <slot name="after" />
</div>
```

`src/lib/io-panel.ts`:

```ts
// 入力（貼り付け / ドラッグ&ドロップ / ファイル選択）→ ツールの処理 → 出力（コピー / ダウンロード）の共通部品
import { decodeBytes } from './encoding';
import { checkFileSize, copyText, downloadBlob, readFileBytes } from './file';

export const AUTO_RUN_MAX_CHARS = 1_000_000;
const DEBOUNCE_MS = 250;

export interface DownloadSpec {
  filename: string;
  mime: string;
  data: BlobPart[];
}

export interface IOPanelOptions {
  /** 入力を処理する。空入力では runOnEmpty が true のときだけ呼ばれる */
  run(input: string): void;
  /** ファイルを独自に読む場合に指定。入力欄に入れる文字列を返す。null なら入力欄を変えず run もしない */
  readFile?(file: File, bytes: Uint8Array<ArrayBuffer>): string | null | Promise<string | null>;
  runOnEmpty?: boolean;
}

export interface IOPanel {
  readonly input: HTMLTextAreaElement;
  readonly output: HTMLTextAreaElement | null;
  setOutput(text: string, download?: DownloadSpec, opts?: { copyable?: boolean }): void;
  setError(message: string): void;
  setInfo(message: string): void;
  clearMessages(): void;
  rerun(): void;
}

export function bindIOPanel(root: HTMLElement, options: IOPanelOptions): IOPanel {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);
  const input = q<HTMLTextAreaElement>('[data-input]')!;
  const fileInput = q<HTMLInputElement>('[data-file]')!;
  const drop = q<HTMLElement>('[data-drop]')!;
  const runBtn = q<HTMLButtonElement>('[data-run]')!;
  const clearBtn = q<HTMLButtonElement>('[data-clear]')!;
  const msg = q<HTMLElement>('[data-msg]')!;
  const output = q<HTMLTextAreaElement>('[data-output]');
  const copyBtn = q<HTMLButtonElement>('[data-copy]');
  const downloadBtn = q<HTMLButtonElement>('[data-download]');
  let download: DownloadSpec | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const panel: IOPanel = {
    input,
    output,
    setOutput(text, dl, opts = {}) {
      panel.clearMessages();
      if (output) output.value = text;
      download = dl;
      if (copyBtn) copyBtn.disabled = text === '' || opts.copyable === false;
      if (downloadBtn) downloadBtn.disabled = !dl;
    },
    setError(message) {
      panel.setOutput('');
      msg.textContent = message;
      msg.className = 'msg msg-error';
    },
    setInfo(message) {
      msg.textContent = message;
      msg.className = 'msg msg-info';
    },
    clearMessages() {
      msg.textContent = '';
      msg.className = 'msg';
    },
    rerun() {
      runNow();
    },
  };

  function runNow() {
    clearTimeout(timer);
    if (input.value.trim() === '' && !options.runOnEmpty) {
      panel.setOutput('');
      return;
    }
    options.run(input.value);
  }

  function scheduleRun() {
    clearTimeout(timer);
    if (input.value.length > AUTO_RUN_MAX_CHARS) {
      panel.setInfo(`入力が大きいため自動${runBtn.textContent}を止めています。「${runBtn.textContent}」を押してください`);
      return;
    }
    timer = setTimeout(runNow, DEBOUNCE_MS);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const size = checkFileSize(file.size);
    if (!size.ok) {
      panel.setError(size.error.message);
      return;
    }
    const bytes = await readFileBytes(file);
    let text: string | null;
    if (options.readFile) {
      text = await options.readFile(file, bytes);
    } else {
      const decoded = decodeBytes(bytes, 'auto');
      if (!decoded.ok) {
        panel.setError(decoded.error.message);
        return;
      }
      text = decoded.value.text;
    }
    if (text === null) return;
    input.value = text;
    runNow();
  }

  input.addEventListener('input', scheduleRun);
  runBtn.addEventListener('click', runNow);
  clearBtn.addEventListener('click', () => {
    input.value = '';
    fileInput.value = '';
    runNow();
  });
  fileInput.addEventListener('change', () => {
    void handleFile(fileInput.files?.[0]);
    fileInput.value = '';
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('dragging');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragging');
    void handleFile(e.dataTransfer?.files[0]);
  });
  copyBtn?.addEventListener('click', async () => {
    const result = await copyText(output?.value ?? '', output);
    panel.setInfo(
      result === 'copied'
        ? 'コピーしました'
        : '出力を選択しました。Ctrl+C（Mac は ⌘C）でコピーしてください',
    );
  });
  downloadBtn?.addEventListener('click', () => {
    if (download) downloadBlob(download.data, download.filename, download.mime);
  });

  return panel;
}
```

- [ ] **Step 2: json-format logic の失敗するテストを書く**

`src/tools/json-format/logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatJson, sortKeysDeep, type FormatOptions } from './logic';

const opts = (over: Partial<FormatOptions> = {}): FormatOptions => ({
  mode: 'format',
  indent: '2',
  sortKeys: false,
  ...over,
});

const text = (r: ReturnType<typeof formatJson>) => (r.ok ? r.value.text : r.error.message);

describe('formatJson', () => {
  it('インデント 2 / 4 / タブで整形する', () => {
    expect(text(formatJson('{"a":[1,2]}', opts()))).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
    expect(text(formatJson('{"a":1}', opts({ indent: '4' })))).toBe('{\n    "a": 1\n}');
    expect(text(formatJson('{"a":1}', opts({ indent: 'tab' })))).toBe('{\n\t"a": 1\n}');
  });

  it('圧縮する', () => {
    expect(text(formatJson('{\n  "a": [1, 2],\n  "b": "x y"\n}', opts({ mode: 'minify' })))).toBe(
      '{"a":[1,2],"b":"x y"}',
    );
  });

  it('キーを再帰的に並べ替える（配列の順序は保つ）', () => {
    expect(
      text(formatJson('{"b":1,"a":{"d":[{"z":1,"y":2}],"c":0}}', opts({ mode: 'minify', sortKeys: true }))),
    ).toBe('{"a":{"c":0,"d":[{"y":2,"z":1}]},"b":1}');
  });

  it('大きな整数や小数表記を変えない', () => {
    expect(
      text(formatJson('{"id":12345678901234567890,"v":1.0}', opts({ mode: 'minify', sortKeys: true }))),
    ).toBe('{"id":12345678901234567890,"v":1.0}');
  });

  it('__proto__ キーを通常のキーとして扱う', () => {
    expect(text(formatJson('{"__proto__":1,"a":2}', opts({ mode: 'minify', sortKeys: true })))).toBe(
      '{"__proto__":1,"a":2}',
    );
  });

  it('構文エラーは位置付きで返す', () => {
    const r = formatJson('{"a":1,}', opts());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(1);
      expect(r.error.column).toBe(8);
    }
  });
});

describe('sortKeysDeep', () => {
  it('プリミティブはそのまま返す', () => {
    expect(sortKeysDeep(1)).toBe(1);
    expect(sortKeysDeep(null)).toBe(null);
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npx vitest run src/tools/json-format`
Expected: FAIL（`./logic` が見つからない）

- [ ] **Step 4: json-format logic を実装**

`src/tools/json-format/logic.ts`:

```ts
import { isRawNumber, parseJson } from '../../lib/json';
import { ok, type Result } from '../../lib/result';

export const MODES = ['format', 'minify'] as const;
export type Mode = (typeof MODES)[number];
export const INDENTS = ['2', '4', 'tab'] as const;
export type Indent = (typeof INDENTS)[number];

export interface FormatOptions {
  mode: Mode;
  indent: Indent;
  sortKeys: boolean;
}

export interface Formatted {
  text: string;
  precisionWarning: boolean;
}

export function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v !== null && typeof v === 'object' && !isRawNumber(v)) {
    // null プロトタイプにして "__proto__" キーも通常のプロパティとして保持する
    const out = Object.create(null) as Record<string, unknown>;
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

export function formatJson(text: string, opts: FormatOptions): Result<Formatted> {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  const value = opts.sortKeys ? sortKeysDeep(parsed.value.value) : parsed.value.value;
  const space = opts.mode === 'minify' ? undefined : opts.indent === 'tab' ? '\t' : Number(opts.indent);
  return ok({ text: JSON.stringify(value, null, space), precisionWarning: parsed.value.precisionWarning });
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run src/tools/json-format`
Expected: PASS（7 件）

- [ ] **Step 6: meta・UI・ガイドを作成**

`src/tools/json-format/meta.ts`:

```ts
import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'json-format',
  title: 'JSON 整形・検証',
  description: 'JSON を見やすく整形・圧縮し、構文エラーの位置を表示します。キーの並べ替えにも対応。',
  category: 'format',
  icon: '🧹',
  keywords: ['json', '整形', 'フォーマット', 'format', 'minify', '圧縮', 'バリデーション', 'validator', '検証'],
  order: 1,
};
```

`src/tools/json-format/Tool.astro`:

```astro
---
import IOPanel from '../../components/IOPanel.astro';
---

<IOPanel
  id="json-format"
  inputLabel="JSON を入力"
  placeholder='{"name": "value", "list": [1, 2, 3]}'
  accept=".json,application/json,text/plain"
  runLabel="整形"
>
  <fieldset slot="options" class="options">
    <legend>オプション</legend>
    <label class="field">
      モード
      <select data-opt="mode">
        <option value="format">整形</option>
        <option value="minify">圧縮</option>
      </select>
    </label>
    <label class="field">
      インデント
      <select data-opt="indent">
        <option value="2">スペース 2</option>
        <option value="4">スペース 4</option>
        <option value="tab">タブ</option>
      </select>
    </label>
    <label class="field"><input type="checkbox" data-opt="sortKeys" /> キーを並べ替える</label>
  </fieldset>
</IOPanel>

<script>
  import { bindIOPanel } from '../../lib/io-panel';
  import { describeError } from '../../lib/result';
  import { readBool, readChoice, toolKey, write } from '../../lib/storage';
  import { formatJson, INDENTS, MODES, type Indent, type Mode } from './logic';

  const SLUG = 'json-format';
  const root = document.querySelector<HTMLElement>(`[data-io="${SLUG}"]`)!;
  const mode = root.querySelector<HTMLSelectElement>('[data-opt="mode"]')!;
  const indent = root.querySelector<HTMLSelectElement>('[data-opt="indent"]')!;
  const sortKeys = root.querySelector<HTMLInputElement>('[data-opt="sortKeys"]')!;

  mode.value = readChoice(toolKey(SLUG, 'mode'), MODES, 'format');
  indent.value = readChoice(toolKey(SLUG, 'indent'), INDENTS, '2');
  sortKeys.checked = readBool(toolKey(SLUG, 'sortKeys'), false);
  indent.disabled = mode.value === 'minify';

  const panel = bindIOPanel(root, {
    run(text) {
      const r = formatJson(text, {
        mode: mode.value as Mode,
        indent: indent.value as Indent,
        sortKeys: sortKeys.checked,
      });
      if (!r.ok) {
        panel.setError(describeError(r.error));
        return;
      }
      panel.setOutput(r.value.text, {
        filename: mode.value === 'minify' ? 'minified.json' : 'formatted.json',
        mime: 'application/json',
        data: [r.value.text],
      });
      if (r.value.precisionWarning) {
        panel.setInfo('お使いのブラウザでは 16 桁以上の数値の精度が失われる場合があります');
      } else {
        panel.setInfo('✓ 正しい JSON です');
      }
    },
  });

  mode.addEventListener('change', () => {
    write(toolKey(SLUG, 'mode'), mode.value);
    indent.disabled = mode.value === 'minify';
    panel.rerun();
  });
  indent.addEventListener('change', () => {
    write(toolKey(SLUG, 'indent'), indent.value);
    panel.rerun();
  });
  sortKeys.addEventListener('change', () => {
    write(toolKey(SLUG, 'sortKeys'), sortKeys.checked);
    panel.rerun();
  });
</script>
```

`src/tools/json-format/guide.md`:

```md
## 使い方

1. 上の入力欄に JSON を貼り付けるか、JSON ファイルをドラッグ&ドロップします。
2. 入力すると自動で整形され、下の出力欄に表示されます。
3. 「コピー」または「ダウンロード」で結果を取り出せます。

## オプション

- **モード**: 「整形」は改行とインデントを入れて読みやすくします。「圧縮」は空白と改行を取り除いて 1 行にします。
- **インデント**: 整形時の字下げをスペース 2 つ・4 つ・タブから選べます。
- **キーを並べ替える**: オブジェクトのキーを辞書順に並べ替えます。配列の順序は変わりません。差分を比較したいときに便利です。

選んだオプションはお使いのブラウザに保存され、次回も同じ設定で使えます。

## 構文エラーの表示

JSON として正しくない場合は、エラーの位置（行・列）と内容を表示します。よくある原因は次のとおりです。

- 最後の要素の後ろに余分なカンマがある（例: `{"a": 1,}`）
- キーや文字列をシングルクォート（`'`）で囲んでいる
- キーをダブルクォートで囲んでいない

## 数値の扱い

`12345678901234567890` のような 16 桁以上の整数や、`1.0` のような表記も元のまま出力します（一部の古いブラウザでは精度が失われる場合があり、その際は警告を表示します）。

## よくある質問

**Q. 入力した JSON はどこかに送信されますか？**
A. いいえ。整形はすべてお使いのブラウザ内で行われ、データはサーバーへ送信・保存されません。

**Q. 大きなファイルも扱えますか？**
A. 50MB までのファイルを読み込めます。入力が 100 万文字を超える場合は自動整形を止めるので、「整形」ボタンを押してください。
```

- [ ] **Step 7: E2E を書く**

`tests/e2e/tools/json-format.spec.ts`:

```ts
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
```

- [ ] **Step 8: 全テスト・型チェック・ビルド・E2E を実行**

Run: `npm test && npm run check && npm run build && npm run test:e2e`
Expected: すべて PASS（サイト全体の E2E のうちツール依存のものも実行されるようになる）

- [ ] **Step 9: コミット**

```bash
git add -A
git commit -m "feat: add IOPanel and JSON formatter tool

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: CSV ⇔ JSON 変換ツール

**Files:**
- Create: `src/tools/csv-json/meta.ts`, `src/tools/csv-json/logic.ts`, `src/tools/csv-json/logic.test.ts`, `src/tools/csv-json/Tool.astro`, `src/tools/csv-json/guide.md`, `tests/e2e/tools/csv-json.spec.ts`

**Interfaces:**
- Consumes: `bindIOPanel`、`IOPanel.astro`、`decodeBytes`、`INPUT_ENCODINGS`、`InputEncoding`、`parseJson`、`isRawNumber`、storage 関数、`describeError`、`ok`、`err`、`Result`
- Produces:
  - `DELIMITERS = [',', '\t', ';'] as const`、`type Delimiter`、`DELIMITER_KEYS = ['comma', 'tab', 'semicolon'] as const`、`type DelimiterKey`、`delimiterOf(key: DelimiterKey): Delimiter`
  - `DIRECTIONS = ['csv-to-json', 'json-to-csv'] as const`、`type Direction`
  - `PREVIEW_ROWS = 100`、`interface Table { columns: string[]; rows: string[][]; totalRows: number }`
  - `csvToJson(csv: string, opts: { delimiter: Delimiter; header: boolean }): Result<{ json: string; table: Table }>`
  - `jsonToCsv(json: string, opts: { delimiter: Delimiter }): Result<{ csv: string; table: Table }>`
  - `uniqueKeys(head: string[], width: number): string[]`、`cellText(v: unknown): string`

- [ ] **Step 1: 失敗するテストを書く**

`src/tools/csv-json/logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cellText, csvToJson, jsonToCsv, uniqueKeys } from './logic';

const c2j = (csv: string, header = true, delimiter: ',' | '\t' | ';' = ',') => {
  const r = csvToJson(csv, { delimiter, header });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
const j2c = (json: string, delimiter: ',' | '\t' | ';' = ',') => {
  const r = jsonToCsv(json, { delimiter });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('csvToJson', () => {
  it('ヘッダー付き CSV をオブジェクトの配列にする（値は文字列）', () => {
    expect(JSON.parse(c2j('name,age\r\n太郎,20\r\n花子,31\r\n').json)).toEqual([
      { name: '太郎', age: '20' },
      { name: '花子', age: '31' },
    ]);
  });

  it('ヘッダーなしなら配列の配列にする', () => {
    expect(JSON.parse(c2j('a,b\nc,d', false).json)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('タブ・セミコロン区切りに対応', () => {
    expect(JSON.parse(c2j('a\tb\n1\t2', true, '\t').json)).toEqual([{ a: '1', b: '2' }]);
    expect(JSON.parse(c2j('a;b\n1;2', true, ';').json)).toEqual([{ a: '1', b: '2' }]);
  });

  it('引用符内のカンマ・改行・二重引用符を扱う', () => {
    expect(JSON.parse(c2j('a,b\n"x,y","1\n2 ""q"""').json)).toEqual([{ a: 'x,y', b: '1\n2 "q"' }]);
  });

  it('先頭の BOM と空行を無視する', () => {
    expect(JSON.parse(c2j('﻿a,b\n\n1,2\n\n').json)).toEqual([{ a: '1', b: '2' }]);
  });

  it('列数が多い行は余った列にも名前を付けて欠落させない', () => {
    expect(JSON.parse(c2j('a,b\n1,2,3\n4').json)).toEqual([
      { a: '1', b: '2', 列3: '3' },
      { a: '4', b: '', 列3: '' },
    ]);
  });

  it('空・重複したヘッダーに一意な名前を付ける', () => {
    expect(JSON.parse(c2j('name,,name\n1,2,3').json)).toEqual([{ name: '1', 列2: '2', name_2: '3' }]);
  });

  it('プレビュー用の表は先頭 100 行まで', () => {
    const csv = ['n', ...Array.from({ length: 150 }, (_, i) => String(i))].join('\n');
    const { table } = c2j(csv);
    expect(table.columns).toEqual(['n']);
    expect(table.rows).toHaveLength(100);
    expect(table.totalRows).toBe(150);
  });

  it('閉じていない引用符はエラー', () => {
    const r = csvToJson('a,b\n"x,1', { delimiter: ',', header: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('引用符');
  });

  it('空入力はエラー', () => {
    expect(csvToJson(' \n', { delimiter: ',', header: true }).ok).toBe(false);
  });
});

describe('jsonToCsv', () => {
  it('オブジェクトの配列はキーの和集合をヘッダーにする', () => {
    expect(j2c('[{"a":1,"b":"x"},{"b":"y","c":true}]').csv).toBe('a,b,c\r\n1,x,\r\n,y,true');
  });

  it('配列の配列はそのまま行にする', () => {
    expect(j2c('[["a","b"],[1,null]]').csv).toBe('a,b\r\n1,');
  });

  it('単独のオブジェクトは 1 行として扱う', () => {
    expect(j2c('{"a":1}').csv).toBe('a\r\n1');
  });

  it('入れ子の値は JSON 文字列にし、必要に応じて引用符で囲む', () => {
    expect(j2c('[{"a":{"x":1},"b":"p,q","c":"say \\"hi\\""}]').csv).toBe(
      'a,b,c\r\n"{""x"":1}","p,q","say ""hi"""',
    );
  });

  it('大きな整数を変えない', () => {
    expect(j2c('[{"id":12345678901234567890}]').csv).toBe('id\r\n12345678901234567890');
  });

  it('区切り文字を指定できる', () => {
    expect(j2c('[{"a":1,"b":2}]', '\t').csv).toBe('a\tb\r\n1\t2');
  });

  it('配列でもオブジェクトでもない・空配列・混在はエラー', () => {
    expect(jsonToCsv('1', { delimiter: ',' }).ok).toBe(false);
    expect(jsonToCsv('[]', { delimiter: ',' }).ok).toBe(false);
    expect(jsonToCsv('[{"a":1},[1]]', { delimiter: ',' }).ok).toBe(false);
    expect(jsonToCsv('{"a":', { delimiter: ',' }).ok).toBe(false);
  });

  it('CSV → JSON → CSV で元に戻る', () => {
    const csv = 'name,note\r\n太郎,"a,b"\r\n花子,"x\ny"';
    expect(j2c(c2j(csv).json).csv).toBe(csv);
  });
});

describe('helpers', () => {
  it('uniqueKeys は幅に合わせて補完する', () => {
    expect(uniqueKeys(['a', 'a', ''], 4)).toEqual(['a', 'a_2', '列3', '列4']);
  });

  it('cellText は値を文字列にする', () => {
    expect(cellText(null)).toBe('');
    expect(cellText(undefined)).toBe('');
    expect(cellText(false)).toBe('false');
    expect(cellText([1, 2])).toBe('[1,2]');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/tools/csv-json`
Expected: FAIL（`./logic` が見つからない）

- [ ] **Step 3: logic を実装**

`src/tools/csv-json/logic.ts`:

```ts
import Papa from 'papaparse';
import { isRawNumber, parseJson } from '../../lib/json';
import { err, ok, type Result } from '../../lib/result';

export const DELIMITERS = [',', '\t', ';'] as const;
export type Delimiter = (typeof DELIMITERS)[number];
export const DELIMITER_KEYS = ['comma', 'tab', 'semicolon'] as const;
export type DelimiterKey = (typeof DELIMITER_KEYS)[number];

export function delimiterOf(key: DelimiterKey): Delimiter {
  return DELIMITERS[DELIMITER_KEYS.indexOf(key)];
}

export const DIRECTIONS = ['csv-to-json', 'json-to-csv'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const PREVIEW_ROWS = 100;

export interface Table {
  columns: string[];
  rows: string[][];
  totalRows: number;
}

function tableOf(columns: string[], rows: string[][]): Table {
  return { columns, rows: rows.slice(0, PREVIEW_ROWS), totalRows: rows.length };
}

function numberedColumns(width: number): string[] {
  return Array.from({ length: width }, (_, i) => `列${i + 1}`);
}

export function uniqueKeys(head: string[], width: number): string[] {
  const used = new Set<string>();
  return Array.from({ length: width }, (_, i) => {
    const base = head[i]?.trim() ? head[i] : `列${i + 1}`;
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base}_${n}`;
    used.add(key);
    return key;
  });
}

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (isRawNumber(v)) return v.rawJSON;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function csvToJson(
  csv: string,
  opts: { delimiter: Delimiter; header: boolean },
): Result<{ json: string; table: Table }> {
  const text = csv.replace(/^﻿/, '');
  if (text.trim() === '') return err('入力が空です');
  // ヘッダーの扱い（空・重複・列数不一致）を自前で制御するため、常に配列として読む
  const parsed = Papa.parse<string[]>(text, { delimiter: opts.delimiter, skipEmptyLines: 'greedy' });
  const quoteError = parsed.errors.find((e) => e.type === 'Quotes');
  if (quoteError) {
    return err(`${(quoteError.row ?? 0) + 1} 行目付近で引用符（"）が閉じられていません`);
  }
  const rows = parsed.data;
  const width = Math.max(0, ...rows.map((r) => r.length));

  if (!opts.header) {
    return ok({ json: JSON.stringify(rows, null, 2), table: tableOf(numberedColumns(width), rows) });
  }
  const [head = [], ...body] = rows;
  const keys = uniqueKeys(head, width);
  const objects = body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
  const padded = body.map((r) => keys.map((_, i) => r[i] ?? ''));
  return ok({ json: JSON.stringify(objects, null, 2), table: tableOf(keys, padded) });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !isRawNumber(v);
}

export function jsonToCsv(
  json: string,
  opts: { delimiter: Delimiter },
): Result<{ csv: string; table: Table }> {
  const parsed = parseJson(json);
  if (!parsed.ok) return parsed;
  const v = parsed.value.value;
  const items: unknown[] | null = Array.isArray(v) ? v : isPlainObject(v) ? [v] : null;
  if (!items) return err('JSON は配列（またはオブジェクト）にしてください');
  if (items.length === 0) return err('配列が空です');

  const unparse = { delimiter: opts.delimiter, newline: '\r\n' };
  if (items.every(Array.isArray)) {
    const data = (items as unknown[][]).map((r) => r.map(cellText));
    const width = Math.max(...data.map((r) => r.length));
    return ok({ csv: Papa.unparse(data, unparse), table: tableOf(numberedColumns(width), data) });
  }
  if (items.every(isPlainObject)) {
    const fields: string[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      for (const k of Object.keys(item)) {
        if (!seen.has(k)) {
          seen.add(k);
          fields.push(k);
        }
      }
    }
    const data = items.map((item) => fields.map((f) => cellText(item[f])));
    return ok({ csv: Papa.unparse({ fields, data }, unparse), table: tableOf(fields, data) });
  }
  return err('配列の要素は「すべてオブジェクト」か「すべて配列」にしてください');
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/tools/csv-json`
Expected: PASS（20 件）。`import Papa from 'papaparse'` で型エラーになる場合は `npm run check` の内容を確認し、`tsconfig.json` の `compilerOptions` に `"esModuleInterop": true` を追加する。

- [ ] **Step 5: meta・UI・ガイドを作成**

`src/tools/csv-json/meta.ts`:

```ts
import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'csv-json',
  title: 'CSV ⇔ JSON 変換',
  description: 'CSV と JSON を相互に変換します。Shift_JIS の CSV やタブ区切りにも対応し、表でプレビューできます。',
  category: 'convert',
  icon: '🔄',
  keywords: ['csv', 'json', '変換', 'コンバーター', 'converter', 'tsv', 'excel', 'エクセル', 'shift_jis'],
  order: 1,
};
```

`src/tools/csv-json/Tool.astro`:

```astro
---
import IOPanel from '../../components/IOPanel.astro';
---

<IOPanel
  id="csv-json"
  inputLabel="CSV を入力"
  placeholder={'name,age\n太郎,20'}
  accept=".csv,.tsv,.txt,.json,text/csv,application/json,text/plain"
>
  <fieldset slot="options" class="options">
    <legend>オプション</legend>
    <label class="field">
      変換の向き
      <select data-opt="direction">
        <option value="csv-to-json">CSV → JSON</option>
        <option value="json-to-csv">JSON → CSV</option>
      </select>
    </label>
    <label class="field">
      区切り文字
      <select data-opt="delimiter">
        <option value="comma">カンマ（,）</option>
        <option value="tab">タブ</option>
        <option value="semicolon">セミコロン（;）</option>
      </select>
    </label>
    <label class="field" data-csv-only>
      <input type="checkbox" data-opt="header" /> 1 行目をヘッダーとして扱う
    </label>
    <label class="field" data-csv-only>
      ファイルの文字コード
      <select data-opt="encoding">
        <option value="auto">自動判定</option>
        <option value="utf-8">UTF-8</option>
        <option value="shift_jis">Shift_JIS</option>
      </select>
    </label>
    <label class="field" data-json-only>
      <input type="checkbox" data-opt="bom" /> BOM を付ける（Excel で文字化けを防ぐ）
    </label>
    <span class="msg-info" data-detected></span>
  </fieldset>
  <div slot="after" data-preview hidden>
    <p class="msg-info" data-preview-caption></p>
    <div class="table-wrap"><table data-preview-table></table></div>
  </div>
</IOPanel>

<script>
  import { decodeBytes, INPUT_ENCODINGS, type InputEncoding } from '../../lib/encoding';
  import { bindIOPanel } from '../../lib/io-panel';
  import { describeError } from '../../lib/result';
  import { readBool, readChoice, toolKey, write } from '../../lib/storage';
  import {
    csvToJson,
    DELIMITER_KEYS,
    delimiterOf,
    DIRECTIONS,
    jsonToCsv,
    type DelimiterKey,
    type Direction,
    type Table,
  } from './logic';

  const SLUG = 'csv-json';
  const root = document.querySelector<HTMLElement>(`[data-io="${SLUG}"]`)!;
  const opt = <T extends HTMLElement>(name: string) => root.querySelector<T>(`[data-opt="${name}"]`)!;
  const direction = opt<HTMLSelectElement>('direction');
  const delimiter = opt<HTMLSelectElement>('delimiter');
  const header = opt<HTMLInputElement>('header');
  const encoding = opt<HTMLSelectElement>('encoding');
  const bom = opt<HTMLInputElement>('bom');
  const detected = root.querySelector<HTMLElement>('[data-detected]')!;
  const inputLabel = root.querySelector<HTMLLabelElement>(`label[for="${SLUG}-input"] strong`)!;
  const preview = root.querySelector<HTMLElement>('[data-preview]')!;
  const previewCaption = root.querySelector<HTMLElement>('[data-preview-caption]')!;
  const previewTable = root.querySelector<HTMLTableElement>('[data-preview-table]')!;

  direction.value = readChoice(toolKey(SLUG, 'direction'), DIRECTIONS, 'csv-to-json');
  delimiter.value = readChoice(toolKey(SLUG, 'delimiter'), DELIMITER_KEYS, 'comma');
  header.checked = readBool(toolKey(SLUG, 'header'), true);
  encoding.value = readChoice(toolKey(SLUG, 'encoding'), INPUT_ENCODINGS, 'auto');
  bom.checked = readBool(toolKey(SLUG, 'bom'), true);

  function renderPreview(table: Table | null) {
    previewTable.replaceChildren();
    preview.hidden = !table;
    if (!table) return;
    const thead = previewTable.createTHead().insertRow();
    for (const c of table.columns) {
      const th = document.createElement('th');
      th.textContent = c;
      thead.append(th);
    }
    const tbody = previewTable.createTBody();
    for (const r of table.rows) {
      const tr = tbody.insertRow();
      for (let i = 0; i < table.columns.length; i++) tr.insertCell().textContent = r[i] ?? '';
    }
    previewCaption.textContent =
      table.totalRows > table.rows.length
        ? `プレビュー（全 ${table.totalRows} 行中、先頭 ${table.rows.length} 行）`
        : `プレビュー（全 ${table.totalRows} 行）`;
  }

  function applyDirection() {
    const toJson = direction.value === 'csv-to-json';
    inputLabel.textContent = toJson ? 'CSV を入力' : 'JSON を入力';
    root.querySelectorAll<HTMLElement>('[data-csv-only]').forEach((el) => (el.hidden = !toJson));
    root.querySelectorAll<HTMLElement>('[data-json-only]').forEach((el) => (el.hidden = toJson));
  }
  applyDirection();

  const panel = bindIOPanel(root, {
    runOnEmpty: true,
    run(text) {
      if (text.trim() === '') {
        renderPreview(null);
        panel.setOutput('');
        return;
      }
      const d = delimiterOf(delimiter.value as DelimiterKey);
      if ((direction.value as Direction) === 'csv-to-json') {
        const r = csvToJson(text, { delimiter: d, header: header.checked });
        if (!r.ok) {
          renderPreview(null);
          panel.setError(describeError(r.error));
          return;
        }
        panel.setOutput(r.value.json, { filename: 'data.json', mime: 'application/json', data: [r.value.json] });
        renderPreview(r.value.table);
      } else {
        const r = jsonToCsv(text, { delimiter: d });
        if (!r.ok) {
          renderPreview(null);
          panel.setError(describeError(r.error));
          return;
        }
        const ext = d === '\t' ? 'tsv' : 'csv';
        panel.setOutput(r.value.csv, {
          filename: `data.${ext}`,
          mime: 'text/csv;charset=utf-8',
          data: bom.checked ? ['﻿', r.value.csv] : [r.value.csv],
        });
        renderPreview(r.value.table);
      }
    },
    readFile(_file, bytes) {
      const enc = direction.value === 'csv-to-json' ? (encoding.value as InputEncoding) : 'auto';
      const decoded = decodeBytes(bytes, enc);
      if (!decoded.ok) {
        detected.textContent = '';
        panel.setError(decoded.error.message);
        return null;
      }
      detected.textContent = `読み込んだ文字コード: ${decoded.value.encoding === 'utf-8' ? 'UTF-8' : 'Shift_JIS'}`;
      return decoded.value.text;
    },
  });

  const persist = (el: HTMLSelectElement | HTMLInputElement, name: string) =>
    el.addEventListener('change', () => {
      write(toolKey(SLUG, name), el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value);
      if (el === direction) applyDirection();
      panel.rerun();
    });
  persist(direction, 'direction');
  persist(delimiter, 'delimiter');
  persist(header, 'header');
  persist(encoding, 'encoding');
  persist(bom, 'bom');
</script>
```

`src/tools/csv-json/guide.md`:

```md
## 使い方

1. 「変換の向き」で「CSV → JSON」か「JSON → CSV」を選びます。
2. 入力欄にデータを貼り付けるか、ファイルをドラッグ&ドロップします。
3. 変換結果が出力欄に表示され、下に表形式のプレビュー（先頭 100 行）が出ます。
4. 「コピー」または「ダウンロード」で結果を取り出せます。

## CSV → JSON

- **1 行目をヘッダーとして扱う**: オンにすると、1 行目を項目名にした `[{"名前": "太郎", ...}]` の形になります。オフにすると `[["名前", ...], ["太郎", ...]]` のような配列の配列になります。
- 値はすべて文字列として出力します（`"20"` のように）。先頭のゼロ（郵便番号や電話番号など）が消えないようにするためです。
- 見出しが空の列には「列3」のような名前を、同じ見出しが重複する列には「name_2」のような名前を付けます。
- 見出しより列が多い行があっても、データは欠けずに出力されます。

## JSON → CSV

- オブジェクトの配列を変換すると、すべてのオブジェクトに登場するキーを見出しにします。キーがない項目は空欄になります。
- 入れ子のオブジェクトや配列は、JSON 文字列としてセルに入ります。
- **BOM を付ける**: Excel で開いたときの文字化けを防ぎます。Excel で使う場合はオンのままにしてください。

## 文字コード

Excel で保存した CSV は Shift_JIS の場合があります。「自動判定」で多くの場合は正しく読めますが、文字化けする場合は「Shift_JIS」を選んでからファイルを読み込み直してください。

## よくある質問

**Q. アップロードしたファイルはサーバーに保存されますか？**
A. いいえ。ファイルはお使いのブラウザ内で読み込まれて変換されるだけで、サーバーへ送信・保存されません。

**Q. 変換できる大きさの上限は？**
A. 50MB までのファイルを読み込めます。
```

- [ ] **Step 6: E2E を書く**

`tests/e2e/tools/csv-json.spec.ts`:

```ts
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
    await expect(page.locator('[data-output]')).toHaveValue('a,b\r\n1,"x,y"');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-download]').click()]);
    expect(download.suggestedFilename()).toBe('data.csv');
    const body = await (await download.createReadStream()).toArray();
    expect(Buffer.concat(body).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
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
```

- [ ] **Step 7: 全テスト・型チェック・ビルド・E2E を実行**

Run: `npm test && npm run check && npm run build && npm run test:e2e`
Expected: すべて PASS

- [ ] **Step 8: 他ツールのページに PapaParse が読み込まれていないことを確認**

Run: `for f in $(grep -o 'src="/_astro/[^"]*\.js"' dist/tools/json-format/index.html | sed 's/src="\///;s/"//'); do grep -l 'MissingQuotes' "dist/$f"; done; echo "done"`
Expected: `done` だけが表示される（json-format のページが読み込む JS に PapaParse のコードが含まれない）。含まれる場合は `[slug].astro` の eager glob によって全ツールのスクリプトが読み込まれているので、`[slug].astro` を `getStaticPaths` の props でコンポーネントを渡す方式に変えるなどして解消する。

- [ ] **Step 9: コミット**

```bash
git add -A
git commit -m "feat: add CSV/JSON converter tool

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Base64 エンコード・デコードツール

**Files:**
- Create: `src/tools/base64/meta.ts`, `src/tools/base64/logic.ts`, `src/tools/base64/logic.test.ts`, `src/tools/base64/Tool.astro`, `src/tools/base64/guide.md`, `tests/e2e/tools/base64.spec.ts`

**Interfaces:**
- Consumes: `bindIOPanel`、`IOPanel.astro`、`decodeBytes`、`formatBytes`、storage 関数、`describeError`、`ok`、`err`、`Result`
- Produces:
  - `MODES = ['encode', 'decode'] as const`、`type Mode`
  - `bytesToBase64(bytes: Uint8Array, urlSafe: boolean): string`、`textToBase64(text: string, urlSafe: boolean): string`
  - `base64ToBytes(input: string): Result<Uint8Array<ArrayBuffer>>`
  - `bytesToText(bytes: Uint8Array): string | null`（UTF-8 テキストでなければ null）
  - `guessFileType(bytes: Uint8Array): { ext: string; mime: string }`

- [ ] **Step 1: 失敗するテストを書く**

`src/tools/base64/logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, bytesToText, guessFileType, textToBase64 } from './logic';

const decodeText = (s: string) => {
  const r = base64ToBytes(s);
  if (!r.ok) throw new Error(r.error.message);
  return bytesToText(r.value);
};

describe('encode', () => {
  it('UTF-8 テキストをエンコードする', () => {
    expect(textToBase64('hello', false)).toBe('aGVsbG8=');
    expect(textToBase64('あ', false)).toBe('44GC');
  });

  it('URL セーフ形式は +/ を -_ にし、パディングを除く', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);
    expect(bytesToBase64(bytes, false)).toBe('+/+/');
    expect(bytesToBase64(bytes, true)).toBe('-_-_');
    expect(textToBase64('a', true)).toBe('YQ');
  });
});

describe('decode', () => {
  it('標準形式・改行や空白を含む入力を読む', () => {
    expect(decodeText('aGVs\nbG8=')).toBe('hello');
    expect(decodeText('  44GC  ')).toBe('あ');
  });

  it('URL セーフ形式・パディングなしを読む', () => {
    expect(decodeText('YQ')).toBe('a');
    const r = base64ToBytes('-_-_');
    expect(r.ok && Array.from(r.value)).toEqual([0xfb, 0xff, 0xbf]);
  });

  it('data URL の接頭辞を取り除く', () => {
    expect(decodeText('data:text/plain;base64,aGVsbG8=')).toBe('hello');
  });

  it('不正な文字・長さはエラー', () => {
    expect(base64ToBytes('abc$').ok).toBe(false);
    expect(base64ToBytes('abcde').ok).toBe(false);
    expect(base64ToBytes('').ok).toBe(false);
  });

  it('大きなデータを往復できる', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 31) % 256);
    const r = base64ToBytes(bytesToBase64(bytes, false));
    expect(r.ok && r.value).toEqual(bytes);
  });
});

describe('bytesToText', () => {
  it('UTF-8 テキストでなければ null', () => {
    expect(bytesToText(new Uint8Array([0xff, 0xfe, 0x00]))).toBeNull();
    expect(bytesToText(new Uint8Array([0x61, 0x00, 0x62]))).toBeNull();
    expect(bytesToText(new TextEncoder().encode('ok\n\tタブ'))).toBe('ok\n\tタブ');
  });
});

describe('guessFileType', () => {
  it('先頭のバイトから種類を推定する', () => {
    expect(guessFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toEqual({ ext: 'png', mime: 'image/png' });
    expect(guessFileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
    expect(guessFileType(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toEqual({ ext: 'pdf', mime: 'application/pdf' });
    expect(guessFileType(new Uint8Array([1, 2, 3]))).toEqual({ ext: 'bin', mime: 'application/octet-stream' });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/tools/base64`
Expected: FAIL（`./logic` が見つからない）

- [ ] **Step 3: logic を実装**

`src/tools/base64/logic.ts`:

```ts
import { err, ok, type Result } from '../../lib/result';

export const MODES = ['encode', 'decode'] as const;
export type Mode = (typeof MODES)[number];

export function bytesToBase64(bytes: Uint8Array, urlSafe: boolean): string {
  let bin = '';
  const CHUNK = 0x8000; // String.fromCharCode の引数が多すぎるとスタックあふれになるため分割する
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const b64 = btoa(bin);
  return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
}

export function textToBase64(text: string, urlSafe: boolean): string {
  return bytesToBase64(new TextEncoder().encode(text), urlSafe);
}

export function base64ToBytes(input: string): Result<Uint8Array<ArrayBuffer>> {
  let s = input
    .trim()
    .replace(/^data:[^,]*;base64,/i, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (s === '') return err('入力が空です');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return err('Base64 として使えない文字が含まれています');
  s = s.replace(/=+$/, '');
  if (s.length % 4 === 1) return err('Base64 の長さが正しくありません（途中で切れている可能性があります）');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return ok(out);
}

export function bytesToText(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // タブ・改行以外の制御文字を含むならバイナリとみなす
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text) ? null : text;
  } catch {
    return null;
  }
}

const SIGNATURES: { bytes: number[]; ext: string; mime: string }[] = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], ext: 'png', mime: 'image/png' },
  { bytes: [0xff, 0xd8, 0xff], ext: 'jpg', mime: 'image/jpeg' },
  { bytes: [0x47, 0x49, 0x46, 0x38], ext: 'gif', mime: 'image/gif' },
  { bytes: [0x25, 0x50, 0x44, 0x46], ext: 'pdf', mime: 'application/pdf' },
  { bytes: [0x50, 0x4b, 0x03, 0x04], ext: 'zip', mime: 'application/zip' },
];

export function guessFileType(bytes: Uint8Array): { ext: string; mime: string } {
  for (const sig of SIGNATURES) {
    if (sig.bytes.every((b, i) => bytes[i] === b)) return { ext: sig.ext, mime: sig.mime };
  }
  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
  if (isWebp) return { ext: 'webp', mime: 'image/webp' };
  return { ext: 'bin', mime: 'application/octet-stream' };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/tools/base64`
Expected: PASS（10 件）

- [ ] **Step 5: meta・UI・ガイドを作成**

`src/tools/base64/meta.ts`:

```ts
import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'base64',
  title: 'Base64 エンコード・デコード',
  description: 'テキストやファイルを Base64 に変換、または Base64 から元に戻します。URL セーフ形式にも対応。',
  category: 'encode',
  icon: '🔡',
  keywords: ['base64', 'エンコード', 'デコード', 'encode', 'decode', '変換', 'data url', '画像'],
  order: 1,
};
```

`src/tools/base64/Tool.astro`:

```astro
---
import IOPanel from '../../components/IOPanel.astro';
---

<IOPanel id="base64" inputLabel="テキストを入力" placeholder="エンコードしたいテキスト">
  <fieldset slot="options" class="options">
    <legend>オプション</legend>
    <label class="field">
      モード
      <select data-opt="mode">
        <option value="encode">エンコード（→ Base64）</option>
        <option value="decode">デコード（Base64 →）</option>
      </select>
    </label>
    <label class="field" data-encode-only>
      <input type="checkbox" data-opt="urlSafe" /> URL セーフ形式（- と _ を使い、= を省く）
    </label>
  </fieldset>
</IOPanel>

<script>
  import { decodeBytes } from '../../lib/encoding';
  import { formatBytes } from '../../lib/file';
  import { bindIOPanel } from '../../lib/io-panel';
  import { describeError } from '../../lib/result';
  import { readBool, readChoice, toolKey, write } from '../../lib/storage';
  import { base64ToBytes, bytesToBase64, bytesToText, guessFileType, MODES, textToBase64, type Mode } from './logic';

  const SLUG = 'base64';
  const root = document.querySelector<HTMLElement>(`[data-io="${SLUG}"]`)!;
  const mode = root.querySelector<HTMLSelectElement>('[data-opt="mode"]')!;
  const urlSafe = root.querySelector<HTMLInputElement>('[data-opt="urlSafe"]')!;
  const inputLabel = root.querySelector<HTMLElement>(`label[for="${SLUG}-input"] strong`)!;

  mode.value = readChoice(toolKey(SLUG, 'mode'), MODES, 'encode');
  urlSafe.checked = readBool(toolKey(SLUG, 'urlSafe'), false);

  function applyMode() {
    const encode = (mode.value as Mode) === 'encode';
    inputLabel.textContent = encode ? 'テキストを入力（ファイルも可）' : 'Base64 を入力';
    root.querySelectorAll<HTMLElement>('[data-encode-only]').forEach((el) => (el.hidden = !encode));
  }
  applyMode();

  const panel = bindIOPanel(root, {
    run(text) {
      if ((mode.value as Mode) === 'encode') {
        const out = textToBase64(text, urlSafe.checked);
        panel.setOutput(out, { filename: 'encoded.txt', mime: 'text/plain', data: [out] });
        return;
      }
      const r = base64ToBytes(text);
      if (!r.ok) {
        panel.setError(describeError(r.error));
        return;
      }
      const decoded = bytesToText(r.value);
      if (decoded !== null) {
        panel.setOutput(decoded, { filename: 'decoded.txt', mime: 'text/plain;charset=utf-8', data: [decoded] });
        return;
      }
      const type = guessFileType(r.value);
      panel.setOutput(
        `（バイナリデータ ${formatBytes(r.value.length)}・推定形式 ${type.ext}。「ダウンロード」で保存してください）`,
        { filename: `decoded.${type.ext}`, mime: type.mime, data: [r.value] },
        { copyable: false },
      );
    },
    readFile(file, bytes) {
      if ((mode.value as Mode) === 'decode') {
        const d = decodeBytes(bytes, 'auto');
        if (!d.ok) {
          panel.setError(d.error.message);
          return null;
        }
        return d.value.text;
      }
      // エンコードではファイルの中身をそのまま（バイナリとして）変換する
      panel.input.value = '';
      const out = bytesToBase64(bytes, urlSafe.checked);
      panel.setOutput(out, { filename: `${file.name}.b64.txt`, mime: 'text/plain', data: [out] });
      panel.setInfo(`${file.name}（${formatBytes(bytes.length)}）をエンコードしました`);
      return null;
    },
  });

  mode.addEventListener('change', () => {
    write(toolKey(SLUG, 'mode'), mode.value);
    applyMode();
    panel.rerun();
  });
  urlSafe.addEventListener('change', () => {
    write(toolKey(SLUG, 'urlSafe'), urlSafe.checked);
    panel.rerun();
  });
</script>
```

`src/tools/base64/guide.md`:

```md
## 使い方

1. 「モード」でエンコードかデコードを選びます。
2. **エンコード**: 入力欄にテキストを入力すると、UTF-8 として Base64 に変換します。画像などのファイルをドラッグ&ドロップすると、ファイルの中身そのものを Base64 に変換します。
3. **デコード**: Base64 の文字列を貼り付けると元に戻します。結果がテキストなら出力欄に表示し、画像などのバイナリなら「ダウンロード」で保存できます。

## 対応している形式

- 標準の Base64（`+` と `/` を使い、末尾を `=` で埋める形式）
- URL セーフ形式（`-` と `_` を使い、`=` を省く形式。JWT や URL のパラメータで使われます）
- `data:image/png;base64,...` のような data URL（デコード時に先頭部分を自動で取り除きます）
- 途中に改行や空白が入った Base64（メールの添付ファイルなど）

デコード時は標準形式と URL セーフ形式を自動で判別します。

## よくある質問

**Q. Base64 は暗号化ですか？**
A. いいえ。Base64 は誰でも元に戻せる変換方式で、秘密を守る目的には使えません。

**Q. 変換したデータは送信されますか？**
A. いいえ。変換はすべてお使いのブラウザ内で行われ、データはサーバーへ送信・保存されません。

**Q. 大きなファイルも変換できますか？**
A. 50MB までのファイルを変換できます。Base64 にすると元のファイルの約 1.33 倍の大きさになります。
```

- [ ] **Step 6: E2E を書く**

`tests/e2e/tools/base64.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

test.describe('Base64', () => {
  test('テキストをエンコードする', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/base64/');
    await page.locator('[data-input]').fill('こんにちは');
    await expect(page.locator('[data-output]')).toHaveValue('44GT44KT44Gr44Gh44Gv');
    expect(w.external).toEqual([]);
  });

  test('ファイルをエンコードする', async ({ page }) => {
    await page.goto('/tools/base64/');
    await page.locator('[data-file]').setInputFiles({
      name: 'x.png',
      mimeType: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    await expect(page.locator('[data-output]')).toHaveValue('iVBORw==');
    await expect(page.locator('[data-msg]')).toContainText('x.png');
  });

  test('バイナリにデコードされたらダウンロードを促す', async ({ page }) => {
    await page.goto('/tools/base64/');
    await page.locator('[data-opt="mode"]').selectOption('decode');
    await page.locator('[data-input]').fill('iVBORw0KGgo=');
    await expect(page.locator('[data-output]')).toHaveValue(/バイナリデータ.*png/);
    await expect(page.locator('[data-copy]')).toBeDisabled();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-download]').click()]);
    expect(download.suggestedFilename()).toBe('decoded.png');
  });

  test('不正な Base64 はエラーを表示する', async ({ page }) => {
    await page.goto('/tools/base64/');
    await page.locator('[data-opt="mode"]').selectOption('decode');
    await page.locator('[data-input]').fill('abc$');
    await expect(page.locator('[data-msg]')).toContainText('使えない文字');
  });
});
```

- [ ] **Step 7: 全テスト・型チェック・ビルド・E2E を実行**

Run: `npm test && npm run check && npm run build && npm run test:e2e`
Expected: すべて PASS

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "feat: add Base64 encoder/decoder tool

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: URL エンコード・デコードツール

**Files:**
- Create: `src/tools/url-encode/meta.ts`, `src/tools/url-encode/logic.ts`, `src/tools/url-encode/logic.test.ts`, `src/tools/url-encode/Tool.astro`, `src/tools/url-encode/guide.md`, `tests/e2e/tools/url-encode.spec.ts`

**Interfaces:**
- Consumes: `bindIOPanel`、`IOPanel.astro`、storage 関数、`describeError`、`ok`、`err`、`Result`
- Produces:
  - `MODES = ['encode', 'decode'] as const`、`type Mode`
  - `encodeComponent(text: string): Result<string>`、`decodeComponent(text: string, plusAsSpace: boolean): Result<string>`
  - `interface QueryParam { key: string; value: string }`、`parseQuery(input: string): QueryParam[] | null`

- [ ] **Step 1: 失敗するテストを書く**

`src/tools/url-encode/logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decodeComponent, encodeComponent, parseQuery } from './logic';

const value = <T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }) =>
  r.ok ? r.value : `ERR:${r.error.message}`;

describe('encodeComponent', () => {
  it('予約文字と日本語をエンコードする', () => {
    expect(value(encodeComponent('a b&c=あ/?'))).toBe('a%20b%26c%3D%E3%81%82%2F%3F');
  });

  it('対になっていないサロゲートはエラー', () => {
    expect(encodeComponent('\ud800').ok).toBe(false);
  });
});

describe('decodeComponent', () => {
  it('デコードする', () => {
    expect(value(decodeComponent('%E3%81%82%20b', false))).toBe('あ b');
  });

  it('+ を空白として扱うか選べる', () => {
    expect(value(decodeComponent('a+b', false))).toBe('a+b');
    expect(value(decodeComponent('a+b', true))).toBe('a b');
  });

  it('不正なパーセントエンコーディングはエラー', () => {
    expect(decodeComponent('%E3%81', false).ok).toBe(false);
    expect(decodeComponent('%zz', false).ok).toBe(false);
  });
});

describe('parseQuery', () => {
  it('URL のクエリをキーと値に分解する（重複キー・エンコード済みも）', () => {
    expect(parseQuery('https://example.com/p?q=%E3%81%82&tag=a&tag=b+c#top')).toEqual([
      { key: 'q', value: 'あ' },
      { key: 'tag', value: 'a' },
      { key: 'tag', value: 'b c' },
    ]);
  });

  it('クエリ文字列だけでも分解する', () => {
    expect(parseQuery('?a=1&b=')).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '' },
    ]);
    expect(parseQuery('a=1#x')).toEqual([{ key: 'a', value: '1' }]);
  });

  it('クエリがなければ null', () => {
    expect(parseQuery('https://example.com/')).toBeNull();
    expect(parseQuery('ただの文章')).toBeNull();
    expect(parseQuery('')).toBeNull();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/tools/url-encode`
Expected: FAIL（`./logic` が見つからない）

- [ ] **Step 3: logic を実装**

`src/tools/url-encode/logic.ts`:

```ts
import { err, ok, type Result } from '../../lib/result';

export const MODES = ['encode', 'decode'] as const;
export type Mode = (typeof MODES)[number];

export function encodeComponent(text: string): Result<string> {
  try {
    return ok(encodeURIComponent(text));
  } catch {
    return err('エンコードできない文字（対になっていないサロゲート）が含まれています');
  }
}

export function decodeComponent(text: string, plusAsSpace: boolean): Result<string> {
  try {
    return ok(decodeURIComponent(plusAsSpace ? text.replace(/\+/g, ' ') : text));
  } catch {
    return err('正しくないパーセントエンコーディングが含まれています（% の後に 16 進数 2 桁が続いていない、または UTF-8 として不完全）');
  }
}

export interface QueryParam {
  key: string;
  value: string;
}

export function parseQuery(input: string): QueryParam[] | null {
  const s = input.trim();
  if (s === '') return null;
  let query: string;
  try {
    query = new URL(s).search;
  } catch {
    if (!s.includes('=')) return null;
    query = s.split('#')[0];
  }
  // URLSearchParams は + を空白として、不正な % はそのまま扱う
  const params = [...new URLSearchParams(query)].map(([key, value]) => ({ key, value }));
  return params.length > 0 ? params : null;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/tools/url-encode`
Expected: PASS（8 件）

- [ ] **Step 5: meta・UI・ガイドを作成**

`src/tools/url-encode/meta.ts`:

```ts
import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'url-encode',
  title: 'URL エンコード・デコード',
  description: 'URL に使う文字列をパーセントエンコード・デコードします。URL のクエリをキーと値の表に分解して表示。',
  category: 'encode',
  icon: '🔗',
  keywords: ['url', 'エンコード', 'デコード', 'パーセントエンコーディング', 'encodeuricomponent', 'クエリ', 'query', '文字化け'],
  order: 2,
};
```

`src/tools/url-encode/Tool.astro`:

```astro
---
import IOPanel from '../../components/IOPanel.astro';
---

<IOPanel id="url-encode" inputLabel="テキストを入力" placeholder="https://example.com/?q=検索語">
  <fieldset slot="options" class="options">
    <legend>オプション</legend>
    <label class="field">
      モード
      <select data-opt="mode">
        <option value="encode">エンコード</option>
        <option value="decode">デコード</option>
      </select>
    </label>
    <label class="field" data-decode-only>
      <input type="checkbox" data-opt="plusAsSpace" /> + を空白として扱う（フォーム送信の形式）
    </label>
  </fieldset>
  <div slot="after" data-query hidden>
    <p><strong>クエリパラメータ</strong></p>
    <div class="table-wrap"><table data-query-table></table></div>
  </div>
</IOPanel>

<script>
  import { bindIOPanel } from '../../lib/io-panel';
  import { describeError } from '../../lib/result';
  import { readBool, readChoice, toolKey, write } from '../../lib/storage';
  import { decodeComponent, encodeComponent, MODES, parseQuery, type Mode } from './logic';

  const SLUG = 'url-encode';
  const root = document.querySelector<HTMLElement>(`[data-io="${SLUG}"]`)!;
  const mode = root.querySelector<HTMLSelectElement>('[data-opt="mode"]')!;
  const plusAsSpace = root.querySelector<HTMLInputElement>('[data-opt="plusAsSpace"]')!;
  const query = root.querySelector<HTMLElement>('[data-query]')!;
  const queryTable = root.querySelector<HTMLTableElement>('[data-query-table]')!;

  mode.value = readChoice(toolKey(SLUG, 'mode'), MODES, 'encode');
  plusAsSpace.checked = readBool(toolKey(SLUG, 'plusAsSpace'), false);

  function applyMode() {
    const decode = (mode.value as Mode) === 'decode';
    root.querySelectorAll<HTMLElement>('[data-decode-only]').forEach((el) => (el.hidden = !decode));
  }
  applyMode();

  function renderQuery(text: string) {
    const params = parseQuery(text);
    queryTable.replaceChildren();
    query.hidden = !params;
    if (!params) return;
    const head = queryTable.createTHead().insertRow();
    for (const label of ['キー', '値']) {
      const th = document.createElement('th');
      th.textContent = label;
      head.append(th);
    }
    const body = queryTable.createTBody();
    for (const p of params) {
      const tr = body.insertRow();
      tr.insertCell().textContent = p.key;
      tr.insertCell().textContent = p.value;
    }
  }

  const panel = bindIOPanel(root, {
    runOnEmpty: true,
    run(text) {
      renderQuery(text);
      if (text === '') {
        panel.setOutput('');
        return;
      }
      const r = (mode.value as Mode) === 'encode' ? encodeComponent(text) : decodeComponent(text, plusAsSpace.checked);
      if (!r.ok) {
        panel.setError(describeError(r.error));
        return;
      }
      panel.setOutput(r.value, { filename: 'result.txt', mime: 'text/plain;charset=utf-8', data: [r.value] });
    },
  });

  mode.addEventListener('change', () => {
    write(toolKey(SLUG, 'mode'), mode.value);
    applyMode();
    panel.rerun();
  });
  plusAsSpace.addEventListener('change', () => {
    write(toolKey(SLUG, 'plusAsSpace'), plusAsSpace.checked);
    panel.rerun();
  });
</script>
```

`src/tools/url-encode/guide.md`:

```md
## 使い方

1. 「モード」でエンコードかデコードを選びます。
2. 入力欄に文字列を入力すると、結果が出力欄に表示されます。
3. URL（`https://...?a=1&b=2` の形）やクエリ文字列（`a=1&b=2`）を入力すると、下にパラメータをキーと値の表で表示します。値はデコードされた状態で表示されます。

## エンコードの方式

JavaScript の `encodeURIComponent` と同じ方式です。英数字と `- _ . ! ~ * ' ( )` 以外の文字を、UTF-8 のバイト列にして `%E3%81%82` のような形に変換します。URL のパラメータの値に日本語や記号を入れたいときに使います。

## 「+ を空白として扱う」について

HTML のフォームから送信されたデータでは、空白が `+` になっています。このオプションをオンにすると `+` を空白に戻してからデコードします。

## よくある質問

**Q. 文字化けした URL を読める形にできますか？**
A. `%E3%81%82` のような形になっている URL なら、デコードで読める文字に戻せます。Shift_JIS でエンコードされたものは UTF-8 として読めないため、エラーになります。

**Q. 入力した URL は送信されますか？**
A. いいえ。変換はお使いのブラウザ内で行われ、入力した URL にアクセスすることもありません。
```

- [ ] **Step 6: E2E を書く**

`tests/e2e/tools/url-encode.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { watchPage } from '../helpers';

test.describe('URL エンコード・デコード', () => {
  test('エンコードする', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/url-encode/');
    await page.locator('[data-input]').fill('東京 タワー');
    await expect(page.locator('[data-output]')).toHaveValue('%E6%9D%B1%E4%BA%AC%20%E3%82%BF%E3%83%AF%E3%83%BC');
    expect(w.external).toEqual([]);
  });

  test('URL を入力するとクエリを表に分解する（URL へはアクセスしない）', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('/tools/url-encode/');
    await page.locator('[data-opt="mode"]').selectOption('decode');
    await page.locator('[data-input]').fill('https://example.com/?q=%E3%81%82&n=1');
    await expect(page.locator('[data-query-table] tbody tr')).toHaveCount(2);
    await expect(page.locator('[data-query-table] tbody tr').first()).toContainText('あ');
    expect(w.external).toEqual([]);
  });

  test('不正な入力はエラーを表示する', async ({ page }) => {
    await page.goto('/tools/url-encode/');
    await page.locator('[data-opt="mode"]').selectOption('decode');
    await page.locator('[data-input]').fill('%E3%81');
    await expect(page.locator('[data-msg]')).toContainText('パーセントエンコーディング');
  });
});
```

- [ ] **Step 7: 全テスト・型チェック・ビルド・E2E を実行**

Run: `npm test && npm run check && npm run build && npm run test:e2e`
Expected: すべて PASS

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "feat: add URL encoder/decoder tool

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: 文字数カウントツール

**Files:**
- Create: `src/tools/char-count/meta.ts`, `src/tools/char-count/logic.ts`, `src/tools/char-count/logic.test.ts`, `src/tools/char-count/Tool.astro`, `src/tools/char-count/guide.md`, `tests/e2e/tools/char-count.spec.ts`

**Interfaces:**
- Consumes: `bindIOPanel`（`runOnEmpty: true`）、`IOPanel.astro`（`showOutput={false}`）、`sjisByteLength`
- Produces:
  - `interface CharStats { chars: number; charsNoSpace: number; utf8Bytes: number; sjisBytes: number; sjisUnencodable: number; lines: number; manuscriptLines: number; manuscriptPages: number }`
  - `graphemes(text: string): string[]`、`countChars(text: string): CharStats`、`MANUSCRIPT_COLS = 20`、`MANUSCRIPT_ROWS = 20`

- [ ] **Step 1: 失敗するテストを書く**

`src/tools/char-count/logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { countChars, graphemes } from './logic';

describe('graphemes', () => {
  it('絵文字の結合や濁点の結合文字を 1 文字として数える', () => {
    expect(graphemes('👨‍👩‍👧')).toHaveLength(1);
    expect(graphemes('が')).toHaveLength(1);
    expect(graphemes('🇯🇵')).toHaveLength(1);
  });
});

describe('countChars', () => {
  it('空文字はすべて 0', () => {
    expect(countChars('')).toEqual({
      chars: 0,
      charsNoSpace: 0,
      utf8Bytes: 0,
      sjisBytes: 0,
      sjisUnencodable: 0,
      lines: 0,
      manuscriptLines: 0,
      manuscriptPages: 0,
    });
  });

  it('文字数は改行を含まず、空白は含む', () => {
    const s = countChars('a b　c\nd');
    expect(s.chars).toBe(6);
    expect(s.charsNoSpace).toBe(4);
    expect(s.lines).toBe(2);
  });

  it('CRLF も 1 つの改行として扱う', () => {
    const s = countChars('a\r\nb\rc');
    expect(s.chars).toBe(3);
    expect(s.lines).toBe(3);
  });

  it('バイト数を UTF-8 と Shift_JIS で数える', () => {
    const s = countChars('aあ😀');
    expect(s.utf8Bytes).toBe(1 + 3 + 4);
    expect(s.sjisBytes).toBe(3);
    expect(s.sjisUnencodable).toBe(1);
  });

  it('400 字詰め原稿用紙に換算する（段落ごとに改行）', () => {
    expect(countChars('あ'.repeat(400))).toMatchObject({ manuscriptLines: 20, manuscriptPages: 1 });
    expect(countChars('あ'.repeat(401))).toMatchObject({ manuscriptLines: 21, manuscriptPages: 2 });
    expect(countChars('あ\n\nい')).toMatchObject({ manuscriptLines: 3, manuscriptPages: 1 });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/tools/char-count`
Expected: FAIL（`./logic` が見つからない）

- [ ] **Step 3: logic を実装**

`src/tools/char-count/logic.ts`:

```ts
import { sjisByteLength } from '../../lib/encoding';

export const MANUSCRIPT_COLS = 20;
export const MANUSCRIPT_ROWS = 20;

export interface CharStats {
  /** 文字数（改行を除く、空白を含む） */
  chars: number;
  /** 空白・改行を除いた文字数 */
  charsNoSpace: number;
  utf8Bytes: number;
  sjisBytes: number;
  /** Shift_JIS で表せない文字の数 */
  sjisUnencodable: number;
  lines: number;
  /** 400 字詰め原稿用紙に書いたときの行数（段落の途中の禁則処理は考慮しない） */
  manuscriptLines: number;
  manuscriptPages: number;
}

let segmenter: Intl.Segmenter | null | undefined;

// 見た目の 1 文字（書記素）単位に分割する。Intl.Segmenter がない古いブラウザではコードポイント単位
export function graphemes(text: string): string[] {
  if (segmenter === undefined) {
    segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;
  }
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
}

export function countChars(text: string): CharStats {
  const normalized = text.replace(/\r\n?/g, '\n');
  const gs = graphemes(normalized);
  const paragraphs = normalized === '' ? [] : normalized.split('\n');
  const manuscriptLines = paragraphs.reduce(
    (sum, p) => sum + Math.max(1, Math.ceil(graphemes(p).length / MANUSCRIPT_COLS)),
    0,
  );
  const sjis = sjisByteLength(normalized);
  return {
    chars: gs.filter((g) => g !== '\n').length,
    charsNoSpace: gs.filter((g) => !/^\s+$/u.test(g)).length,
    utf8Bytes: new TextEncoder().encode(normalized).length,
    sjisBytes: sjis.bytes,
    sjisUnencodable: sjis.unencodable,
    lines: paragraphs.length,
    manuscriptLines,
    manuscriptPages: Math.ceil(manuscriptLines / MANUSCRIPT_ROWS),
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/tools/char-count`
Expected: PASS（6 件）

- [ ] **Step 5: meta・UI・ガイドを作成**

`src/tools/char-count/meta.ts`:

```ts
import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'char-count',
  title: '文字数カウント',
  description: '文字数・空白を除いた文字数・バイト数（UTF-8 / Shift_JIS）・行数・原稿用紙の枚数をリアルタイムで数えます。',
  category: 'text',
  icon: '🔢',
  keywords: ['文字数', 'カウント', '文字数カウント', 'バイト数', '原稿用紙', '行数', 'レポート', 'counter'],
  order: 1,
};
```

`src/tools/char-count/Tool.astro`:

```astro
---
import IOPanel from '../../components/IOPanel.astro';

const items = [
  ['chars', '文字数（改行を除く）'],
  ['charsNoSpace', '空白・改行を除いた文字数'],
  ['lines', '行数'],
  ['utf8Bytes', 'バイト数（UTF-8）'],
  ['sjisBytes', 'バイト数（Shift_JIS）'],
  ['manuscriptPages', '400 字詰め原稿用紙'],
] as const;
---

<IOPanel id="char-count" inputLabel="テキストを入力" placeholder="ここに文章を貼り付けてください" runLabel="数える" showOutput={false}>
  <div slot="after">
    <dl class="stats" data-stats>
      {
        items.map(([key, label]) => (
          <div>
            <dt>{label}</dt>
            <dd data-stat={key}>0</dd>
          </div>
        ))
      }
    </dl>
    <p class="msg-info" data-note></p>
  </div>
</IOPanel>

<script>
  import { bindIOPanel } from '../../lib/io-panel';
  import { countChars, type CharStats } from './logic';

  const root = document.querySelector<HTMLElement>('[data-io="char-count"]')!;
  const note = root.querySelector<HTMLElement>('[data-note]')!;
  const stat = (key: keyof CharStats) => root.querySelector<HTMLElement>(`[data-stat="${key}"]`)!;
  const fmt = (n: number) => n.toLocaleString('ja-JP');

  bindIOPanel(root, {
    runOnEmpty: true,
    run(text) {
      const s = countChars(text);
      stat('chars').textContent = fmt(s.chars);
      stat('charsNoSpace').textContent = fmt(s.charsNoSpace);
      stat('lines').textContent = fmt(s.lines);
      stat('utf8Bytes').textContent = fmt(s.utf8Bytes);
      stat('sjisBytes').textContent = fmt(s.sjisBytes);
      stat('manuscriptPages').textContent = `${fmt(s.manuscriptPages)} 枚（${fmt(s.manuscriptLines)} 行）`;
      note.textContent =
        s.sjisUnencodable > 0
          ? `Shift_JIS で表せない文字（絵文字など）が ${fmt(s.sjisUnencodable)} 文字あり、Shift_JIS のバイト数には含めていません`
          : '';
    },
  });
</script>
```

`src/tools/char-count/guide.md`:

```md
## 使い方

入力欄に文章を貼り付けるか、テキストファイルをドラッグ&ドロップすると、各項目を自動で数えます。

## 各項目の数え方

- **文字数（改行を除く）**: 見た目の 1 文字を 1 と数えます。空白は含み、改行は含みません。「👨‍👩‍👧」のように複数の文字を組み合わせた絵文字や、結合文字の濁点も 1 文字と数えます。
- **空白・改行を除いた文字数**: 半角・全角の空白、タブ、改行を除いた文字数です。レポートの字数制限の確認などに使えます。
- **行数**: 改行で区切られた行の数です。
- **バイト数（UTF-8）**: UTF-8 で保存したときの大きさです。日本語 1 文字は通常 3 バイトです。
- **バイト数（Shift_JIS）**: Shift_JIS で保存したときの大きさです。全角文字は 2 バイト、半角英数字と半角カナは 1 バイトです。絵文字など Shift_JIS で表せない文字は含めず、その数を別に表示します。
- **400 字詰め原稿用紙**: 1 行 20 字・1 枚 20 行として、改行のたびに次の行へ進めた場合の枚数です。句読点のぶら下げなどの禁則処理は考慮していないため、目安としてご利用ください。

## よくある質問

**Q. 入力した文章は保存されますか？**
A. いいえ。文字数の計算はお使いのブラウザ内で行われ、文章はサーバーへ送信・保存されません。ページを閉じると入力内容は消えます。

**Q. Word や他のサービスと文字数が違うのはなぜですか？**
A. 空白や改行、絵文字の数え方がサービスごとに異なるためです。このツールの数え方は上の説明のとおりです。
```

- [ ] **Step 6: E2E を書く**

`tests/e2e/tools/char-count.spec.ts`:

```ts
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
```

- [ ] **Step 7: 全テスト・型チェック・ビルド・E2E を実行**

Run: `npm test && npm run check && npm run build && npm run test:e2e`
Expected: すべて PASS

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "feat: add character counter tool

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: UUID・パスワード生成ツール

**Files:**
- Create: `src/tools/uuid-password/meta.ts`, `src/tools/uuid-password/logic.ts`, `src/tools/uuid-password/logic.test.ts`, `src/tools/uuid-password/Tool.astro`, `src/tools/uuid-password/guide.md`, `tests/e2e/tools/uuid-password.spec.ts`

**Interfaces:**
- Consumes: `copyText`（file.ts）、storage 関数、`ok`、`err`、`Result`、`describeError`
- Produces:
  - `type RandomFill = (buf: Uint8Array) => void`、`cryptoRandom: RandomFill`
  - `uuidV4(rand?: RandomFill): string`、`uuidV7(nowMs?: number, rand?: RandomFill): string`
  - `UUID_VERSIONS = ['v4', 'v7'] as const`、`type UuidVersion`、`COUNT_MIN = 1`、`UUID_COUNT_MAX = 100`、`PASSWORD_COUNT_MAX = 20`
  - `generateUuids(version: UuidVersion, count: number, rand?: RandomFill, nowMs?: number): Result<string[]>`
  - `CHARSETS`、`AMBIGUOUS = 'Il1O0o|'`、`PASSWORD_MIN = 4`、`PASSWORD_MAX = 128`
  - `interface PasswordOptions { length: number; upper: boolean; lower: boolean; digits: boolean; symbols: boolean; excludeAmbiguous: boolean }`
  - `randomInt(n: number, rand?: RandomFill): number`、`generatePassword(o: PasswordOptions, rand?: RandomFill): Result<string>`、`generatePasswords(o: PasswordOptions, count: number, rand?: RandomFill): Result<string[]>`

- [ ] **Step 1: 失敗するテストを書く**

`src/tools/uuid-password/logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AMBIGUOUS,
  CHARSETS,
  generatePassword,
  generatePasswords,
  generateUuids,
  randomInt,
  uuidV4,
  uuidV7,
  type PasswordOptions,
  type RandomFill,
} from './logic';

// テスト用の決定的な乱数（xorshift32）
function seeded(seed = 12345): RandomFill {
  let x = seed;
  return (buf) => {
    for (let i = 0; i < buf.length; i++) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      buf[i] = x & 0xff;
    }
  };
}
const zeros: RandomFill = (buf) => buf.fill(0);

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('UUID', () => {
  it('v4 の形式とバージョン・バリアントのビット', () => {
    expect(uuidV4(seeded())).toMatch(V4);
    expect(uuidV4(zeros)).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('v7 は先頭 48 ビットにミリ秒のタイムスタンプを入れる', () => {
    expect(uuidV7(0x0123456789ab, zeros)).toBe('01234567-89ab-7000-8000-000000000000');
    expect(uuidV7(Date.now(), seeded())).toMatch(V7);
  });

  it('個数を検査し、v7 は生成順に並べる', () => {
    expect(generateUuids('v4', 0).ok).toBe(false);
    expect(generateUuids('v4', 101).ok).toBe(false);
    const r = generateUuids('v7', 20, seeded(), 1_700_000_000_000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toHaveLength(20);
      expect([...r.value].sort()).toEqual(r.value);
    }
    const v4 = generateUuids('v4', 5, seeded());
    expect(v4.ok && new Set(v4.value).size).toBe(5);
  });
});

describe('randomInt', () => {
  it('偏りを避けるため範囲外の値は捨てて引き直す', () => {
    const seq = [0xff, 0xff, 0xff, 0xff, 0, 0, 0, 5];
    let i = 0;
    const scripted: RandomFill = (buf) => {
      for (let j = 0; j < buf.length; j++) buf[j] = seq[i++];
    };
    expect(randomInt(3, scripted)).toBe(2);
    expect(i).toBe(8);
  });
});

const base: PasswordOptions = {
  length: 16,
  upper: true,
  lower: true,
  digits: true,
  symbols: false,
  excludeAmbiguous: false,
};

describe('generatePassword', () => {
  it('指定した長さで、選んだ文字種をすべて含む', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = generatePassword({ ...base, length: 4, symbols: true }, seeded(seed));
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.value).toHaveLength(4);
      expect(r.value).toMatch(/[A-Z]/);
      expect(r.value).toMatch(/[a-z]/);
      expect(r.value).toMatch(/[0-9]/);
      expect([...r.value].some((c) => CHARSETS.symbols.includes(c))).toBe(true);
    }
  });

  it('選んでいない文字種は含まない', () => {
    const r = generatePassword({ ...base, upper: false, digits: false, length: 64 }, seeded());
    expect(r.ok && r.value).toMatch(/^[a-z]{64}$/);
  });

  it('紛らわしい文字を除外できる', () => {
    const r = generatePassword({ ...base, length: 128, excludeAmbiguous: true }, seeded(7));
    expect(r.ok).toBe(true);
    if (r.ok) expect([...r.value].filter((c) => AMBIGUOUS.includes(c))).toEqual([]);
  });

  it('長さ・文字種の指定が不正ならエラー', () => {
    expect(generatePassword({ ...base, length: 3 }).ok).toBe(false);
    expect(generatePassword({ ...base, length: 129 }).ok).toBe(false);
    expect(generatePassword({ ...base, length: 8.5 }).ok).toBe(false);
    expect(generatePassword({ ...base, upper: false, lower: false, digits: false }).ok).toBe(false);
  });

  it('複数個をまとめて生成できる', () => {
    const r = generatePasswords(base, 5, seeded());
    expect(r.ok && r.value).toHaveLength(5);
    expect(generatePasswords(base, 21).ok).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/tools/uuid-password`
Expected: FAIL（`./logic` が見つからない）

- [ ] **Step 3: logic を実装**

`src/tools/uuid-password/logic.ts`:

```ts
import { err, ok, type Result } from '../../lib/result';

export type RandomFill = (buf: Uint8Array) => void;

// 乱数は暗号論的に安全な crypto.getRandomValues だけを使う
export const cryptoRandom: RandomFill = (buf) => {
  crypto.getRandomValues(buf);
};

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

function formatUuid(b: Uint8Array): string {
  const h = hex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function uuidV4(rand: RandomFill = cryptoRandom): string {
  const b = new Uint8Array(16);
  rand(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return formatUuid(b);
}

// RFC 9562: 先頭 48 ビットが Unix ミリ秒、残りがランダム
export function uuidV7(nowMs: number = Date.now(), rand: RandomFill = cryptoRandom): string {
  const b = new Uint8Array(16);
  rand(b);
  let ts = nowMs;
  for (let i = 5; i >= 0; i--) {
    b[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  return formatUuid(b);
}

export const UUID_VERSIONS = ['v4', 'v7'] as const;
export type UuidVersion = (typeof UUID_VERSIONS)[number];
export const COUNT_MIN = 1;
export const UUID_COUNT_MAX = 100;
export const PASSWORD_COUNT_MAX = 20;

function checkCount(count: number, max: number): string | null {
  return Number.isInteger(count) && count >= COUNT_MIN && count <= max
    ? null
    : `個数は ${COUNT_MIN}〜${max} で指定してください`;
}

export function generateUuids(
  version: UuidVersion,
  count: number,
  rand: RandomFill = cryptoRandom,
  nowMs: number = Date.now(),
): Result<string[]> {
  const bad = checkCount(count, UUID_COUNT_MAX);
  if (bad) return err(bad);
  const list = Array.from({ length: count }, () => (version === 'v4' ? uuidV4(rand) : uuidV7(nowMs, rand)));
  // 同じミリ秒内の v7 は並び順が保証されないため、生成順（時刻順）に並べて返す
  return ok(version === 'v7' ? list.sort() : list);
}

export const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!#$%&()*+,-./:;<=>?@[]^_{}~',
} as const;
type CharsetKey = keyof typeof CHARSETS;
const CHARSET_KEYS = Object.keys(CHARSETS) as CharsetKey[];

export const AMBIGUOUS = 'Il1O0o|';
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 128;

export interface PasswordOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

// 0 以上 n 未満の一様な整数。剰余による偏りを避けるため、範囲外の値は捨てて引き直す
export function randomInt(n: number, rand: RandomFill = cryptoRandom): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint8Array(4);
  for (;;) {
    rand(buf);
    const x = ((buf[0] << 24) >>> 0) + (buf[1] << 16) + (buf[2] << 8) + buf[3];
    if (x < limit) return x % n;
  }
}

export function generatePassword(o: PasswordOptions, rand: RandomFill = cryptoRandom): Result<string> {
  if (!Number.isInteger(o.length) || o.length < PASSWORD_MIN || o.length > PASSWORD_MAX) {
    return err(`長さは ${PASSWORD_MIN}〜${PASSWORD_MAX} で指定してください`);
  }
  const sets = CHARSET_KEYS.filter((k) => o[k]).map((k) =>
    o.excludeAmbiguous ? [...CHARSETS[k]].filter((c) => !AMBIGUOUS.includes(c)).join('') : CHARSETS[k],
  );
  if (sets.length === 0) return err('文字の種類を 1 つ以上選んでください');
  const all = sets.join('');
  // 選んだ文字種を最低 1 文字ずつ含めてから残りを埋め、最後に並びを混ぜる
  const chars = sets.map((s) => s[randomInt(s.length, rand)]);
  while (chars.length < o.length) chars.push(all[randomInt(all.length, rand)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rand);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return ok(chars.join(''));
}

export function generatePasswords(
  o: PasswordOptions,
  count: number,
  rand: RandomFill = cryptoRandom,
): Result<string[]> {
  const bad = checkCount(count, PASSWORD_COUNT_MAX);
  if (bad) return err(bad);
  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = generatePassword(o, rand);
    if (!r.ok) return r;
    list.push(r.value);
  }
  return ok(list);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/tools/uuid-password`
Expected: PASS（9 件）

- [ ] **Step 5: meta・UI・ガイドを作成**

`src/tools/uuid-password/meta.ts`:

```ts
import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'uuid-password',
  title: 'UUID・パスワード生成',
  description: 'UUID（v4 / v7）と安全なランダムパスワードを生成します。長さや文字の種類、紛らわしい文字の除外を指定可能。',
  category: 'generate',
  icon: '🎲',
  keywords: ['uuid', 'guid', 'v4', 'v7', 'パスワード', 'password', '生成', 'ジェネレーター', 'generator', 'ランダム'],
  order: 1,
};
```

`src/tools/uuid-password/Tool.astro`:

```astro
<div class="io" data-gen="uuid-password">
  <section>
    <h2>UUID</h2>
    <fieldset class="options">
      <legend>オプション</legend>
      <label class="field">
        バージョン
        <select data-opt="uuidVersion">
          <option value="v4">v4（ランダム）</option>
          <option value="v7">v7（時刻順に並ぶ）</option>
        </select>
      </label>
      <label class="field">個数 <input type="number" data-opt="uuidCount" min="1" max="100" /></label>
      <label class="field"><input type="checkbox" data-opt="uuidUpper" /> 大文字</label>
      <button type="button" class="btn btn-primary" data-uuid-generate>生成</button>
    </fieldset>
    <textarea data-uuid-output readonly spellcheck="false" aria-label="生成した UUID"></textarea>
    <div class="io-actions"><button type="button" class="btn" data-uuid-copy>コピー</button></div>
    <p class="msg" data-uuid-msg role="status" aria-live="polite"></p>
  </section>

  <section>
    <h2>パスワード</h2>
    <fieldset class="options">
      <legend>オプション</legend>
      <label class="field">長さ <input type="number" data-opt="pwLength" min="4" max="128" /></label>
      <label class="field">個数 <input type="number" data-opt="pwCount" min="1" max="20" /></label>
      <label class="field"><input type="checkbox" data-opt="upper" /> 英大文字</label>
      <label class="field"><input type="checkbox" data-opt="lower" /> 英小文字</label>
      <label class="field"><input type="checkbox" data-opt="digits" /> 数字</label>
      <label class="field"><input type="checkbox" data-opt="symbols" /> 記号</label>
      <label class="field"><input type="checkbox" data-opt="excludeAmbiguous" /> 紛らわしい文字（I l 1 O 0 o |）を除く</label>
      <button type="button" class="btn btn-primary" data-pw-generate>生成</button>
    </fieldset>
    <textarea data-pw-output readonly spellcheck="false" aria-label="生成したパスワード"></textarea>
    <div class="io-actions"><button type="button" class="btn" data-pw-copy>コピー</button></div>
    <p class="msg" data-pw-msg role="status" aria-live="polite"></p>
  </section>
</div>

<script>
  import { copyText } from '../../lib/file';
  import { describeError } from '../../lib/result';
  import { readBool, readChoice, readInt, toolKey, write } from '../../lib/storage';
  import {
    COUNT_MIN,
    generatePasswords,
    generateUuids,
    PASSWORD_COUNT_MAX,
    PASSWORD_MAX,
    PASSWORD_MIN,
    UUID_COUNT_MAX,
    UUID_VERSIONS,
    type UuidVersion,
  } from './logic';

  const SLUG = 'uuid-password';
  const root = document.querySelector<HTMLElement>(`[data-gen="${SLUG}"]`)!;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const opt = <T extends HTMLElement>(name: string) => $<T>(`[data-opt="${name}"]`);
  const key = (name: string) => toolKey(SLUG, name);

  const uuidVersion = opt<HTMLSelectElement>('uuidVersion');
  const uuidCount = opt<HTMLInputElement>('uuidCount');
  const uuidUpper = opt<HTMLInputElement>('uuidUpper');
  const pwLength = opt<HTMLInputElement>('pwLength');
  const pwCount = opt<HTMLInputElement>('pwCount');
  const flags = ['upper', 'lower', 'digits', 'symbols', 'excludeAmbiguous'] as const;
  const flagEls = Object.fromEntries(flags.map((f) => [f, opt<HTMLInputElement>(f)])) as Record<
    (typeof flags)[number],
    HTMLInputElement
  >;
  const flagDefaults = { upper: true, lower: true, digits: true, symbols: false, excludeAmbiguous: false };

  uuidVersion.value = readChoice(key('uuidVersion'), UUID_VERSIONS, 'v4');
  uuidCount.value = String(readInt(key('uuidCount'), 5, COUNT_MIN, UUID_COUNT_MAX));
  uuidUpper.checked = readBool(key('uuidUpper'), false);
  pwLength.value = String(readInt(key('pwLength'), 16, PASSWORD_MIN, PASSWORD_MAX));
  pwCount.value = String(readInt(key('pwCount'), 5, COUNT_MIN, PASSWORD_COUNT_MAX));
  for (const f of flags) flagEls[f].checked = readBool(key(f), flagDefaults[f]);

  function show(output: HTMLTextAreaElement, msg: HTMLElement, lines: string[] | null, error?: string) {
    output.value = lines ? lines.join('\n') : '';
    msg.textContent = error ?? '';
    msg.className = error ? 'msg msg-error' : 'msg';
  }

  // 生成した値は保存しない（設定だけを保存する）
  function generateUuid() {
    const r = generateUuids(uuidVersion.value as UuidVersion, Number(uuidCount.value));
    const out = $<HTMLTextAreaElement>('[data-uuid-output]');
    const msg = $<HTMLElement>('[data-uuid-msg]');
    if (!r.ok) return show(out, msg, null, describeError(r.error));
    show(out, msg, uuidUpper.checked ? r.value.map((u) => u.toUpperCase()) : r.value);
  }

  function generatePw() {
    const r = generatePasswords(
      {
        length: Number(pwLength.value),
        upper: flagEls.upper.checked,
        lower: flagEls.lower.checked,
        digits: flagEls.digits.checked,
        symbols: flagEls.symbols.checked,
        excludeAmbiguous: flagEls.excludeAmbiguous.checked,
      },
      Number(pwCount.value),
    );
    const out = $<HTMLTextAreaElement>('[data-pw-output]');
    const msg = $<HTMLElement>('[data-pw-msg]');
    if (!r.ok) return show(out, msg, null, describeError(r.error));
    show(out, msg, r.value);
  }

  function persistOn(el: HTMLInputElement | HTMLSelectElement, name: string, regenerate: () => void) {
    el.addEventListener('change', () => {
      const value =
        el instanceof HTMLInputElement && el.type === 'checkbox'
          ? el.checked
          : el instanceof HTMLInputElement && el.type === 'number'
            ? Number(el.value)
            : el.value;
      write(key(name), value);
      regenerate();
    });
  }
  persistOn(uuidVersion, 'uuidVersion', generateUuid);
  persistOn(uuidCount, 'uuidCount', generateUuid);
  persistOn(uuidUpper, 'uuidUpper', generateUuid);
  persistOn(pwLength, 'pwLength', generatePw);
  persistOn(pwCount, 'pwCount', generatePw);
  for (const f of flags) persistOn(flagEls[f], f, generatePw);

  $('[data-uuid-generate]').addEventListener('click', generateUuid);
  $('[data-pw-generate]').addEventListener('click', generatePw);

  async function copyFrom(outputSel: string, msgSel: string) {
    const out = $<HTMLTextAreaElement>(outputSel);
    const msg = $<HTMLElement>(msgSel);
    const result = await copyText(out.value, out);
    msg.className = 'msg msg-info';
    msg.textContent =
      result === 'copied' ? 'コピーしました' : '選択しました。Ctrl+C（Mac は ⌘C）でコピーしてください';
  }
  $('[data-uuid-copy]').addEventListener('click', () => copyFrom('[data-uuid-output]', '[data-uuid-msg]'));
  $('[data-pw-copy]').addEventListener('click', () => copyFrom('[data-pw-output]', '[data-pw-msg]'));

  generateUuid();
  generatePw();
</script>
```

`src/tools/uuid-password/guide.md`:

```md
## 使い方

ページを開くと UUID とパスワードが自動で生成されます。オプションを変えると作り直され、「生成」ボタンでも何度でも作り直せます。「コピー」で結果をクリップボードにコピーできます。

## UUID について

UUID は、データベースの ID などに使う、重複しにくい 128 ビットの識別子です。

- **v4**: すべてランダムに作られる、最も一般的な UUID です。
- **v7**: 先頭に作成時刻（ミリ秒）が入った UUID です。作った順に並べやすく、データベースの主キーに向いています。まとめて作った場合は時刻順に並べて表示します。

一度に 1〜100 個作れます。

## パスワードについて

- 乱数には、暗号用途にも使えるブラウザ標準の `crypto.getRandomValues` を使っています。
- 選んだ文字の種類（英大文字・英小文字・数字・記号）は、それぞれ最低 1 文字ずつ含まれます。
- 「紛らわしい文字を除く」をオンにすると、`I`（大文字のアイ）、`l`（小文字のエル）、`1`、`O`（大文字のオー）、`0`、`o`、`|` を使いません。手で入力するパスワードに便利です。
- 長さは 4〜128 文字、一度に 1〜20 個作れます。

## よくある質問

**Q. 生成したパスワードはどこかに保存・送信されますか？**
A. いいえ。生成はお使いのブラウザ内で行われ、結果はサーバーへ送信されず、ブラウザにも保存されません（保存するのは長さなどの設定だけです）。

**Q. 安全なパスワードの長さは？**
A. 一般的には 12 文字以上、できれば 16 文字以上で、複数の文字の種類を混ぜることが推奨されます。
```

- [ ] **Step 6: E2E を書く**

`tests/e2e/tools/uuid-password.spec.ts`:

```ts
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
```

- [ ] **Step 7: 全テスト・型チェック・ビルド・E2E を実行**

Run: `npm test && npm run check && npm run build && npm run test:e2e`
Expected: すべて PASS。トップページに 6 ツールすべてのカードが表示される。

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "feat: add UUID and password generator tool

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: CI/CD と README

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: npm scripts `check` / `test` / `build` / `test:e2e`、Cloudflare Pages プロジェクト名 `creator-world-tools`
- Produces: `ci.yml`（`pull_request` と `workflow_call` で起動、ジョブ `verify` と `preview`）、`deploy.yml`（`master` への push で起動、`ci.yml` を呼んでから本番にデプロイ）

- [ ] **Step 1: ワークフローを作成**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  workflow_call:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm test
      # E2E は広告・解析なしのビルドで「外部通信ゼロ」を検証する
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: test-results/
          retention-days: 7

  preview:
    needs: verify
    # フォークからの PR では Secrets を使えないためプレビューは作らない
    if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npx wrangler pages deploy dist --project-name=creator-world-tools --branch="${{ github.head_ref }}"
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [master]

permissions:
  contents: read

concurrency:
  group: deploy-production
  cancel-in-progress: true

jobs:
  verify:
    uses: ./.github/workflows/ci.yml

  deploy:
    needs: verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          PUBLIC_ADSENSE_CLIENT: ${{ vars.PUBLIC_ADSENSE_CLIENT }}
          PUBLIC_ADSENSE_SLOT_TOOL: ${{ vars.PUBLIC_ADSENSE_SLOT_TOOL }}
          PUBLIC_ADSENSE_SLOT_FOOTER: ${{ vars.PUBLIC_ADSENSE_SLOT_FOOTER }}
          PUBLIC_CF_ANALYTICS_TOKEN: ${{ vars.PUBLIC_CF_ANALYTICS_TOKEN }}
      - run: npx wrangler pages deploy dist --project-name=creator-world-tools --branch=master
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: アクションのバージョンを確認**

Run: `gh api repos/actions/checkout/releases/latest --jq .tag_name; gh api repos/actions/setup-node/releases/latest --jq .tag_name; gh api repos/actions/upload-artifact/releases/latest --jq .tag_name`
Expected: 主バージョンがワークフローの記述（checkout v7 / setup-node v7 / upload-artifact）と一致する。`upload-artifact` の最新の主バージョンが v4 でなければ、ワークフローの記述をそれに合わせる。

- [ ] **Step 3: ワークフローの構文を検証**

Run: `npx --yes @action-validator/cli .github/workflows/ci.yml && npx --yes @action-validator/cli .github/workflows/deploy.yml`
Expected: エラーなし。パッケージが見つからない・動かない場合は `python3 -c "import yaml,sys;[yaml.safe_load(open(f)) for f in sys.argv[1:]]" .github/workflows/*.yml` で最低限 YAML として正しいことを確認する。

- [ ] **Step 4: README を作成**

`README.md`:

````md
# Creator World Tools

ブラウザだけで完結する、登録不要の便利ツール集（https://tools.creator-world.net）。

- 入力・アップロードしたデータはブラウザ内だけで処理し、サーバーへ送信・保存しない
- ログイン不要。ツールの設定だけを localStorage に保存する
- Astro の静的サイトを Cloudflare Pages で配信。`master` への push で自動デプロイ

## 開発

Node.js 22.12 以上が必要です。

```bash
npm install
npm run dev        # 開発サーバー（http://localhost:4321）
npm test           # 単体テスト（Vitest）
npm run check      # 型チェック
npm run build      # dist/ に出力（_headers と ads.txt も生成）
npm run test:e2e   # E2E（wrangler pages dev 上で CSP 込みで検証）
```

E2E は広告・解析の環境変数を設定せずにビルドした `dist/` を対象にします（`.env` に `PUBLIC_*` を書いている場合は外してからビルドしてください）。

## ツールの追加方法

1. `src/tools/<slug>/` を作る（slug は英小文字・数字・ハイフン）。既存のツール（例: `src/tools/json-format/`）をコピーして始めると早いです。
2. 次の 5 ファイルを置く:
   - `meta.ts` — `export const meta: ToolMeta = { slug, title, description, category, icon, keywords, order }`
   - `logic.ts` — 処理本体。DOM を使わず、例外を投げずに `Result` を返す
   - `logic.test.ts` — `logic.ts` のテスト
   - `Tool.astro` — UI。入力→出力型なら `IOPanel` を使う
   - `guide.md` — 使い方・注意点・よくある質問（ページ下部に表示）
3. `tests/e2e/tools/<slug>.spec.ts` に操作の E2E を書く。
4. これだけで、トップページのカード・`/tools/<slug>/` ページ・サイトマップ・メタ情報が自動で反映されます。

ルール:

- `fetch` などの通信 API は使わない（`src/lib/no-network.test.ts` が検出して失敗します）
- ユーザーの入力は `textContent` / `value` でだけ表示する（`innerHTML` は使わない）
- 設定は `src/lib/storage.ts` の関数で保存し、入力データは保存しない

## 初回セットアップ（公開まで）

1. **Cloudflare Pages のプロジェクトを作る**: Cloudflare ダッシュボード → Workers & Pages → 作成 → Pages → 「Direct Upload」で、プロジェクト名を `creator-world-tools` にする（最初のアップロードは `dist/` を手動で上げるか、そのまま閉じて GitHub Actions からのデプロイを待つ）。
2. **API トークンを発行する**: My Profile → API Tokens → Create Token → 「Custom token」で権限を `Account` / `Cloudflare Pages` / `Edit` だけにする。
3. **GitHub に Secrets を登録する**: リポジトリの Settings → Secrets and variables → Actions → Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID`（ダッシュボードの右側に表示されるアカウント ID）を登録する。
4. **カスタムドメインを設定する**: Pages プロジェクト → Custom domains → `tools.creator-world.net` を追加し、`creator-world.net` を管理している DNS に次のレコードを追加する。
   ```
   tools  CNAME  creator-world-tools.pages.dev
   ```
5. **アクセス解析（任意）**: Cloudflare ダッシュボード → Web Analytics → サイトを追加し、表示されたトークンを GitHub の Variables に `PUBLIC_CF_ANALYTICS_TOKEN` として登録する。
6. **ブランチを保護する**: Settings → Branches → `master` にルールを追加し、「Require a pull request before merging」と「Require status checks to pass」（`verify` を指定）をオンにする。
7. **AdSense（ツールとページが揃ってから）**: AdSense に `tools.creator-world.net` で申請 → 承認後、GitHub の Variables に `PUBLIC_ADSENSE_CLIENT`（`ca-pub-...`）、`PUBLIC_ADSENSE_SLOT_TOOL`、`PUBLIC_ADSENSE_SLOT_FOOTER` を登録 → AdSense の「プライバシーとメッセージ」で EEA・英国・スイス向けの同意メッセージを有効にする（有効化の前に管理画面で料金が発生しないことを確認する）。

## 費用

| 項目 | 費用 |
|---|---|
| Cloudflare Pages（Free） | 無料。静的配信は帯域・リクエスト無制限。無料プランに自動課金なし |
| GitHub Actions | 公開リポジトリのため無料 |
| Cloudflare Web Analytics | 無料 |
| ドメイン | 既存の `creator-world.net` を使用 |

Pages Functions（サーバー側の処理）は使いません。使うと Workers の無料枠を消費します。

## 広告を有効にしたときの CSP

広告・解析を使わないビルドでは、CSP で自サイト以外への通信をすべて禁止しています。AdSense を有効にすると多数の Google ドメインへの通信が必要になるため、`connect-src` などを `https:` に広げます（`scripts/postbuild.mjs`）。その場合も、入力データを送らないことはコードの静的チェックと E2E（広告なしビルドで外部通信ゼロ）で担保しています。
````

- [ ] **Step 5: 最終確認**

Run: `npm test && npm run check && npm run build && npm run test:e2e`
Expected: すべて PASS

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "ci: add CI and Cloudflare Pages deploy workflows, write README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: GitHub リポジトリの作成と push（ユーザーの確認後に実行）**

外部へ公開する操作なので、実行前にユーザーへ確認する。承認された場合:

```bash
gh repo create kh55/creator-world-tools --public --source . --remote origin --push
```

Expected: `https://github.com/kh55/creator-world-tools` が作成され、`master` が push される。`deploy.yml` が起動するが、Secrets 未登録のため deploy ジョブは失敗する（README の初回セットアップ手順 1〜3 の完了後に再実行する）。
