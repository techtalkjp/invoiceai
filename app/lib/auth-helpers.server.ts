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

/**
 * ユーザーが所属する全組織を取得
 */
export async function getUserOrganizations(userId: string) {
  return await db
    .selectFrom('member')
    .innerJoin('organization', 'organization.id', 'member.organizationId')
    .select([
      'organization.id',
      'organization.name',
      'organization.slug',
      'member.role',
    ])
    .where('member.userId', '=', userId)
    .orderBy('member.createdAt', 'asc')
    .execute()
}

export async function getActiveClientCount(
  organizationId: string,
): Promise<number> {
  const row = await db
    .selectFrom('client')
    .select((eb) => eb.fn.count<string>('id').as('count'))
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', 1)
    .executeTakeFirst()

  return Number(row?.count ?? 0)
}

type OrganizationMetadata = {
  setupCompletedUserIds?: string[]
  workspaceNameConfirmedUserIds?: string[]
}

function parseOrganizationMetadata(raw: unknown): OrganizationMetadata {
  if (!raw) return {}

  if (typeof raw === 'object' && raw !== null) {
    return raw as OrganizationMetadata
  }

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as OrganizationMetadata
    } catch {
      return {}
    }
  }

  return {}
}

export async function hasUserCompletedSetup(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const org = await db
    .selectFrom('organization')
    .select('metadata')
    .where('id', '=', organizationId)
    .executeTakeFirst()

  const metadata = parseOrganizationMetadata(org?.metadata)
  return (metadata.setupCompletedUserIds ?? []).includes(userId)
}

export async function markUserSetupCompleted(
  organizationId: string,
  userId: string,
): Promise<void> {
  const org = await db
    .selectFrom('organization')
    .select('metadata')
    .where('id', '=', organizationId)
    .executeTakeFirst()

  const metadata = parseOrganizationMetadata(org?.metadata)
  const setupCompletedUserIds = Array.from(
    new Set([...(metadata.setupCompletedUserIds ?? []), userId]),
  )

  await db
    .updateTable('organization')
    .set({
      metadata: JSON.stringify({
        ...metadata,
        setupCompletedUserIds,
      }),
      updatedAt: new Date().toISOString(),
    })
    .where('id', '=', organizationId)
    .execute()
}

export async function hasUserConfirmedWorkspaceName(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const org = await db
    .selectFrom('organization')
    .select('metadata')
    .where('id', '=', organizationId)
    .executeTakeFirst()

  const metadata = parseOrganizationMetadata(org?.metadata)
  return (metadata.workspaceNameConfirmedUserIds ?? []).includes(userId)
}

export async function markUserWorkspaceNameConfirmed(
  organizationId: string,
  userId: string,
): Promise<void> {
  const org = await db
    .selectFrom('organization')
    .select('metadata')
    .where('id', '=', organizationId)
    .executeTakeFirst()

  const metadata = parseOrganizationMetadata(org?.metadata)
  const workspaceNameConfirmedUserIds = Array.from(
    new Set([...(metadata.workspaceNameConfirmedUserIds ?? []), userId]),
  )

  await db
    .updateTable('organization')
    .set({
      metadata: JSON.stringify({
        ...metadata,
        workspaceNameConfirmedUserIds,
      }),
      updatedAt: new Date().toISOString(),
    })
    .where('id', '=', organizationId)
    .execute()
}

function toSlug(input: string): string {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

  return normalized || 'org'
}

async function generateUniqueOrganizationSlug(base: string): Promise<string> {
  for (let i = 0; i < 1000; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`
    const exists = await db
      .selectFrom('organization')
      .select('id')
      .where('slug', '=', candidate)
      .executeTakeFirst()
    if (!exists) {
      return candidate
    }
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`
}

/**
 * ユーザーが所属組織を1件も持たない場合、初回組織を自動作成して owner として所属させる
 */
export async function ensureUserHasOrganization(user: {
  id: string
  name: string
  email: string
}) {
  const existing = await getFirstOrganization(user.id)
  if (existing) {
    return existing
  }

  const now = new Date().toISOString()
  const baseSlug = toSlug(user.email.split('@')[0] || user.name)
  const slug = await generateUniqueOrganizationSlug(baseSlug)
  const organizationId = crypto.randomUUID()

  await db.transaction().execute(async (trx) => {
    const alreadyMember = await trx
      .selectFrom('member')
      .select('id')
      .where('userId', '=', user.id)
      .executeTakeFirst()

    if (alreadyMember) {
      return
    }

    await trx
      .insertInto('organization')
      .values({
        id: organizationId,
        name: `${user.name} の組織`,
        slug,
        freeeCompanyId: null,
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    await trx
      .insertInto('member')
      .values({
        id: crypto.randomUUID(),
        organizationId,
        userId: user.id,
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      })
      .execute()
  })

  const created = await getFirstOrganization(user.id)
  if (!created) {
    throw new Error('初回組織の作成に失敗しました。')
  }
  return created
}
