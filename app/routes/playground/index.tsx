import { data, Link, redirect } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '~/components/layout/page-header'
import { PublicLayout } from '~/components/layout/public-layout'
import { authClient } from '~/lib/auth-client'
import { TimesheetDemo } from './+components/timesheet-demo'
import {
  loadActivitiesFromStorage,
  loadFromStorage,
  saveActivities,
} from './+components/use-auto-save'
import type { GitHubResult } from './+lib/github-oauth.server'
import { buildPlaygroundUrl, resolveYearMonth } from './+lib/url-utils'
import { handleParseText, handleStartGitHubOAuth } from './+mutations.server'
import { loadGitHubWithSuggestions } from './+queries.server'
import type { Route } from './+types/index'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const { year, month } = resolveYearMonth(url.searchParams)
  const result = await loadGitHubWithSuggestions(request, year, month)

  return data(
    {
      githubResult: result.githubResult,
      ...(result.error ? { error: result.error } : {}),
    },
    { headers: { 'Set-Cookie': result.setCookie } },
  )
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'startGitHubOAuth') {
    return handleStartGitHubOAuth(formData, request)
  }

  if (intent === 'parseText') {
    return data(await handleParseText(formData, request))
  }

  return redirect('/playground')
}

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
    useActivityStore.getState().setActivities(githubResult.activities)
    saveActivities(monthKey, useActivityStore.getState().activitiesByDate)
  } else {
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

export { HydrateFallback } from './+components/hydrate-fallback'

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
