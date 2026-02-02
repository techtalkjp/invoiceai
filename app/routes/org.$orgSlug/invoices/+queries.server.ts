import { db } from '~/lib/db/kysely'
import {
  getFreeeClientForOrganization,
  listInvoices,
} from '~/utils/freee.server'
import { formatYearMonth } from '~/utils/month'

export type InvoiceListResult = {
  invoices: Awaited<ReturnType<typeof listInvoices>>['display']
  total: number
  limit: number
  error?: boolean
}

export async function fetchInvoices(
  organizationId: string,
  freeeCompanyId: number,
  limit: number,
): Promise<InvoiceListResult> {
  try {
    const freee = await getFreeeClientForOrganization(organizationId)
    const { display, total } = await listInvoices(
      {
        getCompanies: freee.getCompanies,
        getInvoices: freee.getInvoices,
        getInvoice: freee.getInvoice,
        getInvoiceTemplates: freee.getInvoiceTemplates,
        getPartners: freee.getPartners,
      },
      freeeCompanyId,
      limit,
    )
    return { invoices: display, total, limit }
  } catch (error) {
    console.error('Failed to fetch invoices:', error)
    return { invoices: [], total: 0, limit, error: true }
  }
}

export async function fetchInvoice(
  organizationId: string,
  freeeCompanyId: number,
  invoiceId: number,
) {
  const freee = await getFreeeClientForOrganization(organizationId)
  const { invoice } = await freee.getInvoice(freeeCompanyId, invoiceId)
  return invoice
}

/**
 * DB から指定クライアントの月次稼働時間を取得
 */
export async function getClientWorkHoursFromDb(
  organizationId: string,
  clientId: string,
  year: number,
  month: number,
): Promise<{ totalHours: number }> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const result = await db
    .selectFrom('workEntry')
    .select((eb) => eb.fn.sum<number>('hours').as('totalHours'))
    .where('organizationId', '=', organizationId)
    .where('clientId', '=', clientId)
    .where('workDate', '>=', startDate)
    .where('workDate', '<', endDate)
    .executeTakeFirst()

  return { totalHours: result?.totalHours ?? 0 }
}

/**
 * クライアント×月のスタッフ別稼働時間サマリーを取得
 */
export async function getClientWorkHoursByStaff(
  organizationId: string,
  clientId: string,
  year: number,
  month: number,
): Promise<{ userId: string; userName: string; totalHours: number }[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const result = await db
    .selectFrom('workEntry')
    .innerJoin('user', 'user.id', 'workEntry.userId')
    .select([
      'workEntry.userId',
      'user.name as userName',
      (eb) => eb.fn.sum<number>('workEntry.hours').as('totalHours'),
    ])
    .where('workEntry.organizationId', '=', organizationId)
    .where('workEntry.clientId', '=', clientId)
    .where('workEntry.workDate', '>=', startDate)
    .where('workEntry.workDate', '<', endDate)
    .groupBy(['workEntry.userId', 'user.name'])
    .orderBy('user.name', 'asc')
    .execute()

  return result
    .filter((r): r is typeof r & { userId: string } => r.userId !== null)
    .map((r) => ({
      userId: r.userId,
      userName: r.userName ?? '不明',
      totalHours: r.totalHours ?? 0,
    }))
}

/**
 * 複数クライアント×月のスタッフ別稼働時間を一括取得
 */
export async function getWorkHoursByClientAndStaff(
  organizationId: string,
  clientIds: string[],
  year: number,
  month: number,
): Promise<
  Record<string, { userId: string; userName: string; totalHours: number }[]>
> {
  if (clientIds.length === 0) return {}

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const result = await db
    .selectFrom('workEntry')
    .innerJoin('user', 'user.id', 'workEntry.userId')
    .select([
      'workEntry.clientId',
      'workEntry.userId',
      'user.name as userName',
      (eb) => eb.fn.sum<number>('workEntry.hours').as('totalHours'),
    ])
    .where('workEntry.organizationId', '=', organizationId)
    .where('workEntry.clientId', 'in', clientIds)
    .where('workEntry.workDate', '>=', startDate)
    .where('workEntry.workDate', '<', endDate)
    .groupBy(['workEntry.clientId', 'workEntry.userId', 'user.name'])
    .orderBy('user.name', 'asc')
    .execute()

  // クライアントIDごとにグループ化
  const grouped: Record<
    string,
    { userId: string; userName: string; totalHours: number }[]
  > = {}
  for (const r of result) {
    if (r.userId === null) continue
    if (!grouped[r.clientId]) {
      grouped[r.clientId] = []
    }
    grouped[r.clientId]?.push({
      userId: r.userId,
      userName: r.userName ?? '不明',
      totalHours: r.totalHours ?? 0,
    })
  }

  return grouped
}

/**
 * 前月の請求書を freee API から取得
 * partner_id でフィルタして該当月の請求書を探す
 */
export async function getPreviousMonthInvoice(
  organizationId: string,
  freeeCompanyId: number,
  partnerId: number,
  year: number,
  month: number,
) {
  // 前月を計算
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  // 前月の billing_date 範囲を計算
  const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  const prevMonthEnd =
    prevMonth === 12
      ? `${prevYear + 1}-01-01`
      : `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`

  try {
    const freee = await getFreeeClientForOrganization(organizationId)
    const { invoices } = await freee.getInvoices(freeeCompanyId, { limit: 100 })

    // partnerId と前月の billing_date で絞り込み
    const prevInvoice = invoices.find((inv) => {
      if (inv.partner_id !== partnerId) return false
      const billingDate = inv.billing_date
      return billingDate >= prevMonthStart && billingDate < prevMonthEnd
    })

    if (!prevInvoice) {
      return null
    }

    // 詳細情報を取得
    const { invoice } = await freee.getInvoice(freeeCompanyId, prevInvoice.id)
    return invoice
  } catch (error) {
    console.error('Failed to fetch previous month invoice:', error)
    return null
  }
}

/**
 * 請求書を DB に保存（作成または更新）
 */
export async function saveInvoiceToDb(params: {
  organizationId: string
  clientId: string
  year: number
  month: number
  freeeInvoiceId: number
  freeeInvoiceNumber: string
  billingType: 'time' | 'fixed'
  hourlyRate?: number | null
  monthlyFee?: number | null
  subject?: string
  note?: string
  billingDate?: string
  paymentDate?: string
  amountExcludingTax: number
  amountTax: number
  totalAmount: number
  status: string
}): Promise<{ id: string }> {
  const yearMonth = formatYearMonth(params.year, params.month)
  const now = new Date().toISOString()

  // 既存の請求書を検索
  const existing = await db
    .selectFrom('invoice')
    .select('id')
    .where('organizationId', '=', params.organizationId)
    .where('clientId', '=', params.clientId)
    .where('yearMonth', '=', yearMonth)
    .executeTakeFirst()

  if (existing) {
    // 更新
    await db
      .updateTable('invoice')
      .set({
        freeeInvoiceId: params.freeeInvoiceId,
        freeeInvoiceNumber: params.freeeInvoiceNumber,
        billingTypeSnapshot: params.billingType,
        hourlyRateSnapshot: params.hourlyRate ?? null,
        monthlyFeeSnapshot: params.monthlyFee ?? null,
        subjectSnapshot: params.subject ?? null,
        noteSnapshot: params.note ?? null,
        billingDate: params.billingDate ?? null,
        paymentDate: params.paymentDate ?? null,
        amountExcludingTax: params.amountExcludingTax,
        amountTax: params.amountTax,
        totalAmount: params.totalAmount,
        status: params.status,
      })
      .where('id', '=', existing.id)
      .execute()
    return { id: existing.id }
  }

  // 新規作成
  const id = crypto.randomUUID()
  await db
    .insertInto('invoice')
    .values({
      id,
      organizationId: params.organizationId,
      clientId: params.clientId,
      year: params.year,
      month: params.month,
      yearMonth,
      billingTypeSnapshot: params.billingType,
      hourlyRateSnapshot: params.hourlyRate ?? null,
      monthlyFeeSnapshot: params.monthlyFee ?? null,
      subjectSnapshot: params.subject ?? null,
      noteSnapshot: params.note ?? null,
      freeeInvoiceId: params.freeeInvoiceId,
      freeeInvoiceNumber: params.freeeInvoiceNumber,
      billingDate: params.billingDate ?? null,
      paymentDate: params.paymentDate ?? null,
      amountExcludingTax: params.amountExcludingTax,
      amountTax: params.amountTax,
      totalAmount: params.totalAmount,
      status: params.status,
      createdAt: now,
    })
    .execute()

  return { id }
}

/**
 * 対象月・クライアントの請求書を DB から取得
 */
export async function getInvoiceByYearMonth(
  organizationId: string,
  clientId: string,
  year: number,
  month: number,
) {
  const yearMonth = formatYearMonth(year, month)

  const invoice = await db
    .selectFrom('invoice')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('clientId', '=', clientId)
    .where('yearMonth', '=', yearMonth)
    .executeTakeFirst()

  return invoice ?? null
}

/**
 * 複数月・クライアントの請求書を一括取得
 */
export async function getInvoicesByYearMonths(
  organizationId: string,
  yearMonths: string[],
) {
  if (yearMonths.length === 0) return []

  const invoices = await db
    .selectFrom('invoice')
    .select([
      'id',
      'clientId',
      'yearMonth',
      'freeeInvoiceId',
      'freeeInvoiceNumber',
      'totalAmount',
    ])
    .where('organizationId', '=', organizationId)
    .where('yearMonth', 'in', yearMonths)
    .execute()

  return invoices
}

/**
 * タイムシートPDF用：クライアント×月のスタッフ別詳細稼働データを取得
 */
export async function getTimesheetDataForPdf(
  organizationId: string,
  clientId: string,
  year: number,
  month: number,
): Promise<{
  clientName: string
  staffTimesheets: {
    staffName: string
    entries: {
      date: string
      startTime: string | null
      endTime: string | null
      breakMinutes: number
      hours: number
      description: string | null
    }[]
    totalHours: number
  }[]
}> {
  // クライアント名を取得
  const client = await db
    .selectFrom('client')
    .select('name')
    .where('organizationId', '=', organizationId)
    .where('id', '=', clientId)
    .executeTakeFirst()

  if (!client) {
    return { clientName: '不明', staffTimesheets: [] }
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

  // 全エントリを取得（スタッフ情報付き）
  const entries = await db
    .selectFrom('workEntry')
    .innerJoin('user', 'user.id', 'workEntry.userId')
    .select([
      'workEntry.userId',
      'user.name as userName',
      'workEntry.workDate',
      'workEntry.startTime',
      'workEntry.endTime',
      'workEntry.breakMinutes',
      'workEntry.hours',
      'workEntry.description',
    ])
    .where('workEntry.organizationId', '=', organizationId)
    .where('workEntry.clientId', '=', clientId)
    .where('workEntry.workDate', '>=', startDate)
    .where('workEntry.workDate', '<', endDate)
    .orderBy('user.name', 'asc')
    .orderBy('workEntry.workDate', 'asc')
    .execute()

  // スタッフごとにグループ化
  const byStaff = new Map<
    string,
    {
      staffName: string
      entries: {
        date: string
        startTime: string | null
        endTime: string | null
        breakMinutes: number
        hours: number
        description: string | null
      }[]
    }
  >()

  for (const entry of entries) {
    if (!entry.userId) continue

    if (!byStaff.has(entry.userId)) {
      byStaff.set(entry.userId, {
        staffName: entry.userName ?? '不明',
        entries: [],
      })
    }

    byStaff.get(entry.userId)?.entries.push({
      date: entry.workDate,
      startTime: entry.startTime,
      endTime: entry.endTime,
      breakMinutes: entry.breakMinutes,
      hours: entry.hours,
      description: entry.description,
    })
  }

  // 配列に変換して合計時間を計算
  const staffTimesheets = Array.from(byStaff.values()).map((staff) => ({
    ...staff,
    totalHours: staff.entries.reduce((sum, e) => sum + e.hours, 0),
  }))

  return {
    clientName: client.name,
    staffTimesheets,
  }
}
