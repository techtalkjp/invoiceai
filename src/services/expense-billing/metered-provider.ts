import { nanoid } from 'nanoid'
import { z } from 'zod'
import { decrypt, encrypt } from '~/lib/activity-sources/encryption.server'
import { db } from '~/lib/db/kysely'
import { nowISO } from '~/utils/date'
import { padMonth } from '~/utils/month'
import { isBeforeSettlement } from './expense-preview-service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MeteredUsageResult = {
  amount: string
  currency: string
  fetchedAt: string
  isProvisional: boolean
}

// ---------------------------------------------------------------------------
// Provider config schemas
// ---------------------------------------------------------------------------

export const googleCloudProviderConfigSchema = z.object({
  bigqueryProject: z.string().min(1),
  bigqueryDataset: z.string().min(1),
  bigqueryTable: z.string().min(1),
  projectId: z.string().min(1),
  serviceFilter: z.string().optional(),
})

export type GoogleCloudProviderConfig = z.infer<
  typeof googleCloudProviderConfigSchema
>

// ---------------------------------------------------------------------------
// Credential management
// ---------------------------------------------------------------------------

export async function saveProviderCredential(
  organizationId: string,
  provider: string,
  credentialsJson: string,
): Promise<void> {
  const now = nowISO()
  const encrypted = encrypt(credentialsJson)

  await db
    .insertInto('providerCredential')
    .values({
      id: nanoid(),
      organizationId,
      provider,
      encryptedCredentials: encrypted,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['organizationId', 'provider']).doUpdateSet({
        encryptedCredentials: encrypted,
        updatedAt: now,
      }),
    )
    .execute()
}

export async function getProviderCredential(
  organizationId: string,
  provider: string,
): Promise<string | null> {
  const row = await db
    .selectFrom('providerCredential')
    .select('encryptedCredentials')
    .where('organizationId', '=', organizationId)
    .where('provider', '=', provider)
    .executeTakeFirst()

  if (!row) return null
  return decrypt(row.encryptedCredentials)
}

export async function hasProviderCredential(
  organizationId: string,
  provider: string,
): Promise<boolean> {
  const row = await db
    .selectFrom('providerCredential')
    .select('id')
    .where('organizationId', '=', organizationId)
    .where('provider', '=', provider)
    .executeTakeFirst()

  return !!row
}

// ---------------------------------------------------------------------------
// Google Cloud Billing provider
// ---------------------------------------------------------------------------

export async function fetchGoogleCloudMonthlyCost(args: {
  organizationId: string
  config: GoogleCloudProviderConfig
  year: number
  month: number
}): Promise<MeteredUsageResult> {
  const { organizationId, config, year, month } = args

  // SA JSON を取得・復号
  const saJson = await getProviderCredential(
    organizationId,
    'google_cloud_billing',
  )
  if (!saJson) {
    throw new Error(
      'Google Cloud サービスアカウントが設定されていません。設定画面からJSONキーをアップロードしてください。',
    )
  }

  // @google-cloud/bigquery を動的 import（パッケージ未インストール時のエラーを分かりやすく）
  let BigQuery: typeof import('@google-cloud/bigquery').BigQuery
  try {
    const mod = await import('@google-cloud/bigquery')
    BigQuery = mod.BigQuery
  } catch {
    throw new Error(
      '@google-cloud/bigquery パッケージがインストールされていません。pnpm add @google-cloud/bigquery を実行してください。',
    )
  }

  const credentials = JSON.parse(saJson)
  const bigquery = new BigQuery({
    projectId: config.bigqueryProject,
    credentials,
  })

  // 月の開始・終了タイムスタンプ（UTC）
  const startTime = `${year}-${padMonth(month)}-01T00:00:00Z`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endTime = `${endYear}-${padMonth(endMonth)}-01T00:00:00Z`

  const query = `
    SELECT
      CAST(
        COALESCE(SUM(cost), 0) + COALESCE(SUM((
          SELECT SUM(c.amount) FROM UNNEST(credits) c
        )), 0)
      AS STRING) AS amount,
      currency
    FROM \`${config.bigqueryProject}.${config.bigqueryDataset}.${config.bigqueryTable}\`
    WHERE project.id = @projectId
      AND usage_start_time >= @startTime
      AND usage_start_time < @endTime
      ${config.serviceFilter ? 'AND service.description = @serviceFilter' : ''}
    GROUP BY currency
  `

  const params: Record<string, string> = {
    projectId: config.projectId,
    startTime,
    endTime,
  }
  if (config.serviceFilter) {
    params.serviceFilter = config.serviceFilter
  }

  const [rows] = await bigquery.query({ query, params })
  const row = (rows as Array<{ amount: string; currency: string }>)[0]

  const amount = row?.amount ?? '0'
  const currency = row?.currency ?? 'JPY'
  const fetchedAt = nowISO()

  // 暫定値判定: 対象月の翌月5日より前
  const yearMonth = `${year}-${padMonth(month)}`
  const isProvisional = isBeforeSettlement(yearMonth)

  return { amount, currency, fetchedAt, isProvisional }
}

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

export function fetchMeteredCost(args: {
  organizationId: string
  provider: string
  providerConfig: string
  year: number
  month: number
}): Promise<MeteredUsageResult> {
  switch (args.provider) {
    case 'google_cloud': {
      const config = googleCloudProviderConfigSchema.parse(
        JSON.parse(args.providerConfig),
      )
      return fetchGoogleCloudMonthlyCost({
        organizationId: args.organizationId,
        config,
        year: args.year,
        month: args.month,
      })
    }
    default:
      throw new Error(`Unknown metered provider: ${args.provider}`)
  }
}
