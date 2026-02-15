import 'dotenv/config'
import { db } from '~/lib/db/kysely'
import { FEATURE_FLAGS, type FeatureFlagKey } from '~/lib/feature-flags'

const LOCAL_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  signup_enabled: true,
}

async function seedFeatureFlags(defaults: Record<FeatureFlagKey, boolean>) {
  const now = new Date().toISOString()

  for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) {
    await db
      .insertInto('featureFlag')
      .values({
        id: key,
        key,
        description: FEATURE_FLAGS[key].description,
        defaultValue: defaults[key] ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      })
      .onConflict((oc) =>
        oc.column('key').doUpdateSet({
          description: FEATURE_FLAGS[key].description,
          updatedAt: now,
        }),
      )
      .execute()
  }
}

async function main() {
  await seedFeatureFlags(LOCAL_DEFAULTS)
  console.log('Seeded feature flags for local environment.')
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to seed database:', message)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.destroy()
  })
