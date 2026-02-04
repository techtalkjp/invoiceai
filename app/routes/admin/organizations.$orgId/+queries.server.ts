import { db } from '~/lib/db/kysely'

export async function getOrganization(orgId: string) {
  return await db
    .selectFrom('organization')
    .select(['id', 'name', 'slug', 'freeeCompanyId', 'createdAt'])
    .where('id', '=', orgId)
    .executeTakeFirst()
}

export async function getMembers(orgId: string) {
  return await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .select([
      'member.id',
      'member.userId',
      'member.role',
      'member.createdAt',
      'user.name as userName',
      'user.email as userEmail',
    ])
    .where('member.organizationId', '=', orgId)
    .orderBy('member.createdAt', 'asc')
    .execute()
}

export async function addMember(
  orgId: string,
  userId: string,
  role: 'owner' | 'admin' | 'member',
) {
  const id = crypto.randomUUID()
  await db
    .insertInto('member')
    .values({
      id,
      organizationId: orgId,
      userId,
      role,
    })
    .execute()
}

export async function removeMember(memberId: string) {
  await db.deleteFrom('member').where('id', '=', memberId).execute()
}

export async function deleteOrganization(orgId: string) {
  // メンバーを先に削除（外部キー制約）
  await db.deleteFrom('member').where('organizationId', '=', orgId).execute()
  // 組織を削除
  await db.deleteFrom('organization').where('id', '=', orgId).execute()
}
