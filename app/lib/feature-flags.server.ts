import { db } from './db/kysely'

export type FeatureFlagKey = 'signup_enabled'

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flag = await db
    .selectFrom('featureFlag')
    .select('defaultValue')
    .where('key', '=', key)
    .executeTakeFirst()

  return flag?.defaultValue === 1
}

export async function getFeatureFlags() {
  return await db
    .selectFrom('featureFlag')
    .select([
      'id',
      'key',
      'description',
      'defaultValue',
      'createdAt',
      'updatedAt',
    ])
    .orderBy('key', 'asc')
    .execute()
}

export async function setFeatureFlag(key: FeatureFlagKey, enabled: boolean) {
  await db
    .updateTable('featureFlag')
    .set({ defaultValue: enabled ? 1 : 0, updatedAt: new Date().toISOString() })
    .where('key', '=', key)
    .execute()
}
