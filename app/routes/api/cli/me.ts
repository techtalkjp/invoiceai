import { data } from 'react-router'
import { auth } from '~/lib/auth'
import { ensureUserHasOrganization } from '~/lib/auth-helpers.server'
import { db } from '~/lib/db/kysely'
import type { Route } from './+types/me'

/**
 * CLI用: ログインユーザー情報 + 所属組織一覧
 *
 * GET /api/cli/me
 * Header: Authorization: Bearer <session-token>
 */
export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    throw data({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureUserHasOrganization({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  })

  const organizations = await db
    .selectFrom('member')
    .innerJoin('organization', 'organization.id', 'member.organizationId')
    .select([
      'organization.id',
      'organization.name',
      'organization.slug',
      'member.role',
    ])
    .where('member.userId', '=', session.user.id)
    .orderBy('member.createdAt', 'asc')
    .execute()

  return data({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    organizations,
  })
}
