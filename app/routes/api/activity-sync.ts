import { syncAllGitHubActivities } from '@shared/services/activity-sync'
import { timingSafeEqual } from 'node:crypto'
import { data } from 'react-router'
import type { Route } from './+types/activity-sync'

/**
 * Cron用エンドポイント: 全ユーザーのGitHubアクティビティを同期
 *
 * POST /api/activity-sync
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    throw data({ error: 'Method not allowed' }, { status: 405 })
  }

  // API Key 認証
  const secret = process.env.CRON_SECRET
  if (!secret) {
    throw data({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('Authorization') ?? ''
  const expected = `Bearer ${secret}`
  const authBuf = Buffer.from(authHeader)
  const expBuf = Buffer.from(expected)
  if (authBuf.length !== expBuf.length || !timingSafeEqual(authBuf, expBuf)) {
    throw data({ error: 'Unauthorized' }, { status: 401 })
  }

  // 過去7日間を同期
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const results = await syncAllGitHubActivities(startDate, endDate)

  const summary = {
    totalUsers: results.length,
    totalInserted: results.reduce((sum, r) => sum + r.inserted, 0),
    errorCount: results.filter((r) => r.error).length,
  }

  return data(summary, { status: 200 })
}
