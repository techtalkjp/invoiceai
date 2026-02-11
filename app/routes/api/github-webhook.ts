import { createHmac, timingSafeEqual } from 'node:crypto'
import { data } from 'react-router'
import { insertActivities } from '~/lib/activity-sources/activity-queries.server'
import type { ActivityRecord } from '~/lib/activity-sources/types'
import { db } from '~/lib/db/kysely'
import type { Route } from './+types/github-webhook'

/**
 * GitHub Webhook受信エンドポイント
 *
 * POST /api/github-webhook
 * Header: X-Hub-Signature-256: sha256=...
 *
 * push イベントを受信してアクティビティとして記録する
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    throw data({ error: 'Method not allowed' }, { status: 405 })
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    throw data(
      { error: 'GITHUB_WEBHOOK_SECRET not configured' },
      { status: 500 },
    )
  }

  // Webhook署名の検証
  const signature = request.headers.get('X-Hub-Signature-256')
  if (!signature) {
    throw data({ error: 'Missing signature' }, { status: 401 })
  }

  const body = await request.text()
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw data({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = request.headers.get('X-GitHub-Event')

  let payload: {
    repository?: { full_name?: string }
    sender?: { login?: string }
    commits?: Array<{
      id: string
      message: string
      timestamp: string
      url?: string
    }>
  }
  try {
    payload = JSON.parse(body)
  } catch {
    throw data({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (event !== 'push' || !payload.commits) {
    return data({ ok: true, skipped: true }, { status: 200 })
  }

  const repoFullName = payload.repository?.full_name ?? null
  const senderLogin = payload.sender?.login

  if (!senderLogin || !repoFullName) {
    return data({ ok: true, skipped: true }, { status: 200 })
  }

  // sender のアカウントからユーザーとorganizationを検索
  // activitySource の config に GitHub username が保存されていると仮定
  const sources = await db
    .selectFrom('activitySource')
    .select(['organizationId', 'userId', 'config'])
    .where('sourceType', '=', 'github')
    .where('isActive', '=', 1)
    .execute()

  // 一致するユーザーを見つける（configにusernameが入っている場合）
  // fallback: 全GitHubソースに対して試行
  const matchingSources = sources.filter((s) => {
    if (s.config) {
      try {
        const config = JSON.parse(s.config) as { username?: string }
        return config.username === senderLogin
      } catch {
        // JSON parse error
      }
    }
    return false
  })

  // マッチするユーザーが見つからない場合はスキップ
  if (matchingSources.length === 0) {
    return data(
      { ok: true, skipped: true, reason: 'No matching user' },
      { status: 200 },
    )
  }

  let totalInserted = 0

  for (const source of matchingSources) {
    const records: ActivityRecord[] =
      payload.commits?.map((commit) => {
        const eventDate = commit.timestamp.slice(0, 10)
        return {
          sourceType: 'github',
          eventType: 'commit',
          eventDate,
          eventTimestamp: commit.timestamp,
          repo: repoFullName,
          title: commit.message.split('\n')[0] ?? null,
          url: commit.url ?? null,
          metadata: JSON.stringify({ sha: commit.id }),
        }
      }) ?? []

    const inserted = await insertActivities(
      source.organizationId,
      source.userId,
      records,
    )
    totalInserted += inserted
  }

  return data({ ok: true, inserted: totalInserted }, { status: 200 })
}
