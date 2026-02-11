export type SourceType = 'github' | 'google_calendar' | 'wakatime'

export type EventType = 'commit' | 'pr' | 'review' | 'issue_comment' | 'memo'

export interface ActivityRecord {
  sourceType: SourceType | string
  eventType: EventType | string
  eventDate: string // YYYY-MM-DD
  eventTimestamp: string // ISO 8601
  repo: string | null
  title: string | null
  url: string | null // GitHub URL etc.
  metadata: string | null // JSON string
}
