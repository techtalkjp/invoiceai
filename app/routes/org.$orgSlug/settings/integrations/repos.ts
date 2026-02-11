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
    return { ghOrgs: [], repos: [] }
  }

  const url = new URL(request.url)
  const ghOrg = url.searchParams.get('ghOrg')
  const q = url.searchParams.get('q')

  try {
    const pat = decrypt(source.credentials)
    const [orgs, username] = await Promise.all([
      fetchGitHubOrgs(pat),
      fetchGitHubUsername(pat),
    ])
    const repos = q
      ? await searchRepos(pat, q, ghOrg ?? undefined, username)
      : await fetchRecentRepos(pat, ghOrg ?? undefined)
    return { ghOrgs: orgs, repos }
  } catch {
    return { ghOrgs: [], repos: [] }
  }
}
