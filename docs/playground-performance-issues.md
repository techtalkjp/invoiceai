# Playground タイムシート パフォーマンス最適化

対象: `app/routes/playground/+components/timesheet-demo.tsx`

## 最終結果

**INP: 972ms → 56ms（94% 改善）** - 目標達成！

| 指標 | 初期値 | 最終値 | 目標 | 状態 |
|------|--------|--------|------|------|
| INP | 972ms | 56ms | 200ms以下 | ✅ Good |

## 改善履歴

### Phase 1: React Compiler 導入

**INP: 972ms → 423ms（-56%）**

| フェーズ | Before | After | 変化 |
|---------|--------|-------|------|
| Input delay | 1ms | 0.8ms | - |
| Processing duration | 372ms | 386ms | +14ms |
| Presentation delay | 599ms | 36ms | **-94%** |

React Compiler が自動的にメモ化を行い、DOM 更新後のレイアウト/ペイント処理が軽量化。

### Phase 2: 行コンポーネント分離 + State コロケーション

**INP: 423ms → 389ms（-8%）**

| フェーズ | Before | After | 変化 |
|---------|--------|-------|------|
| Input delay | 0.8ms | 0.8ms | - |
| Processing duration | 386ms | 355ms | -8% |
| Presentation delay | 36ms | 34ms | - |

実施内容:
1. `TimesheetRow` コンポーネントを分離（map 内のロジックを独立コンポーネントに）
2. `openPickerKey` を `TimesheetRow` 内部の state に移動

### Phase 3: Zustand 外部状態管理

**INP: 389ms → 256ms（-34%）**

| フェーズ | Before | After | 変化 |
|---------|--------|-------|------|
| Input delay | 0.8ms | 0.7ms | - |
| Processing duration | 355ms | 220ms | -38% |
| Presentation delay | 34ms | 35ms | - |

実施内容:
1. Zustand で選択状態を外部 store 化
2. `useIsSelected(date)` セレクタで行ごとに選択状態を購読
3. イベントハンドラを `TimesheetRow` 内部に移動し、`store.getState()` で state を読み取る
4. コールバック props を削除

### Phase 4: Subscribe 最適化 + memo

**INP: 256ms → 56ms（-78%）**

| フェーズ | Before | After | 変化 |
|---------|--------|-------|------|
| Input delay | 0.7ms | 0.3ms | - |
| Processing duration | 220ms | 26ms | **-88%** |
| Presentation delay | 35ms | 30ms | - |

実施内容:
1. `selectedDates` 配列全体の subscribe → `selectedCount`（長さのみ）に変更
2. `TimesheetTable` を `memo` でラップ
3. `handleUpdateEntry` を `useCallback` でメモ化
4. ボタンクリック時の `startSelection` 発火を防止（`HTMLButtonElement` チェック追加）
5. React Compiler を無効化（手動最適化で十分な効果を達成）

### Phase 5: セル単位の細粒度 Subscribe

再レンダリング範囲: 行全体 → 変更されたセルのみ

実施内容:
1. `monthData` を Zustand store に統合（`useTimesheetStore`）
2. `useEntryField(date, field)` セレクタを追加 - 各セルが特定フィールドのみ subscribe
3. 各セルコンポーネントを内部で store を subscribe するように変更:
   - `TimesheetTimeCell` - `field` props で `startTime` / `endTime` を指定
   - `TimesheetBreakCell` - `breakMinutes` のみ subscribe
   - `TimesheetDescriptionCell` - `description` のみ subscribe
   - `TimesheetWorkCell` - 新規追加、稼働時間計算に必要なフィールドのみ subscribe
4. `TimesheetRow` から `entry` の subscribe を削除（選択状態のみ subscribe）
5. `TimesheetDemo` から `monthData` state を削除

**効果:**
- description 編集時に同じ行の他セル（開始時間、終了時間、休憩）は再レンダリングされない
- 各セルが完全に独立してレンダリング

---

## 最適化のポイント

### 1. Zustand セレクタパターン（行単位）

```typescript
// 各行が自分の選択状態のみ subscribe
function useIsSelected(date: string) {
  return useTimesheetStore((state) => state.selectedDates.includes(date))
}

// 親コンポーネントは長さのみ subscribe（配列全体を subscribe しない）
const selectedCount = useTimesheetStore((s) => s.selectedDates.length)
```

### 2. Zustand セレクタパターン（セル単位）

```typescript
// 各セルが自分のフィールドのみ subscribe
function useEntryField<K extends keyof TimesheetEntry>(date: string, field: K) {
  return useTimesheetStore((state) => state.monthData[date]?.[field])
}

// 使用例: description セルは description のみ subscribe
function TimesheetDescriptionCell({ date, col }: { date: string; col: number }) {
  const value = useEntryField(date, 'description') ?? ''
  // ...
}
```

### 3. getState() による非購読読み取り

```typescript
// コールバック内では getState() で読み取り（購読不要）
const handleCopy = useCallback(() => {
  const { selectedDates, monthData } = useTimesheetStore.getState()
  // ...
}, []) // 依存配列が空になる
```

### 4. memo によるコンポーネント分離

```typescript
// 親の再レンダリングから子を保護
const TimesheetTable = memo(function TimesheetTable({
  monthDates,
  onMouseUp,
}: Props) {
  // ...
})
```

### 5. イベントハンドラのガード

```typescript
// 入力要素やボタンでは選択操作を発火させない
const handleMouseDown = (e: React.MouseEvent) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLButtonElement
  ) {
    return
  }
  // ...
}
```

---

## 計測環境

- **計測日**: 2026-02-05
- **環境**: localhost:5173、CPU throttling なし
- **ツール**: Chrome DevTools Performance タブ

## 参考

- [React.memo](https://react.dev/reference/react/memo)
- [useCallback](https://react.dev/reference/react/useCallback)
- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [INP (Interaction to Next Paint)](https://web.dev/articles/inp)
