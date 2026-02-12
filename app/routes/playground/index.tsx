import { useMemo } from 'react'
import { data, Link, redirect, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ControlBar } from '~/components/layout/control-bar'
import { MonthNav } from '~/components/layout/month-nav'
import { PageHeader } from '~/components/layout/page-header'
import { PublicLayout } from '~/components/layout/public-layout'
import type { MonthData } from '~/components/timesheet'
import { getMonthDates } from '~/components/timesheet'
import { monthDataSchema } from '~/components/timesheet/schema'
import { GRID_COLS } from '~/components/timesheet/table'
import {
  DAY_LABELS,
  getHolidayName,
  isSaturday,
  isSunday,
} from '~/components/timesheet/utils'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'
import { decrypt } from '~/lib/activity-sources/encryption.server'
import { fetchGitHubActivities } from '~/lib/activity-sources/github.server'
import { cn } from '~/lib/utils'
import { suggestWorkEntriesFromActivities } from '../org.$orgSlug/work-hours/+work-entry-suggest.server'
import { TimesheetDemo } from './+components/timesheet-demo'
import {
  loadActivitiesFromStorage,
  saveActivities,
} from './+components/use-auto-save'
import { checkAiUsage, recordAiUsage } from './+lib/ai-usage.server'
import {
  type GitHubResult,
  getTokenFlash,
  startGitHubOAuth,
} from './+lib/github-oauth.server'
import type { Route } from './+types/index'

const STORAGE_KEY = 'invoiceai-playground-timesheet'

// LocalStorage から全月データを読み込み
function loadFromStorage(): Record<string, MonthData> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    const validated: Record<string, MonthData> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const result = monthDataSchema.safeParse(value)
      if (result.success) {
        validated[key] = result.data
      }
    }
    return validated
  } catch {
    return {}
  }
}

// URL パラメータから year/month を解決
function resolveYearMonth(searchParams: URLSearchParams) {
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')
  const now = new Date()
  const year = yearParam ? Number.parseInt(yearParam, 10) : now.getFullYear()
  const month = monthParam
    ? Number.parseInt(monthParam, 10)
    : now.getMonth() + 1
  return { year, month }
}

const buildPlaygroundUrl = (y: number, m: number) =>
  `/playground?year=${y}&month=${m}`

// server loader: flash cookie からトークンを取得 → アクティビティ取得 → 提案生成
export async function loader({ request }: Route.LoaderArgs) {
  const { tokenData, setCookie } = await getTokenFlash(request)

  if (!tokenData) {
    return data(
      { githubResult: null as GitHubResult | null },
      { headers: { 'Set-Cookie': setCookie } },
    )
  }

  let accessToken: string
  try {
    accessToken = decrypt(tokenData.encryptedToken)
  } catch {
    // ENCRYPTION_KEY 変更等で復号失敗 → 再認証を促す
    return data(
      { githubResult: null as GitHubResult | null },
      { headers: { 'Set-Cookie': setCookie } },
    )
  }
  const { username } = tokenData

  const url = new URL(request.url)
  const { year, month } = resolveYearMonth(url.searchParams)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const activities = await fetchGitHubActivities(
    accessToken,
    username,
    startDate,
    endDate,
  )

  const currentMonth = `${year}-${String(month).padStart(2, '0')}`
  let suggestion: Awaited<ReturnType<typeof suggestWorkEntriesFromActivities>>

  if (activities.length === 0) {
    suggestion = {
      entries: [],
      reasoning: 'この月のGitHubアクティビティが見つかりませんでした',
      totalInputTokens: 0,
      totalOutputTokens: 0,
    }
  } else {
    const usage = await checkAiUsage(username, currentMonth)
    suggestion = await suggestWorkEntriesFromActivities(activities, {
      useAi: usage.allowed,
    })
    if (usage.allowed && suggestion.totalInputTokens > 0) {
      await recordAiUsage(
        username,
        currentMonth,
        suggestion.totalInputTokens,
        suggestion.totalOutputTokens,
      )
    }
  }

  return data(
    {
      githubResult: {
        entries: suggestion.entries,
        activities: activities.map((a) => ({
          sourceType: 'github' as const,
          eventType: a.eventType,
          eventDate: a.eventDate,
          eventTimestamp: a.eventTimestamp,
          repo: a.repo,
          title: a.title,
          url: a.url,
          metadata: a.metadata,
        })),
        reasoning: suggestion.reasoning,
        username,
        activityCount: activities.length,
      } satisfies GitHubResult,
    },
    { headers: { 'Set-Cookie': setCookie } },
  )
}

// action: GitHub OAuth フロー開始
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'startGitHubOAuth') {
    const year = Number(formData.get('year'))
    const month = Number(formData.get('month'))
    if (!year || !month) {
      return redirect('/playground')
    }
    return startGitHubOAuth({
      request,
      returnTo: 'playground',
      metadata: { year, month },
    })
  }

  return redirect('/playground')
}

// clientLoader: LocalStorage から全月データを読み込み + GitHub 結果があれば toast
export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  const storedData = loadFromStorage()

  const url = new URL(request.url)
  const { year, month } = resolveYearMonth(url.searchParams)

  // OAuth コールバックからのリダイレクト時のみ serverLoader を呼ぶ
  // （flash cookie にトークンがある場合のみサーバーリクエストが必要）
  const fromOAuth = url.searchParams.get('fromOAuth') === '1'
  const githubResult = fromOAuth
    ? ((await serverLoader())?.githubResult ?? null)
    : null

  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const { useActivityStore } =
    await import('~/components/timesheet/activity-store')

  // flash cookie でデータが来ていたら storedData にマージ + toast 通知
  if (githubResult) {
    // アクティビティを store にセット + localStorage に即座に保存
    useActivityStore.getState().setActivities(githubResult.activities)
    saveActivities(monthKey, useActivityStore.getState().activitiesByDate)

    if (githubResult.entries.length > 0) {
      const merged: MonthData = { ...storedData[monthKey] }
      for (const entry of githubResult.entries) {
        merged[entry.workDate] = {
          startTime: entry.startTime,
          endTime: entry.endTime,
          breakMinutes: entry.breakMinutes,
          description: entry.description,
        }
      }
      storedData[monthKey] = merged
      toast.success(
        `@${githubResult.username}: ${githubResult.activityCount}件のアクティビティから${githubResult.entries.length}日分を反映しました`,
      )
    } else {
      toast.info(
        `@${githubResult.username} のアクティビティが見つかりませんでした`,
      )
    }
  } else {
    // サーバーからアクティビティが来なかった場合、localStorage から復元
    const savedActivities = loadActivitiesFromStorage(monthKey)
    if (savedActivities) {
      useActivityStore.getState().setActivitiesByDate(savedActivities)
    }
  }

  return { storedData, year, month }
}

clientLoader.hydrate = true as const

export function meta() {
  return [
    { title: 'Timesheet Playground - InvoiceAI' },
    { name: 'description', content: 'Timesheet component playground' },
  ]
}

export function HydrateFallback() {
  const [searchParams] = useSearchParams()
  const { year, month } = resolveYearMonth(searchParams)
  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])

  return (
    <PublicLayout>
      <div className="mx-auto grid max-w-4xl min-w-0 gap-4 py-4 sm:py-8">
        <PageHeader
          title="Timesheet Playground"
          subtitle="月次タイムシートのデモ"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">← トップへ</Link>
            </Button>
          }
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
                      'grid h-[41px] items-center border-b',
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
                      <Skeleton className="mx-auto h-5 w-10" />
                    </div>
                    <div className="px-0.5 py-1">
                      <Skeleton className="mx-auto h-5 w-10" />
                    </div>
                    <div className="px-0.5 py-1">
                      <Skeleton className="mx-auto h-5 w-8" />
                    </div>
                    <div className="px-0.5 py-1">
                      <Skeleton className="mx-auto h-5 w-10" />
                    </div>
                    <div className="px-0.5 py-1">
                      <Skeleton className="h-5 w-24" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}

export default function PlaygroundIndex({ loaderData }: Route.ComponentProps) {
  const { storedData, year, month } = loaderData

  return (
    <PublicLayout>
      <div className="mx-auto grid max-w-4xl min-w-0 gap-4 py-4 sm:py-8">
        <PageHeader
          title="Timesheet Playground"
          subtitle="月次タイムシートのデモ"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">← トップへ</Link>
            </Button>
          }
        />

        <TimesheetDemo
          year={year}
          month={month}
          buildUrl={buildPlaygroundUrl}
          initialData={storedData}
        />
      </div>
    </PublicLayout>
  )
}
