import {
  getActiveSourceUsers,
  getActivitySource,
  insertActivities,
} from '~/lib/activity-sources/activity-queries.server'
import { decrypt } from '~/lib/activity-sources/encryption.server'
import {
  fetchGitHubActivities,
  fetchGitHubUsername,
} from '~/lib/activity-sources/github.server'

interface SyncResult {
  organizationId: string
  userId: string
  inserted: number
  error?: string | undefined
}

/**
 * 1ユーザーのGitHubアクティビティを同期
 */
export async function syncUserGitHubActivities(
  organizationId: string,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<SyncResult> {
  const source = await getActivitySource(organizationId, userId, 'github')
  if (!source) {
    return {
      organizationId,
      userId,
      inserted: 0,
      error: 'No GitHub source configured',
    }
  }

  try {
    const pat = decrypt(source.credentials)
    const username = await fetchGitHubUsername(pat)
    const records = await fetchGitHubActivities(
      pat,
      username,
      startDate,
      endDate,
    )
    const inserted = await insertActivities(organizationId, userId, records)
    return { organizationId, userId, inserted }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { organizationId, userId, inserted: 0, error: message }
  }
}

/**
 * 全アクティブユーザーのGitHubアクティビティを一括同期
 */
export async function syncAllGitHubActivities(
  startDate: string,
  endDate: string,
): Promise<SyncResult[]> {
  const users = await getActiveSourceUsers('github')
  const results: SyncResult[] = []

  for (const user of users) {
    const result = await syncUserGitHubActivities(
      user.organizationId,
      user.userId,
      startDate,
      endDate,
    )
    results.push(result)
  }

  return results
}
