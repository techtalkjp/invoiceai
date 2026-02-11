import { redirect } from 'react-router'
import {
  fetchGitHubActivities,
  fetchGitHubUsername,
} from '~/lib/activity-sources/github.server'
import { suggestWorkEntriesFromActivities } from '../org.$orgSlug/work-hours/+work-entry-suggest.server'
import {
  clearOAuthStateCookie,
  exchangeCodeForToken,
  parseOAuthStateCookie,
  setResultFlash,
} from './+lib/github-oauth.server'
import type { Route } from './+types/callback'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  // GitHub がエラーを返した場合
  if (error) {
    return redirect('/playground')
  }

  if (!code || !state) {
    return redirect('/playground')
  }

  // Cookie から state + code_verifier を取得
  const oauthState = await parseOAuthStateCookie(request)
  if (!oauthState || oauthState.state !== state) {
    return redirect('/playground')
  }

  const { codeVerifier, year, month } = oauthState
  const redirectUri = `${url.origin}/playground/callback`

  try {
    // code → access_token
    const accessToken = await exchangeCodeForToken(
      code,
      codeVerifier,
      redirectUri,
    )

    // アクティビティ取得
    const username = await fetchGitHubUsername(accessToken)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const activities = await fetchGitHubActivities(
      accessToken,
      username,
      startDate,
      endDate,
    )

    // 提案生成
    const suggestion =
      activities.length > 0
        ? suggestWorkEntriesFromActivities(activities)
        : {
            entries: [],
            reasoning: 'この月のGitHubアクティビティが見つかりませんでした',
          }

    // 結果を flash cookie にセット
    const resultCookie = await setResultFlash(request, {
      entries: suggestion.entries,
      reasoning: suggestion.reasoning,
      username,
      activityCount: activities.length,
    })

    const clearOAuthCookie = await clearOAuthStateCookie()

    return redirect(`/playground?year=${year}&month=${month}`, {
      headers: [
        ['Set-Cookie', resultCookie],
        ['Set-Cookie', clearOAuthCookie],
      ],
    })
  } catch {
    const clearOAuthCookie = await clearOAuthStateCookie()
    return redirect('/playground', {
      headers: { 'Set-Cookie': clearOAuthCookie },
    })
  }
}
