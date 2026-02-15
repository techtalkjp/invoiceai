import { data } from 'react-router'
import { auth } from '~/lib/auth'
import { db } from '~/lib/db/kysely'
import type { Route } from './+types/clients'

/**
 * CLI用: 組織のクライアント一覧を取得
 *
 * GET /api/cli/clients?organizationId=xxx
 * Header: Authorization: Bearer <session-token>
 */
export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    throw data({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const organizationId = url.searchParams.get('organizationId')
  if (!organizationId) {
    throw data({ error: 'organizationId is required' }, { status: 400 })
  }

  const membership = await db
    .selectFrom('member')
    .select('id')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', session.user.id)
    .executeTakeFirst()

  if (!membership) {
    throw data({ error: 'Forbidden' }, { status: 403 })
  }

  const clients = await db
    .selectFrom('client')
    .select(['id', 'name', 'isActive'])
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', 1)
    .orderBy('name', 'asc')
    .execute()

  return data({
    clients: clients.map((client) => ({
      id: client.id,
      name: client.name,
    })),
  })
}
