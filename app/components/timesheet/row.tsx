import { memo } from 'react'
import { cn } from '~/lib/utils'
import {
  TimesheetBreakCell,
  TimesheetDescriptionCell,
  TimesheetTimeCell,
  TimesheetWorkCell,
} from './cells'
import { useIsSelected, useTimesheetStore } from './store'
import { GRID_COLS } from './table'
import { DAY_LABELS, getHolidayName, isSaturday, isSunday } from './utils'

interface TimesheetRowProps {
  date: string
}

export const TimesheetRow = memo(function TimesheetRow({
  date,
}: TimesheetRowProps) {
  // store から自分の選択状態のみ subscribe
  const selected = useIsSelected(date)

  // 選択操作（store から直接取得 - stable reference）
  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLButtonElement
    ) {
      return
    }
    const currentSelectedDates = useTimesheetStore.getState().selectedDates
    if (e.button === 2 && currentSelectedDates.includes(date)) {
      return
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    e.preventDefault()
    useTimesheetStore.getState().startSelection(date, e.shiftKey)
  }

  const handleMouseEnter = () => {
    useTimesheetStore.getState().extendSelection(date)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLButtonElement
    ) {
      return
    }
    useTimesheetStore.getState().startSelection(date, false)
  }

  const saturday = isSaturday(date)
  const sunday = isSunday(date)
  const holidayName = getHolidayName(date)
  const isOffDay = saturday || sunday || holidayName !== null

  const dateColorClass =
    sunday || holidayName
      ? 'text-destructive'
      : saturday
        ? 'text-blue-500'
        : undefined

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: row selection via mouse enter
    <div
      data-date={date}
      className={cn(
        'grid cursor-pointer items-center border-b transition-colors',
        GRID_COLS,
        isOffDay && 'bg-muted/30',
        selected && 'bg-primary/5',
        !selected && !isOffDay && 'odd:bg-muted/10',
        !selected && 'active:bg-muted/40',
        !selected && 'md:hover:bg-muted/50',
      )}
      onMouseEnter={handleMouseEnter}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: date cell for selection start */}
      <div
        className={cn(
          'touch-none border-l-2 py-0.5 font-medium md:touch-auto',
          selected
            ? 'border-primary'
            : 'md:hover:border-primary/30 border-transparent',
        )}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="flex flex-col px-2">
          <span className={cn('whitespace-nowrap', dateColorClass)}>
            {new Date(date).getDate()}
            <span className="text-[10px]">
              日 ({DAY_LABELS[new Date(date).getDay()]})
            </span>
          </span>
          {holidayName && (
            <span
              className="text-destructive/70 max-w-20 truncate text-[9px] leading-tight"
              title={holidayName}
            >
              {holidayName}
            </span>
          )}
        </div>
      </div>
      <TimesheetTimeCell date={date} field="startTime" col={0} nextCol={1} />
      <TimesheetTimeCell
        date={date}
        field="endTime"
        baseTimeField="startTime"
        allow24Plus
        col={1}
        defaultValue="18:00"
        nextCol={0}
      />
      <TimesheetBreakCell date={date} col={2} />
      <TimesheetWorkCell date={date} />
      <TimesheetDescriptionCell date={date} col={3} />
    </div>
  )
})
