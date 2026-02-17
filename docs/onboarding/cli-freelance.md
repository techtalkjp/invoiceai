# CLI オンボーディングフロー設計

> **ステータス: 設計中（未実装）**
>
> このドキュメントはフリーランス向けの新しいオンボーディング体験の設計仕様です。
> 既存の `invoiceai setup` / `invoiceai sync` とは別フローとして実装予定。

### 既存実装との関係

|                | 既存（setup/sync）                                | 本設計（オンボーディング）                      |
| -------------- | ------------------------------------------------- | ----------------------------------------------- |
| ペルソナ       | B: 受託会社管理者                                 | A: フリーランス                                 |
| データ取得     | GitHub App Installation Token（サーバーサイド）   | ローカル git log + gh CLI（クライアントサイド） |
| リポジトリ検出 | `~/work` 等を再帰スキャン                         | カレントディレクトリの `.git` を検出            |
| 設定構造       | `credentials.json` + `settings.json`（2ファイル） | 単一 JSON に統合（後述）                        |
| コマンド体系   | `login` / `setup` / `sync` を個別実行             | `invoiceai` 1コマンドで状態に応じて自動実行     |

### 既存から流用できる部分

- 認証フロー（`cliLogin()` — ブラウザ認証 + ローカルサーバー）
- API クライアント（`fetchMe()`, `fetchClients()`）
- `ActivityRecord` 型と `insertActivities()` のサーバーサイド保存
- 稼働推定ロジック（`suggestWorkEntriesFromActivities()`）
- 設定ファイルの保存先（`~/.config/invoiceai/`）

---

## ターゲットユーザー

クライアント企業の private repo で毎日作業しているフリーランスエンジニア。
月末の稼働集計・請求書作成が面倒で、自動化したい。

## ゴール

**作業リポジトリで `invoiceai` を1回実行するだけで、過去の稼働サマリーが見える。**
2分以内に wow を得られること。

## フロー全体像

```
npx invoiceai
```

作業リポジトリで1行実行するだけ。`npm install -g` も可。

---

## 詳細フロー

### Phase 1: ログイン（初回のみ）

```
$ invoiceai

InvoiceAI へようこそ！
ブラウザでログインしてください...

(ブラウザが自動で開く → サインアップ or ログイン)

✓ ログイン完了！ (coji@example.com)
```

- 未ログインならブラウザ認証フローを起動
- 既にログイン済みならスキップ
- アカウントがなければブラウザ側でサインアップ → そのまま認証完了

### Phase 2: リポジトリ検出

```
✓ Git リポジトリを検出しました
  リモート: github.com/client-corp/awesome-project
```

- `.git` ディレクトリを検出
- `git remote get-url origin` でリモート URL を取得
- `.git` がない場合はエラー: 「Git リポジトリ内で実行してください」

### Phase 2.5: GitHub CLI チェック（自動）

```
✓ gh CLI を検出しました（PR・レビュー・コメントも取得します）
```

or

```
ℹ gh CLI が見つかりません（コミットのみ取得します）
  gh auth login で GitHub 連携するとより詳細な稼働データが取得できます
```

- `gh auth status` を実行して認証状態を確認
- 認証済み → PR/レビュー/コメントも収集対象に
- 未インストール or 未認証 → コミットのみで続行（エラーにはしない）
- `gh` の状態は設定ファイルに保存しない（毎回チェック）

### Phase 3: 組織選択 or 作成

```
どの組織に紐付けますか？

  1. coji's org（既存）
  2. + 新しい組織を作成

> 1
```

- サーバーから所属組織一覧を取得
- 1つしかなければ自動選択
- 組織がなければ作成フローへ（組織名を入力）

### Phase 4: クライアント選択 or 作成

```
どのクライアントの仕事ですか？

  1. 株式会社A（既存）
  2. 株式会社B（既存）
  3. + 新しいクライアントを作成

> 3

クライアント名: 株式会社クライアント
✓ クライアントを作成しました
```

- サーバーからクライアント一覧を取得
- 既存があればリストから選択
- なければ名前だけで即作成（詳細は Web で後から設定）

### Phase 5: 初回同期（wow ポイント）

**gh CLI あり:**

```
✓ 設定完了！

過去30日のアクティビティを取得中...
  コミット取得中... ✓ 47件
  PR・レビュー取得中... ✓ 23件
━━━━━━━━━━━━━━━━━━━━ 100%

🎉 稼働データを生成しました！

  2月の稼働サマリー:
    稼働日数: 18日
    コミット: 47件
    PR: 8件（マージ5、レビュー3）
    コメント: 12件
    推定稼働: 142.5h

  Web で詳細を確認 → https://app.invoiceai.dev/org/xxx/work-hours

次回以降は invoiceai sync で最新のアクティビティを同期できます。
```

**gh CLI なし:**

```
✓ 設定完了！

過去30日のアクティビティを取得中...
  コミット取得中... ✓ 47件
━━━━━━━━━━━━━━━━━━━━ 100%

🎉 稼働データを生成しました！

  2月の稼働サマリー:
    稼働日数: 18日
    コミット: 47件
    推定稼働: 142.5h

  💡 gh auth login で GitHub 連携すると PR・レビュー情報も取得できます
  Web で詳細を確認 → https://app.invoiceai.dev/org/xxx/work-hours

次回以降は invoiceai sync で最新のアクティビティを同期できます。
```

- ローカル git log からコミットを収集
- `gh` CLI が利用可能なら PR・レビュー・コメントも収集
- `gh` なしの場合はコミットのみで続行し、GitHub 連携の案内を表示
- サーバーに送信 → サーバーが稼働時間を推定しサマリーを応答に含めて返す
- CLI はサーバーの応答をそのまま表示
- Web UI への導線を出す

---

## 2回目以降

```
$ invoiceai sync

github.com/client-corp/awesome-project を同期中...
  コミット: 5件 (abc123..def456)
  PR・レビュー: 3件 (2/15〜)
✓ 8件の新しいアクティビティを同期しました (2/15 〜 2/17)
```

- 複数リポジトリが設定済みなら全部同期

### 差分管理

| データ種別           | 差分管理方法                                 |
| -------------------- | -------------------------------------------- |
| コミット             | `lastSyncCommit`（hash）以降の `git log`     |
| PR/レビュー/コメント | `lastSyncedAt`（日時）以降を `gh api` で取得 |

- 同期成功時に `lastSyncCommit` と `lastSyncedAt` を設定ファイルに更新
- `gh` が前回使えて今回使えない場合 → コミットのみ同期（PR 等はスキップ、警告表示）

---

## 2つ目のリポジトリを追加

```
$ cd ~/work/another-project
$ invoiceai

✓ ログイン済み (coji@example.com)
✓ Git リポジトリを検出しました
  リモート: github.com/other-corp/another-project

どのクライアントの仕事ですか？
  1. 株式会社クライアント
  2. + 新しいクライアントを作成

> 2
クライアント名: 株式会社Other
✓ クライアントを作成しました

過去30日のアクティビティを取得中...
...
```

- ログイン済みならスキップ
- 組織が1つなら自動選択
- クライアント選択から始まる（フローが短くなる）

---

## 設計方針

### 設定の保存場所

`~/.config/invoiceai/` に保存する。クライアントの repo にファイルを入れたくない。

```json
{
  "auth": {
    "serverUrl": "https://app.invoiceai.dev",
    "token": "eyJhbGci..."
  },
  "repos": {
    "/Users/coji/work/client-project": {
      "orgSlug": "coji-org",
      "clientId": "xxx",
      "remoteUrl": "github.com/client-corp/awesome-project",
      "lastSyncCommit": "abc123",
      "lastSyncedAt": "2026-02-15T10:30:00Z"
    }
  }
}
```

- `auth.token`: ブラウザ認証で取得したセッショントークン
- `lastSyncCommit`: コミットの差分同期に使用（この hash 以降を送信）
- `lastSyncedAt`: PR/レビュー/コメントの差分同期に使用（この日時以降を取得）
- `gh` CLI の状態は保存しない（毎回 `gh auth status` でチェック）

### sync トリガー

手動 `invoiceai sync` のみ。自動化は将来検討。

### 引数なし `invoiceai` の挙動

| 状態                              | 挙動                                  |
| --------------------------------- | ------------------------------------- |
| 未ログイン                        | → ログインフロー                      |
| ログイン済み + 未設定リポジトリ   | → リポジトリ設定フロー                |
| ログイン済み + 設定済みリポジトリ | → `invoiceai sync` と同じ（差分同期） |

状態に応じて最適なアクションを自動実行。常に `invoiceai` だけで OK。

### 既に Web で使い始めてる人

CLI を後から追加する場合も同じフローで動く（ログイン → リポジトリ検出 → 既存クライアント選択）。
Web UI の設定画面にも CLI セットアップのガイダンスを表示する。

---

## 収集するデータ

### ローカル git から収集

| データ                               | 取得方法            |
| ------------------------------------ | ------------------- |
| コミット（hash, message, timestamp） | `git log`           |
| 変更ファイル数 / 行数                | `git log --numstat` |

### GitHub から収集（`gh` CLI 経由）

| データ                     | 取得方法           |
| -------------------------- | ------------------ |
| PR（作成/マージ/クローズ） | `gh api` (GraphQL) |
| レビュー                   | `gh api` (GraphQL) |
| Issue コメント             | `gh api` (GraphQL) |

PR・レビュー・コメントはローカル git log だけでは取れないため、
`gh` CLI（GitHub CLI）を利用して取得する。

- `gh` がインストール済み & `gh auth status` で認証済みなら、`gh api` で GraphQL クエリを実行
- `gh` が未インストール or 未認証の場合はスキップ（コミットのみ収集）
- ユーザー自身の認証情報を使うため、クライアント企業側に GitHub App を入れてもらう必要はない
- OAuth App の登録・管理も不要（`gh` の認証基盤に乗る）

### 収集しないもの

- ソースコード本体（プライバシー・セキュリティ上の配慮）
- diff の内容

---

## 稼働時間の推定ロジック

既存の playground と同じロジック（`+work-entry-suggest.server.ts`）を使用する。

### ルール

1. アクティビティを日付ごとにグループ化
2. **開始時刻** = その日の最初のアクティビティの時刻（下限 6:00）
3. **終了時刻** = その日の最後のアクティビティの時刻（上限 29:59 = 翌朝5:59）
4. **休憩** = 稼働が6時間以上なら60分、それ以下は0分
5. 土日祝・アクティビティなしの日はスキップ
6. 0:00〜5:59 のアクティビティは前日の深夜扱い（30時制）

### 作業概要の生成

- AI（Gemini Flash Lite）でコミットメッセージ等からクライアント向けの日本語要約を生成
- 30文字以内、1行
- API 失敗時はルールベースでフォールバック（「3commits(repo) / PR: タイトル」形式）

---

## Sync API 設計

### `POST /api/cli/sync`

CLI からアクティビティを送信し、サーバーが稼働サマリーを返す。

**リクエスト:**

```json
{
  "orgSlug": "coji-org",
  "clientId": "xxx",
  "remoteUrl": "github.com/client-corp/awesome-project",
  "activities": [
    {
      "eventType": "commit",
      "eventDate": "2026-02-15",
      "eventTimestamp": "2026-02-15T10:30:00+09:00",
      "title": "fix: resolve login issue",
      "repo": "client-corp/awesome-project",
      "metadata": {
        "hash": "abc123",
        "filesChanged": 3,
        "additions": 42,
        "deletions": 10
      }
    }
  ]
}
```

**レスポンス:**

```json
{
  "synced": 8,
  "summary": {
    "workDays": 3,
    "commits": 5,
    "prs": 2,
    "reviews": 1,
    "comments": 0,
    "estimatedHours": 24.5,
    "period": { "from": "2026-02-15", "to": "2026-02-17" }
  },
  "webUrl": "https://app.invoiceai.dev/org/coji-org/work-hours"
}
```

- CLI はレスポンスの `summary` をそのまま整形して表示する
- 稼働時間の推定・AI 要約はサーバー側で実行
- 認証: `Authorization: Bearer <token>`（設定ファイルの `auth.token`）

---

## 実装の優先順位

1. **`invoiceai`（引数なし）** — ログイン + リポジトリ設定 + 初回同期の統合フロー
2. **`invoiceai sync`** — 差分同期
3. **サーバー API** — `POST /api/cli/sync`（上記設計）
4. **Web UI 連携** — 同期されたアクティビティを稼働入力画面で表示・提案
