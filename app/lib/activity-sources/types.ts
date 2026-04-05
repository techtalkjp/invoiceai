// 各イベントの共通フィールド
interface ActivityBase {
  eventDate: string // YYYY-MM-DD
  eventTimestamp: string // ISO 8601
  repo: string | null
  title: string | null
  url: string | null
}

// Commit
export interface GitHubCommitRecord extends ActivityBase {
  eventType: 'commit'
  metadata: { oid: string }
}

// Pull Request
export type PrAction = 'opened' | 'merged' | 'closed'
export interface GitHubPRRecord extends ActivityBase {
  eventType: 'pr'
  metadata: { action: PrAction }
}

// Review
export type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED'
export interface GitHubReviewRecord extends ActivityBase {
  eventType: 'review'
  metadata: { state: ReviewState }
}

// Issue Comment
export interface GitHubIssueCommentRecord extends ActivityBase {
  eventType: 'issue_comment'
  metadata: null
}

export type ActivityRecord =
  | GitHubCommitRecord
  | GitHubPRRecord
  | GitHubReviewRecord
  | GitHubIssueCommentRecord

// eventType の union（DB 文字列 → 型変換時に使用）
export type EventType = ActivityRecord['eventType']

/**
 * DB 行を ActivityRecord に正規化する。
 * metadata は ParseJSONResultsPlugin で既にパース済みの前提。
 * eventType が不正な場合は commit として扱う（parseActivityRow と同じ挙動）。
 */
export function toActivityRecord(row: {
  eventType: string
  eventDate: string
  eventTimestamp: string
  repo: string | null
  title: string | null
  url: string | null
  metadata: unknown
}): ActivityRecord {
  const base = {
    eventDate: row.eventDate,
    eventTimestamp: row.eventTimestamp,
    repo: row.repo,
    title: row.title,
    url: row.url,
  }
  const meta = (
    typeof row.metadata === 'object' && row.metadata != null ? row.metadata : {}
  ) as Record<string, unknown>

  switch (row.eventType) {
    case 'pr':
      return {
        ...base,
        eventType: 'pr',
        metadata: { action: (meta.action as PrAction) ?? 'opened' },
      }
    case 'review':
      return {
        ...base,
        eventType: 'review',
        metadata: { state: (meta.state as ReviewState) ?? 'COMMENTED' },
      }
    case 'issue_comment':
      return { ...base, eventType: 'issue_comment', metadata: null }
    default:
      return {
        ...base,
        eventType: 'commit',
        metadata: { oid: (meta.oid as string) ?? '' },
      }
  }
}
