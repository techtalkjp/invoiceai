# InvoiceAI

フリーランス・小規模チーム向けの請求書管理アプリ。freee 請求書連携による月次請求業務の効率化と、タイムシート管理機能を提供。

## 機能

### 請求書管理（要ログイン）

- **月次請求管理**: クライアントごとの請求書作成状況を一覧表示
- **freee 連携**: freee 請求書 API で請求書を自動作成・更新
- **稼働時間管理**: スタッフの稼働時間を記録・集計
- **タイムシート PDF**: 稼働報告書 PDF を自動生成
- **メールテンプレート**: 請求書送付メールのテンプレート生成

### タイムシート Playground（ログイン不要）

スプレッドシート風のタイムシート入力デモ。`/playground` でアクセス可能。

- キーボードナビゲーション（矢印キー、Tab、Enter でセル移動）
- 柔軟な時間入力（`9` → 09:00、`930` → 09:30、`+1h` → 基準時間+1時間）
- ドラッグ選択・コピー＆ペースト
- 平日のみペースト（土日祝を除外）
- PDF 出力（稼働報告書）
- 日本の祝日対応

詳細: [docs/playground-ux-patterns.md](docs/playground-ux-patterns.md)

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フレームワーク | React Router v7 (framework mode) |
| データベース | SQLite (Turso) + Kysely |
| 認証 | better-auth |
| PDF 生成 | @react-pdf/renderer |
| UI | Tailwind CSS v4 + shadcn/ui + Radix UI |
| フォーム | conform + zod |

## セットアップ

### 1. 依存パッケージのインストール

```bash
pnpm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

必要な環境変数:

```env
# Turso Database
DATABASE_URL=
DATABASE_AUTH_TOKEN=

# better-auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:5173

# Gemini (オプション)
GOOGLE_GENERATIVE_AI_API_KEY=
```

### 3. データベースのセットアップ

```bash
pnpm db:push
```

### 4. 開発サーバー起動

```bash
pnpm dev
```

http://localhost:5173 でアクセス可能。

## 画面構成

| パス | 説明 |
|------|------|
| `/` | トップページ（ログイン/新規登録） |
| `/playground` | タイムシート Playground |
| `/org/:slug` | 組織ダッシュボード |
| `/org/:slug/invoices` | 月次請求一覧 |
| `/org/:slug/invoices/create` | 請求書作成 |
| `/org/:slug/work-hours` | 稼働時間入力 |
| `/org/:slug/clients` | クライアント管理 |
| `/org/:slug/settings` | 組織設定 |
| `/admin` | 管理画面 |

## 開発コマンド

```bash
pnpm dev          # 開発サーバー
pnpm build        # ビルド
pnpm start        # 本番サーバー起動
pnpm typecheck    # 型チェック
pnpm lint         # Lint (Biome)
pnpm format       # フォーマットチェック (Prettier)
pnpm test         # テスト (Vitest)
pnpm db:push      # DBスキーマ適用
pnpm db:types     # DB型生成
```

## ディレクトリ構成

```
invoiceai/
├── app/                      # React Router アプリ
│   ├── components/           # 共通コンポーネント (shadcn/ui)
│   ├── lib/                  # ユーティリティ・DB・認証
│   └── routes/               # ルートコンポーネント
│       ├── index.tsx         # トップページ
│       ├── playground/       # タイムシート Playground
│       ├── auth/             # 認証 (signin/signup)
│       ├── admin/            # 管理画面
│       └── org.$orgSlug/     # 組織関連
│           ├── invoices/     # 請求書
│           ├── clients/      # クライアント
│           ├── work-hours/   # 稼働時間
│           └── settings/     # 設定
├── src/                      # CLI ツール（レガシー）
├── db/                       # SQLite データベース
├── docs/                     # ドキュメント
└── public/                   # 静的アセット
```

## CLI コマンド（レガシー）

```bash
pnpm cli:invoice   # 請求書作成
pnpm cli:auth      # freee 認証
pnpm cli:google    # Google 認証
pnpm cli:freee     # freee 請求書一覧
```

## ライセンス

ISC
