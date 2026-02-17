import { execFileSync } from 'node:child_process'

export interface GitRepoInfo {
  rootPath: string
  remoteUrl: string
}

export interface GitCommit {
  hash: string
  date: string // ISO 8601
  message: string
  filesChanged: number
  additions: number
  deletions: number
}

/**
 * カレントディレクトリの git リポジトリを検出する。
 * .git が見つからなければ null を返す。
 */
export function detectGitRepo(cwd?: string | undefined): GitRepoInfo | null {
  const dir = cwd ?? process.cwd()
  try {
    const rootPath = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()

    let remoteUrl = ''
    try {
      remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], {
        cwd: rootPath,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      // remote がない場合は空文字
    }

    return { rootPath, remoteUrl: normalizeRemoteUrl(remoteUrl) }
  } catch {
    return null
  }
}

/**
 * sinceHash 以降のコミットを取得する。
 * sinceHash が null の場合は直近 90 日分を取得する。
 */
export function getCommitsSince(
  repoPath: string,
  sinceHash: string | null,
): GitCommit[] {
  const format = '%H%n%aI%n%s'
  const args = ['log', `--format=${format}`, '--numstat']

  if (sinceHash) {
    args.push(`${sinceHash}..HEAD`)
  } else {
    args.push('--since=90 days ago')
  }

  let output: string
  try {
    output = execFileSync('git', args, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 10 * 1024 * 1024,
    })
  } catch {
    return []
  }

  return parseGitLog(output)
}

/**
 * git log --format='%H%n%aI%n%s' --numstat の出力をパースする。
 */
export function parseGitLog(output: string): GitCommit[] {
  const commits: GitCommit[] = []
  const lines = output.split('\n')
  let i = 0

  while (i < lines.length) {
    // 空行をスキップ
    while (i < lines.length && (lines[i] ?? '').trim() === '') {
      i++
    }
    if (i >= lines.length) break

    const hash = lines[i]?.trim()
    i++
    if (!hash || hash.length < 7) break

    const date = lines[i]?.trim() ?? ''
    i++
    const message = lines[i]?.trim() ?? ''
    i++

    // format と numstat の間の空行をスキップ
    while (i < lines.length && (lines[i] ?? '').trim() === '') {
      i++
    }

    let filesChanged = 0
    let additions = 0
    let deletions = 0

    // numstat 行を読む（タブ区切りの数値行のみ）
    while (i < lines.length) {
      const numstatLine = lines[i] ?? ''
      const match = numstatLine.match(/^(\d+|-)\t(\d+|-)\t/)
      if (!match) break
      filesChanged++
      if (match[1] !== '-') additions += Number(match[1])
      if (match[2] !== '-') deletions += Number(match[2])
      i++
    }

    commits.push({ hash, date, message, filesChanged, additions, deletions })
  }

  return commits
}

/**
 * remote URL を `github.com/owner/repo` 形式に正規化する。
 */
export function normalizeRemoteUrl(raw: string): string {
  if (!raw) return ''

  // SSH: git@github.com:owner/repo.git
  const sshMatch = raw.match(/^git@([^:]+):(.+?)(?:\.git)?$/)
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`
  }

  // HTTPS: https://github.com/owner/repo.git
  try {
    const url = new URL(raw)
    const path = url.pathname.replace(/\.git$/, '').replace(/^\//, '')
    return `${url.host}/${path}`
  } catch {
    return raw
  }
}
