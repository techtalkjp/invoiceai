import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ControlBar } from '~/components/layout/control-bar'
import { MonthNav } from '~/components/layout/month-nav'
import { PageHeader } from '~/components/layout/page-header'
import { PublicLayout } from '~/components/layout/public-layout'
import { getMonthDates } from '~/components/timesheet'
import { GRID_COLS } from '~/components/timesheet/table'
import {
  DAY_LABELS,
  getHolidayName,
  isSaturday,
  isSunday,
} from '~/components/timesheet/utils'
import { Skeleton } from '~/components/ui/skeleton'
import { cn } from '~/lib/utils'
import { buildPlaygroundUrl, resolveYearMonth } from '../+lib/url-utils'

export function HydrateFallback() {
  const [searchParams] = useSearchParams()
  const { year, month } = resolveYearMonth(searchParams)
  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])

  return (
    <PublicLayout>
      <div className="mx-auto grid max-w-4xl min-w-0 gap-4 py-4 sm:py-8">
        <PageHeader
          title="Timesheet Playground"
          subtitle="AIでテキストやGitHubアクティビティからタイムシートを自動作成"
        />

        <div className="min-w-0 space-y-1">
          <ControlBar
            left={
              <MonthNav
                year={year}
                month={month}
                buildUrl={buildPlaygroundUrl}
              />
            }
          />

          {/* Table skeleton */}
          <div className="overflow-x-auto rounded-md border">
            <div className="min-w-[460px] md:min-w-[624px]">
              {/* Header */}
              <div className={cn('grid items-center border-b', GRID_COLS)}>
                <div className="px-2 py-2 text-sm font-medium">日付</div>
                <div className="px-2 py-2 text-center text-sm font-medium">
                  開始
                </div>
                <div className="px-2 py-2 text-center text-sm font-medium">
                  終了
                </div>
                <div className="px-2 py-2 text-center text-sm font-medium">
                  休憩
                </div>
                <div className="px-2 py-2 text-center text-sm font-medium">
                  稼働
                </div>
                <div className="px-2 py-2 text-sm font-medium">概要</div>
              </div>
              {/* Skeleton rows */}
              {monthDates.map((date) => {
                const d = new Date(date)
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
                  <div
                    key={date}
                    className={cn(
                      'grid items-center border-b last:border-b-0',
                      GRID_COLS,
                      isOffDay && 'bg-muted/30',
                      !isOffDay && 'odd:bg-muted/10',
                    )}
                  >
                    <div className="flex items-center self-stretch border-l-2 border-transparent py-0.5 font-medium">
                      <div className="flex flex-col px-2">
                        <span
                          className={cn('whitespace-nowrap', dateColorClass)}
                        >
                          {d.getDate()}
                          <span className="text-[10px]">
                            日 ({DAY_LABELS[d.getDay()]})
                          </span>
                        </span>
                        {holidayName && (
                          <span className="text-destructive/70 max-w-20 truncate text-[9px] leading-tight">
                            {holidayName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-0.5 py-1">
                      <Skeleton className="mx-auto h-7 w-10" />
                    </div>
                    <div className="px-0.5 py-1">
                      <Skeleton className="mx-auto h-7 w-10" />
                    </div>
                    <div className="px-0.5 py-1">
                      <Skeleton className="mx-auto h-7 w-8" />
                    </div>
                    <div className="px-0.5 py-1">
                      <Skeleton className="mx-auto h-7 w-10" />
                    </div>
                    <div className="px-0.5 py-1">
                      <Skeleton className="h-7 w-24" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <nav className="text-muted-foreground flex items-center justify-center gap-4 text-xs">
          <Link
            to="/playground/forms"
            className="hover:text-foreground underline underline-offset-2"
          >
            Forms Demo
          </Link>
          <Link
            to="/playground/money-input"
            className="hover:text-foreground underline underline-offset-2"
          >
            MoneyInput Demo
          </Link>
        </nav>
      </div>
    </PublicLayout>
  )
}
