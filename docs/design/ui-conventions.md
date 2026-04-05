# UI 実装規約

コンポーネント選定、数値表示、フォーム設計の具体的なルール。

## レイアウト

ルートページは以下の構造（CLAUDE.md 記載のレイアウト規約に準拠）:

```tsx
<div className="grid gap-4">
  <PageHeader title="..." subtitle="..." actions={...} />
  <ContentPanel>
    {/* メインコンテンツ */}
  </ContentPanel>
</div>
```

サブタブ内（`_layout.tsx` の `<Outlet>` 内）は `<ContentPanel>` なしで直接コンテンツを配置してよい。

## 数値・金額の表示

- 金額は右揃え + `tabular-nums`（桁が揃って比較しやすい）
- JPY: `¥6,729`（`toLocaleString()` で3桁カンマ）
- USD: `$45.00`（小数点2桁固定）
- 換算表示: `$45.00 → ¥6,729`
- 混在しない: 1画面内で `¥6,729` と `6,729円` を混ぜない

## フォーム

- 新規ルートは `~/lib/form` の `useForm`（conform future API）を使う
- サーバー action: `parseSubmission` + `coerceFormValue(schema).safeParse()` + `formatResult` + `report`
- 複数 intent は `z.discriminatedUnion('intent', [...])` で型安全に
- `useFetcher` でページ遷移なしの送信。ダイアログの閉じは `useEffect` で
- バリデーションエラーはフィールドの隣に表示

## ダイアログ vs インライン

| ケース                     | 推奨                       |
| -------------------------- | -------------------------- |
| 新規作成（2-5フィールド）  | Dialog                     |
| 単一フィールド編集         | インライン                 |
| 削除確認                   | `confirm()` or AlertDialog |
| 複雑な設定（ステップあり） | Dialog（ステップ内）       |

ダイアログの閉じ:

```tsx
function useFetcherDialog(key, open, onOpenChange) {
  const fetcher = useFetcher({ key })
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && open) onOpenChange(false)
  }, [fetcher.state, fetcher.data, open, onOpenChange])
  return fetcher
}
```

## オブジェクト表示

オブジェクト（経費、クライアント等）はカード形式で:

- 左: アイコン + 名前 + 補足情報
- 右: 主要な値（金額等）+ アクションメニュー
- hover で操作ボタンが表示される
- 折りたたみ可能な詳細（Collapsible）

## 色の使い方

| 意味         | 使用                              |
| ------------ | --------------------------------- |
| 主アクション | `primary`（ボタン、リンク）       |
| 補足情報     | `text-muted-foreground`           |
| 警告・注意   | `text-destructive`                |
| 成功状態     | `text-green-600` or Badge variant |
| 背景の区別   | `bg-muted/50`                     |

## アクセシビリティ

- フォームには `<Label>` を対応づける
- アイコンボタンには `aria-label` or テキスト
- キーボード操作可能（Tab/Enter/Escape）
- 色だけで状態を伝えない（テキストやアイコンも併用）
