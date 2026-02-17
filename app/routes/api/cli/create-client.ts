import { data } from 'react-router'
import { requireCliAuth } from '~/lib/auth-helpers.server'
import { db } from '~/lib/db/kysely'
import type { Route } from './+types/create-client'

/**
 * CLI用: クライアント作成
 *
 * POST /api/cli/create-client
 * Header: Authorization: Bearer <session-token>
 * Body: { organizationId, name }
 */
export async function action({ request }: Route.ActionArgs) {
  const session = await requireCliAuth(request)

  const body = (await request.json()) as {
    organizationId: string
    name: string
  }

  if (!body.organizationId || !body.name) {
    throw data(
      { error: 'organizationId and name are required' },
      { status: 400 },
    )
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

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db
    .insertInto('client')
    .values({
      id,
      organizationId: body.organizationId,
      name: body.name,
      billingType: 'time',
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    })
    .execute()

  return data({ id, name: body.name })
}
