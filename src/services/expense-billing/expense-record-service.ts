import { nanoid } from 'nanoid'
import { db } from '~/lib/db/kysely'
import { nowISO } from '~/utils/date'
import { parseYearMonthId } from '~/utils/month'
import { fetchMeteredCost } from './metered-provider'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExpenseRecordRefreshResult = {
  records: Array<{
    expenseItemId: string
    yearMonth: string
    amountForeign: string
    currency: string
    fetchedAt: string | null
  }>
  errors: Array<{
    expenseItemId: string
    error: string
  }>
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * クライアントの有効な経費項目について、当月の expense_record を materialize する。
 * fixed: monthly_amount をそのまま採用
 * metered: プロバイダから取得（未実装の場合はスキップ）
 */
export async function refreshExpenseRecords(args: {
  organizationId: string
  clientId: string
  yearMonth: string
}): Promise<ExpenseRecordRefreshResult> {
  const { organizationId, clientId, yearMonth } = args
  const now = nowISO()

  // 有効な経費項目を取得
  const items = await db
    .selectFrom('expenseItem')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('clientId', '=', clientId)
    .where('isActive', '=', 1)
    .where((eb) =>
      eb.or([
        eb('effectiveFrom', 'is', null),
        eb('effectiveFrom', '<=', yearMonth),
      ]),
    )
    .where((eb) =>
      eb.or([
        eb('effectiveTo', 'is', null),
        eb('effectiveTo', '>=', yearMonth),
      ]),
    )
    .execute()

  const records: ExpenseRecordRefreshResult['records'] = []
  const errors: ExpenseRecordRefreshResult['errors'] = []

  for (const item of items) {
    try {
      if (item.type === 'fixed') {
        const amount = item.monthlyAmount ?? '0'
        await upsertRecord({
          expenseItemId: item.id,
          yearMonth,
          amountForeign: amount,
          currency: item.currency,
          fetchedAt: null,
          now,
        })
        records.push({
          expenseItemId: item.id,
          yearMonth,
          amountForeign: amount,
          currency: item.currency,
          fetchedAt: null,
        })
      } else if (item.type === 'metered') {
        if (!item.provider || !item.providerConfig) {
          errors.push({
            expenseItemId: item.id,
            error: 'metered provider が設定されていません',
          })
          continue
        }

        const { year: y, month: m } = parseYearMonthId(yearMonth)
        if (!y || !m) {
          errors.push({ expenseItemId: item.id, error: '年月が不正です' })
          continue
        }

        const result = await fetchMeteredCost({
          organizationId,
          provider: item.provider,
          providerConfig: item.providerConfig,
          year: y,
          month: m,
        })

        await upsertRecord({
          expenseItemId: item.id,
          yearMonth,
          amountForeign: result.amount,
          currency: result.currency,
          fetchedAt: result.fetchedAt,
          now,
        })

        records.push({
          expenseItemId: item.id,
          yearMonth,
          amountForeign: result.amount,
          currency: result.currency,
          fetchedAt: result.fetchedAt,
        })
      }
    } catch (e) {
      errors.push({
        expenseItemId: item.id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { records, errors }
}

/**
 * metered item に対して直接金額を設定する。
 * プロバイダ未設定時の手動入力や、テスト用途で使用。
 */
export async function setExpenseRecordAmount(args: {
  expenseItemId: string
  yearMonth: string
  amountForeign: string
  currency: string
}): Promise<void> {
  await upsertRecord({
    expenseItemId: args.expenseItemId,
    yearMonth: args.yearMonth,
    amountForeign: args.amountForeign,
    currency: args.currency,
    fetchedAt: nowISO(),
    now: nowISO(),
  })
}

/**
 * metered items のみ: 差額が未調整のレコードを検出する。
 * fixed items は対象外（金額が確定的なので差額は発生しない）。
 */
export async function findUnadjustedDifferences(args: {
  organizationId: string
  clientId: string
}): Promise<
  Array<{
    expenseRecordId: string
    expenseItemId: string
    yearMonth: string
    currentAmount: string
    frozenAmount: string | null
    lastAdjustedAmount: string | null
    currency: string
  }>
> {
  // metered items の expense_record で未調整のものを取得
  const records = await db
    .selectFrom('expenseRecord')
    .innerJoin('expenseItem', 'expenseItem.id', 'expenseRecord.expenseItemId')
    .leftJoin('invoiceLine', (join) =>
      join
        .onRef('invoiceLine.expenseRecordId', '=', 'expenseRecord.id')
        .on('invoiceLine.expenseKind', '=', 'regular'),
    )
    .select([
      'expenseRecord.id as expenseRecordId',
      'expenseRecord.expenseItemId',
      'expenseRecord.yearMonth',
      'expenseRecord.amountForeign as currentAmount',
      'expenseRecord.lastAdjustedAmount',
      'expenseRecord.currency',
      'invoiceLine.amountForeign as frozenAmount',
    ])
    .where('expenseItem.organizationId', '=', args.organizationId)
    .where('expenseItem.clientId', '=', args.clientId)
    .where('expenseItem.type', '=', 'metered')
    .where('expenseRecord.adjustedInInvoiceId', 'is', null)
    .where('invoiceLine.id', 'is not', null) // 請求書に凍結済みのもののみ
    .execute()

  // 差額があるものだけ返す
  return records.filter((r) => {
    const compareWith = r.lastAdjustedAmount ?? r.frozenAmount
    return compareWith != null && compareWith !== r.currentAmount
  })
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function upsertRecord(params: {
  expenseItemId: string
  yearMonth: string
  amountForeign: string
  currency: string
  fetchedAt: string | null
  now: string
}): Promise<void> {
  await db
    .insertInto('expenseRecord')
    .values({
      id: nanoid(),
      expenseItemId: params.expenseItemId,
      yearMonth: params.yearMonth,
      amountForeign: params.amountForeign,
      currency: params.currency,
      fetchedAt: params.fetchedAt,
      createdAt: params.now,
      updatedAt: params.now,
    })
    .onConflict((oc) =>
      oc.columns(['expenseItemId', 'yearMonth']).doUpdateSet({
        amountForeign: params.amountForeign,
        currency: params.currency,
        fetchedAt: params.fetchedAt,
        updatedAt: params.now,
      }),
    )
    .execute()
}
