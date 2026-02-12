import { z } from 'zod'

// 時間文字列のバリデーション（HH:MM 形式、24時超えも許可）
const timeStringSchema = z
  .string()
  .regex(/^([0-2]?[0-9]):([0-5][0-9])$/, '時間は HH:MM 形式で入力してください')
  .refine(
    (val) => {
      const [hours] = val.split(':').map(Number)
      return hours !== undefined && hours >= 0 && hours <= 29
    },
    { message: '時間は 0:00 から 29:59 の範囲で入力してください' },
  )

// 空文字も許可する時間スキーマ
const optionalTimeSchema = z.union([z.literal(''), timeStringSchema])

// タイムシートエントリのスキーマ
export const timesheetEntrySchema = z
  .object({
    startTime: optionalTimeSchema,
    endTime: optionalTimeSchema,
    breakMinutes: z.number().int().min(0).max(480), // 最大8時間
    description: z.string().max(2000),
    aiGenerated: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      // 両方空なら OK
      if (!data.startTime && !data.endTime) return true
      // 片方だけ入力されている場合も OK（入力途中）
      if (!data.startTime || !data.endTime) return true

      // 両方入力されている場合は開始 < 終了をチェック
      const [startH, startM] = data.startTime.split(':').map(Number)
      const [endH, endM] = data.endTime.split(':').map(Number)

      if (
        startH === undefined ||
        startM === undefined ||
        endH === undefined ||
        endM === undefined
      ) {
        return false
      }

      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM

      return endMinutes > startMinutes
    },
    { message: '終了時間は開始時間より後にしてください' },
  )

// 月データのスキーマ
export const monthDataSchema = z.record(z.string(), timesheetEntrySchema)

// clientAction で受け取る intent
export const timesheetIntentSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('updateEntry'),
    date: z.string(),
    field: z.enum(['startTime', 'endTime', 'breakMinutes', 'description']),
    value: z.union([z.string(), z.number()]),
  }),
  z.object({
    intent: z.literal('setMonthData'),
    data: monthDataSchema,
  }),
  z.object({
    intent: z.literal('clearEntry'),
    dates: z.array(z.string()),
  }),
  z.object({
    intent: z.literal('clearAll'),
  }),
])

export type TimesheetIntent = z.infer<typeof timesheetIntentSchema>
