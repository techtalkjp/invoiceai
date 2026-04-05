import { nanoid } from 'nanoid'
import { db } from '~/lib/db/kysely'
import { nowISO } from '~/utils/date'
import type { ExpensePreviewLine } from './expense-preview-service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvoiceLineSnapshot = {
  id: string
  invoiceId: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  taxRate: number
  expenseGroupId: string | null
  expenseItemId: string | null
  expenseRecordId: string | null
  expenseYearMonth: string | null
  expenseKind: 'regular' | 'adjustment' | null
  amountForeign: string | null
  exchangeRate: string | null
  currency: string | null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 稼働明細行を invoice_line snapshot 形式に変換する
 */
export function buildWorkLineSnapshot(params: {
  invoiceId: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  taxRate: number
}): InvoiceLineSnapshot {
  return {
    id: nanoid(),
    invoiceId: params.invoiceId,
    description: params.description,
    quantity: params.quantity,
    unit: params.unit,
    unitPrice: params.unitPrice,
    taxRate: params.taxRate,
    expenseGroupId: null,
    expenseItemId: null,
    expenseRecordId: null,
    expenseYearMonth: null,
    expenseKind: null,
    amountForeign: null,
    exchangeRate: null,
    currency: null,
  }
}

/**
 * 経費プレビュー行を invoice_line snapshot 形式に変換する
 */
export function buildExpenseLineSnapshot(params: {
  invoiceId: string
  line: ExpensePreviewLine
}): InvoiceLineSnapshot {
  return {
    id: nanoid(),
    invoiceId: params.invoiceId,
    description: params.line.description,
    quantity: 1,
    unit: '式',
    unitPrice: params.line.amountJpy,
    taxRate: params.line.taxRate,
    expenseGroupId: params.line.expenseGroupId,
    expenseItemId: params.line.expenseItemId,
    expenseRecordId: params.line.expenseRecordId,
    expenseYearMonth: params.line.expenseYearMonth,
    expenseKind: params.line.expenseKind,
    amountForeign: params.line.amountForeign,
    exchangeRate: params.line.exchangeRate,
    currency: params.line.currency,
  }
}

/**
 * 経費プレビュー行を freee API 送信用の line に変換する
 */
export function toFreeeInvoiceLine(line: ExpensePreviewLine) {
  return {
    type: 'item' as const,
    description: line.description,
    quantity: '1',
    unit: '式',
    unit_price: String(line.amountJpy),
    tax_rate: line.taxRate,
    reduced_tax_rate: line.reducedTaxRate,
    withholding: false,
  }
}

/**
 * invoice_line テーブルに一括保存する
 */
export async function saveInvoiceLines(
  lines: InvoiceLineSnapshot[],
): Promise<void> {
  if (lines.length === 0) return

  // 既存行を削除（同一 invoice_id の行を入れ替え）
  const invoiceId = lines[0]?.invoiceId
  if (invoiceId) {
    await db
      .deleteFrom('invoiceLine')
      .where('invoiceId', '=', invoiceId)
      .execute()
  }

  // 新しい行を挿入
  await db
    .insertInto('invoiceLine')
    .values(
      lines.map((line) => ({
        id: line.id,
        invoiceId: line.invoiceId,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        expenseGroupId: line.expenseGroupId,
        expenseItemId: line.expenseItemId,
        expenseRecordId: line.expenseRecordId,
        expenseYearMonth: line.expenseYearMonth,
        expenseKind: line.expenseKind,
        amountForeign: line.amountForeign,
        exchangeRate: line.exchangeRate,
        currency: line.currency,
      })),
    )
    .execute()
}

/**
 * 差額調整の expense_record を「調整済み」にマークする
 */
export async function markExpenseRecordsAdjusted(
  invoiceId: string,
  adjustmentLines: ExpensePreviewLine[],
): Promise<void> {
  const targets: Array<{ recordId: string; amountForeign: string }> = []
  for (const l of adjustmentLines) {
    if (l.expenseKind === 'adjustment' && l.expenseRecordId) {
      targets.push({
        recordId: l.expenseRecordId,
        amountForeign: l.amountForeign,
      })
    }
  }
  if (targets.length === 0) return

  const now = nowISO()
  const ids = targets.map((t) => t.recordId)

  // 共通フィールドを一括更新
  await db
    .updateTable('expenseRecord')
    .set({
      adjustedInInvoiceId: invoiceId,
      updatedAt: now,
    })
    .where('id', 'in', ids)
    .execute()

  // lastAdjustedAmount はレコードごとに異なるため個別更新
  for (const t of targets) {
    await db
      .updateTable('expenseRecord')
      .set({ lastAdjustedAmount: t.amountForeign })
      .where('id', '=', t.recordId)
      .execute()
  }
}
