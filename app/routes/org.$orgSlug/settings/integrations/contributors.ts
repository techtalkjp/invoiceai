import { requireOrgMember } from '~/lib/auth-helpers.server'
import { getGitHubTokenForOrg } from '~/lib/github-app/get-token-for-org.server'
import type { Route } from './+types/contributors'

interface GitHubContributor {
  login: string
  avatar_url: string
}

/**
 * Resource route: GitHub コントリビューター一覧
 *
 * GET /org/:orgSlug/settings/integrations/contributors
 *
 * Installation Token でアクセス可能なリポジトリから
 * コントリビューターの login 一覧を返す
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { organization } = await requireOrgMember(request, params.orgSlug)

  const empty = {
    contributors: [] as Array<{ login: string; avatarUrl: string }>,
  }

  let token: string
  try {
    token = await getGitHubTokenForOrg(organization.id)
  } catch {
    return { ...empty, error: 'token_failed' as const }
  }

  try {
    // アクセス可能なリポジトリ一覧（最近 push されたもの上位10件）
    const reposRes = await fetch(
      'https://api.github.com/installation/repositories?per_page=10&sort=pushed',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )

    if (!reposRes.ok) {
      return { ...empty, error: 'repos_failed' as const }
    }

    const reposData = (await reposRes.json()) as {
      repositories: Array<{ full_name: string }>
    }

    if (reposData.repositories.length === 0) {
      return { ...empty, error: 'no_repos' as const }
    }

    // 各リポジトリのコントリビューターを並列取得
    const contributorSets = await Promise.allSettled(
      reposData.repositories.map(async (repo) => {
        const res = await fetch(
          `https://api.github.com/repos/${repo.full_name}/contributors?per_page=30`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          },
        )
        if (!res.ok) return []
        return (await res.json()) as GitHubContributor[]
      }),
    )

    // ユニークな login でまとめる
    const seen = new Map<string, string>()
    for (const result of contributorSets) {
      if (result.status !== 'fulfilled') continue
      for (const c of result.value) {
        if (c.login && !seen.has(c.login)) {
          seen.set(c.login, c.avatar_url)
        }
      }
    }

    const contributors = Array.from(seen.entries())
      .map(([login, avatarUrl]) => ({ login, avatarUrl }))
      .sort((a, b) => a.login.localeCompare(b.login))

    return { contributors, error: null }
  } catch {
    return { ...empty, error: 'fetch_failed' as const }
  }
}
