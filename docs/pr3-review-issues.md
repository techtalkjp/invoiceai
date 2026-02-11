# PR #3 コードレビュー指摘事項

PR: feat/activity-integration (GitHub Activity Integration + AI Timesheet Suggestions)

## 対応済み

- ~~コード重複（useRepoFetcher / RepoSelector に共通化）~~
- ~~GitHubActivityDetail → ActivityRecord の型統一~~
- ~~+ai-suggest.server.ts のデッドコード削除~~
- ~~format-on-edit フックの lint-staged 移行~~
- ~~`insertActivities` の N+1 クエリ → バッチ INSERT + UNIQUE INDEX 追加~~
- ~~`activity` テーブルに重複防止の UNIQUE 制約追加~~
- ~~`saveActivitySource` の upsert を ON CONFLICT DO UPDATE に統一~~
- ~~`saveClientSourceMapping` の upsert を ON CONFLICT DO NOTHING に統一~~
- ~~Webhook `timingSafeEqual` の長さチェック追加~~
- ~~Cron エンドポイントの認証を `timingSafeEqual` に変更~~
- ~~Webhook `JSON.parse(body)` のエラーハンドリング追加~~
- ~~`ai-preview.tsx` の `JSON.parse` + `as` キャストを Zod バリデーションに変更~~
- ~~`ai-preview.tsx` の `addMapping` / `removeMapping` を Zod スキーマでバリデーション~~

---

## 未対応の指摘一覧

### 1. `insertActivities` の N+1 クエリ問題

- **重要度**: 高
- **カテゴリ**: パフォーマンス
- **該当**: `app/lib/activity-sources/activity-queries.server.ts`

`for...of` ループで 1 件ずつ INSERT を実行している。大量のアクティビティがある場合、DB ラウンドトリップが件数分発生する。

**修正案**: Kysely の `insertInto(...).values(allValues).onConflict(oc => oc.doNothing())` でバッチ INSERT に変更。件数が多い場合はチャンク分割（例: 100件ずつ）を組み合わせる。

---

### 2. `activity` テーブルに重複防止の UNIQUE 制約がない

- **重要度**: 高
- **カテゴリ**: データ整合性
- **該当**: `db/schema.sql`

`insertActivities` が重複スキップを `try/catch` で処理しているが、テーブルに UNIQUE INDEX がない。重複レコードが蓄積される可能性がある。

**修正案**: `(organization_id, user_id, source_type, event_type, event_date, event_timestamp, repo)` などでユニーク制約を追加。

---

### 3. `saveActivitySource` の upsert が SELECT + INSERT/UPDATE の 2 クエリ

- **重要度**: 中
- **カテゴリ**: パフォーマンス / 安全性
- **該当**: `app/lib/activity-sources/activity-queries.server.ts`

`getActivitySource` で SELECT → 結果に応じて INSERT or UPDATE。レースコンディションのリスクあり。

**修正案**: `INSERT ... ON CONFLICT(organization_id, user_id, source_type) DO UPDATE SET ...` に統一。`activity_source_org_user_type_idx` が UNIQUE INDEX として定義済みなので利用可能。

---

### 4. Webhook 署名検証で `timingSafeEqual` の長さ不一致例外

- **重要度**: 中
- **カテゴリ**: セキュリティ
- **該当**: `app/routes/api/github-webhook.ts`

`timingSafeEqual` は 2 つの Buffer が同じ長さでないと例外をスローする。不正な `X-Hub-Signature-256` で未処理 500 エラーになる。

**修正案**:

```typescript
const sigBuf = Buffer.from(signature)
const expBuf = Buffer.from(expected)
if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
  throw data({ error: 'Invalid signature' }, { status: 401 })
}
```

---

### 5. Cron エンドポイントの認証がタイミング攻撃に脆弱

- **重要度**: 低
- **カテゴリ**: セキュリティ
- **該当**: `app/routes/api/activity-sync.ts`

`authHeader !== Bearer ${secret}` で文字列比較しており、タイミングサイドチャネル攻撃に対して脆弱。

**修正案**: `timingSafeEqual` を使った定数時間比較に変更。

---

### 6. `ActivityRecord` の `SourceType | string` で型安全性を損なっている

- **重要度**: 低
- **カテゴリ**: 型安全性
- **該当**: `app/lib/activity-sources/types.ts`

`sourceType: SourceType | string` は `string` に縮退するため、union 型の意味がない。

**修正案**: 内部型は `SourceType` / `EventType` のみにし、外部入力の境界で検証する。または `string` に統一して混乱を避ける。

---

### 7. Webhook の `JSON.parse(body)` がエラーハンドリングされていない

- **重要度**: 中
- **カテゴリ**: エラーハンドリング
- **該当**: `app/routes/api/github-webhook.ts`

署名検証後の `JSON.parse(body)` に `try/catch` がない。マルフォームド JSON で 500 エラー。

**修正案**: `try/catch` で囲み、パース失敗時は 400 Bad Request を返す。

---

### 8. `ai-preview.tsx` の action で `JSON.parse` + `as` キャスト

- **重要度**: 中
- **カテゴリ**: セキュリティ / 型安全性
- **該当**: `app/routes/org.$orgSlug/work-hours/$clientId/ai-preview.tsx`

`JSON.parse(entriesJson) as Array<{...}>` で型アサーションのみ。hidden input 経由のため改ざん可能。

**修正案**: `z.array(suggestedEntrySchema).parse(JSON.parse(entriesJson))` で Zod バリデーション。

---

### 9. `ai-preview.tsx` の action で `addMapping` / `removeMapping` が conform 外で処理

- **重要度**: 中
- **カテゴリ**: 型安全性
- **該当**: `app/routes/org.$orgSlug/work-hours/$clientId/ai-preview.tsx`

`formData.get('intent')` で判定し、`formData.get('repoFullName') as string` で取得。バリデーションなし。

**修正案**: 専用 Zod スキーマで `parseWithZod` を通す。

---

### 10. Playground loader の `decrypt` 未ガード

- **重要度**: 中
- **カテゴリ**: エラーハンドリング
- **該当**: `app/routes/playground/index.tsx`

`decrypt(tokenData.encryptedToken)` が失敗した場合（ENCRYPTION_KEY 変更時など）の catch がなく 500 エラー。

**修正案**: `try/catch` で囲み、復号失敗時は `githubResult: null` を返して再認証を促す。

---

### 11. `repos.ts` のエラーが空配列として飲み込まれる

- **重要度**: 低
- **カテゴリ**: UX / エラーハンドリング
- **該当**: `app/routes/org.$orgSlug/settings/integrations/repos.ts`

すべてのエラーを `{ ghOrgs: [], repos: [] }` として返し、トークン失効やネットワークエラーの区別がつかない。

**修正案**: エラー種別に応じた情報（`{ error: 'token_expired' }` 等）を返し、UI で適切なメッセージを表示。

---

### 12. `integrations/index.tsx` loader で毎回 GitHub API を叩いて username 取得

- **重要度**: 中
- **カテゴリ**: パフォーマンス
- **該当**: `app/routes/org.$orgSlug/settings/integrations/index.tsx`

ページを開くたびに `fetchGitHubUsername(token)` を呼び、API レート制限を消費しページ表示が遅くなる。

**修正案**: `activity_source.config` に `{ username: "..." }` を保存し、callback で記録。以降は DB から読む。

---

### 13. `syncAllGitHubActivities` が逐次処理で遅い

- **重要度**: 中
- **カテゴリ**: パフォーマンス
- **該当**: `src/services/activity-sync.ts`

全ユーザーの同期が `for...of` で逐次実行。ユーザー数増加時に Cron タイムアウトのリスク。

**修正案**: `Promise.allSettled` または concurrency リミット付き（p-limit 等で 5 並列）で実行。

---

### 14. `callback.github.tsx` で `metadata` を unsafe キャスト

- **重要度**: 中
- **カテゴリ**: 型安全性
- **該当**: `app/routes/auth/callback.github.tsx`

`metadata.year as number`、`metadata.orgSlug as string` と型アサーションで取り出しており、値不在時にランタイムエラー。

**修正案**: Zod でバリデーション。

```typescript
const playgroundMeta = z
  .object({ year: z.number(), month: z.number() })
  .parse(metadata)
```

---

### 15. `OAuthState.metadata` に型付けがない

- **重要度**: 低
- **カテゴリ**: 型安全性
- **該当**: `app/lib/github-oauth.server.ts`

`metadata: Record<string, unknown>` で、`returnTo` ごとに必要な情報がコンパイル時にチェックされない。

**修正案**: discriminated union にする。

```typescript
export type OAuthState =
  | { ...; returnTo: 'playground'; metadata: { year: number; month: number } }
  | { ...; returnTo: 'integrations'; metadata: { orgSlug: string } }
```

---

### 16. `isoToJstDate` のオフセット計算の可読性

- **重要度**: 低
- **カテゴリ**: 可読性
- **該当**: `app/lib/activity-sources/github.server.ts`

`+9h - 6h` を 1 行で計算しており、JST 変換と 30 時制の前日判定の意図が読み取りにくい。

**修正案**: 2 段階に分ける。

```typescript
const jst = new Date(utc.getTime() + 9 * 60 * 60 * 1000)
const workDay = new Date(jst.getTime() - 6 * 60 * 60 * 1000)
```

---

### 17. `formSchema` に `saveAiSuggestionsSchema` があるが action で処理されていない

- **重要度**: 低
- **カテゴリ**: 設計
- **該当**: `app/routes/org.$orgSlug/work-hours/+schema.ts`

`saveAiSuggestionsSchema` が `formSchema` の discriminated union に含まれているが、`$clientId/index.tsx` の action ではこの intent を処理していない（`ai-preview.tsx` が独自にバリデーション）。

**修正案**: `ai-preview.tsx` で共通の `formSchema` を使うか、使わないなら `formSchema` から除外。

---

### 18. Playground の `clientLoader.hydrate = true` で不要なサーバーリクエスト

- **重要度**: 低
- **カテゴリ**: パフォーマンス
- **該当**: `app/routes/playground/index.tsx`

すべてのナビゲーションで server loader が実行される。GitHub 認証フローでない通常アクセスでも毎回サーバーリクエストが走る。

**修正案**: URL パラメータ（`fromOAuth=1` 等）がある場合のみ `serverLoader()` を呼ぶなど条件分岐を検討。
