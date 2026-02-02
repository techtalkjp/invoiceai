# InvoiceAI

AI を活用した請求書管理アプリ。フリーランス・小規模チーム向けに、freee 請求書連携で月次請求業務を効率化。

## 機能

- **月次請求管理**: クライアントごとの請求書作成状況を一覧表示
- **freee 連携**: freee 請求書 API で請求書を自動作成・更新
- **稼働時間管理**: スタッフの稼働時間を記録・集計
- **タイムシート PDF**: 稼働報告書 PDF を自動生成（日本語フォント対応）
- **メールテンプレート**: 請求書送付メールのテンプレート生成

## 技術スタック

- **フレームワーク**: React Router v7 (framework mode)
- **データベース**: SQLite + Kysely
- **認証**: better-auth (freee OAuth 連携)
- **PDF 生成**: @react-pdf/renderer
- **UI**: Tailwind CSS + shadcn/ui

## セットアップ

### 1. 依存パッケージのインストール

```bash
pnpm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成:

```bash
cp .env.example .env
```

必要な環境変数:

```env
# freee API
FREEE_API_CLIENT_ID=your_client_id
FREEE_API_CLIENT_SECRET=your_client_secret

# better-auth
BETTER_AUTH_SECRET=your_secret_key
BETTER_AUTH_URL=http://localhost:5173

# Database
DATABASE_URL=file:./db/app.db
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

## 主要な画面

| パス | 説明 |
|------|------|
| `/` | ダッシュボード |
| `/org/:slug/invoices` | 月次請求一覧 |
| `/org/:slug/invoices/create` | 請求書作成 |
| `/org/:slug/work-entries` | 稼働時間入力 |
| `/org/:slug/settings` | 組織設定・クライアント管理 |

## 月次請求ワークフロー

1. **稼働時間入力**: `/org/:slug/work-entries` でスタッフが稼働時間を記録
2. **請求書作成**: `/org/:slug/invoices` で月を選択し、クライアントごとに請求書を作成
3. **タイムシート PDF**: 時間制クライアントは稼働報告書 PDF をダウンロード可能
4. **freee 確認**: 外部リンクボタンから freee の請求書詳細画面へ遷移
5. **メール送付**: メールテンプレートをコピーして送付

## CLI コマンド（レガシー）

CLI ツールも引き続き利用可能:

```bash
# クライアント一覧
pnpm invoice list

# 稼働時間確認
pnpm invoice hours <client_id> <YYYY-MM>

# 請求書作成（ドライラン）
pnpm invoice create <client_id> <YYYY-MM> --dry-run

# 請求書作成
pnpm invoice create <client_id> <YYYY-MM>
```

## 開発コマンド

```bash
# 開発サーバー
pnpm dev

# ビルド
pnpm build

# 型チェック
pnpm typecheck

# Lint
pnpm lint

# フォーマット
pnpm format

# テスト
pnpm test

# DBスキーマ適用
pnpm db:push

# DB型生成
pnpm db:types
```

## ディレクトリ構成

```
freee-invoices/
├── app/                    # React Router アプリ
│   ├── assets/fonts/       # 日本語フォント (Noto Sans JP)
│   ├── components/         # 共通コンポーネント
│   ├── lib/                # ユーティリティ・DB
│   ├── routes/             # ルートコンポーネント
│   │   └── org.$orgSlug/
│   │       ├── invoices/   # 請求書関連
│   │       │   ├── +pdf/   # PDF テンプレート
│   │       │   └── ...
│   │       ├── settings/   # 設定関連
│   │       └── work-entries/ # 稼働時間
│   └── utils/              # ヘルパー関数
├── src/                    # CLI ツール（レガシー）
├── db/                     # SQLite データベース
├── docs/                   # API ドキュメント
└── output/                 # 生成された PDF
```

## freee API 制限事項

- 請求書 PDF はAPI経由でダウンロードできません（Web UI のみ）
- 請求書詳細画面への外部リンクで対応しています

## トラブルシューティング

### freee トークン期限切れ

設定画面から freee 再認証を実行してください。

### PDF 生成エラー

日本語フォント `app/assets/fonts/NotoSansJP-Regular.ttf` が必要です。
[Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) からダウンロードしてください。

### データベースエラー

```bash
pnpm db:push
```

でスキーマを再適用してください。
