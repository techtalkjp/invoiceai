import { execFileSync } from 'node:child_process'

export interface GhAuthStatus {
  authenticated: boolean
  username: string
}

export interface GhPR {
  number: number
  title: string
  url: string
  state: string // MERGED, CLOSED, OPEN
  createdAt: string
  mergedAt: string | null
  closedAt: string | null
}

export interface GhReview {
  prNumber: number
  prTitle: string
  prUrl: string
  state: string // APPROVED, CHANGES_REQUESTED, COMMENTED
  submittedAt: string
}

export interface GhComment {
  issueNumber: number
  issueTitle: string
  issueUrl: string
  createdAt: string
}

/**
 * gh CLI が認証済みかどうかチェックする。
 * gh が未インストールの場合も authenticated: false を返す。
 */
export function checkGhAuth(): GhAuthStatus {
  try {
    const output = execFileSync(
      'gh',
      ['auth', 'status', '--hostname', 'github.com'],
      {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    // "Logged in to github.com account USERNAME" のようなメッセージからユーザー名を取得
    const match = output.match(/account\s+(\S+)/)
    return { authenticated: true, username: match?.[1] ?? '' } as GhAuthStatus
  } catch (err) {
    // gh auth status は認証済みの場合も stderr に出力することがある
    const stderr = (err as { stderr?: string }).stderr ?? ''
    const match = stderr.match(/account\s+(\S+)/)
    if (match) {
      return { authenticated: true, username: match[1] ?? '' }
    }
    return { authenticated: false, username: '' }
  }
}

/**
 * 指定リポジトリの PR 一覧を取得する。
 * repo は "owner/repo" 形式。
 */
export function fetchPRsSince(repo: string, since: string): GhPR[] {
  try {
    const output = execFileSync(
      'gh',
      [
        'pr',
        'list',
        '--repo',
        repo,
        '--state',
        'all',
        '--search',
        `created:>=${since}`,
        '--json',
        'number,title,url,state,createdAt,mergedAt,closedAt',
        '--limit',
        '100',
      ],
      {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )
    return JSON.parse(output) as GhPR[]
  } catch {
    return []
  }
}

/**
 * 指定リポジトリでユーザーが行ったレビュー一覧を取得する。
 */
export function fetchReviewsSince(
  repo: string,
  since: string,
  username: string,
): GhReview[] {
  try {
    // gh api を使って search API 経由でレビューを取得
    const query = `repo:${repo} reviewed-by:${username} created:>=${since}`
    const output = execFileSync(
      'gh',
      [
        'api',
        'search/issues',
        '-X',
        'GET',
        '-f',
        `q=${query}`,
        '-f',
        'per_page=100',
        '--jq',
        '.items[] | {number, title, html_url, pull_request}',
      ],
      {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )

    // jq の出力は改行区切り JSON
    const reviews: GhReview[] = []
    for (const line of output.trim().split('\n')) {
      if (!line) continue
      try {
        const item = JSON.parse(line) as {
          number: number
          title: string
          html_url: string
          pull_request?: { url: string }
        }
        if (!item.pull_request) continue
        reviews.push({
          prNumber: item.number,
          prTitle: item.title,
          prUrl: item.html_url,
          state: 'COMMENTED', // search API では state を取得できないのでデフォルト
          submittedAt: since, // 正確な日時は個別 API が必要
        })
      } catch {
        continue
      }
    }
    return reviews
  } catch {
    return []
  }
}

/**
 * 指定リポジトリでユーザーが書いたコメント一覧を取得する。
 */
export function fetchCommentsSince(
  repo: string,
  since: string,
  username: string,
): GhComment[] {
  try {
    const query = `repo:${repo} commenter:${username} created:>=${since}`
    const output = execFileSync(
      'gh',
      [
        'api',
        'search/issues',
        '-X',
        'GET',
        '-f',
        `q=${query}`,
        '-f',
        'per_page=100',
        '--jq',
        '.items[] | {number, title, html_url, created_at}',
      ],
      {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )

    const comments: GhComment[] = []
    for (const line of output.trim().split('\n')) {
      if (!line) continue
      try {
        const item = JSON.parse(line) as {
          number: number
          title: string
          html_url: string
          created_at: string
        }
        comments.push({
          issueNumber: item.number,
          issueTitle: item.title,
          issueUrl: item.html_url,
          createdAt: item.created_at,
        })
      } catch {
        continue
      }
    }
    return comments
  } catch {
    return []
  }
}

/**
 * normalizeRemoteUrl の結果から owner/repo 部分を取得する。
 * "github.com/owner/repo" → "owner/repo"
 */
export function extractOwnerRepo(normalizedUrl: string): string | null {
  const match = normalizedUrl.match(/github\.com\/(.+)/)
  return match?.[1] ?? null
}
