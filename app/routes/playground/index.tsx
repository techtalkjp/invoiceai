import { useMemo } from 'react'
import { data, Link, redirect, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ControlBar } from '~/components/layout/control-bar'
import { MonthNav } from '~/components/layout/month-nav'
import { PageHeader } from '~/components/layout/page-header'
import { PublicLayout } from '~/components/layout/public-layout'
import type { MonthData } from '~/components/timesheet'
import { getMonthDates } from '~/components/timesheet'
import { timesheetEntrySchema } from '~/components/timesheet/schema'
import { GRID_COLS } from '~/components/timesheet/table'
import {
  DAY_LABELS,
  getHolidayName,
  isSaturday,
  isSunday,
} from '~/components/timesheet/utils'
import { Skeleton } from '~/components/ui/skeleton'
import { decrypt } from '~/lib/activity-sources/encryption.server'
import { fetchGitHubActivities } from '~/lib/activity-sources/github.server'
import { authClient } from '~/lib/auth-client'
import { getSession } from '~/lib/auth-helpers.server'
import { cn } from '~/lib/utils'
import { parseWorkHoursText } from '../org.$orgSlug/work-hours/+ai-parse.server'
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
// エントリ単位で safeParse し、1エントリの不正で月全体が消えるのを防ぐ
function loadFromStorage(): Record<string, MonthData> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    const validated: Record<string, MonthData> = {}
    for (const [monthKey, monthValue] of Object.entries(parsed)) {
      if (typeof monthValue !== 'object' || monthValue === null) continue
      const monthData: MonthData = {}
      for (const [date, entry] of Object.entries(
        monthValue as Record<string, unknown>,
      )) {
        const result = timesheetEntrySchema.safeParse(entry)
        if (result.success) {
          monthData[date] = result.data
        }
        // 不正なエントリはスキップ（他のエントリは保持）
      }
      if (Object.keys(monthData).length > 0) {
        validated[monthKey] = monthData
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

  // anonymous session の user_id で AI 使用量を追跡
  const session = await getSession(request)
  const userId = session?.user.id

  const url = new URL(request.url)
  const { year, month } = resolveYearMonth(url.searchParams)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  try {
    const activities = await fetchGitHubActivities(
      accessToken,
      username,
      startDate,
      endDate,
    )

    const currentMonth = `${year}-${String(month).padStart(2, '0')}`
    let suggestion: Awaited<ReturnType<typeof suggestWorkEntriesFromActivities>>

    const usage = userId
      ? await checkAiUsage(userId, currentMonth)
      : { used: 0, limit: 30, remaining: 30 }

    if (activities.length === 0) {
      suggestion = {
        entries: [],
        reasoning: 'この月のGitHubアクティビティが見つかりませんでした',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        aiDaysUsed: 0,
      }
    } else {
      suggestion = await suggestWorkEntriesFromActivities(activities, {
        aiDaysLimit: usage.remaining,
      })
      if (suggestion.aiDaysUsed > 0 && userId) {
        await recordAiUsage(
          userId,
          currentMonth,
          suggestion.aiDaysUsed,
          suggestion.totalInputTokens,
          suggestion.totalOutputTokens,
          username,
        )
      }
    }

    const aiUsageAfter = {
      used: usage.used + suggestion.aiDaysUsed,
      limit: usage.limit,
      remaining: Math.max(0, usage.remaining - suggestion.aiDaysUsed),
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
          aiUsage: aiUsageAfter,
        } satisfies GitHubResult,
      },
      { headers: { 'Set-Cookie': setCookie } },
    )
  } catch (e) {
    console.error('[Playground loader]', e)
    return data(
      {
        githubResult: null as GitHubResult | null,
        error: 'GitHubアクティビティの取得に失敗しました',
      },
      { headers: { 'Set-Cookie': setCookie } },
    )
  }
}

// action: GitHub OAuth フロー開始 + テキスト解析
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

  if (intent === 'parseText') {
    const session = await getSession(request)
    if (!session?.user) {
      return data({ error: 'セッションが見つかりません' })
    }

    const text = formData.get('text')
    const year = Number(formData.get('year'))
    const month = Number(formData.get('month'))
    if (!text || typeof text !== 'string' || !year || !month) {
      return data({ error: 'パラメータが不正です' })
    }

    const currentMonth = `${year}-${String(month).padStart(2, '0')}`
    const usage = await checkAiUsage(session.user.id, currentMonth)
    if (usage.remaining <= 0) {
      return data({
        error: `AI解析の月間上限（${usage.limit}回）に達しました`,
      })
    }

    try {
      const result = await parseWorkHoursText(text, year, month)
      await recordAiUsage(session.user.id, currentMonth, 1, 0, 0)
      return data({
        entries: result.entries,
        parseErrors: result.parseErrors,
      })
    } catch (e) {
      return data({
        error: e instanceof Error ? e.message : 'AI解析に失敗しました',
      })
    }
  }

  return redirect('/playground')
}

// clientLoader: anonymous sign-in + LocalStorage から全月データを読み込み + GitHub 結果があれば toast
export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  // セッションがなければ anonymous sign-in（AI 解析の使用量追跡に必要）
  const session = await authClient.getSession()
  if (!session?.data) {
    await authClient.signIn.anonymous()
  }

  const storedData = loadFromStorage()

  const url = new URL(request.url)
  const { year, month } = resolveYearMonth(url.searchParams)

  // OAuth コールバックからのリダイレクト時のみ serverLoader を呼ぶ
  // （flash cookie にトークンがある場合のみサーバーリクエストが必要）
  const fromOAuth = url.searchParams.get('fromOAuth') === '1'
  let githubResult: GitHubResult | null = null
  if (fromOAuth) {
    const serverData = await serverLoader()
    githubResult = serverData?.githubResult ?? null
    if ('error' in serverData && typeof serverData.error === 'string') {
      toast.error(serverData.error)
    }
    // fromOAuth パラメータを URL から除去（リロード時の不要な serverLoader 呼び出しを防止）
    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('fromOAuth')
    window.history.replaceState(null, '', cleanUrl.toString())
  }

  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const { useActivityStore } =
    await import('~/components/timesheet/activity-store')

  if (githubResult) {
    // アクティビティを store にセット + localStorage に保存（indicator 表示用）
    useActivityStore.getState().setActivities(githubResult.activities)
    saveActivities(monthKey, useActivityStore.getState().activitiesByDate)
    // entries のマージは ImportPanel 側で行う（即反映 + ハイライトアニメーション）
  } else {
    // サーバーからアクティビティが来なかった場合、localStorage から復元
    const savedActivities = loadActivitiesFromStorage(monthKey)
    if (savedActivities) {
      useActivityStore.getState().setActivitiesByDate(savedActivities)
    }
  }

  return { storedData, year, month, githubResult }
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

export default function PlaygroundIndex({ loaderData }: Route.ComponentProps) {
  const { storedData, year, month, githubResult } = loaderData

  return (
    <PublicLayout>
      <div className="mx-auto grid max-w-4xl min-w-0 gap-4 py-4 sm:py-8">
        <PageHeader
          title="Timesheet Playground"
          subtitle="AIでテキストやGitHubアクティビティからタイムシートを自動作成"
        />

        <TimesheetDemo
          year={year}
          month={month}
          buildUrl={buildPlaygroundUrl}
          initialData={storedData}
          githubResult={githubResult}
        />

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
