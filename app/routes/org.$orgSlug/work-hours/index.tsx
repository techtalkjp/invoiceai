import { parseWithZod } from '@conform-to/zod/v4'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import { TimesheetGrid } from './+components/timesheet-grid'
import { saveEntry } from './+mutations.server'
import { getMonthEntries, getTimeBasedClients } from './+queries.server'
import { formSchema } from './+schema'
import type { Route } from './+types/index'

function getMonthDates(year: number, month: number): string[] {
  const dates: string[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    dates.push(dateStr)
  }
  return dates
}

function formatMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`
}

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

  const monthLabel = formatMonthLabel(year, month)

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

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>稼働時間入力</CardTitle>
          <CardDescription>
            月ごとに稼働時間を入力します。セルをクリックして時間を入力してください。
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-4">
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
        </CardHeader>
        <CardContent>
          <TimesheetGrid
            orgSlug={orgSlug}
            year={year}
            month={month}
            monthDates={monthDates}
            monthEntries={monthEntries}
          />
        </CardContent>
      </Card>
    </div>
  )
}
