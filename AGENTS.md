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
- Forms: `conform + zod` validation on client + server.
- Auth: use `requireAuth` / `requireAdmin` helpers.

## DB Clients (`app/lib/db/kysely.ts`)

- `db`: app queries with `CamelCasePlugin` (camelCase columns).
- `authDb`: better-auth queries (snake_case, no plugin).

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

## Navigation

- Parent nav stays active on subroutes.
- Subroutes must include breadcrumbs + back button in header.

## Dialogs with useFetcher

- Use `useFetcher({ key })` for dialogs that submit forms.
- Key should include target ID (e.g., `delete-client-${id}`) to reset fetcher state between uses.
- Close dialog in `useEffect` when `fetcher.state === 'idle' && fetcher.data`.

## References

- Form examples: `app/routes/auth/signin.tsx`, `app/routes/auth/signup.tsx`,
  `app/routes/index.tsx`, `app/routes/org.$orgSlug/clients/`,
  `app/components/password-input.tsx`

## Security

- Copy `.env.example` → `.env` and set freee/Google OAuth.
- Never log tokens or commit `.env`.
