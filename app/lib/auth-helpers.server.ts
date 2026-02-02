import { redirect } from 'react-router'
import { auth } from './auth'
import { db } from './db/kysely'

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

interface OrgContext {
  user: AuthSession['user']
  organization: {
    id: string
    name: string
    slug: string | null
    freeeCompanyId: number | null
  }
  membership: {
    id: string
    role: 'owner' | 'admin' | 'member'
  }
}

/**
 * セッションを取得（未認証ならnull）
 */
export async function getSession(request: Request) {
  return await auth.api.getSession({ headers: request.headers })
}

/**
 * 認証必須。未認証なら /auth/signin へリダイレクト
 */
export async function requireAuth(request: Request): Promise<AuthSession> {
  const session = await getSession(request)
  if (!session?.user) {
    throw redirect('/auth/signin')
  }
  return session
}

/**
 * 管理者権限必須。未認証 or 非管理者ならリダイレクト
 */
export async function requireAdmin(request: Request): Promise<AuthSession> {
  const session = await requireAuth(request)
  if (session.user.role !== 'admin') {
    throw redirect('/')
  }
  return session
}

/**
 * 組織メンバーであることを要求。未認証 or 非メンバーならリダイレクト
 */
export async function requireOrgMember(
  request: Request,
  orgSlug: string,
): Promise<OrgContext> {
  const session = await requireAuth(request)

  const result = await db
    .selectFrom('member')
    .innerJoin('organization', 'organization.id', 'member.organizationId')
    .select([
      'organization.id as orgId',
      'organization.name as orgName',
      'organization.slug as orgSlug',
      'organization.freeeCompanyId',
      'member.id as memberId',
      'member.role',
    ])
    .where('organization.slug', '=', orgSlug)
    .where('member.userId', '=', session.user.id)
    .executeTakeFirst()

  if (!result) {
    throw redirect('/')
  }

  return {
    user: session.user,
    organization: {
      id: result.orgId,
      name: result.orgName,
      slug: result.orgSlug,
      freeeCompanyId: result.freeeCompanyId,
    },
    membership: {
      id: result.memberId,
      role: result.role as 'owner' | 'admin' | 'member',
    },
  }
}

/**
 * 組織の admin または owner であることを要求
 */
export async function requireOrgAdmin(
  request: Request,
  orgSlug: string,
): Promise<OrgContext> {
  const context = await requireOrgMember(request, orgSlug)

  if (
    context.membership.role !== 'owner' &&
    context.membership.role !== 'admin'
  ) {
    throw redirect(`/org/${orgSlug}`)
  }

  return context
}

/**
 * ユーザーの最初の組織を取得
 */
export async function getFirstOrganization(
  userId: string,
): Promise<{ id: string; slug: string | null } | null> {
  const member = await db
    .selectFrom('member')
    .innerJoin('organization', 'organization.id', 'member.organizationId')
    .select(['organization.id', 'organization.slug'])
    .where('member.userId', '=', userId)
    .orderBy('member.createdAt', 'asc')
    .executeTakeFirst()

  return member ?? null
}
