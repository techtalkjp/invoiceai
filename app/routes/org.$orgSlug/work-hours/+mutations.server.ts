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
 * 月データを一括同期（full month sync）
 * クライアントの MonthData を正として、DB の該当月のエントリを同期する
 */
export async function syncMonthEntries(
  organizationId: string,
  userId: string,
  clientId: string,
  entries: EntryInput[],
  yearMonth?: string,
) {
  // 送信されたエントリの日付セットを作成
  const submittedDates = new Set(entries.map((e) => e.workDate))

  // エントリの upsert（空エントリは saveEntry 内で自動削除される）
  await Promise.all(
    entries.map((entry) => saveEntry(organizationId, userId, entry)),
  )

  // 月の範囲を決定（yearMonth が渡されなければ entries から推定）
  let firstDate: string | undefined
  let lastDate: string | undefined

  if (yearMonth) {
    // "YYYY-MM" 形式から月初・月末を計算
    const [y, m] = yearMonth.split('-').map(Number)
    if (y && m) {
      firstDate = `${y}-${String(m).padStart(2, '0')}-01`
      const lastDay = new Date(y, m, 0).getDate()
      lastDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }
  } else if (submittedDates.size > 0) {
    const dates = [...submittedDates].sort()
    firstDate = dates[0]
    lastDate = dates[dates.length - 1]
  }

  // 送信に含まれていない日付の既存エントリを削除
  if (firstDate && lastDate) {
    const existingEntries = await db
      .selectFrom('workEntry')
      .select(['id', 'workDate'])
      .where('organizationId', '=', organizationId)
      .where('userId', '=', userId)
      .where('clientId', '=', clientId)
      .where('workDate', '>=', firstDate)
      .where('workDate', '<=', lastDate)
      .execute()

    const toDelete = existingEntries.filter(
      (e) => !submittedDates.has(e.workDate),
    )
    if (toDelete.length > 0) {
      await db
        .deleteFrom('workEntry')
        .where(
          'id',
          'in',
          toDelete.map((e) => e.id),
        )
        .execute()
    }
  }

  return { synced: true }
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
