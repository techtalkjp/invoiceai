// CLI 用のアクティビティ型定義
// app/lib/activity-sources/types.ts と同じ構造（API 通信用）

interface ActivityBase {
  eventDate: string // YYYY-MM-DD
  eventTimestamp: string // ISO 8601
  repo: string | null
  title: string | null
  url: string | null
}

export interface GitHubCommitRecord extends ActivityBase {
  eventType: 'commit'
  metadata: { oid: string }
}

export type PrAction = 'opened' | 'merged' | 'closed'
export interface GitHubPRRecord extends ActivityBase {
  eventType: 'pr'
  metadata: { action: PrAction }
}

export type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED'
export interface GitHubReviewRecord extends ActivityBase {
  eventType: 'review'
  metadata: { state: ReviewState }
}

export interface GitHubIssueCommentRecord extends ActivityBase {
  eventType: 'issue_comment'
  metadata: null
}

export type ActivityRecord =
  | GitHubCommitRecord
  | GitHubPRRecord
  | GitHubReviewRecord
  | GitHubIssueCommentRecord
