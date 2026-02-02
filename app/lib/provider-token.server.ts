import { db } from './db/kysely'

type Provider = 'freee' | 'google'

interface ProviderTokenData {
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null
  scope: string | null
}

/**
 * 組織の OAuth トークンを取得
 */
export async function getProviderToken(
  organizationId: string,
  provider: Provider,
): Promise<ProviderTokenData | null> {
  const token = await db
    .selectFrom('providerToken')
    .select(['accessToken', 'refreshToken', 'expiresAt', 'scope'])
    .where('organizationId', '=', organizationId)
    .where('provider', '=', provider)
    .executeTakeFirst()

  if (!token?.accessToken) {
    return null
  }

  return {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
    scope: token.scope,
  }
}

/**
 * 組織の OAuth トークンを保存（upsert）
 */
export async function saveProviderToken(
  organizationId: string,
  provider: Provider,
  data: {
    accessToken: string
    refreshToken?: string | null
    expiresAt?: string | null
    scope?: string | null
  },
): Promise<void> {
  const existing = await db
    .selectFrom('providerToken')
    .select('id')
    .where('organizationId', '=', organizationId)
    .where('provider', '=', provider)
    .executeTakeFirst()

  const now = new Date().toISOString()

  if (existing) {
    await db
      .updateTable('providerToken')
      .set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        expiresAt: data.expiresAt ?? null,
        scope: data.scope ?? null,
        updatedAt: now,
      })
      .where('id', '=', existing.id)
      .execute()
  } else {
    await db
      .insertInto('providerToken')
      .values({
        id: crypto.randomUUID(),
        organizationId,
        provider,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        expiresAt: data.expiresAt ?? null,
        scope: data.scope ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .execute()
  }
}

/**
 * 組織の OAuth トークンを削除
 */
export async function deleteProviderToken(
  organizationId: string,
  provider: Provider,
): Promise<void> {
  await db
    .deleteFrom('providerToken')
    .where('organizationId', '=', organizationId)
    .where('provider', '=', provider)
    .execute()
}

/**
 * ユーザーの所属組織を取得（最初の組織）
 */
export async function getUserOrganization(userId: string): Promise<{
  id: string
  name: string
  freeeCompanyId: number | null
} | null> {
  const member = await db
    .selectFrom('member')
    .innerJoin('organization', 'organization.id', 'member.organizationId')
    .select([
      'organization.id',
      'organization.name',
      'organization.freeeCompanyId',
    ])
    .where('member.userId', '=', userId)
    .executeTakeFirst()

  return member ?? null
}
