import { db } from '~/lib/db/kysely'
import type { Route } from './+types/users'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgId } = params
  const url = new URL(request.url)
  const query = url.searchParams.get('q') ?? ''

  // 既存メンバーのユーザーIDを取得
  const members = await db
    .selectFrom('member')
    .select(['userId'])
    .where('organizationId', '=', orgId)
    .execute()
  const memberUserIds = members.map((m) => m.userId)

  // メンバーでないユーザーを検索
  const users = await db
    .selectFrom('user')
    .select(['id', 'name', 'email'])
    .$if(memberUserIds.length > 0, (qb) =>
      qb.where('id', 'not in', memberUserIds),
    )
    .$if(query.length > 0, (qb) =>
      qb.where((eb) =>
        eb.or([
          eb('name', 'like', `%${query}%`),
          eb('email', 'like', `%${query}%`),
        ]),
      ),
    )
    .orderBy('name', 'asc')
    .limit(20)
    .execute()

  return { users }
}
