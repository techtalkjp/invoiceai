import { db } from '~/lib/db/kysely'
import { calculateHours } from './+schema'

type EntryInput = {
  clientId: string
  workDate: string
  startTime?: string
  endTime?: string
  breakMinutes?: number
  description?: string
}

/**
 * 単一エントリを保存（upsert）
 */
export async function saveEntry(
  organizationId: string,
  userId: string,
  entry: EntryInput,
) {
  const now = new Date().toISOString()
  const breakMinutes = entry.breakMinutes ?? 0
  const hours = calculateHours(entry.startTime, entry.endTime, breakMinutes)

  // 既存エントリをチェック
  const existing = await db
    .selectFrom('workEntry')
    .select('id')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .where('clientId', '=', entry.clientId)
    .where('workDate', '=', entry.workDate)
    .executeTakeFirst()

  // 開始・終了時刻が両方なく、休憩も0で、説明もない場合は削除
  if (
    !entry.startTime &&
    !entry.endTime &&
    breakMinutes === 0 &&
    !entry.description
  ) {
    if (existing) {
      await db.deleteFrom('workEntry').where('id', '=', existing.id).execute()
    }
    return { deleted: true }
  }

  if (existing) {
    // 更新
    await db
      .updateTable('workEntry')
      .set({
        startTime: entry.startTime ?? null,
        endTime: entry.endTime ?? null,
        breakMinutes,
        hours,
        description: entry.description ?? null,
      })
      .where('id', '=', existing.id)
      .execute()
    return { updated: true, id: existing.id }
  }

  // 新規作成
  const id = crypto.randomUUID()
  await db
    .insertInto('workEntry')
    .values({
      id,
      organizationId,
      userId,
      clientId: entry.clientId,
      workDate: entry.workDate,
      startTime: entry.startTime ?? null,
      endTime: entry.endTime ?? null,
      breakMinutes,
      hours,
      description: entry.description ?? null,
      createdAt: now,
    })
    .execute()

  return { created: true, id }
}

/**
 * 複数エントリを一括保存
 */
export async function saveEntries(
  organizationId: string,
  userId: string,
  entries: EntryInput[],
) {
  const results = await Promise.all(
    entries.map((entry) => saveEntry(organizationId, userId, entry)),
  )
  return { savedCount: results.length }
}

/**
 * エントリを削除
 */
export async function deleteEntry(
  organizationId: string,
  userId: string,
  entryId: string,
) {
  await db
    .deleteFrom('workEntry')
    .where('id', '=', entryId)
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .execute()

  return { deleted: true }
}
