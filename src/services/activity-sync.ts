import { insertActivities } from '~/lib/activity-sources/activity-queries.server'
import { fetchGitHubActivities } from '~/lib/activity-sources/github.server'
import { db } from '~/lib/db/kysely'
import { getGitHubTokenForOrg } from '~/lib/github-app/get-token-for-org.server'
import { getUserMappings } from '~/lib/github-app/queries.server'

interface SyncResult {
  organizationId: string
  userId: string
  inserted: number
  error?: string | undefined
}

/**
 * 組織の全マッピング済みユーザーの GitHub アクティビティを同期
 * Installation Token を使用
 */
export async function syncOrgGitHubActivities(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<SyncResult[]> {
  let token: string
  try {
    token = await getGitHubTokenForOrg(organizationId)
  } catch (e) {
    return [
      {
        organizationId,
        userId: '',
        inserted: 0,
        error: e instanceof Error ? e.message : String(e),
      },
    ]
  }

  const mappings = await getUserMappings(organizationId)
  if (mappings.length === 0) {
    return [
      {
        organizationId,
        userId: '',
        inserted: 0,
        error: 'No user mappings configured',
      },
    ]
  }

  const results: SyncResult[] = []

  for (const mapping of mappings) {
    try {
      const records = await fetchGitHubActivities(
        token,
        mapping.githubUsername,
        startDate,
        endDate,
      )
      const inserted = await insertActivities(
        organizationId,
        mapping.userId,
        records,
      )
      results.push({ organizationId, userId: mapping.userId, inserted })
    } catch (e) {
      results.push({
        organizationId,
        userId: mapping.userId,
        inserted: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return results
}

/**
 * 全組織の GitHub アクティビティを一括同期（cron 用）
 */
export async function syncAllGitHubActivities(
  startDate: string,
  endDate: string,
): Promise<SyncResult[]> {
  const installations = await db
    .selectFrom('githubInstallation')
    .select('organizationId')
    .where('suspendedAt', 'is', null)
    .execute()

  const results: SyncResult[] = []

  for (const inst of installations) {
    const orgResults = await syncOrgGitHubActivities(
      inst.organizationId,
      startDate,
      endDate,
    )
    results.push(...orgResults)
  }

  return results
}
