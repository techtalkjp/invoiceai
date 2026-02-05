import { useState } from 'react'
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { TableCell } from '~/components/ui/table'
import { cn } from '~/lib/utils'
import { BreakGridPicker } from '../../break-grid-picker'
import { useEntryField, useTimesheetStore } from '../store'
import { navigateToCell } from '../utils'

interface TimesheetBreakCellProps {
  date: string
  col: number
}

export function TimesheetBreakCell({ date, col }: TimesheetBreakCellProps) {
  // 自分のフィールドのみ subscribe
  const value = useEntryField(date, 'breakMinutes') ?? 0
  const [open, setOpen] = useState(false)

  const formatBreak = (minutes: number): React.ReactNode => {
    if (minutes === 0) return null
    if (minutes < 60)
      return (
        <>
          {minutes}
          <span className="text-[0.7em]">分</span>
        </>
      )
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return (
      <>
        {h}
        <span className="text-[0.7em]">時間</span>
        {m > 0 && (
          <>
            {m}
            <span className="text-[0.7em]">分</span>
          </>
        )}
      </>
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
  }

  const handleChange = (v: number) => {
    useTimesheetStore.getState().updateEntry(date, 'breakMinutes', v)
  }

  return (
    <TableCell className="p-1 text-center" data-col={col}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onKeyDown={handleKeyDown}
            className={cn(
              'h-7 w-20 rounded-md border text-center leading-7',
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
          <BreakGridPicker
            value={value}
            onChange={(v) => {
              handleChange(v)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </TableCell>
  )
}
