import { z } from 'zod'

// 時間フォーマット（HH:MM、30時制対応: 00:00-29:59）
const timeRegex = /^([01]?[0-9]|2[0-9]):[0-5][0-9]$/
const timeSchema = z
  .string()
  .regex(timeRegex, '時刻形式が不正です（HH:MM）')
  .optional()

// 単一の稼働エントリ保存スキーマ
export const saveEntrySchema = z.object({
  intent: z.literal('saveEntry'),
  clientId: z.string().min(1, 'クライアントを選択してください'),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付形式が不正です'),
  startTime: timeSchema,
  endTime: timeSchema,
  breakMinutes: z.coerce.number().int().min(0).default(0),
  description: z.string().optional(),
})

// 複数エントリ一括保存スキーマ
export const saveEntriesSchema = z.object({
  intent: z.literal('saveEntries'),
  entries: z.string(), // JSON string of entries array
})

// エントリ削除スキーマ
export const deleteEntrySchema = z.object({
  intent: z.literal('deleteEntry'),
  entryId: z.string().min(1),
})

// テキスト解析スキーマ
export const parseTextSchema = z.object({
  intent: z.literal('parseText'),
  text: z.string().min(1, 'テキストを入力してください'),
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
})

// 月データ一括保存スキーマ
export const saveMonthDataSchema = z.object({
  intent: z.literal('saveMonthData'),
  clientId: z.string().min(1),
  monthData: z.string(), // JSON string of MonthData
})

// AI提案確認保存スキーマ
export const saveAiSuggestionsSchema = z.object({
  intent: z.literal('saveAiSuggestions'),
  clientId: z.string().min(1),
  entries: z
    .string()
    .transform((val, ctx) => {
      try {
        return JSON.parse(val) as unknown
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Invalid JSON' })
        return z.NEVER
      }
    })
    .pipe(
      z.array(
        z.object({
          workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          startTime: z.string().regex(timeRegex),
          endTime: z.string().regex(timeRegex),
          breakMinutes: z.number().int().min(0),
          description: z.string(),
        }),
      ),
    ),
})

export const addMappingSchema = z.object({
  intent: z.literal('addMapping'),
  repoFullName: z.string().min(1),
})

export const removeMappingSchema = z.object({
  intent: z.literal('removeMapping'),
  sourceIdentifier: z.string().min(1),
})

// フォームスキーマ（discriminated union）
export const formSchema = z.discriminatedUnion('intent', [
  saveEntrySchema,
  saveEntriesSchema,
  deleteEntrySchema,
  parseTextSchema,
  saveMonthDataSchema,
])

// 型定義
export type SaveEntryData = z.infer<typeof saveEntrySchema>
export type SaveEntriesData = z.infer<typeof saveEntriesSchema>

export type WorkEntryData = {
  id?: string
  startTime?: string
  endTime?: string
  breakMinutes: number
  hours: number
  description?: string
}

export type MonthEntry = {
  clientId: string
  clientName: string
  entries: Record<string, WorkEntryData> // workDate -> entry
}

// 稼働時間を計算（開始・終了時刻と休憩時間から）
export function calculateHours(
  startTime: string | undefined,
  endTime: string | undefined,
  breakMinutes: number,
): number {
  if (!startTime || !endTime) return 0

  const startParts = startTime.split(':').map(Number)
  const endParts = endTime.split(':').map(Number)

  const startH = startParts[0] ?? 0
  const startM = startParts[1] ?? 0
  const endH = endParts[0] ?? 0
  const endM = endParts[1] ?? 0

  const startMinutes = startH * 60 + startM
  let endMinutes = endH * 60 + endM

  // 日をまたぐ場合（例: 22:00 - 06:00）
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }

  const totalMinutes = endMinutes - startMinutes - breakMinutes
  return Math.max(0, totalMinutes / 60)
}
