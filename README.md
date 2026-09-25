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
5. **アクセス解析**:
   - **GA4（Google タグマネージャー経由）**: GTM のコンテナ ID（`GTM-XXXXXXX`）を GitHub の Variables に `PUBLIC_GTM_ID` として登録する。GTM の管理画面で「Google タグ」（GA4 の測定 ID `G-XXXXXXXXXX`）を「Initialization - All Pages」トリガーで追加して公開する。同意モード v2 の初期値（EEA・英国・スイスは拒否、それ以外は許可）はサイト側で送っているので、GTM 側で同意の初期値タグを追加する必要はない。
   - GTM では **「カスタム HTML」タグを使わない**（入力欄の内容を読めてしまうため）。GA4 の拡張計測の「フォーム操作」は、フォームの ID と名前だけを送り、入力値は送らない。
   - **Cloudflare Web Analytics（任意）**: Cloudflare ダッシュボード → Web Analytics → サイトを追加し、表示されたトークンを GitHub の Variables に `PUBLIC_CF_ANALYTICS_TOKEN` として登録する。
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

## 広告・GTM を有効にしたときの CSP

広告・解析を使わないビルドでは、CSP で自サイト以外への通信をすべて禁止しています。AdSense または GTM（`PUBLIC_GTM_ID`）を有効にすると多数の Google ドメインへの通信が必要になるため、`connect-src` などを `https:` に広げます（`scripts/postbuild.mjs`）。その場合も、入力データを送らないことはコードの静的チェックと E2E（外部タグなしビルドで外部通信ゼロ）で担保しています。
