# 従量課金プロバイダ連携

## 設計方針

プロバイダをプラグイン的に追加できる構造にする。各プロバイダは共通インターフェースを実装し、`provider_config` の JSON で接続設定を保持する。

返却値は `{ amount: string (decimal), currency: string }` の形式。浮動小数点の精度を失わないよう decimal 文字列で返す。

## Google Cloud Billing（BigQuery Standard Export）

### 概要

Cloud Billing API v1 では実績コストを取得できない。**BigQuery Billing Export が唯一の公式な方法**。

### セットアップ状況

- [x] Billing Export 有効化済み（2026-04-04、Standard usage cost）
- Billing Account: `012813-078E5D-19D7AB`
- BigQuery: `techtalk.techtalk` データセット
- テーブル名: 自動生成（`gcp_billing_export_v1_012813_078E5D_19D7AB` 形式、要確認）

### 認証

各ユーザーが自分の GCP 環境でサービスアカウントを作成し、アプリの設定画面から JSON キーをアップロードする。

**ユーザー向けセットアップ手順**（アプリ内のヘルプとして表示）:

1. GCP コンソール → IAM と管理 → サービスアカウント
2. 「サービスアカウントを作成」→ 名前は任意（例: `invoiceai-billing-reader`）
3. ロール付与: `BigQuery データ閲覧者` + `BigQuery ジョブユーザー`
4. 作成後、鍵を管理 → 新しい鍵を作成 → JSON
5. ダウンロードした JSON ファイルをアプリの設定画面でアップロード

**アプリ側の保存**:

- アップロードされた JSON は `provider_credential` テーブルに暗号化して保存
- 既存の `activity_source.credentials` と同じ暗号化方式（`ENCRYPTION_KEY`）を使用

### provider_config の構造

| フィールド      | 必須 | 説明                                                                   |
| --------------- | ---- | ---------------------------------------------------------------------- |
| bigqueryProject | ○    | BigQuery のプロジェクトID                                              |
| bigqueryDataset | ○    | データセット名                                                         |
| bigqueryTable   | ○    | Billing Export テーブル名                                              |
| projectId       | ○    | コスト集計対象の GCP プロジェクトID                                    |
| serviceFilter   | -    | サービス名フィルタ（例: `"Cloud AI API"`）。未指定ならプロジェクト全体 |

設定例:

- projectId: `dailove-search`
- serviceFilter: Gemini API のみに絞るなら該当サービス名を指定

### 集計基準

- **`usage_start_time` ベース（利用月基準）** を採用
- GCP の `invoice.month` は請求書基準で、月跨ぎや遅延計上で利用月とズレることがあるため
- クレジット（無料枠・割引等）を差し引いた実質コストを計算: `SUM(cost) + SUM(credits)`
- 通貨は Billing Account の設定に依存。日本アカウントでは **JPY**（円建て）で返る。返却値の `currency` フィールドで判定する

### 確定タイミング

- 月末締め後、全データ確定まで数日かかる
- **翌月5日以降** に前月分を取得するのが安全

### 必要パッケージ

`@google-cloud/bigquery`

## 将来のプロバイダ候補

| プロバイダ | API               | 備考                             |
| ---------- | ----------------- | -------------------------------- |
| Vercel     | Usage API         | 従量課金に移行した場合に対応     |
| AWS        | Cost Explorer API | アカウント・サービス別に取得可能 |
| Stripe     | Billing API       | サブスク課金の利用額取得         |
