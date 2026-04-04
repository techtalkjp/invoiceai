import Decimal from 'decimal.js'
import { db } from '~/lib/db/kysely'
import { dayjs } from '~/utils/dayjs'
import { parseYearMonthId } from '~/utils/month'
import { getExchangeRate } from './exchange-rate-service'
import {
  findUnadjustedDifferences,
  refreshExpenseRecords,
} from './expense-record-service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoundingMethod = 'round' | 'floor' | 'ceil'

export type ExpensePreviewLine = {
  expenseKind: 'regular' | 'adjustment'
  expenseGroupId: string | null
  expenseItemId: string | null
  expenseRecordId: string | null
  expenseYearMonth: string
  description: string
  amountForeign: string
  currency: string
  exchangeRate: string | null
  amountJpy: number
  taxRate: number
  isProvisional: boolean
  reducedTaxRate: boolean
}

export type ExpensePreviewResult = {
  lines: ExpensePreviewLine[]
  exchangeRates: Record<
    string,
    { rate: string; rateDate: string; source: string; isManual: boolean }
  >
  errors: Array<{ expenseItemId: string; error: string }>
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 請求書作成画面用の経費プレビューを生成する。
 * 1. expense_record を materialize
 * 2. グループ/単独の regular lines を生成
 * 3. 前月以前の差額 adjustment lines を生成
 */
export async function getExpensePreview(args: {
  organizationId: string
  clientId: string
  yearMonth: string
  roundingMethod: RoundingMethod
}): Promise<ExpensePreviewResult> {
  const { organizationId, clientId, yearMonth, roundingMethod } = args

  // 1. expense_record を materialize
  const refreshResult = await refreshExpenseRecords({
    organizationId,
    clientId,
    yearMonth,
  })

  // 2. グループ定義と当月レコードを取得
  const [groups, records] = await Promise.all([
    db
      .selectFrom('expenseGroup')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .where('clientId', '=', clientId)
      .where('isActive', '=', 1)
      .orderBy('sortOrder', 'asc')
      .execute(),
    db
      .selectFrom('expenseRecord')
      .innerJoin('expenseItem', 'expenseItem.id', 'expenseRecord.expenseItemId')
      .select([
        'expenseRecord.id as recordId',
        'expenseRecord.expenseItemId',
        'expenseRecord.amountForeign',
        'expenseRecord.currency',
        'expenseItem.groupId',
        'expenseItem.name as itemName',
        'expenseItem.invoiceLabel as itemInvoiceLabel',
        'expenseItem.taxRate as itemTaxRate',
        'expenseItem.type as itemType',
      ])
      .where('expenseItem.organizationId', '=', organizationId)
      .where('expenseItem.clientId', '=', clientId)
      .where('expenseRecord.yearMonth', '=', yearMonth)
      .execute(),
  ])

  // 3. 必要な為替レートを取得
  const currencies = new Set(records.map((r) => r.currency))
  const exchangeRates: ExpensePreviewResult['exchangeRates'] = {}
  for (const currency of currencies) {
    if (currency === 'JPY') continue
    const rate = await getExchangeRate(yearMonth, currency)
    exchangeRates[`${currency}/JPY`] = rate
  }

  // 4. regular lines を生成
  const lines: ExpensePreviewLine[] = []

  // グループ経費: グループ内のレコードを集約して1行に
  for (const group of groups) {
    const groupRecords = records.filter((r) => r.groupId === group.id)
    if (groupRecords.length === 0) continue

    const totalForeign = groupRecords.reduce(
      (sum, r) => sum.plus(r.amountForeign),
      new Decimal(0),
    )
    const currency = group.currency
    const rate =
      currency === 'JPY'
        ? null
        : (exchangeRates[`${currency}/JPY`]?.rate ?? null)
    const amountJpy = applyRounding(
      totalForeign.toString(),
      rate,
      roundingMethod,
    )

    const { year, month } = parseYearMonthId(yearMonth)
    const description = expandTemplate(group.invoiceLabel, {
      year: String(year),
      month: String(month),
      amountForeign: totalForeign.toString(),
      currency: currencyLabel(currency),
      rate: rate ?? '',
    })

    const isProvisional =
      groupRecords.some((r) => r.itemType === 'metered') &&
      isBeforeSettlement(yearMonth)

    lines.push({
      expenseKind: 'regular',
      expenseGroupId: group.id,
      expenseItemId: null,
      expenseRecordId: null,
      expenseYearMonth: yearMonth,
      description,
      amountForeign: totalForeign.toString(),
      currency,
      exchangeRate: rate,
      amountJpy,
      taxRate: group.taxRate,
      isProvisional,
      reducedTaxRate: group.taxRate === 8,
    })
  }

  // 単独経費: グループに属さないレコードはそれぞれ1行
  const standaloneRecords = records.filter((r) => r.groupId == null)
  for (const record of standaloneRecords) {
    const currency = record.currency
    const rate =
      currency === 'JPY'
        ? null
        : (exchangeRates[`${currency}/JPY`]?.rate ?? null)
    const amountJpy = applyRounding(record.amountForeign, rate, roundingMethod)
    const taxRate = record.itemTaxRate ?? 10

    const { year: sy, month: sm } = parseYearMonthId(yearMonth)
    const description = record.itemInvoiceLabel
      ? expandTemplate(record.itemInvoiceLabel, {
          year: String(sy),
          month: String(sm),
          amountForeign: record.amountForeign,
          currency: currencyLabel(currency),
          rate: rate ?? '',
        })
      : `${record.itemName} ${sy}年${sm}月`

    lines.push({
      expenseKind: 'regular',
      expenseGroupId: null,
      expenseItemId: record.expenseItemId,
      expenseRecordId: record.recordId,
      expenseYearMonth: yearMonth,
      description,
      amountForeign: record.amountForeign,
      currency,
      exchangeRate: rate,
      amountJpy,
      taxRate,
      isProvisional:
        record.itemType === 'metered' && isBeforeSettlement(yearMonth),
      reducedTaxRate: taxRate === 8,
    })
  }

  // 5. 差額 adjustment lines（metered のみ）
  const diffs = await findUnadjustedDifferences({
    organizationId,
    clientId,
  })

  for (const diff of diffs) {
    const compareWith = diff.lastAdjustedAmount ?? diff.frozenAmount
    if (!compareWith) continue

    const diffAmount = new Decimal(diff.currentAmount).minus(compareWith)
    if (diffAmount.isZero()) continue

    // 元請求月の為替レートを使用
    const currency = diff.currency
    let rate: string | null = null
    if (currency !== 'JPY') {
      const origRate = await getExchangeRate(diff.yearMonth, currency)
      rate = origRate.rate
    }

    const amountJpy = applyRounding(diffAmount.toString(), rate, roundingMethod)

    lines.push({
      expenseKind: 'adjustment',
      expenseGroupId: null,
      expenseItemId: diff.expenseItemId,
      expenseRecordId: diff.expenseRecordId,
      expenseYearMonth: diff.yearMonth,
      description: `経費差額調整 ${diff.yearMonth}`,
      amountForeign: diffAmount.toString(),
      currency,
      exchangeRate: rate,
      amountJpy,
      taxRate: 10,
      isProvisional: false,
      reducedTaxRate: false,
    })
  }

  return { lines, exchangeRates, errors: refreshResult.errors }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 端数処理: 外貨金額 × 為替レート → 円額（INTEGER）
 */
export function applyRounding(
  amountForeign: string,
  exchangeRate: string | null,
  method: RoundingMethod,
): number {
  const amount = new Decimal(amountForeign)
  const jpy = exchangeRate ? amount.mul(exchangeRate) : amount // JPY: そのまま

  const roundingMode =
    method === 'floor'
      ? Decimal.ROUND_FLOOR
      : method === 'ceil'
        ? Decimal.ROUND_CEIL
        : Decimal.ROUND_HALF_UP

  return jpy.toDecimalPlaces(0, roundingMode).toNumber()
}

function expandTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(
    /\{(\w+)\}/g,
    (_, key: string) => vars[key] ?? `{${key}}`,
  )
}

function currencyLabel(currency: string): string {
  if (currency === 'JPY') return '円'
  if (currency === 'USD') return 'ドル'
  return currency
}

/**
 * 対象月の翌月5日より前かどうか（従量課金の暫定値判定）
 */
export function isBeforeSettlement(yearMonth: string): boolean {
  const { year, month } = parseYearMonthId(yearMonth)
  if (!year || !month) return false
  const settlementDate =
    month === 12
      ? dayjs(`${year + 1}-01-05`)
      : dayjs(`${year}-${String(month + 1).padStart(2, '0')}-05`)
  return dayjs().isBefore(settlementDate)
}
