import { parseWithZod } from '@conform-to/zod/v4'
import holidayJp from '@holiday-jp/holiday_jp'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import { parseWorkHoursText } from './+ai-parse.server'
import { ClearRowButton } from './+components/clear-row-button'
import { EditableCell } from './+components/editable-cell'
import { HoursCell } from './+components/hours-cell'
import { TextImportDialog } from './+components/text-import-dialog'
import { saveEntries, saveEntry } from './+mutations.server'
import { getClientMonthEntries } from './+queries.server'
import { calculateHours, formSchema } from './+schema'
import type { Route } from './+types/$clientId'

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

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

function formatDateRow(dateStr: string): string {
  const date = new Date(dateStr)
  const dayOfWeek = date.getDay()
  const day = date.getDate()
  return `${day}日 (${DAY_LABELS[dayOfWeek]})`
}

function getHolidayName(dateStr: string): string | null {
  const date = new Date(dateStr)
  const holiday = holidayJp.between(date, date)[0]
  return holiday?.name ?? null
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

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug, clientId } = params
  const { organization, user } = await requireOrgMember(request, orgSlug)

  const url = new URL(request.url)
  const yearParam = url.searchParams.get('year')
  const monthParam = url.searchParams.get('month')

  const now = new Date()
  const year = yearParam ? Number.parseInt(yearParam, 10) : now.getFullYear()
  const month = monthParam
    ? Number.parseInt(monthParam, 10)
    : now.getMonth() + 1

  const clientEntry = await getClientMonthEntries(
    organization.id,
    user.id,
    clientId,
    year,
    month,
  )

  if (!clientEntry) {
    throw new Response('クライアントが見つかりません', { status: 404 })
  }

  const monthDates = getMonthDates(year, month)

  // 前月・次月を計算
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  const monthLabel = formatMonthLabel(year, month)

  // 月合計を計算
  const monthTotal = monthDates.reduce((sum, date) => {
    return sum + (clientEntry.entries[date]?.hours ?? 0)
  }, 0)

  return {
    organization,
    year,
    month,
    monthDates,
    clientEntry,
    prevYear,
    prevMonth,
    nextYear,
    nextMonth,
    monthLabel,
    monthTotal,
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

  if (intent === 'parseText') {
    const { text, year, month } = submission.value
    try {
      const result = await parseWorkHoursText(text, year, month)
      return {
        entries: result.entries,
        parseErrors: result.parseErrors,
        success: true,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'AI解析に失敗しました',
        success: false,
      }
    }
  }

  if (intent === 'saveEntries') {
    const { entries: entriesJson } = submission.value
    try {
      const entries = JSON.parse(entriesJson) as Array<{
        clientId: string
        workDate: string
        startTime?: string
        endTime?: string
        breakMinutes?: number
        description?: string
      }>
      await saveEntries(organization.id, user.id, entries)
      return { lastResult: submission.reply(), success: true }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '保存に失敗しました',
        success: false,
      }
    }
  }

  return { lastResult: submission.reply(), success: false }
}

export default function ClientWorkHours({
  loaderData: {
    year,
    month,
    monthDates,
    clientEntry,
    prevYear,
    prevMonth,
    nextYear,
    nextMonth,
    monthLabel,
  },
  params: { orgSlug, clientId },
}: Route.ComponentProps) {
  // 月合計を動的に計算（編集反映用）
  const currentTotal = monthDates.reduce((sum, date) => {
    const entry = clientEntry.entries[date]
    return sum + (entry?.hours ?? 0)
  }, 0)

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link
                  to={`/org/${orgSlug}/work-hours?year=${year}&month=${month}`}
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <CardTitle>{clientEntry.clientName}</CardTitle>
                <CardDescription>
                  セルをクリックして編集 · Tab/Enterで移動
                </CardDescription>
              </div>
            </div>
            <TextImportDialog clientId={clientId} year={year} month={month} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" asChild>
                <Link
                  to={`/org/${orgSlug}/work-hours/${clientId}?year=${prevYear}&month=${prevMonth}`}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Link>
              </Button>
              <span className="min-w-32 text-center text-lg font-medium">
                {monthLabel}
              </span>
              <Button variant="outline" size="icon" asChild>
                <Link
                  to={`/org/${orgSlug}/work-hours/${clientId}?year=${nextYear}&month=${nextMonth}`}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="text-muted-foreground text-sm">
              合計:{' '}
              <span className="font-bold">{currentTotal.toFixed(1)}h</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">日付</TableHead>
                <TableHead className="w-28 text-center">開始</TableHead>
                <TableHead className="w-28 text-center">終了</TableHead>
                <TableHead className="w-16 text-center">休憩</TableHead>
                <TableHead className="w-16 text-center">稼働</TableHead>
                <TableHead>作業内容</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthDates.map((date) => {
                const entry = clientEntry.entries[date]
                const saturday = isSaturday(date)
                const sunday = isSunday(date)
                const holiday = isHoliday(date)
                const holidayName = getHolidayName(date)
                const isOffDay = saturday || sunday || holiday

                const currentEntry = {
                  startTime: entry?.startTime,
                  endTime: entry?.endTime,
                  breakMinutes: entry?.breakMinutes ?? 0,
                  description: entry?.description,
                }

                // 編集時の時間を計算
                const hours = calculateHours(
                  entry?.startTime,
                  entry?.endTime,
                  entry?.breakMinutes ?? 0,
                )

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
                      <span className={dateColorClass}>
                        {formatDateRow(date)}
                      </span>
                      {holidayName && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          {holidayName}
                        </span>
                      )}
                    </TableCell>
                    <EditableCell
                      clientId={clientId}
                      workDate={date}
                      field="startTime"
                      value={entry?.startTime ?? ''}
                      type="time"
                      currentEntry={currentEntry}
                      className="text-center"
                    />
                    <EditableCell
                      clientId={clientId}
                      workDate={date}
                      field="endTime"
                      value={entry?.endTime ?? ''}
                      type="time"
                      currentEntry={currentEntry}
                      className="text-center"
                    />
                    <EditableCell
                      clientId={clientId}
                      workDate={date}
                      field="breakHours"
                      value={
                        entry?.breakMinutes
                          ? String(entry.breakMinutes / 60)
                          : ''
                      }
                      type="number"
                      suffix="h"
                      currentEntry={currentEntry}
                      className="text-center"
                    />
                    <HoursCell hours={hours} />
                    <EditableCell
                      clientId={clientId}
                      workDate={date}
                      field="description"
                      value={entry?.description ?? ''}
                      placeholder="作業内容"
                      currentEntry={currentEntry}
                      className="text-muted-foreground"
                    />
                    <ClearRowButton
                      clientId={clientId}
                      workDate={date}
                      hasData={!!entry}
                    />
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
