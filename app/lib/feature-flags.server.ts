import { db } from './db/kysely'
import { FEATURE_FLAGS, type FeatureFlagKey } from './feature-flags'
export type { FeatureFlagKey } from './feature-flags'

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
  const now = new Date().toISOString()

  await db
    .insertInto('featureFlag')
    .values({
      id: key,
      key,
      description: FEATURE_FLAGS[key].description,
      defaultValue: enabled ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.column('key').doUpdateSet({
        defaultValue: enabled ? 1 : 0,
        updatedAt: now,
      }),
    )
    .execute()
}
