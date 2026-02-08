import { memo, useCallback, useState } from 'react'
import { TimeGridPicker } from '~/components/time/time-grid-picker'
import { TimeInput } from '~/components/time/time-input'
import {
  Popover,
  PopoverAnchor,
  PopoverArrow,
  PopoverContent,
} from '~/components/ui/popover'
import { cn } from '~/lib/utils'
import { useEntryField, useTimesheetStore } from '../store'
import { navigateToCell } from '../utils'

interface TimesheetTimeCellProps {
  date: string
  field: 'startTime' | 'endTime'
  baseTimeField?: 'startTime' | 'endTime' | undefined
  allow24Plus?: boolean | undefined
  disabled?: boolean | undefined
  col: number
  defaultValue?: string | undefined
  /** Picker から選択後に次のセルへ移動するための col 番号 */
  nextCol?: number | undefined
}

export const TimesheetTimeCell = memo(function TimesheetTimeCell({
  date,
  field,
  baseTimeField,
  allow24Plus = false,
  disabled = false,
  col,
  defaultValue = '09:00',
  nextCol,
}: TimesheetTimeCellProps) {
  // 自分のフィールドのみ subscribe
  const value = useEntryField(date, field) ?? ''
  const startTime = useEntryField(date, 'startTime')
  const baseTime = baseTimeField === 'startTime' ? startTime : undefined

  const [open, setOpen] = useState(false)

  const handleChange = useCallback(
    (v: string) => {
      // 空→空の変更は store を汚さない（不要な保存を防止）
      if (v === '' && !useTimesheetStore.getState().monthData[date]?.[field]) {
        return
      }
      useTimesheetStore.getState().updateEntry(date, field, v)
    },
    [date, field],
  )

  const handlePickerSelect = useCallback(
    (v: string) => {
      useTimesheetStore.getState().updateEntry(date, field, v)
      setOpen(false)
      // Picker 選択後、次のセルへフォーカス移動
      if (nextCol !== undefined) {
        const otherField = field === 'startTime' ? 'endTime' : 'startTime'
        const otherValue =
          useTimesheetStore.getState().monthData[date]?.[otherField]
        if (!otherValue) {
          // 対になる時刻が未入力 → そのセルの input にフォーカス
          setTimeout(() => {
            const input = document.querySelector(
              `[data-date="${date}"] [data-col="${nextCol}"] input`,
            ) as HTMLInputElement | null
            input?.focus()
          }, 0)
        } else {
          // 両方入力済み → 概要欄にフォーカス
          setTimeout(() => {
            const descButton = document.querySelector(
              `[data-date="${date}"] [data-col="3"] button`,
            ) as HTMLButtonElement | null
            descButton?.click()
          }, 0)
        }
      }
    },
    [date, field, nextCol],
  )

  const handleFocus = useCallback(() => {
    setOpen(true)
  }, [])

  const handleNavigate = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      navigateToCell(date, col, direction)
    },
    [date, col],
  )

  return (
    <div className="px-0.5 py-1 text-center md:px-1" data-col={col}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: prevent ContextMenuTrigger on mobile */}
          <div onContextMenu={(e) => e.preventDefault()}>
            <TimeInput
              value={value}
              onChange={handleChange}
              onFocus={handleFocus}
              placeholder=""
              className={cn(
                'h-7! w-full! px-1! text-center text-xs',
                'bg-muted/70! border-transparent! md:bg-transparent!',
                'hover:border-border! hover:bg-accent/50!',
                'focus:border-primary! focus:bg-background!',
                disabled && 'pointer-events-none opacity-50',
              )}
              baseTime={baseTime}
              onNavigate={handleNavigate}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-auto p-2"
          align="center"
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <PopoverArrow className="fill-popover drop-shadow-sm" />
          <TimeGridPicker
            value={value || defaultValue}
            onChange={handlePickerSelect}
            interval={30}
            allow24Plus={allow24Plus}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
})
