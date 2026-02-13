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
