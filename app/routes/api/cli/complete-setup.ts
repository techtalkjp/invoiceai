import { data } from 'react-router'
import {
  markUserSetupCompleted,
  markUserWorkspaceNameConfirmed,
  requireCliAuth,
} from '~/lib/auth-helpers.server'
import { db } from '~/lib/db/kysely'
import type { Route } from './+types/complete-setup'

/**
 * CLI用: セットアップ完了をマーク
 *
 * POST /api/cli/complete-setup
 * Header: Authorization: Bearer <session-token>
 * Body: { organizationId }
 *
 * CLI 経由でセットアップした場合に、Web 側の setup 状態も完了にする。
 * これにより、後から Web にアクセスしたときに setup フローに飛ばされない。
 */
export async function action({ request }: Route.ActionArgs) {
  const session = await requireCliAuth(request)

  const body = (await request.json()) as { organizationId: string }

  if (!body.organizationId) {
    throw data({ error: 'organizationId is required' }, { status: 400 })
  }

  // membership チェック
  const membership = await db
    .selectFrom('member')
    .select('id')
    .where('organizationId', '=', body.organizationId)
    .where('userId', '=', session.user.id)
    .executeTakeFirst()

  if (!membership) {
    throw data({ error: 'Forbidden' }, { status: 403 })
  }

  // workspace 名確認済み + setup 完了をマーク
  await markUserWorkspaceNameConfirmed(body.organizationId, session.user.id)
  await markUserSetupCompleted(body.organizationId, session.user.id)

  return data({ ok: true })
}
