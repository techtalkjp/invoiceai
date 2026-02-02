import holidayJp from '@holiday-jp/holiday_jp'
import { Link } from 'react-router'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import type { MonthEntry } from '../+schema'
import { DayCell } from './day-cell'

type Props = {
  orgSlug: string
  year: number
  month: number
  monthDates: string[]
  monthEntries: MonthEntry[]
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function getHolidayName(dateStr: string): string | null {
  const date = new Date(dateStr)
  const holiday = holidayJp.between(date, date)[0]
  return holiday?.name ?? null
}

function formatDateRow(dateStr: string): string {
  const date = new Date(dateStr)
  const dayOfWeek = date.getDay()
  const day = date.getDate()
  return `${day}日 (${DAY_LABELS[dayOfWeek]})`
}

function isSaturday(dateStr: string): boolean {
  const date = new Date(dateStr)
  return date.getDay() === 6
}

function isSunday(dateStr: string): boolean {
  const date = new Date(dateStr)
  return date.getDay() === 0
}

function isHoliday(dateStr: string): boolean {
  return getHolidayName(dateStr) !== null
}

export function TimesheetGrid({
  orgSlug,
  year,
  month,
  monthDates,
  monthEntries,
}: Props) {
  // 日ごとの合計を計算
  const dailyTotals = monthDates.map((date) =>
    monthEntries.reduce((sum, entry) => {
      const dayEntry = entry.entries[date]
      return sum + (dayEntry?.hours ?? 0)
    }, 0),
  )

  // クライアントごとの月合計を計算
  const clientTotals = monthEntries.map((entry) =>
    monthDates.reduce((sum, date) => {
      const dayEntry = entry.entries[date]
      return sum + (dayEntry?.hours ?? 0)
    }, 0),
  )

  // 月の総合計
  const monthTotal = dailyTotals.reduce((sum, total) => sum + total, 0)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">日付</TableHead>
          {monthEntries.map((entry) => (
            <TableHead key={entry.clientId} className="text-center">
              <Link
                to={`/org/${orgSlug}/work-hours/${entry.clientId}?year=${year}&month=${month}`}
                className="hover:underline"
              >
                {entry.clientName}
              </Link>
            </TableHead>
          ))}
          <TableHead className="w-16 text-center font-bold">計</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {monthDates.map((date, dateIdx) => {
          const saturday = isSaturday(date)
          const sunday = isSunday(date)
          const holiday = isHoliday(date)
          const holidayName = getHolidayName(date)
          const isOffDay = saturday || sunday || holiday

          // 日付の色: 日曜・祝日は赤、土曜は青
          const dateColorClass =
            sunday || holiday
              ? 'text-destructive'
              : saturday
                ? 'text-blue-500'
                : undefined

          return (
            <TableRow
              key={date}
              className={isOffDay ? 'bg-muted/30' : undefined}
            >
              <TableCell className="font-medium">
                <span className={dateColorClass}>{formatDateRow(date)}</span>
                {holidayName && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    {holidayName}
                  </span>
                )}
              </TableCell>
              {monthEntries.map((entry) => {
                const dayEntry = entry.entries[date]
                return (
                  <DayCell
                    key={entry.clientId}
                    clientId={entry.clientId}
                    workDate={date}
                    entry={dayEntry}
                    isWeekend={isOffDay}
                  />
                )
              })}
              <TableCell className="bg-muted/30 text-center font-medium">
                {dailyTotals[dateIdx] !== undefined && dailyTotals[dateIdx] > 0
                  ? dailyTotals[dateIdx].toFixed(1)
                  : '-'}
              </TableCell>
            </TableRow>
          )
        })}

        {/* クライアント合計行 */}
        <TableRow className="border-t-2">
          <TableCell className="font-bold">計</TableCell>
          {clientTotals.map((total, idx) => (
            <TableCell
              key={monthEntries[idx]?.clientId}
              className="text-center font-medium"
            >
              {total > 0 ? total.toFixed(1) : '-'}
            </TableCell>
          ))}
          <TableCell className="bg-primary/10 text-center font-bold">
            {monthTotal > 0 ? monthTotal.toFixed(1) : '-'}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
