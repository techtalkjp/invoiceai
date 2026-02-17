import type { SyncResponse } from './cli-api'
import type { RepoConfig } from './cli-config'
import type { GhAuthStatus } from './cli-gh'
import {
  extractOwnerRepo,
  fetchCommentsSince,
  fetchPRsSince,
  fetchReviewsSince,
} from './cli-gh'
import { getCommitsSince } from './cli-git'
import type { ActivityRecord } from './cli-types'

/**
 * git log + gh CLI からアクティビティを収集し、ActivityRecord[] に変換する。
 */
export function collectActivities(
  repoPath: string,
  repoConfig: RepoConfig,
  ghStatus: GhAuthStatus,
): ActivityRecord[] {
  const activities: ActivityRecord[] = []
  const repoName = repoConfig.remoteUrl || repoPath

  // git log からコミットを収集
  const commits = getCommitsSince(repoPath, repoConfig.lastSyncCommit)
  for (const commit of commits) {
    const eventDate = commit.date.slice(0, 10) // YYYY-MM-DD
    activities.push({
      eventType: 'commit',
      eventDate,
      eventTimestamp: commit.date,
      repo: repoName,
      title: commit.message,
      url: null,
      metadata: { oid: commit.hash },
    })
  }

  // gh CLI が認証済みなら PR/レビュー/コメントも収集
  if (ghStatus.authenticated && repoConfig.remoteUrl) {
    const ownerRepo = extractOwnerRepo(repoConfig.remoteUrl)
    if (ownerRepo) {
      const since = repoConfig.lastSyncedAt
        ? repoConfig.lastSyncedAt.slice(0, 10)
        : ninetyDaysAgo()

      // PRs
      const prs = fetchPRsSince(ownerRepo, since)
      for (const pr of prs) {
        const eventDate = (pr.mergedAt ?? pr.closedAt ?? pr.createdAt).slice(
          0,
          10,
        )
        const eventTimestamp = pr.mergedAt ?? pr.closedAt ?? pr.createdAt
        const action =
          pr.state === 'MERGED'
            ? 'merged'
            : pr.state === 'CLOSED'
              ? 'closed'
              : 'opened'
        activities.push({
          eventType: 'pr',
          eventDate,
          eventTimestamp,
          repo: repoName,
          title: pr.title,
          url: pr.url,
          metadata: { action },
        })
      }

      // Reviews
      const reviews = fetchReviewsSince(ownerRepo, since, ghStatus.username)
      for (const review of reviews) {
        activities.push({
          eventType: 'review',
          eventDate: review.submittedAt.slice(0, 10),
          eventTimestamp: review.submittedAt,
          repo: repoName,
          title: review.prTitle,
          url: review.prUrl,
          metadata: {
            state: review.state as
              | 'APPROVED'
              | 'CHANGES_REQUESTED'
              | 'COMMENTED',
          },
        })
      }

      // Comments
      const comments = fetchCommentsSince(ownerRepo, since, ghStatus.username)
      for (const comment of comments) {
        activities.push({
          eventType: 'issue_comment',
          eventDate: comment.createdAt.slice(0, 10),
          eventTimestamp: comment.createdAt,
          repo: repoName,
          title: comment.issueTitle,
          url: comment.issueUrl,
          metadata: null,
        })
      }
    }
  }

  return activities
}

function ninetyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().slice(0, 10)
}

/**
 * 同期結果のサマリーをターミナルに表示する。
 */
export function printSyncSummary(response: SyncResponse): void {
  const { synced, summary, webUrl } = response

  console.log('\n--- 同期完了 ---')
  console.log(`  同期アクティビティ数: ${synced}`)
  console.log(`  期間: ${summary.period.from} 〜 ${summary.period.to}`)
  console.log(`  稼働日数: ${summary.workDays}日`)
  console.log(
    `  内訳: コミット ${summary.commits} / PR ${summary.prs} / レビュー ${summary.reviews} / コメント ${summary.comments}`,
  )
  console.log(`  推定稼働時間: ${summary.estimatedHours}h`)
  console.log(`\n  Web で確認: ${webUrl}`)
}
