import { parseWithZod } from '@conform-to/zod/v4'
import { ChevronLeftIcon, ChevronRightIcon, FilterIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { formatMinutesToDuration } from '~/components/time-utils'
import { getMonthDates } from '~/components/timesheet'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import { formatYearMonthLabel } from '~/utils/month'
import { TimesheetGrid } from './+components/timesheet-grid'
import { saveEntry } from './+mutations.server'
import { getMonthEntries, getTimeBasedClients } from './+queries.server'
import { formSchema } from './+schema'
import type { Route } from './+types/index'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { organization, user } = await requireOrgMember(request, orgSlug)

  const url = new URL(request.url)
  const yearParam = url.searchParams.get('year')
  const monthParam = url.searchParams.get('month')

  const now = new Date()
  const year = yearParam ? Number.parseInt(yearParam, 10) : now.getFullYear()
  const month = monthParam
    ? Number.parseInt(monthParam, 10)
    : now.getMonth() + 1

  const [monthEntries, clients] = await Promise.all([
    getMonthEntries(organization.id, user.id, year, month),
    getTimeBasedClients(organization.id),
  ])

  const monthDates = getMonthDates(year, month)

  // 前月・次月を計算
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  const monthLabel = formatYearMonthLabel(year, month)

  return {
    organization,
    user,
    year,
    month,
    monthDates,
    monthEntries,
    clients,
    prevYear,
    prevMonth,
    nextYear,
    nextMonth,
    monthLabel,
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug } = params
  const { organization, user } = await requireOrgMember(request, orgSlug)

  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: formSchema })

  if (submission.status !== 'success') {
    return { lastResult: submission.reply(), success: false }
  }

  const { intent } = submission.value

  if (intent === 'saveEntry') {
    const {
      clientId,
      workDate,
      startTime,
      endTime,
      breakMinutes,
      description,
    } = submission.value
    await saveEntry(organization.id, user.id, {
      clientId,
      workDate,
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      breakMinutes,
      ...(description !== undefined && { description }),
    })
    return { lastResult: submission.reply(), success: true }
  }

  return { lastResult: submission.reply(), success: false }
}

function computeMonthTotalMinutes(
  monthEntries: Array<{ entries: Record<string, { hours: number }> }>,
  monthDates: string[],
): number {
  let totalMinutes = 0
  for (const entry of monthEntries) {
    for (const date of monthDates) {
      totalMinutes += Math.round((entry.entries[date]?.hours ?? 0) * 60)
    }
  }
  return totalMinutes
}

export default function WorkHours({
  loaderData: {
    year,
    month,
    monthDates,
    monthEntries,
    clients,
    prevYear,
    prevMonth,
    nextYear,
    nextMonth,
    monthLabel,
  },
  params: { orgSlug },
}: Route.ComponentProps) {
  const [showOnlyFilled, setShowOnlyFilled] = useState(false)

  const filteredDates = useMemo(() => {
    if (!showOnlyFilled) return monthDates
    return monthDates.filter((date) =>
      monthEntries.some((entry) => (entry.entries[date]?.hours ?? 0) > 0),
    )
  }, [showOnlyFilled, monthDates, monthEntries])

  if (clients.length === 0) {
    return (
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>稼働時間入力</CardTitle>
            <CardDescription>
              クライアントが登録されていません。まず設定からクライアントを追加してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={`/org/${orgSlug}/clients`}>クライアント設定を開く</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalMinutes = computeMonthTotalMinutes(monthEntries, monthDates)
  const totalLabel =
    totalMinutes > 0 ? formatMinutesToDuration(totalMinutes) : '0h'

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link
            to={`/org/${orgSlug}/work-hours?year=${prevYear}&month=${prevMonth}`}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Link>
        </Button>
        <span className="min-w-32 text-center text-lg font-medium">
          {monthLabel}
        </span>
        <Button variant="outline" size="icon" asChild>
          <Link
            to={`/org/${orgSlug}/work-hours?year=${nextYear}&month=${nextMonth}`}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant={showOnlyFilled ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setShowOnlyFilled((v) => !v)}
          className="text-muted-foreground text-xs"
        >
          <FilterIcon className="size-3.5" />
          入力済みのみ
        </Button>
        <span className="text-muted-foreground text-sm">
          合計:{' '}
          <span className="text-foreground font-medium">{totalLabel}</span>
        </span>
      </div>

      <div className="overflow-hidden rounded-md border">
        <TimesheetGrid
          orgSlug={orgSlug}
          year={year}
          month={month}
          monthDates={filteredDates}
          monthEntries={monthEntries}
        />
      </div>
    </div>
  )
}
