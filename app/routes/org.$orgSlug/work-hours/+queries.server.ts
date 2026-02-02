import { db } from '~/lib/db/kysely'
import type { MonthEntry, WorkEntryData } from './+schema'

/**
 * 指定した月の稼働データを取得
 */
export async function getMonthEntries(
  organizationId: string,
  userId: string,
  year: number,
  month: number,
): Promise<MonthEntry[]> {
  // 月の開始・終了日を計算
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  // 稼働データを取得
  const entries = await db
    .selectFrom('workEntry')
    .select([
      'id',
      'clientId',
      'workDate',
      'startTime',
      'endTime',
      'breakMinutes',
      'hours',
      'description',
    ])
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .where('workDate', '>=', monthStart)
    .where('workDate', '<', monthEnd)
    .execute()

  // クライアント一覧を取得（アクティブで時間制のもののみ）
  const clients = await db
    .selectFrom('client')
    .select(['id', 'name'])
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', 1)
    .where('billingType', '=', 'time')
    .orderBy('name', 'asc')
    .execute()

  // クライアントごとにエントリをグループ化
  const result: MonthEntry[] = clients.map((client) => {
    const clientEntries = entries.filter((e) => e.clientId === client.id)
    const entriesMap: Record<string, WorkEntryData> = {}

    for (const entry of clientEntries) {
      const mappedEntry: WorkEntryData = {
        id: entry.id,
        breakMinutes: entry.breakMinutes,
        hours: entry.hours,
      }
      if (entry.startTime !== null) {
        mappedEntry.startTime = entry.startTime
      }
      if (entry.endTime !== null) {
        mappedEntry.endTime = entry.endTime
      }
      if (entry.description !== null) {
        mappedEntry.description = entry.description
      }
      entriesMap[entry.workDate] = mappedEntry
    }

    return {
      clientId: client.id,
      clientName: client.name,
      entries: entriesMap,
    }
  })

  return result
}

/**
 * 時間制のアクティブなクライアント一覧を取得
 */
export async function getTimeBasedClients(organizationId: string) {
  return await db
    .selectFrom('client')
    .select(['id', 'name'])
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', 1)
    .where('billingType', '=', 'time')
    .orderBy('name', 'asc')
    .execute()
}

/**
 * 特定クライアントの月次稼働データを取得
 */
export async function getClientMonthEntries(
  organizationId: string,
  userId: string,
  clientId: string,
  year: number,
  month: number,
): Promise<MonthEntry | null> {
  // クライアント情報を取得
  const client = await db
    .selectFrom('client')
    .select(['id', 'name'])
    .where('organizationId', '=', organizationId)
    .where('id', '=', clientId)
    .executeTakeFirst()

  if (!client) {
    return null
  }

  // 月の開始・終了日を計算
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  // 稼働データを取得
  const entries = await db
    .selectFrom('workEntry')
    .select([
      'id',
      'workDate',
      'startTime',
      'endTime',
      'breakMinutes',
      'hours',
      'description',
    ])
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .where('clientId', '=', clientId)
    .where('workDate', '>=', monthStart)
    .where('workDate', '<', monthEnd)
    .execute()

  const entriesMap: Record<string, WorkEntryData> = {}

  for (const entry of entries) {
    const mappedEntry: WorkEntryData = {
      id: entry.id,
      breakMinutes: entry.breakMinutes,
      hours: entry.hours,
    }
    if (entry.startTime !== null) {
      mappedEntry.startTime = entry.startTime
    }
    if (entry.endTime !== null) {
      mappedEntry.endTime = entry.endTime
    }
    if (entry.description !== null) {
      mappedEntry.description = entry.description
    }
    entriesMap[entry.workDate] = mappedEntry
  }

  return {
    clientId: client.id,
    clientName: client.name,
    entries: entriesMap,
  }
}

/**
 * 指定した月の稼働サマリーを取得
 */
export async function getMonthlySummary(
  organizationId: string,
  userId: string,
  year: number,
  month: number,
) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const entries = await db
    .selectFrom('workEntry')
    .innerJoin('client', 'client.id', 'workEntry.clientId')
    .select([
      'workEntry.clientId',
      'client.name as clientName',
      db.fn.sum<number>('workEntry.hours').as('totalHours'),
    ])
    .where('workEntry.organizationId', '=', organizationId)
    .where('workEntry.userId', '=', userId)
    .where('workEntry.workDate', '>=', startDate)
    .where('workEntry.workDate', '<', endDate)
    .groupBy(['workEntry.clientId', 'client.name'])
    .execute()

  return entries
}
