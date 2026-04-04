import { z } from 'zod/v4'

const taxRateSchema = z
  .number()
  .refine((v) => [0, 8, 10].includes(v), '税率は0, 8, 10のいずれかです')

const expenseItemInGroupSchema = z.object({
  name: z.string().min(1, '項目名を入力してください'),
  type: z.enum(['fixed', 'metered']),
  monthlyAmount: z.string().optional(),
})

export const createGroupWithItemsSchema = z.object({
  intent: z.literal('createGroupWithItems'),
  name: z.string().min(1, 'グループ名を入力してください'),
  invoiceLabel: z.string().min(1, '請求書テンプレートを入力してください'),
  currency: z.enum(['USD', 'JPY']),
  taxRate: taxRateSchema,
  sortOrder: z.number().int().default(0),
  items: z.array(expenseItemInGroupSchema).default([]),
})

export const upsertGroupSchema = z.object({
  intent: z.literal('upsertGroup'),
  groupId: z.string().optional(),
  name: z.string().min(1, 'グループ名を入力してください'),
  invoiceLabel: z.string().min(1, '請求書テンプレートを入力してください'),
  currency: z.enum(['USD', 'JPY']),
  taxRate: taxRateSchema,
  sortOrder: z.number().int().default(0),
})

export const deleteGroupSchema = z.object({
  intent: z.literal('deleteGroup'),
  groupId: z.string().min(1),
})

export const upsertItemSchema = z.object({
  intent: z.literal('upsertItem'),
  itemId: z.string().optional(),
  groupId: z.string().optional(),
  name: z.string().min(1, '項目名を入力してください'),
  type: z.enum(['fixed', 'metered']),
  currency: z.enum(['USD', 'JPY']),
  monthlyAmount: z.string().optional(),
  taxRate: taxRateSchema.optional(),
  sortOrder: z.number().int().default(0),
})

export const deleteItemSchema = z.object({
  intent: z.literal('deleteItem'),
  itemId: z.string().min(1),
})

export const expenseFormSchema = z.discriminatedUnion('intent', [
  createGroupWithItemsSchema,
  upsertGroupSchema,
  deleteGroupSchema,
  upsertItemSchema,
  deleteItemSchema,
])
