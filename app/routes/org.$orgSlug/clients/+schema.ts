import { z } from 'zod'

// 支払条件
export const paymentTermsOptions = [
  { value: 'next_month_end', label: '翌月末払い' },
  { value: 'next_next_month_1st', label: '翌々月1日払い' },
  { value: 'next_next_month_end', label: '翌々月末払い' },
] as const

export type PaymentTerms = (typeof paymentTermsOptions)[number]['value']

// クライアントスキーマ
export const clientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'クライアント名を入力してください'),
  billingType: z.enum(['fixed', 'time']),
  hourlyRate: z.coerce.number().int().min(0).optional(),
  monthlyFee: z.coerce.number().int().min(0).optional(),
  unitLabel: z.string().optional(),
  hasWorkDescription: z.coerce.number().int().min(0).max(1).optional(),
  freeePartnerId: z.coerce.number().int().optional(),
  freeePartnerName: z.string().optional(),
  invoiceSubjectTemplate: z.string().optional(),
  invoiceNote: z.string().optional(),
  paymentTerms: z
    .enum(['next_month_end', 'next_next_month_1st', 'next_next_month_end'])
    .optional(),
})

export type ClientFormData = z.infer<typeof clientSchema>

// インポート用スキーマ
export const importSchema = z.object({
  partnerId: z.coerce.number().int(),
  partnerName: z.string(),
})

export const bulkImportSchema = z.object({
  partners: z.string(), // JSON string of partner array
})

// 型定義
export type InvoicePartner = {
  id: number
  name: string
  lastBillingDate: string
}
