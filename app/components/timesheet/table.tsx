import { memo, useMemo } from 'react'
import { cn } from '~/lib/utils'
import { TimesheetRow } from './row'
import { useFilledDatesKey, useTimesheetStore } from './store'

/** ヘッダー・各行で共有する grid-template-columns */
export const GRID_COLS = 'grid-cols-[4.5rem_4rem_4rem_4rem_4rem_1fr]'

interface TimesheetTableProps {
  monthDates: string[]
  onMouseUp: () => void
}

// テーブル本体（memo で親の再レンダリングから分離）
export const TimesheetTable = memo(function TimesheetTable({
  monthDates,
  onMouseUp,
}: TimesheetTableProps) {
  const showOnlyFilled = useTimesheetStore((s) => s.showOnlyFilled)
  // monthData 全体ではなく「どの日にデータがあるか」だけを subscribe
  const filledDatesKey = useFilledDatesKey()
  const filteredDates = useMemo(() => {
    if (!showOnlyFilled) return monthDates
    const filledSet = new Set(filledDatesKey.split(','))
    return monthDates.filter((date) => filledSet.has(date))
  }, [showOnlyFilled, monthDates, filledDatesKey])

  return (
    <div className="min-w-[540px]">
      <div className={cn('grid items-center border-b', GRID_COLS)}>
        <div className="px-2 py-2 text-sm font-medium">日付</div>
        <div className="px-2 py-2 text-center text-sm font-medium">開始</div>
        <div className="px-2 py-2 text-center text-sm font-medium">終了</div>
        <div className="px-2 py-2 text-center text-sm font-medium">休憩</div>
        <div className="px-2 py-2 text-center text-sm font-medium">稼働</div>
        <div className="px-2 py-2 text-sm font-medium">概要</div>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse up for selection end */}
      <div onMouseUp={onMouseUp}>
        {filteredDates.map((date) => (
          <TimesheetRow key={date} date={date} />
        ))}
      </div>
    </div>
  )
})
