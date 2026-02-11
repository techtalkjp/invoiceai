# GitHub アクティビティ連携 & AI 稼働時間提案

## 概要

GitHub のアクティビティ（コミット・PR・レビュー・Issue）を自動取得し、
それをもとに稼働時間エントリを AI またはルールベースで提案する機能。

## アーキテクチャ

```
GitHub ──webhook/cron──> activity テーブル ──> AI提案 ──> work_entry
         │                                      │
         ├─ REST API (push events)              ├─ LLM (Gemini Flash)
         └─ GraphQL API (commits/PRs/reviews)   └─ ルールベース (集計)
```

## DB スキーマ (3 テーブル追加)

### activity_source

外部サービスの認証情報を保持。PAT は AES-256-GCM で暗号化して保存。

| カラム          | 説明                                      |
| --------------- | ----------------------------------------- |
| id              | PK                                        |
| organization_id | 組織 FK                                   |
| user_id         | ユーザー FK                               |
| source_type     | `github` / `google_calendar` / `wakatime` |
| credentials     | 暗号化済み PAT                            |
| config          | JSON (将来用)                             |
| is_active       | 有効フラグ                                |

### activity

取得したアクティビティイベントを格納。

| カラム          | 説明                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| id              | PK                                                                        |
| organization_id | 組織 FK                                                                   |
| user_id         | ユーザー FK                                                               |
| source_type     | ソース種別                                                                |
| event_type      | `commit` / `pr_opened` / `pr_merged` / `review` / `issue_opened` / `push` |
| event_date      | 日付 (YYYY-MM-DD)                                                         |
| event_timestamp | タイムスタンプ                                                            |
| repo            | リポジトリ名 (owner/repo)                                                 |
| title           | イベントタイトル                                                          |
| metadata        | JSON (詳細情報)                                                           |

### client_source_mapping

クライアントとリポジトリの紐付け。

| カラム            | 説明            |
| ----------------- | --------------- |
| id                | PK              |
| client_id         | クライアント FK |
| source_type       | ソース種別      |
| source_identifier | リポジトリ名等  |

## 実装ファイル構成

### データ層 (`app/lib/activity-sources/`)

- **types.ts** — `ActivityRecord` 型定義
- **encryption.server.ts** — AES-256-GCM による PAT の暗号化/復号
- **github.server.ts** — GitHub REST + GraphQL API クライアント
  - `fetchGitHubUsername` / `fetchGitHubUserRepos` — REST API
  - `fetchGitHubActivities` — GraphQL でコミット/PR/レビューを一括取得
  - `parseGitHubPushEvent` — Webhook ペイロード解析
- **activity-queries.server.ts** — Kysely クエリ群
  - CRUD: `getActivitySource`, `upsertActivitySource`, `deleteActivitySource`
  - マッピング: `getClientSourceMappings`, `upsertClientSourceMapping`, `deleteClientSourceMapping`
  - アクティビティ: `insertActivities`, `getActivitiesByMonth`, `getActivitiesForClient`
  - ユーザー: `getActiveSourceUsers`

### API エンドポイント (`app/routes/api/`)

- **activity-sync.ts** — Cron 用同期エンドポイント (`CRON_SECRET` で認証)
- **github-webhook.ts** — GitHub Webhook 受信 (HMAC-SHA256 検証 → push イベント挿入)

### 設定 UI (`app/routes/org.$orgSlug/settings/`)

- **integrations.tsx** — 外部連携設定ページ
  - GitHub PAT の登録/削除/テスト
  - リポジトリ → クライアント紐付け管理
  - 手動同期トリガー
- **integrations.repos.ts** — GitHub リポジトリ一覧取得 API (Combobox 用)

### AI 提案 (`app/routes/org.$orgSlug/work-hours/`)

- **+ai-suggest.server.ts** — Gemini Flash による稼働時間提案
  - アクティビティからプロンプトを生成し LLM で推定
- **+work-entry-suggest.server.ts** — ルールベース提案
  - アクティビティ数・種別から稼働時間を決定論的に算出

### クライアント稼働時間 UI (`$clientId/`)

- **index.tsx** — 既存の `$clientId.tsx` をフォルダ構成に移行
- **ai-preview.tsx** — AI 提案プレビュー画面
  - 提案一覧の選択/編集/一括保存
  - 時間の自動調整 (重複回避)
- **+components/repo-mapping-panel.tsx** — リポジトリ紐付けパネル

### CLI & MCP (`src/`)

- **sync-activities.ts** — CLI メイン (`cac` ベース)
  - `sync` — GitHub アクティビティ同期
  - `activities` — アクティビティ一覧表示
  - `mcp` — MCP サーバー起動
- **cli-entry.ts** — bin エントリポイント
- **mcp-server.ts** — MCP サーバー (stdio)
  - ツール: `list_activities`, `list_clients`, `list_work_entries`, `save_work_entry`, `save_work_entries`, `get_monthly_summary`
- **services/activity-sync.ts** — 同期ビジネスロジック

## 環境変数 (追加分)

| 変数                    | 説明                                                      |
| ----------------------- | --------------------------------------------------------- |
| `ENCRYPTION_KEY`        | PAT 暗号化用 (base64 32バイト: `openssl rand -base64 32`) |
| `CRON_SECRET`           | Cron エンドポイント認証キー                               |
| `GITHUB_WEBHOOK_SECRET` | GitHub Webhook HMAC 検証用                                |

## 依存パッケージ (追加分)

- `@modelcontextprotocol/sdk` — MCP サーバー実装

## 実装状況

- [x] DB スキーマ設計
- [x] 暗号化ユーティリティ
- [x] GitHub API クライアント (REST + GraphQL)
- [x] アクティビティ DB クエリ
- [x] Webhook / Cron エンドポイント
- [x] 設定 UI (PAT 管理 + リポジトリマッピング)
- [x] AI 提案 (LLM + ルールベース)
- [x] AI プレビュー UI
- [x] CLI + MCP サーバー
- [x] スキーマ定義 (Zod)
- [ ] テスト
- [ ] エラーハンドリングの改善
- [ ] Google Calendar / WakaTime 対応
