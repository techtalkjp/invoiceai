# Playground タイムシートの UX パターン集

このドキュメントは `app/routes/playground/` 配下のタイムシートコンポーネントで実装されている、使いやすさを向上させるための細かな工夫をまとめたものです。

## 目次

1. [キーボードナビゲーション](#1-キーボードナビゲーション)
2. [時間入力の工夫](#2-時間入力の工夫)
3. [行選択とドラッグ操作](#3-行選択とドラッグ操作)
4. [フォーカス管理とスタイリング](#4-フォーカス管理とスタイリング)
5. [Popover/Picker の UX](#5-popoverpicker-の-ux)
6. [コピー＆ペースト機能](#6-コピーペースト機能)
7. [視覚的フィードバック](#7-視覚的フィードバック)
8. [レスポンシブ対応](#8-レスポンシブ対応)
9. [その他の工夫](#9-その他の工夫)

---

## 1. キーボードナビゲーション

### 1.1 スプレッドシート風セル移動

**ファイル**: `timesheet-demo.tsx` - `navigateToCell()`

```typescript
function navigateToCell(
  currentDate: string,
  currentCol: number,
  direction: 'up' | 'down' | 'left' | 'right',
)
```

- **矢印キー**: 上下左右でセル間を移動
- **Tab / Shift+Tab**: 左右のセルへ移動
- **Enter**: 下のセルへ移動（確定と同時に）

### 1.2 カーソル位置に応じた移動判定

**ファイル**: `time-input.tsx`, `timesheet-demo.tsx` (TimesheetDescriptionCell)

テキスト入力中の矢印キー動作をスプレッドシート風に制御:

- **カーソルが先頭にあるとき**: 左矢印・上矢印でセル移動
- **カーソルが末尾にあるとき**: 右矢印・下矢印でセル移動
- **それ以外**: 通常のテキスト編集

```typescript
const atStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0
const atEnd = textarea.selectionStart === textarea.value.length &&
              textarea.selectionEnd === textarea.value.length

if (e.key === 'ArrowUp' && atStart) {
  e.preventDefault()
  navigateToCell(date, col, 'up')
}
```

### 1.3 時間調整のショートカット

**ファイル**: `time-input.tsx`

- **Shift + ↑**: 時間を15分増加
- **Shift + ↓**: 時間を15分減少

```typescript
if (e.key === 'ArrowUp') {
  if (e.shiftKey) {
    adjustTime(15)  // +15分
  } else {
    onNavigate?.('up')  // セル移動
  }
}
```

### 1.4 IME対応

**ファイル**: `timesheet-demo.tsx` (TimesheetDescriptionCell)

日本語入力中のキー操作を無効化:

```typescript
onKeyDown={(e) => {
  if (e.nativeEvent.isComposing) return  // IME変換中は何もしない
  // ...
}}
```

---

## 2. 時間入力の工夫

### 2.1 あいまい入力パース

**ファイル**: `time-utils.ts` - `parseTimeInput()`

様々な形式の入力を自動認識:

| 入力 | 解釈 |
|------|------|
| `9` | 09:00 |
| `18` | 18:00 |
| `930` | 09:30 |
| `0930` | 09:30 |
| `9:30` | 09:30 |
| `26` | 26:00（翌2:00） |
| `+1h` | 基準時間 +1時間 |
| `+30m` | 基準時間 +30分 |

### 2.2 コロン自動補完

**ファイル**: `time-input.tsx` - `handleChange()`

2桁の有効な時間を入力すると自動でコロンを追加:

```typescript
// 2桁の数字で、有効な時間（0-29）の場合にコロンを自動追加
if (/^\d{2}$/.test(newValue) && !inputValue.includes(':')) {
  const hour = parseInt(newValue, 10)
  if (hour >= 0 && hour <= 29) {
    setInputValue(`${newValue}:`)  // "09" → "09:"
  }
}
```

### 2.3 バックスペース時のコロン削除対応

自動補完されたコロンを削除すると、時間の2桁目も一緒に削除:

```typescript
// "09:" からバックスペースで "09" になった場合、"0" に戻す
if (/^\d{2}$/.test(newValue) && inputValue.endsWith(':') &&
    newValue.length < inputValue.length) {
  setInputValue(newValue.slice(0, 1))  // "09" → "0"
}
```

### 2.4 完全な時間形式からの上書き入力

既に `XX:XX` 形式の場合、数字入力で全置換を開始:

```typescript
// 既に完全な時間形式（XX:XX）の場合、数字入力で全置換開始
if (/^\d{1,2}:\d{2}$/.test(inputValue) && newValue.length > inputValue.length) {
  const addedChar = newValue.slice(-1)
  if (/^\d$/.test(addedChar)) {
    setInputValue(addedChar)  // "09:30" + "1" → "1"
  }
}
```

### 2.5 フォーカス時の全選択

**ファイル**: `time-input.tsx`

```typescript
const handleFocus = useCallback((e: FocusEvent<HTMLInputElement>) => {
  setIsEditing(true)
  e.target.select()  // 全選択してすぐ上書き可能に
}, [])
```

### 2.6 休憩時間の自動設定

**ファイル**: `timesheet-demo.tsx` - `handleUpdateEntry()`

開始・終了時間を入力したとき、休憩が未設定ならデフォルト1時間を設定:

```typescript
if ((field === 'startTime' || field === 'endTime') &&
    value && entry.breakMinutes === 0) {
  updated.breakMinutes = 60  // デフォルト1時間
}
```

---

## 3. 行選択とドラッグ操作

### 3.1 ドラッグ範囲選択

**ファイル**: `timesheet-demo.tsx`

マウスダウン→ドラッグ→マウスアップで複数行を選択:

```typescript
const handleMouseDown = useCallback((date: string, e: React.MouseEvent) => {
  setIsDragging(true)
  setDragStartDate(date)
  setSelectedDates([date])
}, [])

const handleMouseEnter = useCallback((date: string) => {
  if (isDragging && dragStartDate) {
    const range = getDateRange(dragStartDate, date)
    setSelectedDates(range)
  }
}, [isDragging, dragStartDate])
```

### 3.2 Shift+クリックで範囲拡張

```typescript
if (e.shiftKey && selectedDates.length > 0) {
  const lastSelected = selectedDates[selectedDates.length - 1]
  const range = getDateRange(lastSelected, date)
  setSelectedDates(range)
}
```

### 3.3 画面端での自動スクロール

ドラッグ中に画面端（上下80px以内）に近づくと自動スクロール:

```typescript
const scrollThreshold = 80  // 画面端からこのpx以内で自動スクロール開始
const scrollSpeed = 15

const autoScroll = () => {
  if (mouseY < scrollThreshold) {
    window.scrollBy(0, -scrollSpeed)  // 上にスクロール
  } else if (mouseY > viewportHeight - scrollThreshold) {
    window.scrollBy(0, scrollSpeed)   // 下にスクロール
  }
  // スクロール後に選択を更新
  updateSelectionFromMouseY(mouseY)
  scrollAnimationId = requestAnimationFrame(autoScroll)
}
```

### 3.4 テーブル外での選択更新

グローバルな `mousemove` リスナーで、マウスがテーブル外に出ても最も近い行を選択:

```typescript
const updateSelectionFromMouseY = (mouseY: number) => {
  const rows = document.querySelectorAll('[data-date]')
  let closestRow = null
  // マウスY座標から最も近い行を探す
  for (const row of rows) {
    const rect = row.getBoundingClientRect()
    // ...距離計算
  }
  // 選択更新
}
```

### 3.5 選択解除

- **テーブル外クリック**: 選択をクリア
- **同じ行を再クリック**: 1行選択中にその行をクリックで解除

```typescript
if (selectedDates.length === 1 && selectedDates[0] === date) {
  setSelectedDates([])  // 選択クリア
}
```

### 3.6 入力要素クリック時の選択維持

input/textarea/select をクリックした場合は行選択しない:

```typescript
if (e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLSelectElement) {
  return  // 選択しない
}
```

### 3.7 右クリック時の選択維持

既に選択範囲内で右クリックした場合は選択を維持（コンテキストメニュー用）:

```typescript
if (e.button === 2 && selectedDates.includes(date)) {
  return  // 選択を維持
}
```

---

## 4. フォーカス管理とスタイリング

### 4.1 統一されたフォーカススタイル（リングなし）

**ファイル**: `time-input.tsx`, `timesheet-demo.tsx`

全セルでフォーカスリングを非表示にして統一感を出す:

```typescript
// TimeInput
className={cn(
  'focus-visible:ring-0 focus-visible:border-input',
  // ...
)}

// TimesheetDescriptionCell (button)
className={cn(
  'focus:border-primary focus:bg-background focus:outline-none',
  // ...
)}
```

### 4.2 概要欄の表示/編集モード切り替え

**ファイル**: `timesheet-demo.tsx` (TimesheetDescriptionCell)

非フォーカス時は `button` で表示、フォーカス時に `textarea` に切り替え:

```typescript
{isFocused ? (
  <textarea
    autoFocus
    onBlur={() => setIsFocused(false)}
    // ...
  />
) : (
  <button
    onClick={() => setIsFocused(true)}
    // ...
  >
    <span className="line-clamp-3">{value || '-'}</span>
  </button>
)}
```

### 4.3 行の高さを維持するプレースホルダー

概要欄のフォーカス切り替え時に行の高さが変わらないよう、非表示のプレースホルダーで高さを確保:

```typescript
<div className="relative">
  {/* 高さを確保するための非表示のプレースホルダー */}
  <div aria-hidden="true" className="pointer-events-none invisible">
    <span className="line-clamp-3">{value || '-'}</span>
  </div>

  {/* 実際のコンテンツ（absolute配置でオーバーレイ） */}
  {isFocused ? <textarea className="absolute inset-0" /> : <button className="absolute inset-0" />}
</div>
```

### 4.4 ホバー時のインタラクティブなスタイル

```typescript
// 非フォーカス時: 透明ボーダー → ホバーで表示
'border-transparent bg-transparent',
'hover:border-border hover:bg-accent/50',
'focus:border-primary focus:bg-background',
```

---

## 5. Popover/Picker の UX

### 5.1 Picker選択後の自動フォーカス移動

**ファイル**: `timesheet-demo.tsx` - `onSelectFromPicker`

時間Pickerで選択後、次の入力フィールドへ自動遷移:

```typescript
onSelectFromPicker={() => {
  // 終了時間が未入力なら終了時間のPickerを開く
  if (!entry?.endTime) {
    setOpenPickerKey(`${date}-1`)
  } else {
    // 両方入力済みなら備考欄にフォーカス
    setTimeout(() => {
      const descButton = document.querySelector(
        `[data-date="${date}"] [data-col="3"] button`
      )
      descButton?.click()
    }, 0)
  }
}}
```

### 5.2 Picker の開閉状態を一元管理

同時に複数のPickerが開かないよう、キーで状態管理:

```typescript
const [openPickerKey, setOpenPickerKey] = useState<string | null>(null)

// 使用時
open={openPickerKey === `${date}-0`}
onOpenChange={(open) => setOpenPickerKey(open ? `${date}-0` : null)}
```

### 5.3 TimeGridPicker の選択位置自動スクロール

**ファイル**: `time-grid-picker.tsx`

Picker表示時に現在選択中の時間を中央に表示:

```typescript
useLayoutEffect(() => {
  if (selectedRef.current && scrollRef.current) {
    const container = scrollRef.current
    const selected = selectedRef.current
    container.scrollTop = selectedTop - containerHeight / 2 + selectedHeight / 2
  }
}, [])
```

### 5.4 時間帯による色分け

時間帯に応じて視認性を向上:

```typescript
const getCategoryColor = (category: TimeCategory): string => {
  switch (category) {
    case 'early-morning': return 'bg-indigo-100 ...'   // 6時前
    case 'morning': return 'bg-amber-100 ...'          // 6-9時
    case 'daytime': return 'bg-emerald-100 ...'        // 9-18時
    case 'evening': return 'bg-orange-100 ...'         // 18-22時
    case 'night': return 'bg-purple-100 ...'           // 22時以降
  }
}
```

### 5.5 インターバル切り替え

**ファイル**: `time-grid-picker.tsx`

30分/15分/10分刻みを切り替え可能:

```typescript
{([30, 15, 10] as const).map((opt) => (
  <button onClick={() => setInterval(opt)}>
    {opt}分
  </button>
))}
```

### 5.6 BreakGridPicker の自由入力

**ファイル**: `break-grid-picker.tsx`

プリセット以外の値も入力可能:

```typescript
<input
  type="number"
  placeholder="自由入力"
  onKeyDown={(e) => {
    if (e.key === 'Enter') handleCustomSubmit()
  }}
/>
{isCustomValue && (
  <div>現在: {formatBreakLabel(value)}</div>
)}
```

---

## 6. コピー＆ペースト機能

### 6.1 アプリ内クリップボード

**ファイル**: `timesheet-demo.tsx`

選択行のデータをコピー:

```typescript
const handleCopy = useCallback(() => {
  const entries = selectedDates
    .map((date) => monthData[date])
    .filter((e) => e !== undefined)
  setClipboard(entries)
}, [selectedDates, monthData])
```

### 6.2 繰り返しペースト

コピーした内容を選択範囲に繰り返し適用:

```typescript
const handlePaste = useCallback(() => {
  selectedDates.forEach((date, idx) => {
    const entry = clipboard[idx % clipboard.length]  // 繰り返し
    newData[date] = { ...entry }
  })
}, [clipboard, selectedDates])
```

### 6.3 平日のみペースト

土日・祝日を除いてペースト:

```typescript
const handlePasteWeekdaysOnly = useCallback(() => {
  const weekdayDates = selectedDates.filter(isWeekday)
  // ...
}, [clipboard, selectedDates, isWeekday])

const isWeekday = (dateStr: string): boolean => {
  const dayOfWeek = new Date(dateStr).getDay()
  return dayOfWeek !== 0 && dayOfWeek !== 6 && !getHolidayName(dateStr)
}
```

### 6.4 コンテキストメニュー

右クリックでコピー/ペースト/クリア操作:

```typescript
<ContextMenu>
  <ContextMenuTrigger asChild>
    {/* テーブル */}
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onClick={handleCopy}>コピー</ContextMenuItem>
    <ContextMenuItem onClick={handlePaste}>ペースト</ContextMenuItem>
    <ContextMenuItem onClick={handlePasteWeekdaysOnly}>平日のみペースト</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem onClick={handleClearSelected} variant="destructive">
      選択行をクリア
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

---

## 7. 視覚的フィードバック

### 7.1 選択行のハイライト

```typescript
<TableRow
  className={cn(
    isOffDay && 'bg-muted/30',           // 休日は薄いグレー
    selected && 'bg-primary/5',           // 選択中は薄い色
    !selected && 'hover:bg-muted/50',     // 非選択時ホバー
  )}
>
  <TableCell>
    {selected && (
      <div className="bg-primary absolute left-0 w-0.5" />  // 左端に縦線
    )}
  </TableCell>
</TableRow>
```

### 7.2 曜日・祝日の色分け

```typescript
const dateColorClass =
  sunday || holidayName ? 'text-destructive' :    // 日曜・祝日は赤
  saturday ? 'text-blue-500' : undefined          // 土曜は青
```

### 7.3 祝日名のツールチップ

```typescript
{holidayName && (
  <span
    className="text-destructive/70 max-w-16 truncate text-[10px]"
    title={holidayName}  // 省略時はホバーで全文表示
  >
    {holidayName}
  </span>
)}
```

### 7.4 稼働時間の単位表示

数値と単位で視認性を向上:

```typescript
<>
  {hours}<span className="text-[0.7em]">時間</span>
  {mins > 0 && (
    <>{mins}<span className="text-[0.7em]">分</span></>
  )}
</>
```

### 7.5 コピー状態の表示

```typescript
{clipboard && clipboard.length > 0 && (
  <span className="text-primary">
    ({clipboard.length}行コピー済み)
  </span>
)}
```

### 7.6 改行ヒントの表示

概要欄編集中にヒントを表示:

```typescript
{isFocused && (
  <span className="text-muted-foreground absolute right-1 bottom-1.5 text-[10px]">
    Shift+Enter: 改行
  </span>
)}
```

---

## 8. レスポンシブ対応

### 8.1 フローティングツールバー

選択時に画面下部中央にツールバーを表示:

```typescript
{selectedDates.length > 0 && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
    <div className="bg-background/95 rounded-full border shadow-lg backdrop-blur">
      {/* ツールバー内容 */}
    </div>
  </div>
)}
```

### 8.2 モバイル/デスクトップでの表示切り替え

```typescript
{/* モバイル: アイコンのみ */}
<Button size="icon-sm" className="sm:hidden">
  <Copy className="size-4" />
</Button>

{/* デスクトップ: アイコン+テキスト */}
<Button size="sm" className="hidden sm:inline-flex">
  <Copy className="size-4" />
  コピー
</Button>
```

---

## 9. その他の工夫

### 9.1 24時超えサポート

深夜作業に対応（26:00 = 翌2:00）:

```typescript
const maxHour = allow24Plus ? 29 : 23

// 時間帯判定も24時超えに対応
const normalizedHours = hours >= 24 ? hours - 24 : hours
```

### 9.2 サンプルデータ生成

テスト用にワンクリックでサンプルデータを生成:

```typescript
function generateSampleData(year: number, month: number): MonthData {
  // 平日のみランダムにデータを入れる
  if (dayOfWeek !== 0 && dayOfWeek !== 6 && Math.random() > 0.3) {
    data[date] = {
      startTime: `${startHour}:00`,
      endTime: `${endHour}:00`,
      breakMinutes: 60,
    }
  }
}
```

### 9.3 破壊的操作の確認ダイアログ

全クリアなどの操作は AlertDialog で確認:

```typescript
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button>全クリア</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogTitle>全クリア</AlertDialogTitle>
    <AlertDialogDescription>
      すべての入力内容を削除します。この操作は取り消せません。
    </AlertDialogDescription>
    <AlertDialogFooter>
      <AlertDialogCancel>キャンセル</AlertDialogCancel>
      <AlertDialogAction variant="destructive" onClick={handleClearAll}>
        クリア
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 9.4 PDF出力

react-pdf/renderer を使用した稼働報告書のPDF生成:

```typescript
const blob = await generateTimesheetPdf(
  year, month, monthData, monthDates, getHolidayName, pdfInfo
)
downloadBlob(blob, `稼働報告書_${year}年${month}月.pdf`)
```

### 9.5 日本の祝日対応

`@holiday-jp/holiday_jp` パッケージで祝日を判定:

```typescript
import holidayJp from '@holiday-jp/holiday_jp'

function getHolidayName(dateStr: string): string | null {
  const date = new Date(dateStr)
  const holiday = holidayJp.between(date, date)[0]
  return holiday?.name ?? null
}
```

### 9.6 データ属性によるDOM操作

セルナビゲーション用にdata属性を活用:

```typescript
<TableRow data-date={date}>
  <TableCell data-col={0}>...</TableCell>
  <TableCell data-col={1}>...</TableCell>
  <TableCell data-col={2}>...</TableCell>
  <TableCell data-col={3}>...</TableCell>
</TableRow>

// ナビゲーション時
const targetCell = document.querySelector(
  `[data-date="${targetDate}"] [data-col="${targetCol}"]`
)
```

---

## ファイル構成

```
app/routes/playground/
├── index.tsx                      # ルートコンポーネント
└── +components/
    ├── timesheet-demo.tsx         # メインコンポーネント（選択・ナビゲーション・CRUD）
    ├── time-input.tsx             # 時間入力フィールド
    ├── time-grid-picker.tsx       # 時間選択Picker
    ├── break-grid-picker.tsx      # 休憩時間選択Picker
    ├── time-utils.ts              # 時間パース・計算ユーティリティ
    └── timesheet-pdf.tsx          # PDF生成
```
