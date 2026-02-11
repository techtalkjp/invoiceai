import { useEffect } from 'react'
import { data, Link, redirect } from 'react-router'
import { PageHeader } from '~/components/layout/page-header'
import { PublicLayout } from '~/components/layout/public-layout'
import type { MonthData } from '~/components/timesheet'
import { useTimesheetStore } from '~/components/timesheet'
import { monthDataSchema } from '~/components/timesheet/schema'
import { Button } from '~/components/ui/button'
import { TimesheetDemo } from './+components/timesheet-demo'
import {
  type GitHubResult,
  getResultFlash,
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

// server loader: flash cookie から GitHub 結果を読み取り
export async function loader({ request }: Route.LoaderArgs) {
  const { result, setCookie } = await getResultFlash(request)
  return data(
    { githubResult: result },
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
    return startGitHubOAuth(request, year, month)
  }

  return redirect('/playground')
}

// clientLoader: LocalStorage から全月データを読み込み + URL から year/month を取得
export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  const storedData = loadFromStorage()
  const serverData = await serverLoader()

  const url = new URL(request.url)
  const yearParam = url.searchParams.get('year')
  const monthParam = url.searchParams.get('month')

  const now = new Date()
  const year = yearParam ? Number.parseInt(yearParam, 10) : now.getFullYear()
  const month = monthParam
    ? Number.parseInt(monthParam, 10)
    : now.getMonth() + 1

  return {
    storedData,
    year,
    month,
    githubResult: (serverData?.githubResult as GitHubResult | null) ?? null,
  }
}

clientLoader.hydrate = true as const

export function meta() {
  return [
    { title: 'Timesheet Playground - InvoiceAI' },
    { name: 'description', content: 'Timesheet component playground' },
  ]
}

function useApplyGitHubResult(githubResult: GitHubResult | null) {
  // flash cookie の結果を Zustand store に同期
  useEffect(() => {
    if (!githubResult || githubResult.entries.length === 0) return
    const monthData: MonthData = {}
    for (const entry of githubResult.entries) {
      monthData[entry.workDate] = {
        startTime: entry.startTime,
        endTime: entry.endTime,
        breakMinutes: entry.breakMinutes,
        description: entry.description,
      }
    }
    useTimesheetStore.getState().setMonthData(monthData)
  }, [githubResult])
}

export function HydrateFallback() {
  return (
    <PublicLayout>
      <div className="mx-auto grid max-w-4xl min-w-0 gap-4 py-4 sm:py-8">
        <PageHeader title="Timesheet Playground" subtitle="読み込み中..." />
      </div>
    </PublicLayout>
  )
}

export default function PlaygroundIndex({ loaderData }: Route.ComponentProps) {
  const { storedData, year, month, githubResult } = loaderData

  useApplyGitHubResult(githubResult)

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
          buildUrl={(y, m) => `/playground?year=${y}&month=${m}`}
          initialData={storedData}
          githubResult={githubResult}
        />
      </div>
    </PublicLayout>
  )
}
