import { data } from 'react-router'
import { insertActivities } from '~/lib/activity-sources/activity-queries.server'
import type { ActivityRecord } from '~/lib/activity-sources/types'
import { auth } from '~/lib/auth'
import { db } from '~/lib/db/kysely'
import { saveEntries } from '../../org.$orgSlug/work-hours/+mutations.server'
import { suggestWorkEntriesFromActivities } from '../../org.$orgSlug/work-hours/+work-entry-suggest.server'
import type { Route } from './+types/sync'

interface SyncRequestBody {
  orgSlug: string
  clientId: string
  remoteUrl: string
  activities: ActivityRecord[]
}

/**
 * CLI用: アクティビティ同期
 *
 * POST /api/cli/sync
 * Header: Authorization: Bearer <session-token>
 * Body: { orgSlug, clientId, remoteUrl, activities[] }
 */
export async function action({ request }: Route.ActionArgs) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    throw data({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as SyncRequestBody
  const { orgSlug, clientId, activities } = body

  if (!orgSlug || !clientId || !Array.isArray(activities)) {
    throw data(
      { error: 'orgSlug, clientId, activities are required' },
      { status: 400 },
    )
  }

  // orgSlug → organization 解決
  const organization = await db
    .selectFrom('organization')
    .select(['id', 'slug'])
    .where('slug', '=', orgSlug)
    .executeTakeFirst()

  if (!organization) {
    throw data({ error: 'Organization not found' }, { status: 404 })
  }

  // membership チェック
  const membership = await db
    .selectFrom('member')
    .select('id')
    .where('organizationId', '=', organization.id)
    .where('userId', '=', session.user.id)
    .executeTakeFirst()

  if (!membership) {
    throw data({ error: 'Forbidden' }, { status: 403 })
  }

  // clientId 検証
  const client = await db
    .selectFrom('client')
    .select('id')
    .where('id', '=', clientId)
    .where('organizationId', '=', organization.id)
    .executeTakeFirst()

  if (!client) {
    throw data({ error: 'Client not found' }, { status: 404 })
  }

  // アクティビティ挿入
  const synced = await insertActivities(
    organization.id,
    session.user.id,
    activities,
  )

  // 当月のサマリーを計算
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const monthActivities = await db
    .selectFrom('activity')
    .select([
      'eventType',
      'eventDate',
      'eventTimestamp',
      'repo',
      'title',
      'url',
      'metadata',
    ])
    .where('organizationId', '=', organization.id)
    .where('userId', '=', session.user.id)
    .where('eventDate', '>=', startDate)
    .where('eventDate', '<=', endDate)
    .execute()

  const workDays = new Set(monthActivities.map((a) => a.eventDate)).size
  const commits = monthActivities.filter((a) => a.eventType === 'commit').length
  const prs = monthActivities.filter((a) => a.eventType === 'pr').length
  const reviews = monthActivities.filter((a) => a.eventType === 'review').length
  const comments = monthActivities.filter(
    (a) => a.eventType === 'issue_comment',
  ).length

  // 稼働時間推定: 日ごとにグルーピングし、最初/最後のタイムスタンプから推定
  const estimatedHours = estimateWorkHours(monthActivities)

  // 当月アクティビティから workEntry を自動生成（既存エントリがない日のみ）
  const existingWorkDates = new Set(
    (
      await db
        .selectFrom('workEntry')
        .select('workDate')
        .where('organizationId', '=', organization.id)
        .where('userId', '=', session.user.id)
        .where('clientId', '=', clientId)
        .where('workDate', '>=', startDate)
        .where('workDate', '<=', endDate)
        .execute()
    ).map((e) => e.workDate),
  )

  // 既存 workEntry がない日のアクティビティだけ suggest に渡す
  const activitiesForSuggest: ActivityRecord[] = monthActivities
    .filter((a) => !existingWorkDates.has(a.eventDate))
    .map((a) => ({
      eventType: a.eventType as ActivityRecord['eventType'],
      eventDate: a.eventDate,
      eventTimestamp: a.eventTimestamp,
      repo: a.repo,
      title: a.title,
      url: a.url,
      metadata: (a.metadata ?? null) as never,
    }))

  if (activitiesForSuggest.length > 0) {
    const suggestion = await suggestWorkEntriesFromActivities(
      activitiesForSuggest,
      { aiDaysLimit: 0 },
    )
    if (suggestion.entries.length > 0) {
      await saveEntries(
        organization.id,
        session.user.id,
        suggestion.entries.map((e) => ({
          clientId,
          workDate: e.workDate,
          startTime: e.startTime,
          endTime: e.endTime,
          breakMinutes: e.breakMinutes,
          description: e.description,
        })),
      )
    }
  }

  const origin = new URL(request.url).origin

  return data({
    synced,
    summary: {
      workDays,
      commits,
      prs,
      reviews,
      comments,
      estimatedHours,
      period: { from: startDate, to: endDate },
    },
    webUrl: `${origin}/org/${orgSlug}/work-hours/${clientId}`,
  })
}

function estimateWorkHours(
  activities: Array<{ eventDate: string; eventTimestamp: string }>,
): number {
  // 日付ごとにグルーピング
  const byDate = new Map<string, string[]>()
  for (const a of activities) {
    const existing = byDate.get(a.eventDate)
    if (existing) {
      existing.push(a.eventTimestamp)
    } else {
      byDate.set(a.eventDate, [a.eventTimestamp])
    }
  }

  let totalMinutes = 0
  for (const timestamps of byDate.values()) {
    if (timestamps.length === 0) continue

    const times = timestamps
      .map((t) => new Date(t).getTime())
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b)

    if (times.length === 0) continue

    const first = times[0] ?? 0
    const last = times[times.length - 1] ?? 0
    let durationMinutes = Math.max((last - first) / 60_000, 60) // 最低 1 時間

    // 6 時間超なら 60 分休憩を差し引く
    if (durationMinutes > 360) {
      durationMinutes -= 60
    }

    totalMinutes += durationMinutes
  }

  return Math.round(totalMinutes / 60)
}
