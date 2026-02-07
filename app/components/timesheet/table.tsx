import { memo, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { TimesheetRow } from './row'
import { useTimesheetStore } from './store'

interface TimesheetTableProps {
  monthDates: string[]
  onMouseUp: () => void
}

// テーブル本体（memo で親の再レンダリングから分離）
export const TimesheetTable = memo(function TimesheetTable({
  monthDates,
  onMouseUp,
}: TimesheetTableProps) {
  // store selector で配列を新規生成すると snapshot 不安定で無限更新になり得る。
  // selector は参照取得だけにして、配列導出は useMemo で行う。
  const showOnlyFilled = useTimesheetStore((s) => s.showOnlyFilled)
  const monthData = useTimesheetStore((s) => s.monthData)
  const filteredDates = useMemo(() => {
    if (!showOnlyFilled) return monthDates
    return monthDates.filter((date) => {
      const entry = monthData[date]
      return entry?.startTime || entry?.endTime
    })
  }, [showOnlyFilled, monthDates, monthData])

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
