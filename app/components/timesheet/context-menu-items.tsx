import { ClipboardPaste, Copy, Trash2 } from 'lucide-react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '~/components/ui/context-menu'
import { useTimesheetStore } from './store'
import type { Clipboard } from './types'

interface TimesheetContextMenuItemsProps {
  clipboard: Clipboard
  onCopy: () => void
  onPaste: () => void
  onPasteWeekdaysOnly: () => void
  onClearSelected: () => void
}

/**
 * タイムシートの右クリックメニュー内容。
 * hasSelection を内部で subscribe するので、親の再レンダリングを防ぐ。
 * ContextMenuContent は Portal 経由なので、このコンポーネントの再レンダリングは
 * 親コンポーネントに伝播しない。
 */
export function TimesheetContextMenuItems({
  clipboard,
  onCopy,
  onPaste,
  onPasteWeekdaysOnly,
  onClearSelected,
}: TimesheetContextMenuItemsProps) {
  const hasSelection = useTimesheetStore((s) => s.selectedDates.length > 0)

  return (
    <ContextMenuContent>
      <ContextMenuItem onClick={onCopy} disabled={!hasSelection}>
        <Copy className="size-4" />
        コピー
      </ContextMenuItem>
      <ContextMenuItem
        onClick={onPaste}
        disabled={!clipboard || clipboard.length === 0 || !hasSelection}
      >
        <ClipboardPaste className="size-4" />
        ペースト
      </ContextMenuItem>
      <ContextMenuItem
        onClick={onPasteWeekdaysOnly}
        disabled={!clipboard || clipboard.length === 0 || !hasSelection}
      >
        <ClipboardPaste className="size-4" />
        平日のみペースト
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={onClearSelected}
        disabled={!hasSelection}
        variant="destructive"
      >
        <Trash2 className="size-4" />
        選択行をクリア
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
