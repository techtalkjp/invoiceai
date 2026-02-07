import { memo, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { TimesheetRow } from './row'
import { useFilledDatesKey, useTimesheetStore } from './store'

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">日付</TableHead>
          <TableHead className="w-24 text-center">開始</TableHead>
          <TableHead className="w-24 text-center">終了</TableHead>
          <TableHead className="w-20 text-center">休憩</TableHead>
          <TableHead className="w-20 text-center">稼働</TableHead>
          <TableHead>概要</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody onMouseUp={onMouseUp}>
        {filteredDates.map((date) => (
          <TimesheetRow key={date} date={date} />
        ))}
      </TableBody>
    </Table>
  )
})
