import { data } from 'react-router'
import { auth } from '~/lib/auth'
import { db } from '~/lib/db/kysely'
import type { Route } from './+types/create-org'

/**
 * CLI用: 組織作成
 *
 * POST /api/cli/create-org
 * Header: Authorization: Bearer <session-token>
 * Body: { name }
 */
export async function action({ request }: Route.ActionArgs) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    throw data({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { name: string }

  if (!body.name) {
    throw data({ error: 'name is required' }, { status: 400 })
  }

  const slug = generateSlug(body.name)
  const orgId = crypto.randomUUID()
  const now = new Date().toISOString()

  // 組織作成
  await db
    .insertInto('organization')
    .values({
      id: orgId,
      name: body.name,
      slug,
      createdAt: now,
    })
    .execute()

  // ユーザーを owner として追加
  await db
    .insertInto('member')
    .values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId: session.user.id,
      role: 'owner',
      createdAt: now,
    })
    .execute()

  return data({ id: orgId, slug, name: body.name })
}

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || `org-${Date.now()}`
  )
}
