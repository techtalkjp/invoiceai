import { memo } from 'react'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { TimesheetRow } from './row'

interface TimesheetTableProps {
  monthDates: string[]
  onMouseUp: () => void
}

// テーブル本体（memo で親の再レンダリングから分離）
export const TimesheetTable = memo(function TimesheetTable({
  monthDates,
  onMouseUp,
}: TimesheetTableProps) {
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
        {monthDates.map((date) => (
          <TimesheetRow key={date} date={date} />
        ))}
      </TableBody>
    </Table>
  )
})
