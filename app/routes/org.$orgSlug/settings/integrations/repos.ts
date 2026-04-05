import { getActivitySource } from '~/lib/activity-sources/activity-queries.server'
import { decrypt } from '~/lib/activity-sources/encryption.server'
import {
  fetchGitHubOrgs,
  fetchGitHubUsername,
  fetchRecentRepos,
  searchRepos,
} from '~/lib/activity-sources/github.server'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import type { Route } from './+types/repos'

/**
 * Resource route: GitHub 組織一覧 + リポジトリ一覧
 *
 * GET /org/:orgSlug/settings/integrations/repos?ghOrg=xxx&q=keyword
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { organization, user } = await requireOrgMember(request, params.orgSlug)

  const source = await getActivitySource(organization.id, user.id, 'github')
  if (!source) {
    return {
      ghOrgs: [] as Awaited<ReturnType<typeof fetchGitHubOrgs>>,
      repos: [] as Awaited<ReturnType<typeof fetchRecentRepos>>,
      error: null as string | null,
    }
  }

  const url = new URL(request.url)
  const ghOrg = url.searchParams.get('ghOrg')
  const q = url.searchParams.get('q')

  try {
    const pat = decrypt(source.credentials)
    const config = source.config as { username?: string } | null
    const username = config?.username ?? (await fetchGitHubUsername(pat))
    const [orgs, repos] = await Promise.all([
      fetchGitHubOrgs(pat),
      q
        ? searchRepos(pat, q, ghOrg ?? undefined, username)
        : fetchRecentRepos(pat, ghOrg ?? undefined),
    ])
    return { ghOrgs: orgs, repos, error: null as string | null }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    const isAuthError =
      message.includes('401') || message.includes('Bad credentials')
    return {
      ghOrgs: [] as Awaited<ReturnType<typeof fetchGitHubOrgs>>,
      repos: [] as Awaited<ReturnType<typeof fetchRecentRepos>>,
      error: isAuthError ? 'token_expired' : ('fetch_failed' as string | null),
    }
  }
}
