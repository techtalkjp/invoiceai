import { memo, useState } from 'react'
import { TableCell, TableRow } from '~/components/ui/table'
import { cn } from '~/lib/utils'
import {
  TimesheetBreakCell,
  TimesheetDescriptionCell,
  TimesheetTimeCell,
  TimesheetWorkCell,
} from './cells'
import { useIsSelected, useTimesheetStore } from './store'
import { formatDateRow, getHolidayName, isSaturday, isSunday } from './utils'

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

  // Picker の開閉状態を行内で管理（0: startTime, 1: endTime）
  const [openPickerCol, setOpenPickerCol] = useState<number | null>(null)

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
    <TableRow
      data-date={date}
      className={cn(
        'cursor-pointer transition-colors',
        isOffDay && 'bg-muted/30',
        selected && 'bg-primary/5',
        !selected && !isOffDay && 'odd:bg-muted/10',
        !selected && 'active:bg-muted/40',
        !selected && 'md:hover:bg-muted/50',
      )}
      onMouseEnter={handleMouseEnter}
    >
      <TableCell
        className="relative touch-none py-0.5 font-medium md:touch-auto"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {selected && (
          <div className="bg-primary absolute top-0 bottom-0 left-0 w-0.5" />
        )}
        <div className="flex flex-col">
          <span className={dateColorClass}>{formatDateRow(date)}</span>
          {holidayName && (
            <span
              className="text-destructive/70 max-w-20 truncate text-[9px] leading-tight"
              title={holidayName}
            >
              {holidayName}
            </span>
          )}
        </div>
      </TableCell>
      <TimesheetTimeCell
        date={date}
        field="startTime"
        col={0}
        open={openPickerCol === 0}
        onOpenChange={(open) => setOpenPickerCol(open ? 0 : null)}
        onSelectFromPicker={() => {
          // 終了時間が未入力なら終了時間のPickerを開く
          const endTime = useTimesheetStore.getState().monthData[date]?.endTime
          if (!endTime) {
            setOpenPickerCol(1)
          } else {
            // 両方入力済みなら備考欄にフォーカス
            setTimeout(() => {
              const descButton = document.querySelector(
                `[data-date="${date}"] [data-col="3"] button`,
              ) as HTMLButtonElement | null
              descButton?.click()
            }, 0)
          }
        }}
      />
      <TimesheetTimeCell
        date={date}
        field="endTime"
        baseTimeField="startTime"
        allow24Plus
        col={1}
        defaultValue="18:00"
        open={openPickerCol === 1}
        onOpenChange={(open) => setOpenPickerCol(open ? 1 : null)}
        onSelectFromPicker={() => {
          // 開始時間が未入力なら開始時間のPickerを開く
          const startTime =
            useTimesheetStore.getState().monthData[date]?.startTime
          if (!startTime) {
            setOpenPickerCol(0)
          } else {
            // 両方入力済みなら備考欄にフォーカス
            setTimeout(() => {
              const descButton = document.querySelector(
                `[data-date="${date}"] [data-col="3"] button`,
              ) as HTMLButtonElement | null
              descButton?.click()
            }, 0)
          }
        }}
      />
      <TimesheetBreakCell date={date} col={2} />
      <TimesheetWorkCell date={date} />
      <TimesheetDescriptionCell date={date} col={3} />
    </TableRow>
  )
})
