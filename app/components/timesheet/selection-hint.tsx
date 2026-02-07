import { useTimesheetStore } from './store'

/**
 * 選択操作のヒントとクリップボード状態表示。
 */
export function SelectionHint() {
  const clipboardCount = useTimesheetStore((s) => s.clipboard?.length ?? 0)

  return (
    <div className="text-muted-foreground text-xs">
      行をクリックで選択 / ドラッグで範囲選択 / Shift+クリックで範囲拡張
      {clipboardCount > 0 && (
        <span className="text-primary ml-2">
          ({clipboardCount}行コピー済み)
        </span>
      )}
    </div>
  )
}
