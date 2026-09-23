# Creator World Tools 設計書

- 作成日: 2026-09-23
- リポジトリ: `creator-world-tools`（GitHub 公開リポジトリ、デフォルトブランチ `master`）
- 公開 URL: `https://tools.creator-world.net`（`creator-world.net` のサブドメイン）

## 1. 目的・成功基準

ブラウザだけで動く便利ツールを集めたポータルサイトを公開し、AdSense で広告収入を得る。

成功基準:

1. トップページ（ポータル）から各ツールに遷移でき、ツールは 1 ツール = 1 URL で独立している。
2. ツールの追加が「`src/tools/<slug>/` にフォルダを 1 つ追加する」だけで完結する（トップ、ページ、サイトマップ、メタ情報が自動反映）。
3. ユーザーが入力・アップロードしたデータはブラウザ外へ送信されず、どこにも保存されない。
4. ログイン不要。設定値のみ localStorage に保存する。
5. `master` への push（PR マージ）で、テスト合格後に Cloudflare Pages へ自動デプロイされる。
6. 運用費用はドメイン維持費のみ（ホスティング・CI・解析は無料枠内）。
7. AdSense 審査に必要なページ・コンテンツが揃っており、パブリッシャー ID を設定するだけで広告が表示できる。

## 2. 技術選定

| 項目 | 採用 | 理由 |
|---|---|---|
| フレームワーク | Astro（静的出力 `output: 'static'`） | ツールごとに独立した静的ページを生成でき、SEO・AdSense 審査に有利。必要なページだけ JS を読み込む |
| 言語 | TypeScript | ツールロジックの型安全性 |
| ホスティング | Cloudflare Pages（Direct Upload） | 静的配信は帯域・リクエスト無制限、広告掲載可、無料プランに自動課金なし |
| CI/CD | GitHub Actions + wrangler | デプロイ前にテストを必須化できる。公開リポジトリのため Actions は無料 |
| 単体テスト | Vitest | Astro/Vite と設定を共有できる |
| E2E | Playwright | 全ツールのスモークテストと外部通信の検知 |
| 解析 | Cloudflare Web Analytics | 無料・Cookie 不使用で同意不要 |
| 広告 | Google AdSense + AdSense「プライバシーとメッセージ」（Google 認定 CMP） | EEA/UK/スイス向けに認定 CMP が必須のため |

### 不採用とした選択肢

- **Vercel Hobby**: 規約で AdSense 等の広告掲載は商用利用とされ、Hobby プランでは不可。
- **GitHub Pages**: 規約上「オンラインビジネス運営のための無料ホスティング」としての利用が禁止されており、広告収益化はグレー。
- **Netlify Free**: 無料枠がクレジット制（300 クレジット/月、帯域換算で約 15GB）で、超過時の扱いが不明確。
- **ビルドなしの素の HTML/JS**: ツール追加のたびにページ・メタ・サイトマップを手作業で増やす必要がある。
- **SPA（Vite + React）**: 1 ページ構成になり SEO・審査に不利。

### Pages Functions は使わない

サーバーサイドの処理を一切持たない。これにより「アップロードデータを保存しない」ことを構造的に保証し、Workers の無料枠（1 日 10 万リクエスト）も消費しない。

## 3. ディレクトリ構成

```
creator-world-tools/
  astro.config.mjs          site: 'https://tools.creator-world.net'、@astrojs/sitemap
  scripts/
    postbuild.mjs           ビルド後に dist/_headers（CSP 等）と dist/ads.txt を環境変数から生成
  public/
    robots.txt
    favicon.svg
  src/
    tools/
      <slug>/
        meta.ts             ツールのメタ情報（後述の ToolMeta）
        logic.ts            変換処理などの純粋関数（DOM に依存しない）
        logic.test.ts       logic.ts の Vitest テスト
        Tool.astro          ツール UI。<script> で logic.ts を呼び出す
        guide.md            使い方・注意点・FAQ（ページ下部に表示）
    lib/
      registry.ts           import.meta.glob で src/tools/*/meta.ts を収集し一覧を返す
      storage.ts            localStorage ラッパー（名前空間分離、例外時は無視）
      file.ts               ファイル読み込み、ダウンロード、クリップボードコピー
      encoding.ts           テキストの文字コード判定・デコード（UTF-8 / Shift_JIS）
    components/
      IOPanel.astro         入力（貼り付け / ドラッグ&ドロップ / ファイル選択）と出力（コピー / ダウンロード）の共通 UI
      AdSlot.astro          広告枠（ID 未設定時は何も出力しない）
      ToolCard.astro        トップページのカード
      PrivacyBadge.astro    「データはブラウザ内で処理され、送信・保存されません」表示
    layouts/
      BaseLayout.astro      <head>（title/description/OGP/canonical）、ヘッダー、フッター、解析タグ、AdSense スクリプト
      ToolLayout.astro      BaseLayout + パンくず + PrivacyBadge + Tool + AdSlot + guide + AdSlot
    pages/
      index.astro           ポータル
      tools/[slug].astro    getStaticPaths で registry から全ツールのページを生成
      privacy.astro         プライバシーポリシー
      about.astro           サイトについて
      404.astro
  tests/
    e2e/smoke.spec.ts
  .github/workflows/
    ci.yml
    deploy.yml
```

## 4. ツール登録の仕組み

### ToolMeta

```ts
export type Category = 'convert' | 'format' | 'encode' | 'text' | 'generate';

export interface ToolMeta {
  slug: string;          // URL: /tools/<slug>/。フォルダ名と一致させる
  title: string;         // 例: 'CSV ⇔ JSON 変換'
  description: string;   // meta description とカードの説明文（120 字以内）
  category: Category;
  icon: string;          // 絵文字 1 文字
  keywords: string[];    // トップページ検索用
  order?: number;        // カテゴリ内の並び順（昇順、未指定は末尾）
}
```

### registry.ts

- `import.meta.glob('../tools/*/meta.ts', { eager: true })` でメタ情報を収集する。
- 同様に `Tool.astro` と `guide.md` を glob で読み込み、slug をキーに対応付ける。
- ビルド時に次を検証し、違反があればビルドを失敗させる:
  - slug とフォルダ名が一致している
  - slug が重複していない
  - `Tool.astro` と `guide.md` が存在する

### ツール追加手順

1. `src/tools/<slug>/` に `meta.ts`・`logic.ts`・`logic.test.ts`・`Tool.astro`・`guide.md` を作る。
2. 以上。トップのカード、`/tools/<slug>/` ページ、サイトマップ、title/description/OGP が自動で反映される。E2E のスモークテストも registry から全ツールを列挙して実行する。

README に上記手順と、既存ツールをコピーして始めるテンプレートの説明を記載する。

## 5. ページ設計

### トップページ（`/`）

- ヒーロー: サイト名、ひとこと説明、「データは送信されません」の明示。
- 検索ボックス: title・description・keywords をクライアント側で部分一致フィルタ（通信なし）。
- 最近使ったツール: localStorage の `cwt:recent`（最大 6 件の slug 配列）。未使用時は非表示。
- カテゴリ別カード一覧: `ToolCard`（アイコン・タイトル・説明）。
- JS 無効時もカード一覧は表示される（検索と最近使ったツールだけが無効になる）。

### ツールページ（`/tools/<slug>/`）

上から順に:

1. パンくず（トップ > カテゴリ名 > ツール名）
2. h1（ツール名）と説明文
3. PrivacyBadge
4. Tool.astro（ツール本体）
5. AdSlot（ツール下）
6. guide.md の内容（使い方・注意点・FAQ）
7. AdSlot（ページ下部）
8. 同じカテゴリの他ツールへのリンク

ページ表示時に slug を「最近使ったツール」の先頭に追加する。

### 静的ページ

- `/privacy`: ブラウザ内処理であり入力データは送信・保存しないこと／localStorage に保存する項目の一覧（設定値・最近使ったツール）／Google AdSense による Cookie 利用と第三者配信、広告設定ページへのリンク／Cloudflare Web Analytics の利用（Cookie なし）／ポリシーの改定について。
- `/about`: サイトの目的、運営者、データを送信しない方針。

## 6. データの扱い（セキュリティ・プライバシー）

- ツールのコードは入力データを `fetch` / `XMLHttpRequest` / `navigator.sendBeacon` / WebSocket などで送信しない。
- ファイルは `File` / `FileReader` / `Blob` でブラウザ内でのみ扱い、ダウンロードは `URL.createObjectURL` で生成して使用後に `revokeObjectURL` する。
- localStorage に保存するのは**設定値と最近使ったツールのみ**。入力データ・出力データは保存しない。
  - キーは `cwt:` で始め、ツール固有の設定は `cwt:tool:<slug>:<key>` とする。
  - `storage.ts` はストレージが使えない環境（プライベートモード等）での例外を握りつぶし、既定値で動作する。
- `scripts/postbuild.mjs` が `dist/_headers` を生成し、次を設定する:
  - `Content-Security-Policy`（広告・解析なし）: `default-src 'self'`、`script-src 'self'`、`connect-src 'self'`、`frame-src 'none'`、`object-src 'none'`、`base-uri 'self'`、`frame-ancestors 'none'`。inline script は禁止（Astro のスクリプトのインライン化も無効にする）。
  - Cloudflare Web Analytics を有効にした場合は `static.cloudflareinsights.com`（script）と `cloudflareinsights.com`（connect）だけを追加する。
  - AdSense を有効にした場合は、国別ドメインを含む多数の Google ドメインから配信されドメインの列挙が保守できないため、`script-src` / `connect-src` / `img-src` / `frame-src` に `https:` を許可する。この場合も入力データを送らないことは、通信 API の静的チェック（`src` 配下で `fetch` 等の使用をテストで禁止）と、広告なしビルドでの E2E（外部通信ゼロ）で担保する。
  - `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy`（カメラ・マイク・位置情報を無効化）。
- E2E テストで、各ツールの変換操作中にサイト自身のオリジン以外へのリクエストが発生しないことを検証する（広告・解析は E2E 実行時は無効）。

## 7. 広告（AdSense）と同意管理

- 環境変数:
  - `PUBLIC_ADSENSE_CLIENT`（例: `ca-pub-XXXXXXXXXXXXXXXX`）
  - `PUBLIC_ADSENSE_SLOT_TOOL`（ツール下の広告ユニット ID）
  - `PUBLIC_ADSENSE_SLOT_FOOTER`（ページ下部の広告ユニット ID）
- `PUBLIC_ADSENSE_CLIENT` が未設定の場合、AdSense スクリプト・広告枠・ads.txt の内容は一切出力しない。審査通過前は広告なしで公開する。
- 広告枠は入力欄・出力欄・操作ボタンに隣接させない（誤クリック防止、ポリシー準拠）。
- `AdSlot` は最小高さを確保し、CLS を防ぐ。
- 同意管理は AdSense 管理画面の「プライバシーとメッセージ」（Google 認定 CMP）を使用する。コード側では追加実装しない。有効化時に AdSense 管理画面で料金が発生しないことを確認する。
- 日本国内向けには同意バナーを必須としないが、プライバシーポリシーは必ず掲載する。
- AdSense の申請は、初回リリースの 6 ツールと静的ページが揃った後に行う。

## 8. 初回リリースのツール

| slug | 名前 | カテゴリ | 機能 | 依存 |
|---|---|---|---|---|
| `csv-json` | CSV ⇔ JSON 変換 | convert | 双方向変換。区切り文字（カンマ / タブ / セミコロン）、ヘッダー行の有無、入力文字コード（UTF-8 / Shift_JIS、自動判定あり）を指定。先頭 100 行のテーブルプレビュー。ダウンロード（JSON / CSV は UTF-8、CSV は BOM 付き出力を選択可） | PapaParse |
| `json-format` | JSON 整形・検証 | format | 整形（インデント 2 / 4 / タブ）、圧縮、キーのソート。構文エラー時は行・列とメッセージを表示 | なし |
| `base64` | Base64 エンコード・デコード | encode | テキスト（UTF-8）とファイルのエンコード・デコード。URL セーフ形式の切り替え。デコード結果がバイナリの場合はダウンロード | なし |
| `url-encode` | URL エンコード・デコード | encode | `encodeURIComponent` / `decodeURIComponent`。URL を貼るとクエリ文字列をキーと値の表に分解表示 | なし |
| `char-count` | 文字数カウント | text | 文字数（サロゲートペアと結合文字を考慮し `Intl.Segmenter` で書記素単位）、空白・改行を除いた文字数、バイト数（UTF-8 / Shift_JIS）、行数、400 字詰め原稿用紙換算。入力と同時に更新 | なし |
| `uuid-password` | UUID・パスワード生成 | generate | UUID v4 / v7 の生成（1〜100 個）。パスワード生成（長さ 4〜128、英大文字・英小文字・数字・記号の選択、紛らわしい文字の除外）。乱数は `crypto.getRandomValues` のみを使用 | なし |

Shift_JIS のエンコード（バイト数計算）はブラウザ標準で行えないため、`encoding.ts` に JIS X 0208 の範囲判定による計算を実装する（ASCII / 半角カナ = 1 バイト、それ以外 = 2 バイト、Shift_JIS で表現できない文字は件数を別途表示する）。

### 各ツール共通の振る舞い

- 入力は貼り付け・ドラッグ&ドロップ・ファイル選択の 3 通り（テキスト入力が不要なツールは除く）。
- 入力ファイルの上限は 50MB。超えた場合は処理せずにメッセージを表示する。
- 変換エラーはツール内にメッセージを表示し、例外で画面を壊さない。
- 出力はコピーボタンとダウンロードボタンを備える。
- ツール固有の設定（区切り文字、インデント幅など）は localStorage に保存し、次回訪問時に復元する。

## 9. エラーハンドリング

- `logic.ts` の関数は例外を投げず、`{ ok: true, value } | { ok: false, error: { message, line?, column? } }` を返す。UI は `ok` を見て出力またはエラーを表示する。
- ファイル読み込み失敗・サイズ超過・文字コード判定失敗は、IOPanel が共通のメッセージで表示する。
- localStorage の読み書き失敗は無視し、既定値で動作する。
- クリップボード API が使えない環境では、コピーボタンを押すと出力欄を全選択し、「選択しました。Ctrl+C でコピーしてください」と表示する。

## 10. テスト

- **単体テスト（Vitest）**: 各 `logic.ts` の正常系・境界値・エラー系。`encoding.ts` の Shift_JIS バイト数、`registry.ts` の検証ロジック。
- **E2E（Playwright）**: 広告・解析の環境変数なしでビルドした成果物を `wrangler pages dev`（`_headers` を適用するローカルサーバー、ログイン不要）で配信し、以下を検証する。
  - トップページにすべてのツールのカードが表示される。
  - 各ツールページが表示され、代表的な入力で期待する出力になる。
  - 変換操作中にサイト自身のオリジン以外へのリクエストが発生しない。
  - `/privacy`、`/about`、`/sitemap-index.xml`、`/robots.txt`、`/ads.txt` が 200 を返す。
  - CSP ヘッダーが付与され、各ページで CSP 違反・JS エラーが発生しない。
  - 入力データが localStorage に保存されない。
- **型チェック**: `astro check`。

## 11. CI/CD

### `.github/workflows/ci.yml`

- トリガー: `pull_request`、および `deploy.yml` からの `workflow_call`（検証ジョブを共通化）。
- 手順: `actions/checkout` → `actions/setup-node`（`.nvmrc` の LTS、npm キャッシュ）→ `npm ci` → `npm run check`（astro check）→ `npm test`（Vitest）→ `npm run build` → Playwright ブラウザのインストール → `npm run test:e2e`。
- PR の場合は検証合格後に `wrangler pages deploy dist --project-name=creator-world-tools --branch=<head branch>` でプレビューにデプロイする。ただしフォークからの PR では Secrets を使えないため、プレビューのデプロイは省略する。

### `.github/workflows/deploy.yml`

- トリガー: `master` への `push`。
- 手順: ci.yml と同じ検証 → `wrangler pages deploy dist --project-name=creator-world-tools --branch=master`（本番）。
- `concurrency` で同時実行を 1 つに制限し、古い実行はキャンセルする。

### Secrets / 環境変数

- GitHub Secrets: `CLOUDFLARE_API_TOKEN`（権限は「Cloudflare Pages: 編集」のみ）、`CLOUDFLARE_ACCOUNT_ID`。
- GitHub Variables（ビルド時に使用）: `PUBLIC_ADSENSE_CLIENT`、`PUBLIC_ADSENSE_SLOT_TOOL`、`PUBLIC_ADSENSE_SLOT_FOOTER`、`PUBLIC_CF_ANALYTICS_TOKEN`。いずれも未設定でもビルドは成功する。

### ブランチ保護

- `master` への直接 push を禁止し、PR 経由で ci.yml の成功を必須とする（GitHub の設定で行う。手順を README に記載）。

## 12. 初回セットアップ（手作業、README に手順を記載）

1. GitHub に公開リポジトリ `creator-world-tools` を作成し、push する。
2. Cloudflare ダッシュボードで Pages プロジェクト `creator-world-tools` を Direct Upload 方式で作成する。
3. Cloudflare の API トークンを発行する（Cloudflare Pages: 編集）。
4. GitHub Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を登録する。
5. Pages プロジェクトにカスタムドメイン `tools.creator-world.net` を追加し、`creator-world.net` の DNS に `tools CNAME creator-world-tools.pages.dev` を追加する。
6. Cloudflare Web Analytics でサイトを作成し、トークンを `PUBLIC_CF_ANALYTICS_TOKEN` に設定する。
7. `master` のブランチ保護を設定する。
8. 6 ツールと静的ページが公開されたら AdSense に申請し、承認後に `PUBLIC_ADSENSE_*` を設定、「プライバシーとメッセージ」で EEA/UK 向けメッセージを有効化する。

## 13. 費用

| 項目 | 費用 |
|---|---|
| Cloudflare Pages（Free） | 無料。静的配信は無制限、ビルド 500 回/月（本構成では Cloudflare 側でビルドしないため消費しない）、自動課金なし |
| GitHub Actions | 公開リポジトリのため無料 |
| Cloudflare Web Analytics | 無料 |
| AdSense「プライバシーとメッセージ」 | 有効化時に管理画面で無料であることを確認する |
| ドメイン | 既存の `creator-world.net` を使用（追加費用なし） |

## 14. 対象外（初回リリースでは作らない）

- YAML / XML 変換、画像の圧縮・変換、正規表現テスター、ハッシュ計算などの追加ツール（仕組み完成後に 1 つずつ追加する）
- 入力データを localStorage に保存する機能
- 多言語対応（日本語のみ）
- ダークモード以外のテーマ切り替え（ダークモードは `prefers-color-scheme` に従う）
- GA4 などの Cookie を使うアクセス解析
- PWA / オフライン対応
- お問い合わせページ（連絡先の掲載は行わない）
