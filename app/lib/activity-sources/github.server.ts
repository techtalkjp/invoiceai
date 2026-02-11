import type { ActivityRecord } from './types'

const GITHUB_API = 'https://api.github.com'

interface GitHubRepo {
  full_name: string
  pushed_at: string | null
}

async function githubFetch<T>(
  path: string,
  pat: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${GITHUB_API}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

/**
 * 認証済みユーザーの最近のリポジトリ一覧を取得
 */
export async function fetchRecentRepos(
  pat: string,
  org?: string | undefined,
): Promise<Array<{ fullName: string; pushedAt: string | null }>> {
  const path = org ? `/orgs/${org}/repos` : '/user/repos'
  const repos = await githubFetch<GitHubRepo[]>(path, pat, {
    sort: 'pushed',
    direction: 'desc',
    per_page: '20',
    type: org ? 'all' : 'owner',
  })
  return repos.map((r) => ({
    fullName: r.full_name,
    pushedAt: r.pushed_at,
  }))
}

/**
 * リポジトリをキーワード検索（GitHub Search API）
 * org が指定されている場合は org: 修飾子を付与
 */
export async function searchRepos(
  pat: string,
  query: string,
  org?: string | undefined,
  username?: string | undefined,
): Promise<Array<{ fullName: string; pushedAt: string | null }>> {
  const scope = org ? `org:${org}` : username ? `user:${username}` : ''
  const qualifiers = scope ? `${query} ${scope}` : query
  const result = await githubFetch<{
    items: GitHubRepo[]
  }>('/search/repositories', pat, {
    q: qualifiers,
    sort: 'updated',
    per_page: '30',
  })
  return result.items.map((r) => ({
    fullName: r.full_name,
    pushedAt: r.pushed_at,
  }))
}

/**
 * ユーザーが所属するGitHub組織一覧を取得
 */
export async function fetchGitHubOrgs(
  pat: string,
): Promise<Array<{ login: string; avatarUrl: string }>> {
  const orgs = await githubFetch<Array<{ login: string; avatar_url: string }>>(
    '/user/orgs',
    pat,
    { per_page: '100' },
  )
  return orgs.map((o) => ({ login: o.login, avatarUrl: o.avatar_url }))
}

/**
 * 認証済みユーザーのユーザー名を取得
 */
export async function fetchGitHubUsername(pat: string): Promise<string> {
  const user = await githubFetch<{ login: string }>('/user', pat)
  return user.login
}

/**
 * GitHub GraphQL API ヘルパー
 */
async function githubGraphQL<T>(
  pat: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    throw new Error(`GitHub GraphQL error: ${res.status} ${res.statusText}`)
  }
  const json = (await res.json()) as {
    data?: T
    errors?: Array<{ message: string }>
  }
  if (json.errors && json.errors.length > 0) {
    throw new Error(`GitHub GraphQL error: ${json.errors[0]?.message}`)
  }
  if (!json.data) {
    throw new Error('GitHub GraphQL error: no data returned')
  }
  return json.data
}

/**
 * ISOタイムスタンプをJSTの「勤務日」文字列に変換
 * タイムシートが30時制（6:00起点）なので、JST 0:00〜5:59 は前日扱い
 */
function isoToJstDate(iso: string): string {
  const utc = new Date(iso)
  // UTC → JST (+9h)
  const jst = new Date(utc.getTime() + 9 * 60 * 60 * 1000)
  // 30時制: 0:00-5:59 のアクティビティは前日の稼働として扱う (-6h)
  const workDay = new Date(jst.getTime() - 6 * 60 * 60 * 1000)
  return workDay.toISOString().slice(0, 10)
}

// GraphQL レスポンス型
interface GqlActivitiesResponse {
  user: {
    contributionsCollection: {
      commitContributionsByRepository: Array<{
        repository: { nameWithOwner: string }
        contributions: {
          nodes: Array<{ commitCount: number; occurredAt: string }>
        }
      }>
      pullRequestReviewContributions: {
        nodes: Array<{
          occurredAt: string
          pullRequestReview: { state: string }
          pullRequest: {
            title: string
            url: string
            repository: { nameWithOwner: string }
          }
        }>
      }
    }
    pullRequests: {
      nodes: Array<{
        title: string
        url: string
        state: string
        merged: boolean
        createdAt: string
        mergedAt: string | null
        closedAt: string | null
        repository: { nameWithOwner: string }
      }>
    }
    issueComments: {
      nodes: Array<{
        url: string
        createdAt: string
        issue: {
          title: string
          repository: { nameWithOwner: string }
        }
      }>
    }
  }
}

const ACTIVITIES_QUERY = `
  query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: 50) {
          repository { nameWithOwner }
          contributions(first: 100) {
            nodes { commitCount occurredAt }
          }
        }
        pullRequestReviewContributions(first: 50) {
          nodes {
            occurredAt
            pullRequestReview { state }
            pullRequest {
              title url
              repository { nameWithOwner }
            }
          }
        }
      }
      pullRequests(first: 50, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          title url state merged createdAt mergedAt closedAt
          repository { nameWithOwner }
        }
      }
      issueComments(first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
        nodes {
          url createdAt
          issue {
            title
            repository { nameWithOwner }
          }
        }
      }
    }
  }
`

/**
 * 指定期間のGitHubアクティビティをGraphQL APIで取得
 */
export async function fetchGitHubActivities(
  pat: string,
  username: string,
  startDate: string,
  endDate: string,
): Promise<ActivityRecord[]> {
  const from = `${startDate}T00:00:00Z`
  const to = `${endDate}T23:59:59Z`

  const data = await githubGraphQL<GqlActivitiesResponse>(
    pat,
    ACTIVITIES_QUERY,
    {
      login: username,
      from,
      to,
    },
  )

  const records: ActivityRecord[] = []

  // コミット（リポジトリ別・日別）
  for (const repoContrib of data.user.contributionsCollection
    .commitContributionsByRepository) {
    const repo = repoContrib.repository.nameWithOwner
    for (const node of repoContrib.contributions.nodes) {
      const eventDate = isoToJstDate(node.occurredAt)
      if (eventDate < startDate || eventDate > endDate) continue
      records.push({
        sourceType: 'github',
        eventType: 'commit',
        eventDate,
        eventTimestamp: node.occurredAt,
        repo,
        title: `${node.commitCount} commits`,
        url: `https://github.com/${repo}`,
        metadata: JSON.stringify({ count: node.commitCount }),
      })
    }
  }

  // PR（作成・マージ・クローズをそれぞれ記録）
  for (const pr of data.user.pullRequests.nodes) {
    const createdDate = isoToJstDate(pr.createdAt)
    if (createdDate >= startDate && createdDate <= endDate) {
      records.push({
        sourceType: 'github',
        eventType: 'pr',
        eventDate: createdDate,
        eventTimestamp: pr.createdAt,
        repo: pr.repository.nameWithOwner,
        title: pr.title,
        url: pr.url,
        metadata: JSON.stringify({ action: 'opened' }),
      })
    }
    if (pr.merged && pr.mergedAt) {
      const mergedDate = isoToJstDate(pr.mergedAt)
      if (mergedDate >= startDate && mergedDate <= endDate) {
        records.push({
          sourceType: 'github',
          eventType: 'pr',
          eventDate: mergedDate,
          eventTimestamp: pr.mergedAt,
          repo: pr.repository.nameWithOwner,
          title: pr.title,
          url: pr.url,
          metadata: JSON.stringify({ action: 'merged' }),
        })
      }
    } else if (pr.state === 'CLOSED' && pr.closedAt) {
      const closedDate = isoToJstDate(pr.closedAt)
      if (closedDate >= startDate && closedDate <= endDate) {
        records.push({
          sourceType: 'github',
          eventType: 'pr',
          eventDate: closedDate,
          eventTimestamp: pr.closedAt,
          repo: pr.repository.nameWithOwner,
          title: pr.title,
          url: pr.url,
          metadata: JSON.stringify({ action: 'closed' }),
        })
      }
    }
  }

  // レビュー
  for (const review of data.user.contributionsCollection
    .pullRequestReviewContributions.nodes) {
    const eventDate = isoToJstDate(review.occurredAt)
    if (eventDate < startDate || eventDate > endDate) continue
    records.push({
      sourceType: 'github',
      eventType: 'review',
      eventDate,
      eventTimestamp: review.occurredAt,
      repo: review.pullRequest.repository.nameWithOwner,
      title: review.pullRequest.title,
      url: review.pullRequest.url,
      metadata: JSON.stringify({ state: review.pullRequestReview.state }),
    })
  }

  // Issue コメント
  for (const comment of data.user.issueComments.nodes) {
    const eventDate = isoToJstDate(comment.createdAt)
    if (eventDate < startDate || eventDate > endDate) continue
    records.push({
      sourceType: 'github',
      eventType: 'issue_comment',
      eventDate,
      eventTimestamp: comment.createdAt,
      repo: comment.issue.repository.nameWithOwner,
      title: comment.issue.title,
      url: comment.url,
      metadata: null,
    })
  }

  return records
}
