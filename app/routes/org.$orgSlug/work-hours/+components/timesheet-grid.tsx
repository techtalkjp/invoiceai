import { ArrowRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { HoursDurationDisplay } from '~/components/time/duration-display'
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

  // クライアント列の均等幅を計算（日付列とヘッダーの合計列を除いた残り）
  const clientCount = monthEntries.length

  return (
    <div className="overflow-x-auto">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-20" />
          {monthEntries.map((entry) => (
            <col
              key={entry.clientId}
              style={{
                width:
                  clientCount > 0
                    ? `${(100 - 10 - 12) / clientCount}%`
                    : undefined,
                minWidth: '5rem',
              }}
            />
          ))}
          <col className="w-24" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead className="bg-background sticky left-0 z-10">
              日付
            </TableHead>
            {monthEntries.map((entry, idx) => (
              <TableHead
                key={entry.clientId}
                className="overflow-hidden text-center"
              >
                <Link
                  to={`/org/${orgSlug}/work-hours/${entry.clientId}?year=${year}&month=${month}`}
                  className="hover:bg-accent inline-flex max-w-full items-center gap-1 truncate rounded-md px-2 py-1 text-sm font-medium transition-colors"
                >
                  <span className="truncate">{entry.clientName}</span>
                  <ArrowRightIcon className="h-3 w-3 shrink-0 opacity-50" />
                </Link>
                {(clientTotals[idx] ?? 0) > 0 && (
                  <div className="text-muted-foreground truncate text-[10px]">
                    <HoursDurationDisplay hours={clientTotals[idx] ?? 0} />
                  </div>
                )}
              </TableHead>
            ))}
            <TableHead className="text-center font-bold">計</TableHead>
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

            const dailyTotal = dailyTotals[dateIdx] ?? 0

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
                  <div className="flex flex-col">
                    <span className={dateColorClass}>
                      {formatDateRow(date)}
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
                <TableCell className="bg-muted/30 text-center text-sm font-medium">
                  {dailyTotal > 0 && (
                    <HoursDurationDisplay hours={dailyTotal} />
                  )}
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
                {total > 0 && (
                  <Link
                    to={`/org/${orgSlug}/work-hours/${monthEntries[idx]?.clientId}?year=${year}&month=${month}`}
                    className="hover:text-primary transition-colors"
                  >
                    <HoursDurationDisplay hours={total} />
                  </Link>
                )}
              </TableCell>
            ))}
            <TableCell className="bg-primary/10 text-center font-bold">
              {monthTotal > 0 && <HoursDurationDisplay hours={monthTotal} />}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
