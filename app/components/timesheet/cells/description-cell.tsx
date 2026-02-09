import { memo, useState } from 'react'
import { cn } from '~/lib/utils'
import { useEntryField, useTimesheetStore } from '../store'
import { navigateToCell } from '../utils'

interface TimesheetDescriptionCellProps {
  date: string
  col: number
}

export const TimesheetDescriptionCell = memo(function TimesheetDescriptionCell({
  date,
  col,
}: TimesheetDescriptionCellProps) {
  // 自分のフィールドのみ subscribe
  const value = useEntryField(date, 'description') ?? ''
  const [isFocused, setIsFocused] = useState(false)

  const handleChange = (v: string) => {
    useTimesheetStore.getState().updateEntry(date, 'description', v)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: prevent ContextMenuTrigger on input cells
    <div
      className="p-1"
      data-col={col}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="relative">
        {/* 高さを確保するための非表示のプレースホルダー（常にline-clamp-3で3行分の高さ） */}
        <div
          aria-hidden="true"
          className="pointer-events-none invisible min-h-7 w-full min-w-32 px-2 py-1 text-base whitespace-pre-wrap"
        >
          <span className="line-clamp-3">{value || '-'}</span>
        </div>

        {/* フォーカス時: 編集用textarea（absolute配置でオーバーレイ） */}
        {isFocused ? (
          <>
            <textarea
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={(e) => {
                // IME変換中は何もしない
                if (e.nativeEvent.isComposing) return

                const textarea = e.target as HTMLTextAreaElement
                const atStart =
                  textarea.selectionStart === 0 && textarea.selectionEnd === 0
                const atEnd =
                  textarea.selectionStart === textarea.value.length &&
                  textarea.selectionEnd === textarea.value.length

                // Shift+Enterで改行を許可、Enterのみで次の行へ
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  navigateToCell(date, col, 'down')
                } else if (e.key === 'Tab') {
                  e.preventDefault()
                  navigateToCell(date, col, e.shiftKey ? 'left' : 'right')
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  navigateToCell(date, col, 'up')
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  navigateToCell(date, col, 'down')
                } else if (e.key === 'ArrowLeft' && atStart) {
                  e.preventDefault()
                  navigateToCell(date, col, 'left')
                } else if (e.key === 'ArrowRight' && atEnd) {
                  e.preventDefault()
                  navigateToCell(date, col, 'right')
                }
              }}
              // biome-ignore lint/a11y/noAutofocus: フォーカス切り替え時に必要
              autoFocus
              rows={1}
              placeholder="概要を入力"
              className={cn(
                'absolute inset-0 field-sizing-content min-h-7 w-full min-w-32 resize-none rounded-md border px-2 py-1 text-base',
                'border-primary bg-background outline-none',
              )}
            />
            <span className="text-muted-foreground/60 pointer-events-none absolute right-1.5 bottom-0.5 hidden text-[9px] md:block">
              Shift+Enter: 改行
            </span>
          </>
        ) : (
          /* 非フォーカス時: line-clampで省略表示（absolute配置でオーバーレイ） */
          <button
            type="button"
            onClick={() => setIsFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault()
                navigateToCell(date, col, e.shiftKey ? 'left' : 'right')
              }
            }}
            className={cn(
              'absolute inset-0 min-h-7 w-full min-w-32 cursor-text rounded-md border px-2 py-1 text-left text-base',
              'bg-muted/70 border-transparent md:bg-transparent',
              'hover:border-border hover:bg-accent/50',
              'focus:border-primary focus:bg-background focus:outline-none',
              !value && 'text-transparent',
            )}
          >
            <span className="line-clamp-3 whitespace-pre-wrap">
              {value || '-'}
            </span>
          </button>
        )}
      </div>
    </div>
  )
})
