import { z } from 'zod'

export const yearMonthSchema = z
  .string()
  .regex(
    /^(\d{4})-(\d{2})$/,
    'Invalid date format. Use YYYY-MM (e.g., 2025-01)',
  )
  .transform((value) => {
    const [yearStr, monthStr] = value.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    return { year, month }
  })
  .refine(
    ({ year, month }) => Number.isFinite(year) && month >= 1 && month <= 12,
    'Invalid date format. Use YYYY-MM (e.g., 2025-01)',
  )

export const invoiceCreateSchema = z.object({
  clientId: z.string({ error: 'クライアントを選択してください' }).min(1),
  yearMonth: yearMonthSchema,
  // 編集モード時は freee の請求書 ID を渡す
  freeeInvoiceId: z.coerce.number().optional(),
})

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>
