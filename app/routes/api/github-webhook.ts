import { createHmac, timingSafeEqual } from 'node:crypto'
import { data } from 'react-router'
import { insertActivities } from '~/lib/activity-sources/activity-queries.server'
import { isoToJstDate } from '~/lib/activity-sources/github.server'
import type { ActivityRecord } from '~/lib/activity-sources/types'
import { db } from '~/lib/db/kysely'
import { invalidateInstallationToken } from '~/lib/github-app/installation-token.server'
import {
  deleteGitHubInstallationByInstallationId,
  getGitHubInstallationByInstallationId,
  suspendGitHubInstallation,
  unsuspendGitHubInstallation,
} from '~/lib/github-app/queries.server'
import type { Route } from './+types/github-webhook'

interface WebhookPayload {
  action?: string
  installation?: {
    id: number
    account: { login: string; type: string }
    permissions: Record<string, string>
    repository_selection: string
    suspended_at?: string | null
  }
  repository?: { full_name?: string }
  sender?: { login?: string }
  commits?: Array<{
    id: string
    message: string
    timestamp: string
    url?: string
  }>
}

function verifySignature(body: string, signature: string): boolean {
  const secret =
    process.env.GITHUB_APP_WEBHOOK_SECRET ?? process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) return false

  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)
}

/**
 * GitHub Webhook受信エンドポイント
 *
 * POST /api/github-webhook
 * Header: X-Hub-Signature-256: sha256=...
 *
 * - installation イベント: App のインストール/削除/停止を処理
 * - push イベント: コミットをアクティビティとして記録
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    throw data({ error: 'Method not allowed' }, { status: 405 })
  }

  const signature = request.headers.get('X-Hub-Signature-256')
  if (!signature) {
    throw data({ error: 'Missing signature' }, { status: 401 })
  }

  const body = await request.text()
  if (!verifySignature(body, signature)) {
    throw data({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = JSON.parse(body)
  } catch {
    throw data({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const event = request.headers.get('X-GitHub-Event')

  // installation イベント
  if (event === 'installation' && payload.installation) {
    return handleInstallationEvent(payload)
  }

  // push イベント
  if (event === 'push' && payload.commits) {
    return handlePushEvent(payload)
  }

  return data({ ok: true, skipped: true }, { status: 200 })
}

async function handleInstallationEvent(payload: WebhookPayload) {
  const installation = payload.installation
  if (!installation) {
    return data({ ok: true, skipped: true }, { status: 200 })
  }
  const action = payload.action

  if (action === 'created') {
    // 新規インストール — コールバック経由で保存済みの可能性があるが、
    // webhook でも受信するので upsert で処理
    const existing = await getGitHubInstallationByInstallationId(
      installation.id,
    )
    if (existing) {
      // 既に保存済み（コールバック経由）
      return data({ ok: true, action: 'already_saved' }, { status: 200 })
    }
    // コールバックで org と紐付けされていない場合はスキップ
    return data({ ok: true, action: 'skipped_no_org_link' }, { status: 200 })
  }

  if (action === 'deleted') {
    await deleteGitHubInstallationByInstallationId(installation.id)
    invalidateInstallationToken(installation.id)
    return data({ ok: true, action: 'deleted' }, { status: 200 })
  }

  if (action === 'suspend') {
    await suspendGitHubInstallation(
      installation.id,
      installation.suspended_at ?? new Date().toISOString(),
    )
    invalidateInstallationToken(installation.id)
    return data({ ok: true, action: 'suspended' }, { status: 200 })
  }

  if (action === 'unsuspend') {
    await unsuspendGitHubInstallation(installation.id)
    return data({ ok: true, action: 'unsuspended' }, { status: 200 })
  }

  return data({ ok: true, skipped: true }, { status: 200 })
}

async function handlePushEvent(payload: WebhookPayload) {
  const repoFullName = payload.repository?.full_name ?? null
  const senderLogin = payload.sender?.login

  if (!senderLogin || !repoFullName) {
    return data({ ok: true, skipped: true }, { status: 200 })
  }

  // github_user_mapping からユーザーを解決
  const mappings = await db
    .selectFrom('githubUserMapping')
    .select(['organizationId', 'userId'])
    .where('githubUsername', '=', senderLogin)
    .execute()

  if (mappings.length === 0) {
    return data(
      { ok: true, skipped: true, reason: 'No matching user' },
      { status: 200 },
    )
  }

  let totalInserted = 0

  for (const mapping of mappings) {
    const records: ActivityRecord[] =
      payload.commits?.map((commit) => {
        const eventDate = isoToJstDate(commit.timestamp)
        return {
          eventType: 'commit' as const,
          eventDate,
          eventTimestamp: commit.timestamp,
          repo: repoFullName,
          title: commit.message.split('\n')[0] ?? null,
          url: commit.url ?? null,
          metadata: { oid: commit.id.slice(0, 7) },
        }
      }) ?? []

    const inserted = await insertActivities(
      mapping.organizationId,
      mapping.userId,
      records,
    )
    totalInserted += inserted
  }

  return data({ ok: true, inserted: totalInserted }, { status: 200 })
}
