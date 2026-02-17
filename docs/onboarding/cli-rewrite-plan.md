# CLI 新仕様 書き直し計画

## Context

a-freelance.md の設計に基づき、CLI を新仕様に全面書き直す。後方互換性は不要。

**現状の問題:**

- 既存 CLI の sync は GitHub App Installation Token（サーバーサイド）前提で、クライアント Org の private repo に対応できない
- コマンド体系が `login` / `setup` / `sync` と分かれており、フリーランスには煩雑
- 設定ファイルが2つに分かれている（credentials.json + settings.json）
- リポジトリ検出が再帰スキャン方式で、新仕様の「カレントディレクトリの .git のみ」と異なる

**新仕様のゴール:**
「作業リポジトリで `invoiceai` を1回実行するだけで、過去の稼働サマリーが見える」

## 変更サマリー

| 項目           | 旧                                               | 新                                             |
| -------------- | ------------------------------------------------ | ---------------------------------------------- |
| コマンド       | `login` / `setup` / `sync` / `whoami` / `logout` | `invoiceai`（自動判定）+ `invoiceai sync`      |
| 設定ファイル   | credentials.json + settings.json                 | 単一 config.json                               |
| リポジトリ検出 | `~/work` 等を再帰スキャン                        | カレントディレクトリの `.git` のみ             |
| 同期方式       | GitHub App Installation Token（サーバーサイド）  | ローカル git log + gh CLI → POST /api/cli/sync |

## 実装ステップ

### Step 1: 設定ファイル基盤 — `src/services/cli-config.ts`

全面書き換え。新しい型定義と読み書きロジック。

```typescript
interface RepoConfig {
  orgSlug: string
  clientId: string
  remoteUrl: string
  lastSyncCommit: string | null
  lastSyncedAt: string | null
}

interface CliConfig {
  auth: { serverUrl: string; token: string }
  repos: Record<string, RepoConfig> // key = absolute repo path
}
```

主要 export:

- `loadConfig()` / `saveConfig()` — 単一 config.json の読み書き
- `saveAuth(token, serverUrl)` — ログイン時に auth だけ保存
- `getRepoConfig(repoPath)` / `saveRepoConfig(repoPath, config)` — リポジトリ単位の設定管理
- `updateSyncState(repoPath, lastSyncCommit, lastSyncedAt)` — 同期後の状態更新
- `deleteConfig()` — ログアウト時に削除

保存先: `~/.config/invoiceai/config.json`（旧ファイルは無視）

テスト: `src/services/cli-config.test.ts`

### Step 2: Git ユーティリティ — `src/services/cli-git.ts`（新規）

カレントディレクトリの .git 検出、git log からコミット収集。

主要 export:

- `detectGitRepo(cwd?)` → `{ rootPath, remoteUrl } | null`
- `getCommitsSince(repoPath, sinceHash)` → `GitCommit[]`（hash, date, message, filesChanged, additions, deletions）
- `normalizeRemoteUrl(raw)` → `github.com/owner/repo` 形式に正規化

git コマンド: `git rev-parse --show-toplevel`, `git remote get-url origin`, `git log --format=... --numstat`

テスト: `src/services/cli-git.test.ts`（normalizeRemoteUrl の単体テスト + git log パースのモックテスト）

### Step 3: gh CLI ラッパー — `src/services/cli-gh.ts`（新規）

`gh` CLI が使えるかチェック + PR/レビュー/コメントの取得。

主要 export:

- `checkGhAuth()` → `{ authenticated, username }`
- `fetchPRsSince(repo, since)` → PR 一覧
- `fetchReviewsSince(repo, since, username)` → レビュー一覧
- `fetchCommentsSince(repo, since, username)` → コメント一覧

すべて `execFileSync('gh', [...])` で実行。gh 未インストール/未認証時はエラーにせず空配列を返す。

テスト: `src/services/cli-gh.test.ts`

### Step 4: 対話プロンプト — `src/services/cli-prompts.ts`（新規）

現在 `cli.ts` にインラインで書かれている readline ロジックを分離。

主要 export:

- `askQuestion(question)` → `string`
- `askYesNo(question)` → `boolean`
- `selectFromList(items, label, prompt)` → 選択された item
- `askClientName()` → `string`

### Step 5: API クライアント拡張 — `src/services/cli-api.ts`

既存の `fetchMe()`, `fetchClients()` を維持しつつ、新 config に合わせて `getAuthHeaders()` / `getServerUrl()` を修正。以下を追加:

- `syncActivities(request)` → `SyncResponse`（POST /api/cli/sync）
- `createClient(orgId, name)` → `{ id, name }`（POST /api/cli/create-client）
- `createOrg(name)` → `{ id, slug, name }`（POST /api/cli/create-org）

### Step 6: 同期ロジック — `src/services/cli-sync.ts`（新規）

git + gh のデータを `ActivityRecord` 型（`app/lib/activity-sources/types.ts` で定義済み）に変換してサーバーに送信。

主要 export:

- `collectActivities(repoPath, repoConfig, ghStatus)` → `ActivityRecord[]`
- `printSyncSummary(response)` → ターミナルにサマリー表示

内部で `cli-git.ts` の `getCommitsSince()` と `cli-gh.ts` の `fetchPRsSince()` 等を組み合わせる。

テスト: `src/services/cli-sync.test.ts`

### Step 7: メイン CLI — `src/cli.ts`

全面書き換え。cac で2コマンドのみ定義:

```
invoiceai          → 状態に応じて自動実行
invoiceai sync     → 差分同期
```

**状態判定ロジック:**

1. config なし or auth なし → ログインフロー
2. auth あり + カレントディレクトリが未設定リポジトリ → セットアップフロー
3. auth あり + 設定済みリポジトリ → sync フロー
4. API が 401 を返した場合 → 自動で再ログインフローに入り、元の操作を続行

**セットアップフロー（Phase 2〜5）:**

1. `detectGitRepo()` でリポジトリ検出
2. `checkGhAuth()` で gh CLI チェック（情報表示のみ）
3. `fetchMe()` → 組織選択 or 作成（1つなら自動選択）
4. `fetchClients()` → クライアント選択 or 作成（名前のみで即作成）
5. 初回同期 → `collectActivities()` → `syncActivities()` → `printSyncSummary()`
6. 設定保存

**sync フロー:**

1. `collectActivities()` で差分収集
2. `syncActivities()` でサーバーに送信
3. `updateSyncState()` で設定更新
4. `printSyncSummary()` で結果表示

### Step 8: Web API エンドポイント（3つ新規）

#### `app/routes/api/cli/sync.ts` — POST /api/cli/sync

- 認証: Bearer トークン（`auth.api.getSession()`）
- リクエスト: `{ orgSlug, clientId, remoteUrl, activities[] }`
- 処理:
  1. orgSlug → organization 解決 + membership チェック
  2. clientId 検証
  3. `insertActivities()` で DB 挿入（既存の `activity-queries.server.ts` を流用）
  4. サマリー計算（workDays, commits, prs, reviews, comments, estimatedHours, period）
- レスポンス: `{ synced, summary, webUrl }`
- サマリーは差分ではなく当月の累計値を返す（2回目以降も毎回「wow」を維持するため）

estimatedHours: 既存の `suggestWorkEntriesFromActivities()` ロジック（a-freelance.md の「稼働時間の推定ロジック」に記載のルール）を使用する。アクティビティを日付ごとにグループ化し、最初/最後のタイムスタンプから開始・終了時刻を推定、6時間超なら60分休憩を差し引く。

#### `app/routes/api/cli/create-client.ts` — POST /api/cli/create-client

- リクエスト: `{ organizationId, name }`
- 処理: client テーブルに INSERT（billingType = 'time', hourlyRate = null）
- レスポンス: `{ id, name }`

#### `app/routes/api/cli/create-org.ts` — POST /api/cli/create-org

- リクエスト: `{ name }`
- 処理: organization 作成 + ユーザーを owner として追加。slug は name から自動生成
- レスポンス: `{ id, slug, name }`

### Step 9: 不要ファイル削除 + エントリポイント整理

- `src/sync-activities.ts` — 削除（サーバーサイド cron は `app/routes/api/activity-sync.ts` + `src/services/activity-sync.ts` で維持）
- `src/cli-entry.ts` — 削除（`src/cli.ts` を直接実行）
- `package.json` の `cli:activity` スクリプト更新

### Step 10: 認証フロー微修正 — `src/services/cli-auth.ts`

`saveConfig()` → `saveAuth()` に変更（設定構造の変更に対応）。ロジック自体はそのまま。

## 主要ファイル一覧

| ファイル                              | 操作         | 行数目安 |
| ------------------------------------- | ------------ | -------- |
| `src/services/cli-config.ts`          | 全面書き換え | ~120行   |
| `src/services/cli-config.test.ts`     | 書き換え     | ~80行    |
| `src/services/cli-git.ts`             | 新規         | ~100行   |
| `src/services/cli-git.test.ts`        | 新規         | ~80行    |
| `src/services/cli-gh.ts`              | 新規         | ~120行   |
| `src/services/cli-gh.test.ts`         | 新規         | ~60行    |
| `src/services/cli-prompts.ts`         | 新規         | ~60行    |
| `src/services/cli-sync.ts`            | 新規         | ~100行   |
| `src/services/cli-sync.test.ts`       | 新規         | ~80行    |
| `src/services/cli-api.ts`             | 拡張         | ~150行   |
| `src/services/cli-auth.ts`            | 微修正       | ~85行    |
| `src/cli.ts`                          | 全面書き換え | ~300行   |
| `app/routes/api/cli/sync.ts`          | 新規         | ~100行   |
| `app/routes/api/cli/create-client.ts` | 新規         | ~40行    |
| `app/routes/api/cli/create-org.ts`    | 新規         | ~50行    |
| `src/sync-activities.ts`              | 削除         | —        |
| `src/cli-entry.ts`                    | 削除         | —        |

## 変更しないファイル

- `src/adapters/cli.ts` — openBrowser() そのまま
- `src/adapters/env.ts` — そのまま
- `src/core/` — すべてそのまま
- `src/services/activity-sync.ts` — サーバーサイド cron 用（CLI とは別系統）
- `src/services/freee-*.ts`, `src/services/google-*.ts`, `src/services/invoice-service.ts` — 変更不要
- `app/routes/auth/cli-callback.tsx` — そのまま
- `app/routes/api/cli/me.ts` — そのまま
- `app/routes/api/cli/clients.ts` — そのまま

## 既存コード流用

- `cliLogin()` (`cli-auth.ts`): ローカルHTTPサーバー + ブラウザ認証のロジックをほぼそのまま流用
- `fetchMe()`, `fetchClients()` (`cli-api.ts`): API 呼び出しロジックをそのまま流用
- `insertActivities()` (`app/lib/activity-sources/activity-queries.server.ts`): DB 挿入ロジックを sync API から呼び出し
- `ActivityRecord` 型 (`app/lib/activity-sources/types.ts`): commit/pr/review/issue_comment の型定義をそのまま使用
- `openBrowser()` (`src/adapters/cli.ts`): そのまま

## 検証方法

1. `pnpm typecheck && pnpm lint` — 型チェック + lint
2. `pnpm test` — 新規テスト含む全テスト
3. 手動テスト:
   - `pnpm cli`（引数なし）→ ログインフロー → 組織選択 → クライアント選択 → 初回同期
   - `pnpm cli sync` → 差分同期
   - 別のリポジトリに移動して `pnpm cli` → 2つ目のリポジトリ追加
   - gh CLI なしの環境で実行 → コミットのみで同期
