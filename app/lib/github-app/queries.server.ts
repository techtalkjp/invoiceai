import { db } from '~/lib/db/kysely'

// --- github_installation ---

interface GitHubInstallationPayload {
  id: number
  account: { login: string; type: string }
  permissions: Record<string, string>
  repository_selection: string
  suspended_at?: string | null | undefined
}

export async function saveGitHubInstallation(
  organizationId: string,
  installation: GitHubInstallationPayload,
) {
  await db
    .insertInto('githubInstallation')
    .values({
      id: crypto.randomUUID(),
      organizationId,
      installationId: installation.id,
      accountLogin: installation.account.login,
      targetType: installation.account.type,
      permissions: JSON.stringify(installation.permissions),
      repositorySelection: installation.repository_selection,
      suspendedAt: installation.suspended_at ?? null,
    })
    .onConflict((oc) =>
      oc.column('organizationId').doUpdateSet({
        installationId: installation.id,
        accountLogin: installation.account.login,
        targetType: installation.account.type,
        permissions: JSON.stringify(installation.permissions),
        repositorySelection: installation.repository_selection,
        suspendedAt: installation.suspended_at ?? null,
        updatedAt: new Date().toISOString(),
      }),
    )
    .execute()
}

export function getGitHubInstallation(organizationId: string) {
  return db
    .selectFrom('githubInstallation')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

export function getGitHubInstallationByInstallationId(installationId: number) {
  return db
    .selectFrom('githubInstallation')
    .selectAll()
    .where('installationId', '=', installationId)
    .executeTakeFirst()
}

export async function deleteGitHubInstallation(organizationId: string) {
  await db
    .deleteFrom('githubInstallation')
    .where('organizationId', '=', organizationId)
    .execute()
}

export async function deleteGitHubInstallationByInstallationId(
  installationId: number,
) {
  await db
    .deleteFrom('githubInstallation')
    .where('installationId', '=', installationId)
    .execute()
}

export async function suspendGitHubInstallation(
  installationId: number,
  suspendedAt: string,
) {
  await db
    .updateTable('githubInstallation')
    .set({ suspendedAt, updatedAt: new Date().toISOString() })
    .where('installationId', '=', installationId)
    .execute()
}

export async function unsuspendGitHubInstallation(installationId: number) {
  await db
    .updateTable('githubInstallation')
    .set({ suspendedAt: null, updatedAt: new Date().toISOString() })
    .where('installationId', '=', installationId)
    .execute()
}

// --- github_user_mapping ---

export async function saveUserMapping(
  organizationId: string,
  userId: string,
  githubUsername: string,
) {
  const now = new Date().toISOString()

  await db
    .insertInto('githubUserMapping')
    .values({
      id: crypto.randomUUID(),
      organizationId,
      userId,
      githubUsername,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['organizationId', 'userId']).doUpdateSet({
        githubUsername,
        updatedAt: now,
      }),
    )
    .execute()
}

export async function bulkSaveUserMappings(
  organizationId: string,
  mappings: Array<{ userId: string; githubUsername: string }>,
) {
  for (const mapping of mappings) {
    await saveUserMapping(
      organizationId,
      mapping.userId,
      mapping.githubUsername,
    )
  }
}

export function getUserMappings(organizationId: string) {
  return db
    .selectFrom('githubUserMapping')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .execute()
}

export async function getUserIdByGitHubUsername(
  organizationId: string,
  githubUsername: string,
): Promise<string | undefined> {
  const row = await db
    .selectFrom('githubUserMapping')
    .select('userId')
    .where('organizationId', '=', organizationId)
    .where('githubUsername', '=', githubUsername)
    .executeTakeFirst()
  return row?.userId
}

export async function deleteUserMapping(
  organizationId: string,
  userId: string,
) {
  await db
    .deleteFrom('githubUserMapping')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .execute()
}

export async function deleteAllUserMappings(organizationId: string) {
  await db
    .deleteFrom('githubUserMapping')
    .where('organizationId', '=', organizationId)
    .execute()
}
