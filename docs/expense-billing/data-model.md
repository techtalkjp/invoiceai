# データモデル: 月次経費請求

## 設計方針

- 金額は **INTEGER（cent / 銭単位）** または **TEXT（decimal文字列）** で保持。`REAL` は浮動小数点誤差があるため使わない
  - 金額: TEXT（例: `"45.00"`）— API からの値をそのまま保持、精度を失わない
  - 為替レート: TEXT（例: `"149.53"`）— 日銀の公表値をそのまま保持
  - 円換算額: INTEGER（円単位）— 端数処理後の確定値
- 通貨が JPY の場合（例: GCP の日本アカウント）は為替換算不要。金額をそのまま円額として使用
- 請求書に採用した値は `invoice_line`（既存テーブル）にスナップショットとして凍結する。`expense_record` は原データの取得結果であり、請求書確定後も再取得で更新される可能性がある

## テーブル設計

### expense_group（経費グループ）

請求書上で1明細行にまとめる単位。通貨・税率はグループが持ち、所属アイテムはすべて同一通貨。
税率が異なる経費を混在させたい場合はグループを分ける。

| カラム          | 型                          | 説明                                                                         |
| --------------- | --------------------------- | ---------------------------------------------------------------------------- |
| id              | TEXT PK                     | nanoid                                                                       |
| organization_id | TEXT FK → organization      | 組織                                                                         |
| client_id       | TEXT FK → client            | 対象クライアント                                                             |
| name            | TEXT NOT NULL               | 管理名（例: "サーバ通信費"）                                                 |
| invoice_label   | TEXT NOT NULL               | 請求書テンプレート                                                           |
| currency        | TEXT NOT NULL DEFAULT 'USD' | 通貨コード（グループの真実のソース）                                         |
| tax_rate        | INTEGER NOT NULL DEFAULT 10 | 税率（%）。freee API の `tax_rate` にそのまま渡す。10=課税, 8=軽減, 0=非課税 |
| sort_order      | INTEGER NOT NULL DEFAULT 0  | 請求書内の表示順                                                             |
| is_active       | INTEGER NOT NULL DEFAULT 1  | 有効フラグ                                                                   |
| created_at      | TEXT                        |                                                                              |
| updated_at      | TEXT                        |                                                                              |

`invoice_label` テンプレート変数:

- `{year}`, `{month}` — 対象年月
- `{amount_foreign}` — 外貨合計額
- `{currency}` — 通貨コード（例: "ドル"）
- `{rate}` — 適用為替レート

例（USD）: `"ホゴスルサーバ通信費 {year}年{month}月 (月{amount_foreign}ドル:ドル円{rate}円換算)"`
例（JPY）: `"Gemini API利用料 {year}年{month}月"` — JPY の場合、為替関連変数は使わない

### expense_item（経費項目）

個別の経費項目。グループに属する場合と単独の場合がある。

- **グループ所属**: 通貨・税率はグループから継承。アイテムには税率を持たない
- **単独項目**（group_id = NULL）: 自身の currency / tax_rate を使用

| カラム          | 型                           | 説明                                                                           |
| --------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| id              | TEXT PK                      | nanoid                                                                         |
| organization_id | TEXT FK → organization       | 組織                                                                           |
| group_id        | TEXT FK → expense_group NULL | グループ（NULL = 単独明細）                                                    |
| client_id       | TEXT FK → client             | 対象クライアント                                                               |
| name            | TEXT NOT NULL                | 項目名（例: "Vercel", "Gemini API"）                                           |
| type            | TEXT NOT NULL                | `'fixed'` / `'metered'`                                                        |
| currency        | TEXT NOT NULL DEFAULT 'USD'  | 通貨（単独項目の場合のみ使用。グループ所属時はグループの currency と一致必須） |
| monthly_amount  | TEXT                         | fixed の場合の月額（外貨 decimal 文字列。例: `"20.00"`）                       |
| provider        | TEXT                         | metered のプロバイダ（例: `'google_cloud'`）                                   |
| provider_config | TEXT                         | metered の設定 JSON                                                            |
| invoice_label   | TEXT                         | 単独明細の請求書表示名テンプレート                                             |
| tax_rate        | INTEGER                      | 単独項目の税率（group_id = NULL の場合のみ使用。10/8/0）                       |
| effective_from  | TEXT                         | 有効開始月（`'2026-04'`）。NULL = 制限なし                                     |
| effective_to    | TEXT                         | 有効終了月（`'2026-12'`）。NULL = 制限なし                                     |
| sort_order      | INTEGER NOT NULL DEFAULT 0   | グループ内の表示順                                                             |
| is_active       | INTEGER NOT NULL DEFAULT 1   | 有効フラグ                                                                     |
| created_at      | TEXT                         |                                                                                |
| updated_at      | TEXT                         |                                                                                |

有効判定: `is_active = 1 AND (effective_from IS NULL OR effective_from <= 対象月) AND (effective_to IS NULL OR effective_to >= 対象月)`

### exchange_rate（為替レートキャッシュ）

| カラム          | 型                          | 説明                                                  |
| --------------- | --------------------------- | ----------------------------------------------------- |
| id              | TEXT PK                     | nanoid                                                |
| year_month      | TEXT NOT NULL               | `'2026-03'`                                           |
| currency_pair   | TEXT NOT NULL               | `'USD/JPY'`                                           |
| rate            | TEXT NOT NULL               | レート decimal 文字列（例: `"149.53"`）               |
| rate_date       | TEXT NOT NULL               | レート基準日（当月末営業日 `'2026-03-31'`）           |
| source          | TEXT NOT NULL DEFAULT 'boj' | ソース識別子                                          |
| is_manual       | INTEGER NOT NULL DEFAULT 0  | 手動上書きフラグ                                      |
| override_reason | TEXT                        | 手動上書き時の理由（例: "日銀API障害のため手動設定"） |
| created_at      | TEXT                        |                                                       |
| updated_at      | TEXT                        |                                                       |

UNIQUE(year_month, currency_pair)

手動上書き時: `is_manual = 1`, `source = 'manual'`, `override_reason` に理由を記録。
API 再取得時: `is_manual = 0` のレコードのみ上書き。手動レコードは保護される。

### expense_record（月次経費取得結果）

原データの取得結果。請求書確定とは独立しており、再取得で更新される。

| カラム                 | 型                     | 説明                                                                               |
| ---------------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| id                     | TEXT PK                | nanoid                                                                             |
| expense_item_id        | TEXT FK → expense_item | 経費項目                                                                           |
| year_month             | TEXT NOT NULL          | `'2026-03'`                                                                        |
| amount_foreign         | TEXT NOT NULL          | 外貨金額 decimal（例: `"45.00"`）                                                  |
| currency               | TEXT NOT NULL          | 通貨コード                                                                         |
| adjusted_in_invoice_id | TEXT FK → invoice NULL | 差額をどの請求書で調整済みか。NULL = 未調整                                        |
| last_adjusted_amount   | TEXT                   | 調整時の金額（decimal）。次回差額は `amount_foreign - last_adjusted_amount` で算出 |
| fetched_at             | TEXT                   | API 取得日時（fixed の場合は NULL）                                                |
| created_at             | TEXT                   |                                                                                    |
| updated_at             | TEXT                   |                                                                                    |

UNIQUE(expense_item_id, year_month)

差額調整フロー（**metered items のみ** — fixed items は金額が確定的なので対象外）:

1. 請求書作成時に `invoice_line` に凍結（金額・レート・円額）
2. 後日 `expense_record` が再取得で更新される（API 確定値に変わる）
3. 次月の請求書作成画面で差額を判定:
   - 初回調整: `amount_foreign` と `invoice_line` の凍結値を比較
   - 再調整: `amount_foreign` と `last_adjusted_amount` を比較
4. 差額がある場合「前月差額あり」と表示（元請求月の為替レートで円換算。JPY の場合はそのまま）
5. 調整を反映したら:
   - `adjusted_in_invoice_id` に調整先の請求書IDを記録
   - `last_adjusted_amount` に調整時点の `amount_foreign` を記録
6. さらに expense_record が更新されても、`last_adjusted_amount` との差分で正しく検出できる

※ fixed items の `adjusted_in_invoice_id` / `last_adjusted_amount` は常に NULL のまま

### 請求書への凍結（既存テーブル活用）

請求書に採用した値は既存の `invoice_line` テーブルに保存される。
invoice_line に追加するカラム:

| カラム           | 型                           | 説明                           |
| ---------------- | ---------------------------- | ------------------------------ |
| expense_group_id | TEXT FK → expense_group NULL | 元の経費グループ               |
| expense_item_id  | TEXT FK → expense_item NULL  | 元の経費項目（単独項目の場合） |
| amount_foreign   | TEXT                         | 外貨金額 decimal               |
| exchange_rate    | TEXT                         | 適用為替レート decimal         |
| currency         | TEXT                         | 通貨コード                     |

排他制約:

- **グループ経費**: `expense_group_id` にグループID、`expense_item_id` は NULL
- **単独経費**: `expense_item_id` にアイテムID、`expense_group_id` は NULL
- **通常の稼働明細**: 両方 NULL
- **両方同時に値を持つことは禁止**

請求書確定後は `invoice_line` の値が正であり、`expense_record` や `exchange_rate` が後から変わっても影響しない。

## クライアントテーブルへの追加カラム

| カラム          | 型                   | 説明                                       |
| --------------- | -------------------- | ------------------------------------------ |
| rounding_method | TEXT DEFAULT 'round' | 端数処理: `'round'` / `'floor'` / `'ceil'` |

## ER 図

```
organization ──< client
                   ├──< expense_group ──< expense_item ──< expense_record
                   │        │                   │
                   │        │ (tax_rate,          └── provider_config (JSON)
                   │        │  currency)
                   │        │
                   └──< expense_item (group_id = NULL, 単独)
                              │ (tax_rate, currency)
                              └──< expense_record
                                     └── adjusted_in_invoice_id → invoice

invoice ──< invoice_line
              ├── expense_group_id (グループ経費)  ─┐ 排他
              └── expense_item_id  (単独経費)    ─┘

exchange_rate (独立、year_month + currency_pair で一意)
```

## バリデーションルール

1. グループ所属アイテムの `currency` はグループの `currency` と一致必須
2. グループ所属アイテムの `organization_id` / `client_id` はグループのそれと一致必須
3. グループ所属アイテムは `tax_rate` を持たない（NULL）。税率はグループから継承
4. 単独アイテム（group_id = NULL）は `tax_rate` 必須
5. `tax_rate` は `0`（非課税）/ `8`（軽減）/ `10`（標準）のいずれか。freee API にそのまま渡す
6. `type = 'fixed'` の場合 `monthly_amount` 必須
7. `type = 'metered'` の場合 `provider` + `provider_config` 必須
8. `effective_from` ≤ `effective_to`（両方指定時）
9. `invoice_line` の `expense_group_id` と `expense_item_id` は排他（両方非NULLは禁止）
10. 同一グループ内の `sort_order` は一意推奨
