# Feature Flags 機能の追加

## 目的
新規ユーザー登録の許可/不許可を制御するFeature flags機能を追加する。
将来的には特定テナント/特定ユーザー単位での制御も可能にする。

## DBスキーマ設計

### テーブル構成

```sql
-- Feature flags マスター
CREATE TABLE IF NOT EXISTS "feature_flag" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "key" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "default_value" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "feature_flag_key_idx" ON "feature_flag"("key");
```

**フェーズ1では組織/ユーザー単位のオーバーライドテーブルは追加しない**（YAGNI原則）

### 初期データ
```sql
INSERT INTO "feature_flag" ("id", "key", "description", "default_value")
VALUES ('ff_signup', 'signup_enabled', '新規ユーザー登録の許可', 1);
```

## 実装ファイル

### 1. DBスキーマ追加
**ファイル**: `db/schema.sql`

末尾に `feature_flag` テーブルとインデックスを追加。

### 2. Feature Flagサービス作成
**ファイル**: `app/lib/feature-flags.server.ts` (新規)

```typescript
import { db } from './db/kysely'

export type FeatureFlagKey = 'signup_enabled'

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flag = await db
    .selectFrom('featureFlag')
    .select('defaultValue')
    .where('key', '=', key)
    .executeTakeFirst()

  return flag?.defaultValue === 1
}
```

### 3. auth.tsの修正
**ファイル**: `app/lib/auth.ts`

`databaseHooks.user.create.before` に登録可否チェックを追加:

```typescript
import { APIError } from 'better-auth/api'
import { isFeatureEnabled } from './feature-flags.server'

// databaseHooks内
before: async (user) => {
  // Feature flag: 新規登録が無効な場合はエラー
  const signupEnabled = await isFeatureEnabled('signup_enabled')
  if (!signupEnabled) {
    throw new APIError('BAD_REQUEST', {
      message: '現在、新規登録は受け付けていません',
    })
  }
  // 既存の最初のユーザーをadminにするロジック...
}
```

### 4. signup.tsxの修正（UX向上）
**ファイル**: `app/routes/auth/signup.tsx`

loader追加で事前チェック、フラグOFFならメッセージ表示:

```typescript
export async function loader() {
  const signupEnabled = await isFeatureEnabled('signup_enabled')
  return { signupEnabled }
}

// コンポーネント内
if (!loaderData.signupEnabled) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>登録受付停止中</CardTitle>
        <CardDescription>
          現在、新規登録は受け付けていません。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/auth/signin">ログインはこちら</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
```

### 5. 管理画面追加
**ファイル**: `app/routes/admin/feature-flags/index.tsx` (新規)

- フラグ一覧表示
- グローバル値のON/OFF切り替え

**ファイル**: `app/routes/admin/_layout.tsx`

ナビゲーションに「Feature Flags」追加

## 実装順序

1. `db/schema.sql` にテーブル追加
2. `pnpm db:push` でローカルDB適用
3. `pnpm db:push:production` で本番DB適用
4. `pnpm db:types` で型生成
5. `app/lib/feature-flags.server.ts` 作成
6. `app/lib/auth.ts` 修正
7. `app/routes/auth/signup.tsx` に loader 追加
8. 管理画面 `app/routes/admin/feature-flags/index.tsx` 作成
9. `app/routes/admin/_layout.tsx` にナビ追加
10. 初期データ投入（signup_enabled = 1）

## 検証方法

1. `pnpm dev` で開発サーバー起動
2. 管理画面 `/admin/feature-flags` でフラグ確認
3. `signup_enabled` を OFF に切り替え
4. `/auth/signup` にアクセス → メッセージ表示されることを確認
5. フラグを ON に戻す
6. `/auth/signup` で新規登録できることを確認

## 将来の拡張（今回は実装しない）

- `feature_flag_organization` テーブル（組織単位オーバーライド）
- `feature_flag_user` テーブル（ユーザー単位オーバーライド）
- 評価優先順位: ユーザー > 組織 > グローバルデフォルト
