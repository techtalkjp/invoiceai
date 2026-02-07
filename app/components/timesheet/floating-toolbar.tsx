import { CalendarDays, ClipboardPaste, Copy, Trash2 } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { useTimesheetStore } from './store'

export function FloatingToolbar() {
  const selectedCount = useTimesheetStore((s) => s.selectedDates.length)
  const hasClipboard = useTimesheetStore(
    (s) => s.clipboard !== null && s.clipboard.length > 0,
  )

  if (selectedCount === 0) return null

  const { copySelection, pasteToSelected, clearSelectedEntries } =
    useTimesheetStore.getState()

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="bg-background/95 flex items-center gap-1 rounded-full border px-2 py-1.5 shadow-lg backdrop-blur sm:gap-2 sm:px-4 sm:py-2">
        <span className="text-xs font-medium whitespace-nowrap sm:text-sm">
          {selectedCount}行
        </span>
        <div className="bg-border h-4 w-px" />

        {/* コピーボタン */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={copySelection}
          title="コピー"
          className="sm:hidden"
        >
          <Copy className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={copySelection}
          className="hidden gap-1.5 sm:inline-flex"
        >
          <Copy className="size-4" />
          コピー
        </Button>

        {/* ペーストボタン */}
        {hasClipboard && (
          <>
            <div className="bg-border hidden h-4 w-px sm:block" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => pasteToSelected()}
              title="ペースト"
              className="sm:hidden"
            >
              <ClipboardPaste className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => pasteToSelected()}
              className="hidden gap-1.5 sm:inline-flex"
            >
              <ClipboardPaste className="size-4" />
              ペースト
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => pasteToSelected(true)}
              title="平日のみペースト"
              className="sm:hidden"
            >
              <CalendarDays className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => pasteToSelected(true)}
              className="hidden gap-1.5 sm:inline-flex"
            >
              <ClipboardPaste className="size-4" />
              平日のみ
            </Button>
          </>
        )}

        {/* クリアボタン */}
        <div className="bg-border hidden h-4 w-px sm:block" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={clearSelectedEntries}
          title="クリア"
          className="text-destructive hover:text-destructive sm:hidden"
        >
          <Trash2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSelectedEntries}
          className="text-destructive hover:text-destructive hidden gap-1.5 sm:inline-flex"
        >
          <Trash2 className="size-4" />
          クリア
        </Button>
      </div>
    </div>
  )
}
