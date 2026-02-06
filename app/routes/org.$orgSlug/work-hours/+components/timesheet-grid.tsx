import { ArrowRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { formatMinutesToDuration } from '~/components/time-utils'
import {
  formatDateRow,
  getHolidayName,
  isSaturday,
  isSunday,
} from '~/components/timesheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { cn } from '~/lib/utils'
import type { MonthEntry } from '../+schema'
import { DayCell } from './day-cell'

type Props = {
  orgSlug: string
  year: number
  month: number
  monthDates: string[]
  monthEntries: MonthEntry[]
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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="bg-background sticky left-0 z-10 w-24">
              日付
            </TableHead>
            {monthEntries.map((entry, idx) => (
              <TableHead key={entry.clientId} className="text-center">
                <Link
                  to={`/org/${orgSlug}/work-hours/${entry.clientId}?year=${year}&month=${month}`}
                  className="hover:bg-accent inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition-colors"
                >
                  {entry.clientName}
                  <ArrowRightIcon className="h-3 w-3 opacity-50" />
                </Link>
                <div className="text-muted-foreground text-[10px]">
                  {(clientTotals[idx] ?? 0) > 0
                    ? formatMinutesToDuration(
                        Math.round((clientTotals[idx] ?? 0) * 60),
                      )
                    : '-'}
                </div>
              </TableHead>
            ))}
            <TableHead className="w-16 text-center font-bold">計</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {monthDates.map((date, dateIdx) => {
            const saturday = isSaturday(date)
            const sunday = isSunday(date)
            const holidayName = getHolidayName(date)
            const isOffDay = saturday || sunday || !!holidayName

            // 日付の色: 日曜・祝日は赤、土曜は青
            const dateColorClass =
              sunday || holidayName
                ? 'text-destructive'
                : saturday
                  ? 'text-blue-500'
                  : undefined

            return (
              <TableRow
                key={date}
                className={cn(
                  'transition-colors',
                  isOffDay ? 'bg-muted/30' : 'odd:bg-muted/10',
                  'md:hover:bg-muted/50',
                )}
              >
                <TableCell className="bg-background sticky left-0 z-10 font-medium">
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
                      clientName={entry.clientName}
                      workDate={date}
                      workDateLabel={formatDateRow(date)}
                      entry={dayEntry}
                      isWeekend={isOffDay}
                    />
                  )
                })}
                <TableCell className="bg-muted/30 text-center font-medium">
                  {dailyTotals[dateIdx] !== undefined &&
                  dailyTotals[dateIdx] > 0
                    ? dailyTotals[dateIdx].toFixed(1)
                    : '-'}
                </TableCell>
              </TableRow>
            )
          })}

          {/* クライアント合計行 */}
          <TableRow className="border-t-2">
            <TableCell className="bg-background sticky left-0 z-10 font-bold">
              合計
            </TableCell>
            {clientTotals.map((total, idx) => (
              <TableCell
                key={monthEntries[idx]?.clientId}
                className="text-center font-medium"
              >
                <Link
                  to={`/org/${orgSlug}/work-hours/${monthEntries[idx]?.clientId}?year=${year}&month=${month}`}
                  className="hover:text-primary transition-colors"
                >
                  {total > 0 ? total.toFixed(1) : '-'}
                </Link>
              </TableCell>
            ))}
            <TableCell className="bg-primary/10 text-center font-bold">
              {monthTotal > 0 ? monthTotal.toFixed(1) : '-'}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
