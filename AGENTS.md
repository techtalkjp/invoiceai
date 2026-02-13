# InvoiceAI - Repository Guidelines

## Project Layout (primary)

- `app/`: React Router v7 app (routes/components/data/lib/utils).
- `src/`: CLI + core services (adapters/core/services, CLI entrypoints).
- `db/`: Local DB files; schema via Atlas.
- `docs/`: freee OAuth/API notes.
- `public/`: Static assets.
- `terraform/`: GCP API enablement.
- `output/`: Generated invoice outputs.

## Commands (most used)

- `pnpm dev`, `pnpm build`, `pnpm start`
- `pnpm cli:invoice`, `pnpm cli:auth`, `pnpm cli:google`
- `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm typecheck`
- `pnpm db:push`, `pnpm db:types`

## Coding & Tests

- TypeScript (ESM), 2-space, Prettier defaults (no semicolons, single quotes).
- Biome lint; avoid unused awaits/suspicious patterns.
- Tests: Vitest, `*.test.ts` under `src/`. Run `pnpm test` when touching `src/core`, `src/services`, `src/adapters`.

## React Router v7 Rules

- Data read: `loader` only (no component `fetch`/`useEffect`).
- Data write: `action` only (no direct API route calls).
- Forms: `conform + zod` validation on client + server (see Forms section below).
- Auth: use `requireAuth` / `requireAdmin` helpers.

## DB Clients (`app/lib/db/kysely.ts`)

- `db`: app queries with `CamelCasePlugin` + `ParseJSONResultsPlugin`
- `authDb`: better-auth queries (snake_case, no plugin)

### Kysely 注意点

- **`db`（アプリ用）**: `CamelCasePlugin` + `ParseJSONResultsPlugin`
  - カラム名: `snake_case` → `camelCase` 自動変換。クエリ内でもキャメルケースで書く
  - JSON カラム（`config`, `metadata` 等）: 取得時に自動パース済み。`JSON.parse()` 不要。キャストして直接アクセス（例: `row.config as { key?: string } | null`）
  - `JSON.parse()` を二重に呼ぶと `"[object Object]" is not valid JSON` エラーになる
- **`authDb`（better-auth 用）**: プラグインなし
  - カラム名: `snake_case` のまま
  - JSON カラム: 生の文字列。`JSON.parse()` が必要

## Route Colocation (react-router-auto-routes)

ファイル名規約：

- `_layout.tsx`: レイアウト。`Outlet` で子ルートを描画。子をネストさせる唯一の方法。
- `index.tsx` / `_index.tsx`: インデックスルート（同じ意味）。親フォルダのパスに対応。
- `$param.tsx`: 動的パラメータ（例: `$clientId.tsx` → `:clientId`）。
- `route.tsx`: **非推奨**。`index.tsx` を使う。
- `+` で始まるファイル/フォルダ: ルートとして無視される。
  - 例: `+queries.server.ts`, `+components/`, `+/helpers.ts`
  - 注意: `routes/` 直下には置けない。`+types` は予約済み。

例:

```
org.$orgSlug/
├── _layout.tsx      # /org/:orgSlug のレイアウト（Outlet で子を描画）
├── _index.tsx       # /org/:orgSlug （レイアウト内に表示）
├── clients/
│   ├── index.tsx    # /org/:orgSlug/clients
│   ├── $clientId.tsx
│   ├── +queries.server.ts  # ← ルートにならない
│   └── +components/        # ← ルートにならない
```

## Page Layout Convention

すべてのルートページは以下の構造に従う:

```tsx
<div className="grid gap-4">
  <PageHeader title="..." subtitle="..." backTo="..." actions={...} />
  <ControlBar left={<MonthNav ... />} right={<FilterButton />} />  {/* optional */}
  <ContentPanel>
    {/* テーブル / フォーム / メインコンテンツ */}
  </ContentPanel>
</div>
```

- ルートコンポーネントの最外部は `<div className="grid gap-4">` (または `gap-6`)
- ページヘッダーは必ず `<PageHeader>` を使用
- 戻るボタンが必要なサブページは `backTo` prop を指定
- 月切替が必要なページは `<MonthNav>` を使用
- フィルタやアクションボタンがある場合は `<ControlBar>` を使用
- テーブルやリストは `<ContentPanel>` で囲む
- 共通コンポーネント: `~/components/page-header`, `~/components/control-bar`, `~/components/month-nav`, `~/components/content-panel`

## useEffect Policy

`useEffect` は外部世界との同期専用。それ以外では使用禁止。

**許可される用途**: API 呼び出し、WebSocket 接続、ブラウザ API、外部ストアのサブスクリプション、タイマー。

**アンチパターン（禁止）**:

- props や派生値をローカル state にコピーする
- フラグの変化に応じてロジックを実行する
- ユーザーアクションを effect 内で処理する（イベントハンドラを使うこと）
- 派生・バリデーション state を effect 内で更新する
- 空の依存配列で初期化する（代わりに `useMemo` を使う）

**原則**:

- props / state から導出できる値はレンダー中に計算する
- ユーザーアクションはイベントハンドラで処理する（effect ではない）
- effect は外部システムに触れる本物の副作用にのみ使用する
- `useEffect` を書く際は、同期対象の外部リソースを短いコメントで説明する

## Navigation

- Parent nav stays active on subroutes.
- Subroutes must include breadcrumbs + back button in header.

## Dialogs with useFetcher

- Use `useFetcher({ key })` for dialogs that submit forms.
- Key should include target ID (e.g., `delete-client-${id}`) to reset fetcher state between uses.
- Close dialog in `useEffect` when `fetcher.state === 'idle' && fetcher.data`.

## Forms (future API)

- 新ルートは `~/lib/form` の `useForm` を使う（`configureForms` 統合済み）
- スキーマは定義時に `coerceFormValue()` でラップする。クライアント (`useForm`) もサーバー action (`safeParse`) も同じスキーマを使う
- `coerceFormValue` がフォーム値の型変換を担う（`"on"` → `true`, `"123"` → `123` 等）。`z.coerce.number()` は不要、`z.number()` で OK
- クライアント: `useForm(schema, { lastResult, defaultValue })` — `onValidate` 不要
- サーバー action: `parseSubmission` + `report` (`@conform-to/react/future`)、`formatResult(schema.safeParse())` (`@conform-to/zod/v4/future`)
- `parseWithZod` / `getInputProps` は旧 API。`fields.xxx.inputProps` / `.moneyInputProps` を使う
- 実装例: `app/routes/playground/forms/index.tsx`, `app/routes/playground/money-input/index.tsx`

## References

- Form examples (legacy): `app/routes/auth/signin.tsx`, `app/routes/auth/signup.tsx`,
  `app/routes/index.tsx`, `app/routes/org.$orgSlug/clients/`,
  `app/components/password-input.tsx`
- Form examples (future): `app/routes/playground/money-input/index.tsx`

## Security

- Copy `.env.example` → `.env` and set freee/Google OAuth.
- Never log tokens or commit `.env`.
