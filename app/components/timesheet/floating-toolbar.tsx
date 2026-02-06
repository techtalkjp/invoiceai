import { CalendarDays, ClipboardPaste, Copy, Trash2 } from 'lucide-react'
import { Button } from '~/components/ui/button'
import type { Clipboard } from './types'

interface FloatingToolbarProps {
  selectedCount: number
  clipboard: Clipboard
  onCopy: () => void
  onPaste: () => void
  onPasteWeekdaysOnly: () => void
  onClearSelected: () => void
}

export function FloatingToolbar({
  selectedCount,
  clipboard,
  onCopy,
  onPaste,
  onPasteWeekdaysOnly,
  onClearSelected,
}: FloatingToolbarProps) {
  if (selectedCount === 0) return null

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
          onClick={onCopy}
          title="コピー"
          className="sm:hidden"
        >
          <Copy className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="hidden gap-1.5 sm:inline-flex"
        >
          <Copy className="size-4" />
          コピー
        </Button>

        {/* ペーストボタン */}
        {clipboard && clipboard.length > 0 && (
          <>
            <div className="bg-border hidden h-4 w-px sm:block" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onPaste}
              title="ペースト"
              className="sm:hidden"
            >
              <ClipboardPaste className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onPaste}
              className="hidden gap-1.5 sm:inline-flex"
            >
              <ClipboardPaste className="size-4" />
              ペースト
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onPasteWeekdaysOnly}
              title="平日のみペースト"
              className="sm:hidden"
            >
              <CalendarDays className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onPasteWeekdaysOnly}
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
          onClick={onClearSelected}
          title="クリア"
          className="text-destructive hover:text-destructive sm:hidden"
        >
          <Trash2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelected}
          className="text-destructive hover:text-destructive hidden gap-1.5 sm:inline-flex"
        >
          <Trash2 className="size-4" />
          クリア
        </Button>
      </div>
    </div>
  )
}
