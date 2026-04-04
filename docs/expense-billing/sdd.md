# SDD: 月次経費請求機能

## 1. 目的

本書は `docs/expense-billing/` 配下の RDD を、現在の InvoiceAI の実装構造に落とし込むための詳細設計書である。

前提:

- UI は React Router v7 の `loader` / `action` パターンで実装する
- 新規フォームは `~/lib/form` + `conform` + `zod` future API を使う
- DB アクセスは `app/lib/db/kysely.ts` の `db` を使い、クエリでは camelCase で書く
- 日付処理は `dayjs` と既存 `~/utils/date`, `~/utils/month` を使う
- freee 請求書作成の既存入口は `app/routes/org.$orgSlug/invoices/create.tsx` と `src/services/invoice-service.ts`

---

## 2. 実装アーキテクチャ

### 2.1 全体像

実装は以下の 4 層に分ける。

1. ルート層
   - クライアント詳細配下に経費設定 UI / 実績 UI を追加
   - 請求書作成画面に経費プレビューと操作を追加
2. ルート専用 server module
   - `+queries.server.ts` と `+mutations.server.ts` で画面ごとの read/write を集約
3. ドメインサービス層
   - 経費アイテム解決、為替レート取得、従量課金取得、請求明細組み立てを `src/services/expense-billing/` に集約
4. 外部連携層
   - 日銀 API
   - BigQuery Billing Export
   - freee 請求書 API

### 2.2 追加・変更ファイル一覧

```text
app/
  lib/
    provider-credential.server.ts            # 新規: GCP SA JSON の保存/取得
  routes/
    org.$orgSlug/
      clients/
        $clientId/
          _layout.tsx                        # 新規: クライアント詳細の共通レイアウト
          _index.tsx                         # 新規: 既存 $clientId.tsx を移設（基本設定）
          expenses.tsx                       # 新規: 経費グループ/項目管理
          expense-records.tsx                # 新規: 月次経費実績一覧
          +queries.server.ts                 # 新規: client detail 共通 read
          +mutations.server.ts               # 新規: client detail 共通 write
          +schema.ts                         # 新規: 経費管理フォーム schema
          +components/
            client-detail-tabs.tsx          # 新規
            expense-group-card.tsx          # 新規
            expense-item-form.tsx           # 新規
            expense-group-form.tsx          # 新規
            exchange-rate-form.tsx          # 新規
            provider-config-google-cloud.tsx # 新規
            expense-record-list.tsx         # 新規
      invoices/
        +queries.server.ts                   # 変更: 経費プレビュー取得と invoice_line 保存を追加
        +schema.ts                           # 変更: rate manual override などの intent 用 schema 追加
        create.tsx                           # 変更: 経費プレビュー、再取得、manual rate、差額調整 UI

src/
  services/
    expense-billing/
      types.ts                               # 新規: domain types
      constants.ts                           # 新規
      utils/
        decimal.ts                           # 新規: Decimal ラッパ
        label-template.ts                    # 新規: invoice_label 展開
        rounding.ts                          # 新規: round/floor/ceil
        year-month.ts                        # 新規: YYYY-MM 判定
      exchange-rate/
        boj-client.ts                        # 新規: 日銀 API client
        exchange-rate-service.ts             # 新規: cache + manual override + fetch
      metered/
        provider-registry.ts                 # 新規: plugin registry
        types.ts                             # 新規
        google-cloud-billing-provider.ts     # 新規
        google-cloud-billing-query.ts        # 新規
      records/
        expense-record-service.ts            # 新規: fixed/metered の月次 record upsert
        expense-record-diff-service.ts       # 新規: 差額検出
      billing/
        expense-definition-service.ts        # 新規: active items/groups 解決
        expense-preview-service.ts           # 新規: 請求書作成画面用 preview 組立
        invoice-expense-line-builder.ts      # 新規: freee line + invoice_line snapshot

db/
  schema.sql                                 # 変更

app/lib/db/
  types.ts                                   # `pnpm db:types` で再生成
```

### 2.3 パッケージ追加

- `@google-cloud/bigquery`
- `decimal.js`

理由:

- BigQuery Billing Export 参照に必須
- 外貨金額と為替レートの乗算・差額計算を浮動小数点なしで扱うため

### 2.4 既存構造への組み込み方

- クライアント詳細は現在 `app/routes/org.$orgSlug/clients/$clientId.tsx` の単一画面だが、経費タブ追加に合わせて `app/routes/org.$orgSlug/clients/$clientId/` フォルダへ分解する
- 既存の `/org/:orgSlug/clients/:clientId` パスは `_index.tsx` に移すことで維持する
- 請求書作成は既存 `create.tsx` を維持し、そこで経費 preview を loader で読み、`action` の `intent` 分岐で再取得・手動レート保存・請求書作成を処理する
- freee 送信の業務ロジックは `src/services/invoice-service.ts` を拡張し、既存の稼働明細 1 行に加えて経費明細配列を受け取れる形にする

---

## 3. DB スキーマ変更

### 3.1 新規テーブル

#### expense_group

```sql
CREATE TABLE IF NOT EXISTS "expense_group" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "client_id" TEXT NOT NULL REFERENCES "client"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "invoice_label" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "tax_type" TEXT NOT NULL DEFAULT 'taxable' CHECK ("tax_type" IN ('taxable', 'non_taxable')),
  "tax_rate" INTEGER NOT NULL DEFAULT 10,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "expense_group_client_idx"
  ON "expense_group"("client_id");
CREATE INDEX IF NOT EXISTS "expense_group_org_client_active_idx"
  ON "expense_group"("organization_id", "client_id", "is_active");
```

#### expense_item

```sql
CREATE TABLE IF NOT EXISTS "expense_item" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "group_id" TEXT REFERENCES "expense_group"("id") ON DELETE SET NULL,
  "client_id" TEXT NOT NULL REFERENCES "client"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('fixed', 'metered')),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "monthly_amount" TEXT,
  "provider" TEXT,
  "provider_config" TEXT,
  "invoice_label" TEXT,
  "tax_type" TEXT CHECK ("tax_type" IN ('taxable', 'non_taxable')),
  "tax_rate" INTEGER,
  "effective_from" TEXT,
  "effective_to" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "expense_item_client_idx"
  ON "expense_item"("client_id");
CREATE INDEX IF NOT EXISTS "expense_item_group_idx"
  ON "expense_item"("group_id");
CREATE INDEX IF NOT EXISTS "expense_item_client_active_idx"
  ON "expense_item"("client_id", "is_active");
```

#### exchange_rate

```sql
CREATE TABLE IF NOT EXISTS "exchange_rate" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "year_month" TEXT NOT NULL,
  "currency_pair" TEXT NOT NULL,
  "rate" TEXT NOT NULL,
  "rate_date" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'boj',
  "is_manual" INTEGER NOT NULL DEFAULT 0,
  "override_reason" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "exchange_rate_year_month_pair_idx"
  ON "exchange_rate"("year_month", "currency_pair");
```

#### expense_record

```sql
CREATE TABLE IF NOT EXISTS "expense_record" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "expense_item_id" TEXT NOT NULL REFERENCES "expense_item"("id") ON DELETE CASCADE,
  "year_month" TEXT NOT NULL,
  "amount_foreign" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "adjusted_in_invoice_id" TEXT REFERENCES "invoice"("id") ON DELETE SET NULL,
  "last_adjusted_amount" TEXT,
  "fetched_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "expense_record_item_month_idx"
  ON "expense_record"("expense_item_id", "year_month");
CREATE INDEX IF NOT EXISTS "expense_record_invoice_idx"
  ON "expense_record"("adjusted_in_invoice_id");
```

#### provider_credential

```sql
CREATE TABLE IF NOT EXISTS "provider_credential" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('google_cloud_billing')),
  "encrypted_credentials" TEXT NOT NULL,
  "config" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "provider_credential_org_provider_idx"
  ON "provider_credential"("organization_id", "provider");
```

`provider_credential` は `activity_source.credentials` と同様に `ENCRYPTION_KEY` を使って暗号化した JSON を保存する。GCP SA JSON の保存先は既存 `provider_token` ではなく、この新テーブルに分離する。

### 3.2 既存テーブル ALTER

#### client

```sql
ALTER TABLE "client"
  ADD COLUMN "rounding_method" TEXT NOT NULL DEFAULT 'round'
  CHECK ("rounding_method" IN ('round', 'floor', 'ceil'));
```

#### invoice_line

```sql
ALTER TABLE "invoice_line"
  ADD COLUMN "expense_group_id" TEXT REFERENCES "expense_group"("id") ON DELETE SET NULL;

ALTER TABLE "invoice_line"
  ADD COLUMN "expense_item_id" TEXT REFERENCES "expense_item"("id") ON DELETE SET NULL;

ALTER TABLE "invoice_line"
  ADD COLUMN "expense_record_id" TEXT REFERENCES "expense_record"("id") ON DELETE SET NULL;

ALTER TABLE "invoice_line"
  ADD COLUMN "expense_year_month" TEXT;

ALTER TABLE "invoice_line"
  ADD COLUMN "expense_kind" TEXT DEFAULT NULL
  CHECK ("expense_kind" IN ('regular', 'adjustment'));

ALTER TABLE "invoice_line"
  ADD COLUMN "amount_foreign" TEXT;

ALTER TABLE "invoice_line"
  ADD COLUMN "exchange_rate" TEXT;

ALTER TABLE "invoice_line"
  ADD COLUMN "currency" TEXT;
```

追加 index:

```sql
CREATE INDEX IF NOT EXISTS "invoice_line_expense_group_idx"
  ON "invoice_line"("expense_group_id");
CREATE INDEX IF NOT EXISTS "invoice_line_expense_item_idx"
  ON "invoice_line"("expense_item_id");
CREATE INDEX IF NOT EXISTS "invoice_line_expense_record_idx"
  ON "invoice_line"("expense_record_id");
```

### 3.3 制約に関する補足

- `invoice_line.expense_group_id` と `invoice_line.expense_item_id` の排他制約は RDD 上必須
- SQLite の `ALTER TABLE` では既存テーブルへ複雑な table-level `CHECK` 追加が難しい
- そのため設計上は以下の二段階で扱う
  - `schema.sql` の新規定義には排他 `CHECK` を含める
  - 既存 DB への migration は Atlas で `invoice_line` 再作成 migration を切る
- 1st release では app 層 validation も必ず入れる

推奨 `CHECK`:

```sql
CHECK (
  ("expense_group_id" IS NULL OR "expense_item_id" IS NULL)
)
```

### 3.4 Kysely 型への反映

`pnpm db:types` 後に最低限以下が追加される。

- `Client.roundingMethod`
- `ExpenseGroup`
- `ExpenseItem`
- `ExchangeRate`
- `ExpenseRecord`
- `ProviderCredential`
- `InvoiceLine.expenseGroupId`
- `InvoiceLine.expenseItemId`
- `InvoiceLine.expenseRecordId`
- `InvoiceLine.expenseYearMonth`
- `InvoiceLine.expenseKind`
- `InvoiceLine.amountForeign`
- `InvoiceLine.exchangeRate`
- `InvoiceLine.currency`

---

## 4. サーバーサイド実装

### 4.1 ドメイン型

`src/services/expense-billing/types.ts`

```ts
export type RoundingMethod = 'round' | 'floor' | 'ceil'
export type TaxType = 'taxable' | 'non_taxable'
export type ExpenseItemType = 'fixed' | 'metered'
export type MeteredProvider = 'google_cloud'

export type MoneyDecimal = string
export type YearMonth = `${number}-${number}`

export type ExpensePreviewLine = {
  expenseKind: 'regular' | 'adjustment'
  expenseGroupId: string | null
  expenseItemId: string | null
  expenseRecordId: string | null
  expenseYearMonth: string
  description: string
  amountForeign: string
  currency: 'USD'
  exchangeRate: string
  amountJpy: number
  taxRate: number
  taxType: TaxType
  isProvisional: boolean
}
```

### 4.2 queries.server / mutations.server

#### クライアント詳細配下

`app/routes/org.$orgSlug/clients/$clientId/+queries.server.ts`

責務:

- クライアント基本情報取得
- クライアント配下の `expense_group`, `expense_item` 一覧取得
- 対象月の `expense_record` + `exchange_rate` + 請求済み状態を取得
- `provider_credential` の登録有無判定

主な関数:

- `getClientDetail(organizationId, clientId)`
- `getExpenseDefinitions(organizationId, clientId)`
- `getExpenseRecordsByMonth(organizationId, clientId, yearMonth)`
- `getGoogleCloudCredentialStatus(organizationId)`

`app/routes/org.$orgSlug/clients/$clientId/+mutations.server.ts`

責務:

- 経費グループ CRUD
- 経費項目 CRUD
- クライアント `roundingMethod` 更新
- GCP credential 保存/削除
- 経費再取得実行
- 為替レート手動保存/解除

主な関数:

- `upsertExpenseGroup(organizationId, clientId, input)`
- `deleteExpenseGroup(organizationId, clientId, groupId)`
- `upsertExpenseItem(organizationId, clientId, input)`
- `deleteExpenseItem(organizationId, clientId, itemId)`
- `updateClientRoundingMethod(organizationId, clientId, roundingMethod)`
- `saveGoogleCloudCredential(organizationId, serviceAccountJson)`
- `deleteGoogleCloudCredential(organizationId)`
- `refreshExpenseRecords(organizationId, clientId, yearMonth)`
- `saveManualExchangeRate(yearMonth, rate, reason)`
- `clearManualExchangeRate(yearMonth, currencyPair)`

#### 請求書作成

既存 `app/routes/org.$orgSlug/invoices/+queries.server.ts` を拡張する。

追加関数:

- `getInvoiceExpensePreview(params)`
- `saveInvoiceLinesSnapshot(invoiceId, lines)`
- `markExpenseRecordsAdjusted(invoiceId, adjustments)`
- `deleteInvoiceLines(invoiceId)`

`saveInvoiceToDb` は invoice header の upsert を維持し、`saveInvoiceLinesSnapshot` を別関数に分ける。請求書更新時は次の順で transaction 化する。

1. `saveInvoiceToDb`
2. `deleteInvoiceLines`
3. 稼働 line + 経費 line を `saveInvoiceLinesSnapshot` で再 insert
4. adjustment 対象があれば `markExpenseRecordsAdjusted`

### 4.3 為替レート取得サービス

`src/services/expense-billing/exchange-rate/exchange-rate-service.ts`

責務:

- `exchange_rate` cache lookup
- manual override 優先
- 日銀 API fetch
- 月末営業日レート抽出

公開 API:

```ts
getExchangeRate(yearMonth: string, currencyPair: 'USD/JPY'): Promise<{
  rate: string
  rateDate: string
  source: 'boj' | 'manual'
  isManual: boolean
}>

saveManualExchangeRate(input): Promise<void>
clearManualExchangeRate(yearMonth: string, currencyPair: 'USD/JPY'): Promise<void>
```

処理フロー:

1. `exchange_rate` を検索
2. `isManual = 1` なら即返す
3. キャッシュがあれば返す
4. `boj-client.ts` で月次データ取得
5. 月末から逆順で `null` 以外の値を採用
6. `exchange_rate` に upsert

`boj-client.ts` 実装方針:

- `fetch` を使う
- API レスポンスは JSON で受ける
- request 単位は `startDate=YYYYMM`, `endDate=YYYYMM`
- 通貨ペアは現時点 `USD/JPY` 固定で `FXERD05`

### 4.4 従量課金取得サービス

#### 共通 interface

`src/services/expense-billing/metered/types.ts`

```ts
export type MeteredUsageResult = {
  amount: string
  currency: 'USD'
  fetchedAt: string
  isProvisional: boolean
}

export interface MeteredProviderAdapter<TConfig> {
  provider: string
  parseConfig(input: unknown): TConfig
  fetchMonthlyCost(args: {
    organizationId: string
    yearMonth: string
    config: TConfig
  }): Promise<MeteredUsageResult>
}
```

#### Registry

`provider-registry.ts`

- `google_cloud` を registry 登録
- 今後 Vercel / AWS / Stripe を追加可能にする

#### Google Cloud Billing provider

`google-cloud-billing-provider.ts`

責務:

- `provider_credential` から encrypted SA JSON を取得して decrypt
- `@google-cloud/bigquery` client を生成
- 指定 `yearMonth` の usage cost を集計

`provider_config` の Zod schema:

```ts
const googleCloudProviderConfigSchema = z.object({
  bigqueryProject: z.string().min(1),
  bigqueryDataset: z.string().min(1),
  bigqueryTable: z.string().min(1),
  projectId: z.string().min(1),
  serviceFilter: z.string().optional(),
})
```

集計 SQL:

```sql
SELECT
  CAST(
    COALESCE(SUM(cost), 0) + COALESCE(SUM((
      SELECT SUM(c.amount)
      FROM UNNEST(credits) c
    )), 0)
    AS STRING
  ) AS amount
FROM `${bigqueryProject}.${bigqueryDataset}.${bigqueryTable}`
WHERE project.id = @projectId
  AND usage_start_time >= @startTime
  AND usage_start_time < @endTime
  AND (@serviceFilter IS NULL OR service.description = @serviceFilter)
```

補足:

- `credits.amount` は負値なので `SUM(cost) + SUM(credits.amount)` で実質コストになる
- `isProvisional` は JST で対象月の翌月 5 日より前なら `true`
- `fetchedAt` は `nowISO()`

### 4.5 expense_record サービス

`expense-record-service.ts`

責務:

- active な fixed/metered item から当月 `expense_record` を upsert
- fixed は `monthlyAmount` をそのまま採用
- metered は provider registry で取得

公開 API:

```ts
refreshExpenseRecords(args: {
  organizationId: string
  clientId: string
  yearMonth: string
}): Promise<ExpenseRecordRefreshResult>
```

upsert ルール:

- key は `expense_item_id + year_month`
- fixed:
  - `amountForeign = monthlyAmount`
  - `fetchedAt = null`
- metered:
  - `amountForeign = providerResult.amount`
  - `fetchedAt = providerResult.fetchedAt`
- `createdAt` / `updatedAt` は `nowISO()`

### 4.6 プレビュー/差額計算サービス

`expense-preview-service.ts`

責務:

- 対象月の active item/group を解決
- `expense_record` 未作成の fixed item は仮想 record として扱うか、loader 前に `refreshExpenseRecords` を呼んで materialize する
- 為替レートを取得
- 円換算、template 展開、差額 line 生成

推奨フロー:

1. `refreshExpenseRecords` を対象月で実行
2. `getExchangeRate` を取得
3. current month の regular lines を生成
4. previous month 以前の `expense_record` で未調整差額を検出
5. adjustment lines を生成
6. freee 用 line 配列と DB snapshot 用 line 配列を返す

差額判定:

- 初回調整:
  - `expense_record.amount_foreign - 凍結済み invoice_line.amount_foreign`
- 再調整:
  - `expense_record.amount_foreign - expense_record.last_adjusted_amount`
- 差額の円換算は `expense_year_month` の `exchange_rate` を使う

### 4.7 端数処理

`rounding.ts`

```ts
applyRounding(
  amountForeign: string,
  exchangeRate: string,
  method: 'round' | 'floor' | 'ceil',
): number
```

処理:

- `Decimal(amountForeign).mul(exchangeRate)`
- `toDecimalPlaces(0, roundingMode)`
- `toNumber()`

`round` / `floor` / `ceil` の DB 値を `decimal.js` rounding mode に変換する

---

## 5. ルート設計

### 5.1 クライアント詳細の再構成

#### 既存変更

- 旧: `app/routes/org.$orgSlug/clients/$clientId.tsx`
- 新:
  - `app/routes/org.$orgSlug/clients/$clientId/_layout.tsx`
  - `app/routes/org.$orgSlug/clients/$clientId/_index.tsx`

`_layout.tsx` の責務:

- `PageHeader`
- breadcrumb / back button
- `Tabs` で `基本設定`, `経費項目`, `経費実績`
- `Outlet`

#### 新規ルート

1. `/org/:orgSlug/clients/:clientId`
   - `_index.tsx`
   - 既存クライアント編集フォーム
2. `/org/:orgSlug/clients/:clientId/expenses`
   - `expenses.tsx`
   - 経費グループ・項目管理
3. `/org/:orgSlug/clients/:clientId/expense-records?yearMonth=YYYY-MM`
   - `expense-records.tsx`
   - 月次経費実績一覧

### 5.2 loader / action 設計

#### expenses.tsx

loader:

- `requireOrgAdmin`
- `getClientDetail`
- `getExpenseDefinitions`
- `getGoogleCloudCredentialStatus`

action intents:

- `upsert-expense-group`
- `delete-expense-group`
- `upsert-expense-item`
- `delete-expense-item`
- `update-rounding-method`
- `save-google-cloud-credential`
- `delete-google-cloud-credential`

#### expense-records.tsx

loader:

- `requireOrgAdmin`
- `yearMonth` query param を解釈
- `getExpenseRecordsByMonth`
- `getExchangeRate`

action intents:

- `refresh-expense-records`
- `save-manual-rate`
- `clear-manual-rate`

#### invoices/create.tsx

loader:

- `requireOrgMember`
- クライアント一覧
- 既存請求書有無
- `clientId` と `yearMonth` が揃っていれば `getInvoiceExpensePreview`
- preview には以下を含める
  - work summary
  - expense lines
  - exchange rate
  - manual override 状態
  - provisional フラグ
  - adjustment lines

action intents:

- `refresh-expenses`
  - `refreshExpenseRecords`
  - preview 再計算
- `save-manual-rate`
  - 手動レート保存
  - preview 再計算
- `clear-manual-rate`
  - 手動レート解除
  - preview 再計算
- `create-invoice`
  - freee create
  - DB save
- `update-invoice`
  - freee update
  - DB save

### 5.3 フォーム設計

新規ルートは `~/lib/form` を使う。

主な schema:

- `expenseGroupSchema`
- `expenseItemSchema`
- `googleCloudCredentialSchema`
- `exchangeRateOverrideSchema`
- `expenseRefreshSchema`
- `invoiceExpenseActionSchema`

注意:

- `coerceFormValue()` を schema 定義時に使う
- `provider_config` は UI 入力値から object 化したあと `JSON.stringify` して DB 保存
- DB 読み出し時は `db` が `ParseJSONResultsPlugin` を使わない TEXT 列なので、`providerConfig` は route/server 層で `JSON.parse()` する

---

## 6. コンポーネント設計

### 6.1 client-detail-tabs.tsx

責務:

- クライアント詳細配下のタブナビ

props:

```ts
type ClientDetailTabsProps = {
  orgSlug: string
  clientId: string
  current: 'settings' | 'expenses' | 'expense-records'
}
```

### 6.2 expense-group-card.tsx

責務:

- グループ 1 件の表示
- 合計額、税区分、所属 item 一覧を表示
- 編集/削除トリガを出す

props:

```ts
type ExpenseGroupCardProps = {
  group: ExpenseGroupView
  onEdit: (groupId: string) => void
  onDelete: (groupId: string) => void
  onAddItem: (groupId: string) => void
}
```

### 6.3 expense-group-form.tsx

責務:

- グループ作成/編集ダイアログ

props:

```ts
type ExpenseGroupFormProps = {
  defaultValue?: Partial<ExpenseGroupFormInput>
  lastResult?: SubmissionResult | null
  mode: 'create' | 'edit'
}
```

入力項目:

- name
- invoiceLabel
- currency
- taxType
- taxRate
- sortOrder
- isActive

### 6.4 expense-item-form.tsx

責務:

- item 作成/編集ダイアログ
- fixed / metered で入力切替

props:

```ts
type ExpenseItemFormProps = {
  groups: Array<{ id: string; name: string; currency: string }>
  defaultValue?: Partial<ExpenseItemFormInput>
  lastResult?: SubmissionResult | null
  mode: 'create' | 'edit'
}
```

入力項目:

- name
- groupId
- type
- monthlyAmount
- provider
- provider specific config
- invoiceLabel
- taxType
- taxRate
- effectiveFrom
- effectiveTo
- sortOrder
- isActive

### 6.5 provider-config-google-cloud.tsx

責務:

- metered provider = `google_cloud` の設定入力

props:

```ts
type ProviderConfigGoogleCloudProps = {
  defaultValue?: {
    bigqueryProject?: string
    bigqueryDataset?: string
    bigqueryTable?: string
    projectId?: string
    serviceFilter?: string
  }
}
```

### 6.6 exchange-rate-form.tsx

責務:

- 現在レート表示
- manual override 保存/解除
- 理由入力

props:

```ts
type ExchangeRateFormProps = {
  yearMonth: string
  currentRate: string | null
  rateDate: string | null
  isManual: boolean
  sourceLabel: string
  lastResult?: SubmissionResult | null
}
```

### 6.7 expense-record-list.tsx

責務:

- 月次経費実績一覧の表示
- group 単位合計と item 内訳展開
- 請求反映済み/暫定/差額あり表示

props:

```ts
type ExpenseRecordListProps = {
  yearMonth: string
  exchangeRate: string | null
  groups: ExpenseRecordGroupView[]
}
```

### 6.8 invoices/create.tsx 側の追加表示ブロック

新規 subcomponent 化推奨:

- `InvoiceExpensePreviewSection`
- `InvoiceExpenseTable`
- `InvoiceExpenseAdjustmentNotice`

表示内容:

- 為替レート
- manual override 状態
- 経費明細 table
- provisional alert
- adjustment alert

---

## 7. freee API 連携

### 7.1 現状

`src/services/invoice-service.ts` は稼働明細 1 行のみを `lines` に積む構造。

### 7.2 変更方針

`createClientInvoice` / `updateClientInvoice` に追加行を渡せるようにする。

新しい入力:

```ts
export type AdditionalInvoiceLine = {
  description: string
  quantity: string
  unit: string
  unitPrice: string
  taxRate: number
}
```

署名変更案:

```ts
createClientInvoice(
  client,
  year,
  month,
  deps,
  options?: {
    additionalLines?: AdditionalInvoiceLine[]
  },
)
```

`buildInvoiceParams` の `lines`:

```ts
lines: [
  buildInvoiceLine(client, year, month, totalHours),
  ...additionalLines.map(...)
]
```

### 7.3 税区分の扱い

現時点の設計:

- `taxable` -> `tax_rate: taxRate`
- `non_taxable` -> `tax_rate: 0`

ただし RDD のアクションアイテム通り、freee 請求書 API で「非課税」の厳密表現は別確認が必要。実装では mapping を `invoice-expense-line-builder.ts` に閉じ込め、freee API 仕様確認後にそこで差し替える。

### 7.4 DB 凍結

freee 送信成功後、freee 側の line id を待たずにアプリ側 snapshot を `invoice_line` に保存する。

保存対象:

- description
- quantity
- unit
- unitPrice
- taxRate
- expenseGroupId / expenseItemId / expenseRecordId
- expenseYearMonth
- expenseKind
- amountForeign
- exchangeRate
- currency

これにより請求書再表示時は `expense_record` 再計算を参照せず、`invoice_line` を唯一の凍結値として扱える。

### 7.5 adjustment 反映

差額 line を今月の請求書に採用した場合:

- 当該 line も `invoice_line` に `expenseKind = 'adjustment'` で保存
- 対応する `expense_record` に
  - `adjustedInInvoiceId = currentInvoiceId`
  - `lastAdjustedAmount = current expense_record.amountForeign`
    を保存

---

## 8. 詳細ロジック

### 8.1 active item 判定

対象月 `yearMonth` に対して次を満たす item を対象にする。

- `isActive = 1`
- `effectiveFrom IS NULL OR effectiveFrom <= yearMonth`
- `effectiveTo IS NULL OR effectiveTo >= yearMonth`

### 8.2 group / 単独 item の line 化

- group 所属 item:
  - item ごとの `expense_record.amountForeign` を合算
  - label は group.invoiceLabel を展開
  - 税設定は group から採用
- group 非所属 item:
  - item 単位で 1 行
  - label は item.invoiceLabel を展開
  - 税設定は item から採用

### 8.3 label template 展開

置換変数:

- `{year}`
- `{month}`
- `{amount_foreign}`
- `{currency}`
- `{rate}`

通貨表示:

- 当面は `USD` のみなので UI 表示文言は `ドル`
- template 展開は `currency = 'ドル'` を返す helper を設ける

### 8.4 provisional 判定

metered line に対して:

- 対象月の翌月 5 日 JST 未満なら provisional
- preview 全体には `lines.some(line => line.isProvisional)` で notice 表示

### 8.5 idempotency

- `refreshExpenseRecords` は `expense_item_id + year_month` upsert
- `getExchangeRate` は `year_month + currency_pair` upsert
- invoice 作成更新は同月既存 `invoice` を header upsert
- `invoice_line` は invoice 単位で delete + insert

---

## 9. 実装順序

### Step 1: DB と型

1. `db/schema.sql` に新規 table / column を追加
2. Atlas migration を作成
3. `pnpm db:push`
4. `pnpm db:types`

理由:

- 以降の route / service 実装が Kysely 型に依存するため

### Step 2: 基盤 utility / credential

1. `provider-credential.server.ts`
2. `src/services/expense-billing/utils/decimal.ts`
3. `rounding.ts`
4. `label-template.ts`

理由:

- 外部連携や preview 生成の共通基盤になるため

### Step 3: 為替レートサービス

1. `boj-client.ts`
2. `exchange-rate-service.ts`
3. unit test を追加

理由:

- 請求 preview と実績画面の両方で使う共通依存

### Step 4: metered provider 基盤

1. provider registry
2. Google Cloud Billing provider
3. provider_config schema
4. credential 保存機能

理由:

- `expense_record` 自動取得の核になるため

### Step 5: expense definition / record service

1. `expense_group`, `expense_item` CRUD
2. `expense-record-service.ts`
3. `expense-record-diff-service.ts`

理由:

- ここまでで経費設定と原データ取得が成立する

### Step 6: クライアント詳細 UI

1. `clients/$clientId` を folder route へリファクタ
2. `expenses.tsx`
3. `expense-records.tsx`

理由:

- 管理 UI を先に固めると preview の確認がしやすい

### Step 7: 請求 preview

1. `expense-preview-service.ts`
2. `invoices/create.tsx` loader 拡張
3. manual rate / refresh action
4. UI table / notice

理由:

- freee 送信前に計算結果を見える化するため

### Step 8: freee 送信統合

1. `src/services/invoice-service.ts` 拡張
2. `invoice_line` snapshot 保存
3. `expense_record` adjustment 更新

理由:

- 最後に既存請求書作成フローへ安全に組み込む

### Step 9: テスト

最低限追加するテスト:

- `exchange-rate-service.test.ts`
- `google-cloud-billing-provider.test.ts`
- `rounding.test.ts`
- `expense-preview-service.test.ts`
- `invoice-service.test.ts` の追加ケース

確認観点:

- fixed + metered 混在
- manual rate 保護
- 翌月 5 日前の provisional
- 差額 adjustment の初回 / 再調整
- grouped / standalone item 両方

---

## 10. 未解決事項と実装メモ

### 10.1 freee 非課税 line の表現

RDD にも残っている確認事項。初版は `tax_rate = 0` 前提で実装し、adapter 層に閉じ込める。

### 10.2 invoice_line の migration

`CHECK` 追加のため、既存 DB では table rebuild migration を想定する。Atlas migration で明示的に扱う。

### 10.3 GCP Billing Export table 名

RDD 上「要確認」。UI では `bigqueryTable` を必須入力とし、自動推測はしない。

### 10.4 provider_config の保存形式

- DB では TEXT JSON
- `db` は TEXT を自動 parse しないため route/server 層で明示的に parse する
- Kysely query では `providerConfig` を string として扱う

### 10.5 認可

- 経費設定変更は `requireOrgAdmin`
- 請求 preview / 請求作成は `requireOrgMember`
- GCP credential の保存/削除も `requireOrgAdmin`
