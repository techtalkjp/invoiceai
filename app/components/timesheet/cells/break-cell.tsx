import { memo, useCallback, useState } from 'react'
import { BreakGridPicker } from '~/components/break-grid-picker'
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { cn } from '~/lib/utils'
import { useEntryField, useTimesheetStore } from '../store'
import { navigateToCell } from '../utils'

interface TimesheetBreakCellProps {
  date: string
  col: number
}

const formatBreak = (minutes: number): React.ReactNode => {
  if (minutes === 0) return null
  if (minutes < 60)
    return (
      <span className="whitespace-nowrap">
        {minutes}
        <span className="text-[0.7em]">分</span>
      </span>
    )
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return (
    <span className="whitespace-nowrap">
      {h}
      <span className="text-[0.7em]">時間</span>
      {m > 0 && (
        <>
          {m}
          <span className="text-[0.7em]">分</span>
        </>
      )}
    </span>
  )
}

export const TimesheetBreakCell = memo(function TimesheetBreakCell({
  date,
  col,
}: TimesheetBreakCellProps) {
  // 自分のフィールドのみ subscribe
  const value = useEntryField(date, 'breakMinutes') ?? 0
  const [open, setOpen] = useState(false)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        navigateToCell(date, col, 'up')
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        navigateToCell(date, col, 'down')
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigateToCell(date, col, 'left')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        navigateToCell(date, col, 'right')
      } else if (e.key === 'Tab') {
        e.preventDefault()
        navigateToCell(date, col, e.shiftKey ? 'left' : 'right')
      }
    },
    [date, col],
  )

  const handlePickerSelect = useCallback(
    (v: number) => {
      useTimesheetStore.getState().updateEntry(date, 'breakMinutes', v)
      setOpen(false)
    },
    [date],
  )

  return (
    <div className="px-0.5 py-1 text-center md:px-1" data-col={col}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onKeyDown={handleKeyDown}
            className={cn(
              'h-7 w-full rounded-md border text-center text-sm leading-7',
              'bg-muted/70 border-transparent md:bg-transparent',
              'hover:border-border hover:bg-accent/50',
              'focus:border-primary focus:bg-background focus:outline-none',
            )}
          >
            {formatBreak(value) || '\u00A0'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="center" sideOffset={8}>
          <PopoverArrow className="fill-popover drop-shadow-sm" />
          <BreakGridPicker value={value} onChange={handlePickerSelect} />
        </PopoverContent>
      </Popover>
    </div>
  )
})
