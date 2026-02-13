import { decrypt } from '~/lib/activity-sources/encryption.server'
import { fetchGitHubActivities } from '~/lib/activity-sources/github.server'
import { getSession } from '~/lib/auth-helpers.server'
import { suggestWorkEntriesFromActivities } from '../org.$orgSlug/work-hours/+work-entry-suggest.server'
import { checkAiUsage, recordAiUsage } from './+lib/ai-usage.server'
import { type GitHubResult, getTokenFlash } from './+lib/github-oauth.server'

export async function loadGitHubWithSuggestions(
  request: Request,
  year: number,
  month: number,
): Promise<{
  githubResult: GitHubResult | null
  setCookie: string
  error?: string | undefined
}> {
  const { tokenData, setCookie } = await getTokenFlash(request)

  if (!tokenData) {
    return { githubResult: null, setCookie }
  }

  let accessToken: string
  try {
    accessToken = decrypt(tokenData.encryptedToken)
  } catch {
    return { githubResult: null, setCookie }
  }
  const { username } = tokenData

  // anonymous session の user_id で AI 使用量を追跡
  const session = await getSession(request)
  const userId = session?.user.id

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

    return {
      githubResult: {
        entries: suggestion.entries,
        activities,
        reasoning: suggestion.reasoning,
        username,
        activityCount: activities.length,
        aiUsage: aiUsageAfter,
      } satisfies GitHubResult,
      setCookie,
    }
  } catch (e) {
    console.error('[Playground loader]', e)
    return {
      githubResult: null,
      setCookie,
      error: 'GitHubアクティビティの取得に失敗しました',
    }
  }
}
