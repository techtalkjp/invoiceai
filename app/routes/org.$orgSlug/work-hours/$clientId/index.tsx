import { parseWithZod } from '@conform-to/zod/v4'
import { PageHeader } from '~/components/layout/page-header'
import { getMonthDates } from '~/components/timesheet'
import {
  deleteClientSourceMapping,
  getActivitySource,
  getClientSourceMappings,
  saveClientSourceMapping,
} from '~/lib/activity-sources/activity-queries.server'
import { decrypt } from '~/lib/activity-sources/encryption.server'
import { fetchGitHubActivities } from '~/lib/activity-sources/github.server'
import type { ActivityRecord } from '~/lib/activity-sources/types'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import { parseWorkHoursText } from '../+ai-parse.server'
import { toServerEntries } from '../+components/data-mapping'
import { WorkHoursTimesheet } from '../+components/work-hours-timesheet'
import { saveEntries, saveEntry, syncMonthEntries } from '../+mutations.server'
import { getClientMonthEntries } from '../+queries.server'
import { formSchema } from '../+schema'
import { suggestWorkEntriesFromActivities } from '../+work-entry-suggest.server'
import type { Route } from './+types/index'

// saveMonthData / suggestFromGitHub は楽観的更新なので revalidation 不要
export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: {
  formData?: FormData
  defaultShouldRevalidate: boolean
}) {
  const intent = formData?.get('intent')
  if (intent === 'saveMonthData' || intent === 'suggestFromGitHub') {
    return false
  }
  return defaultShouldRevalidate
}

export const handle = {
  breadcrumb: (data?: {
    organization?: { slug?: string }
    clientEntry?: { clientName?: string }
  }) => {
    const slug = data?.organization?.slug
    if (!slug) return [{ label: '稼働時間' }]
    return [
      { label: '稼働時間', to: `/org/${slug}/work-hours` },
      { label: data.clientEntry?.clientName ?? '' },
    ]
  },
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

  const [clientEntry, mappings, source] = await Promise.all([
    getClientMonthEntries(organization.id, user.id, clientId, year, month),
    getClientSourceMappings([clientId], 'github'),
    getActivitySource(organization.id, user.id, 'github'),
  ])

  if (!clientEntry) {
    throw new Response('クライアントが見つかりません', { status: 404 })
  }

  // マッピング済みリポジトリのアクティビティを GitHub API から取得
  const activitiesByDate: Record<string, ActivityRecord[]> = {}
  const mappedRepos = new Set(mappings.map((m) => m.sourceIdentifier))
  if (mappedRepos.size > 0 && source?.credentials) {
    try {
      const pat = decrypt(source.credentials)
      // ParseJSONResultsPlugin により config は既にパース済みオブジェクト
      const config = source.config as { username?: string } | null
      const username = config?.username
      if (username) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        const allActivities = await fetchGitHubActivities(
          pat,
          username,
          startDate,
          endDate,
        )
        for (const a of allActivities) {
          if (!a.repo || !mappedRepos.has(a.repo)) continue
          let arr = activitiesByDate[a.eventDate]
          if (!arr) {
            arr = []
            activitiesByDate[a.eventDate] = arr
          }
          arr.push(a)
        }
      }
    } catch {
      // PAT 復号失敗時はアクティビティなしで続行
    }
  }

  const monthDates = getMonthDates(year, month)

  return {
    organization,
    user: { name: user.name },
    year,
    month,
    monthDates,
    clientEntry,
    activitiesByDate,
    hasGitHubPat: !!source,
    mappings,
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug, clientId } = params
  const { organization, user } = await requireOrgMember(request, orgSlug)

  const formData = await request.formData()

  // saveMonthData は FormData で直接送信される（conform 経由ではない）
  const intent = formData.get('intent')
  if (intent === 'saveMonthData') {
    const formClientId = formData.get('clientId') as string
    const yearMonth = (formData.get('yearMonth') as string) || undefined
    const monthDataJson = formData.get('monthData') as string
    try {
      const monthData = JSON.parse(monthDataJson) as Record<
        string,
        {
          startTime: string
          endTime: string
          breakMinutes: number
          description: string
        }
      >
      const entries = toServerEntries(formClientId, monthData)
      await syncMonthEntries(
        organization.id,
        user.id,
        formClientId,
        entries,
        yearMonth,
      )
      return { success: true }
    } catch {
      return { success: false, error: '保存に失敗しました' }
    }
  }

  // suggestFromGitHub は conform 経由せず直接処理
  if (intent === 'suggestFromGitHub') {
    const year = Number(formData.get('year'))
    const month = Number(formData.get('month'))

    const mappings = await getClientSourceMappings([clientId], 'github')
    const mappedRepos = new Set(mappings.map((m) => m.sourceIdentifier))

    if (mappedRepos.size === 0) {
      return { suggestion: null, noActivities: true }
    }

    // activity_source から PAT + username を取得して GitHub API を直接呼出し
    const source = await getActivitySource(organization.id, user.id, 'github')
    if (!source?.credentials) {
      return { suggestion: null, noActivities: true }
    }

    let pat: string
    try {
      pat = decrypt(source.credentials)
    } catch {
      return { suggestion: null, noActivities: true }
    }

    // ParseJSONResultsPlugin により config は既にパース済みオブジェクト
    const config = source.config as { username?: string } | null
    const username = config?.username
    if (!username) {
      return { suggestion: null, noActivities: true }
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const allActivities = await fetchGitHubActivities(
      pat,
      username,
      startDate,
      endDate,
    )
    const activities = allActivities.filter(
      (a) => a.repo && mappedRepos.has(a.repo),
    )

    if (activities.length === 0) {
      return { suggestion: null, noActivities: true }
    }

    const suggestion = await suggestWorkEntriesFromActivities(activities)
    return { suggestion }
  }

  // addMapping / removeMapping は conform 経由せず直接処理
  if (intent === 'addMapping') {
    const repoFullName = formData.get('repoFullName') as string
    if (!repoFullName) return { error: 'リポジトリを選択してください' }
    await saveClientSourceMapping(clientId, 'github', repoFullName)
    return { mappingUpdated: true }
  }

  if (intent === 'removeMapping') {
    const sourceIdentifier = formData.get('sourceIdentifier') as string
    if (!sourceIdentifier) return { error: '対象が見つかりません' }
    await deleteClientSourceMapping(clientId, 'github', sourceIdentifier)
    return { mappingUpdated: true }
  }

  const submission = parseWithZod(formData, { schema: formSchema })

  if (submission.status !== 'success') {
    return { lastResult: submission.reply(), success: false }
  }

  if (submission.value.intent === 'saveEntry') {
    const {
      clientId: entryClientId,
      workDate,
      startTime,
      endTime,
      breakMinutes,
      description,
    } = submission.value
    await saveEntry(organization.id, user.id, {
      clientId: entryClientId,
      workDate,
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      breakMinutes,
      ...(description !== undefined && { description }),
    })
    return { lastResult: submission.reply(), success: true }
  }

  if (submission.value.intent === 'parseText') {
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

  if (submission.value.intent === 'saveEntries') {
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
    organization,
    user,
    year,
    month,
    clientEntry,
    activitiesByDate,
    hasGitHubPat,
    mappings,
  },
  params: { orgSlug, clientId },
}: Route.ComponentProps) {
  return (
    <div className="grid gap-4">
      <PageHeader
        title={clientEntry.clientName}
        subtitle="セルをクリックして編集 · Tab/Enterで移動"
      />

      <WorkHoursTimesheet
        clientId={clientId}
        clientEntry={clientEntry}
        year={year}
        month={month}
        organizationName={organization.name}
        clientName={clientEntry.clientName}
        staffName={user.name}
        activitiesByDate={activitiesByDate}
        buildUrl={(y, m) =>
          `/org/${orgSlug}/work-hours/${clientId}?year=${y}&month=${m}`
        }
        orgSlug={orgSlug}
        hasGitHubPat={hasGitHubPat}
        mappings={mappings}
      />
    </div>
  )
}
