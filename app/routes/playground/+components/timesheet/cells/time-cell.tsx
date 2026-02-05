import { useState } from 'react'
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { TableCell } from '~/components/ui/table'
import { cn } from '~/lib/utils'
import { TimeGridPicker } from '../../time-grid-picker'
import { TimeInput } from '../../time-input'
import { useEntryField, useTimesheetStore } from '../store'
import { navigateToCell } from '../utils'

interface TimesheetTimeCellProps {
  date: string
  field: 'startTime' | 'endTime'
  baseTimeField?: 'startTime' | 'endTime' | undefined
  allow24Plus?: boolean
  disabled?: boolean
  col: number
  defaultValue?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSelectFromPicker?: () => void
}

export function TimesheetTimeCell({
  date,
  field,
  baseTimeField,
  allow24Plus = false,
  disabled = false,
  col,
  defaultValue = '09:00',
  open,
  onOpenChange,
  onSelectFromPicker,
}: TimesheetTimeCellProps) {
  // 自分のフィールドのみ subscribe（フックは常に呼び出す）
  const value = useEntryField(date, field) ?? ''
  const startTime = useEntryField(date, 'startTime')
  const baseTime = baseTimeField === 'startTime' ? startTime : undefined

  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled
    ? (onOpenChange ?? (() => {}))
    : setInternalOpen

  const handleChange = (v: string) => {
    useTimesheetStore.getState().updateEntry(date, field, v)
  }

  return (
    <TableCell className="p-1 text-center" data-col={col}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="inline-block">
            <TimeInput
              value={value}
              onChange={handleChange}
              placeholder=""
              className={cn(
                'h-7! w-20! text-center text-xs',
                'bg-muted/70! border-transparent! md:bg-transparent!',
                'hover:border-border! hover:bg-accent/50!',
                'focus:border-primary! focus:bg-background!',
                disabled && 'pointer-events-none opacity-50',
              )}
              baseTime={baseTime}
              onNavigate={(direction) => navigateToCell(date, col, direction)}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="center" sideOffset={8}>
          <PopoverArrow className="fill-popover drop-shadow-sm" />
          <TimeGridPicker
            value={value || defaultValue}
            onChange={(v) => {
              handleChange(v)
              setIsOpen(false)
              onSelectFromPicker?.()
            }}
            interval={30}
            allow24Plus={allow24Plus}
          />
        </PopoverContent>
      </Popover>
    </TableCell>
  )
}
