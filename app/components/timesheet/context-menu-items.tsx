import { ClipboardPaste, Copy, Trash2 } from 'lucide-react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '~/components/ui/context-menu'
import { useTimesheetSelector, useTimesheetStoreApi } from './store'

/**
 * タイムシートの右クリックメニュー内容。
 * store から直接 subscribe するので、親コンポーネントへの props 依存がない。
 */
export function TimesheetContextMenuItems() {
  const store = useTimesheetStoreApi()
  const hasSelection = useTimesheetSelector((s) => s.selectedDates.length > 0)
  const hasClipboard = useTimesheetSelector(
    (s) => s.clipboard !== null && s.clipboard.length > 0,
  )

  const { copySelection, pasteToSelected, clearSelectedEntries } =
    store.getState()

  return (
    <ContextMenuContent>
      <ContextMenuItem onClick={copySelection} disabled={!hasSelection}>
        <Copy className="size-4" />
        コピー
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => pasteToSelected()}
        disabled={!hasClipboard || !hasSelection}
      >
        <ClipboardPaste className="size-4" />
        ペースト
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => pasteToSelected(true)}
        disabled={!hasClipboard || !hasSelection}
      >
        <ClipboardPaste className="size-4" />
        平日のみペースト
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={clearSelectedEntries}
        disabled={!hasSelection}
        variant="destructive"
      >
        <Trash2 className="size-4" />
        選択行をクリア
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
