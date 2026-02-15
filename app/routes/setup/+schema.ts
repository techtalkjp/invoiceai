import { coerceFormValue } from '@conform-to/zod/v4/future'
import { z } from 'zod/v4'

export const workspaceSchema = coerceFormValue(
  z.object({
    workspaceName: z.string().trim().min(1, '会社名・屋号を入力してください'),
  }),
)

export const clientSchema = coerceFormValue(
  z
    .object({
      name: z.string().min(1, 'クライアント名を入力してください'),
      billingType: z.enum(['time', 'fixed']),
      hourlyRate: z.number().int().min(0).optional(),
      monthlyFee: z.number().int().min(0).optional(),
    })
    .superRefine((value, ctx) => {
      if (value.billingType === 'time' && value.hourlyRate === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['hourlyRate'],
          message: '時間単価を入力してください',
        })
      }

      if (value.billingType === 'fixed' && value.monthlyFee === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['monthlyFee'],
          message: '月額を入力してください',
        })
      }
    }),
)

export type ClientFormValue = z.infer<typeof clientSchema>
