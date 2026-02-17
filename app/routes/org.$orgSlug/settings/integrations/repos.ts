import { requireOrgMember } from '~/lib/auth-helpers.server'
import { getGitHubTokenForOrg } from '~/lib/github-app/get-token-for-org.server'
import type { Route } from './+types/repos'

interface GitHubRepo {
  full_name: string
  pushed_at: string | null
}

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})

/**
 * Resource route: GitHub リポジトリ一覧
 *
 * GET /org/:orgSlug/settings/integrations/repos?q=keyword
 *
 * Installation Token でアクセス可能なリポジトリを返す
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { organization } = await requireOrgMember(request, params.orgSlug)

  let token: string
  try {
    token = await getGitHubTokenForOrg(organization.id)
  } catch {
    return { repos: [], error: 'not_installed' as const }
  }

  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.toLowerCase()

  try {
    // Installation Token ではリポジトリ一覧を取得
    const res = await fetch(
      'https://api.github.com/installation/repositories?per_page=100&sort=pushed&direction=desc',
      { headers: headers(token) },
    )

    if (!res.ok) {
      return { repos: [], error: 'fetch_failed' as const }
    }

    const data = (await res.json()) as {
      repositories: GitHubRepo[]
    }

    let repos = data.repositories
      .map((r) => ({
        fullName: r.full_name,
        pushedAt: r.pushed_at,
      }))
      .sort((a, b) => {
        const ta = a.pushedAt ?? ''
        const tb = b.pushedAt ?? ''
        return tb.localeCompare(ta)
      })

    // クエリがあればフィルタ（ソート順は維持）
    if (q) {
      repos = repos.filter((r) => r.fullName.toLowerCase().includes(q))
    }

    return { repos, error: null }
  } catch {
    return { repos: [], error: 'fetch_failed' as const }
  }
}
