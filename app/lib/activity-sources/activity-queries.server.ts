import { db } from '~/lib/db/kysely'
import type { ActivityRecord } from './types'

/**
 * アクティビティを一括挿入（重複はスキップ）
 * UNIQUE INDEX (org, user, source_type, event_type, event_timestamp, repo) で重複排除
 * SQLite パラメータ上限を考慮して 90 行ずつチャンク分割
 */
export async function insertActivities(
  organizationId: string,
  userId: string,
  records: ActivityRecord[],
): Promise<number> {
  if (records.length === 0) return 0

  const CHUNK_SIZE = 90
  let insertedCount = 0

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE)
    const values = chunk.map((record) => ({
      id: crypto.randomUUID(),
      organizationId,
      userId,
      sourceType: record.sourceType,
      eventType: record.eventType,
      eventDate: record.eventDate,
      eventTimestamp: record.eventTimestamp,
      repo: record.repo ?? '',
      title: record.title,
      metadata: record.metadata,
    }))

    const result = await db
      .insertInto('activity')
      .values(values)
      .onConflict((oc) =>
        oc
          .columns([
            'organizationId',
            'userId',
            'sourceType',
            'eventType',
            'eventTimestamp',
            'repo',
          ])
          .doNothing(),
      )
      .execute()

    for (const r of result) {
      insertedCount += Number(r.numInsertedOrUpdatedRows ?? 0)
    }
  }

  return insertedCount
}

/**
 * 指定期間のアクティビティを取得
 */
export function getActivities(
  organizationId: string,
  userId: string,
  startDate: string,
  endDate: string,
) {
  return db
    .selectFrom('activity')
    .select([
      'id',
      'sourceType',
      'eventType',
      'eventDate',
      'eventTimestamp',
      'repo',
      'title',
      'metadata',
    ])
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .where('eventDate', '>=', startDate)
    .where('eventDate', '<=', endDate)
    .orderBy('eventDate', 'asc')
    .orderBy('eventTimestamp', 'asc')
    .execute()
}

/**
 * 指定月のアクティビティを取得
 */
export function getActivitiesByMonth(
  organizationId: string,
  userId: string,
  year: number,
  month: number,
) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return getActivities(organizationId, userId, startDate, endDate)
}

/**
 * activity_source からユーザーの接続情報を取得
 */
export function getActivitySource(
  organizationId: string,
  userId: string,
  sourceType: string,
) {
  return db
    .selectFrom('activitySource')
    .select(['id', 'credentials', 'config', 'isActive'])
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .where('sourceType', '=', sourceType)
    .executeTakeFirst()
}

/**
 * activity_source を保存（upsert）
 */
export async function saveActivitySource(
  organizationId: string,
  userId: string,
  sourceType: string,
  credentials: string,
  config: string | null,
) {
  const now = new Date().toISOString()

  await db
    .insertInto('activitySource')
    .values({
      id: crypto.randomUUID(),
      organizationId,
      userId,
      sourceType,
      credentials,
      config,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc
        .columns(['organizationId', 'userId', 'sourceType'])
        .doUpdateSet({ credentials, config, updatedAt: now }),
    )
    .execute()
}

/**
 * activity_source を削除
 */
export async function deleteActivitySource(
  organizationId: string,
  userId: string,
  sourceType: string,
) {
  await db
    .deleteFrom('activitySource')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .where('sourceType', '=', sourceType)
    .execute()
}

/**
 * client_source_mapping を取得
 */
export function getClientSourceMappings(
  clientIds: string[],
  sourceType: string,
) {
  if (clientIds.length === 0) return Promise.resolve([])
  return db
    .selectFrom('clientSourceMapping')
    .select(['clientId', 'sourceIdentifier'])
    .where('clientId', 'in', clientIds)
    .where('sourceType', '=', sourceType)
    .execute()
}

/**
 * client_source_mapping を保存
 */
export async function saveClientSourceMapping(
  clientId: string,
  sourceType: string,
  sourceIdentifier: string,
) {
  await db
    .insertInto('clientSourceMapping')
    .values({
      id: crypto.randomUUID(),
      clientId,
      sourceType,
      sourceIdentifier,
      createdAt: new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc.columns(['clientId', 'sourceType', 'sourceIdentifier']).doNothing(),
    )
    .execute()
}

/**
 * client_source_mapping を削除
 */
export async function deleteClientSourceMapping(
  clientId: string,
  sourceType: string,
  sourceIdentifier: string,
) {
  await db
    .deleteFrom('clientSourceMapping')
    .where('clientId', '=', clientId)
    .where('sourceType', '=', sourceType)
    .where('sourceIdentifier', '=', sourceIdentifier)
    .execute()
}

/**
 * 有効なactivity_sourceを持つ全ユーザーを取得
 */
export function getActiveSourceUsers(sourceType: string) {
  return db
    .selectFrom('activitySource')
    .select(['organizationId', 'userId', 'credentials', 'config'])
    .where('sourceType', '=', sourceType)
    .where('isActive', '=', 1)
    .execute()
}
