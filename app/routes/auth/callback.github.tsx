import { redirect } from 'react-router'
import { saveActivitySource } from '~/lib/activity-sources/activity-queries.server'
import { encrypt } from '~/lib/activity-sources/encryption.server'
import {
  fetchGitHubActivities,
  fetchGitHubUsername,
} from '~/lib/activity-sources/github.server'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import {
  clearOAuthStateCookie,
  exchangeCodeForToken,
  parseOAuthStateCookie,
} from '~/lib/github-oauth.server'
import { suggestWorkEntriesFromActivities } from '../org.$orgSlug/work-hours/+work-entry-suggest.server'
import { setResultFlash } from '../playground/+lib/github-oauth.server'
import type { Route } from './+types/callback.github'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  // GitHub がエラーを返した場合
  if (error || !code || !state) {
    return redirect('/')
  }

  // Cookie から state + code_verifier を取得
  const oauthState = await parseOAuthStateCookie(request)
  if (!oauthState || oauthState.state !== state) {
    return redirect('/')
  }

  const { codeVerifier, returnTo, metadata } = oauthState
  const redirectUri = `${url.origin}/auth/callback/github`

  try {
    const accessToken = await exchangeCodeForToken(
      code,
      codeVerifier,
      redirectUri,
    )

    if (returnTo === 'playground') {
      return handlePlaygroundCallback(request, accessToken, metadata)
    }

    if (returnTo === 'integrations') {
      return handleIntegrationsCallback(request, accessToken, metadata)
    }

    // 不明な returnTo
    const clearCookie = await clearOAuthStateCookie()
    return redirect('/', { headers: { 'Set-Cookie': clearCookie } })
  } catch {
    const clearCookie = await clearOAuthStateCookie()
    // returnTo に応じてエラー時のリダイレクト先を決定
    const fallback =
      returnTo === 'playground'
        ? '/playground'
        : returnTo === 'integrations' && metadata.orgSlug
          ? `/org/${metadata.orgSlug}/settings/integrations`
          : '/'
    return redirect(fallback, { headers: { 'Set-Cookie': clearCookie } })
  }
}

// --- Playground: アクティビティ取得 → 提案生成 → flash cookie ---

async function handlePlaygroundCallback(
  request: Request,
  accessToken: string,
  metadata: Record<string, unknown>,
): Promise<Response> {
  const year = metadata.year as number
  const month = metadata.month as number

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

  const suggestion =
    activities.length > 0
      ? suggestWorkEntriesFromActivities(activities)
      : {
          entries: [],
          reasoning: 'この月のGitHubアクティビティが見つかりませんでした',
        }

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
}

// --- Integrations: token を暗号化して DB 保存 ---

async function handleIntegrationsCallback(
  request: Request,
  accessToken: string,
  metadata: Record<string, unknown>,
): Promise<Response> {
  const orgSlug = metadata.orgSlug as string

  // 認証チェック（session cookie で判定）
  const { organization, user } = await requireOrgAdmin(request, orgSlug)

  // token の有効性を確認
  await fetchGitHubUsername(accessToken)

  // 暗号化して保存
  const encrypted = encrypt(accessToken)
  await saveActivitySource(organization.id, user.id, 'github', encrypted, null)

  const clearOAuthCookie = await clearOAuthStateCookie()
  return redirect(`/org/${orgSlug}/settings/integrations`, {
    headers: { 'Set-Cookie': clearOAuthCookie },
  })
}
