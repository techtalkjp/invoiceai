import { google } from '@ai-sdk/google'
import holidayJp from '@holiday-jp/holiday_jp'
import { Output, generateText } from 'ai'
import { z } from 'zod'

// テキストから抽出する稼働エントリのスキーマ
const workEntrySchema = z.object({
  workDate: z.string().describe('日付 (YYYY-MM-DD形式)'),
  startTime: z.string().optional().describe('開始時刻 (HH:MM形式、24時間表記)'),
  endTime: z.string().optional().describe('終了時刻 (HH:MM形式、24時間表記)'),
  breakMinutes: z
    .number()
    .optional()
    .describe('休憩時間（分単位）。記載がなければ0'),
  description: z.string().optional().describe('作業内容の要約'),
})

const parseResultSchema = z.object({
  entries: z.array(workEntrySchema).describe('抽出された稼働エントリの配列'),
  parseErrors: z
    .array(z.string())
    .optional()
    .describe('解析できなかった行や問題があった場合のメッセージ'),
})

export type ParsedWorkEntry = z.infer<typeof workEntrySchema>
export type ParseResult = z.infer<typeof parseResultSchema>

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

/**
 * 指定年月のカレンダー情報（曜日・祝日）を生成
 */
function buildCalendarContext(year: number, month: number): string {
  const daysInMonth = new Date(year, month, 0).getDate()
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month - 1, daysInMonth)
  const holidays = holidayJp.between(start, end)
  const holidayMap = new Map(
    holidays.map((h) => {
      const d = new Date(h.date)
      return [d.getDate(), h.name]
    }),
  )

  const lines: string[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dow = DAY_LABELS[date.getDay()]
    const holiday = holidayMap.get(day)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    let label = `${month}/${day}(${dow})`
    if (holiday) {
      label += ` 祝日:${holiday}`
    } else if (isWeekend) {
      label += ' 休日'
    }
    lines.push(label)
  }
  return lines.join('\n')
}

/**
 * テキストから稼働時間を抽出する
 */
export async function parseWorkHoursText(
  text: string,
  year: number,
  month: number,
): Promise<ParseResult> {
  const calendarContext = buildCalendarContext(year, month)

  const { output } = await generateText({
    abortSignal: AbortSignal.timeout(30_000),
    model: google('gemini-flash-latest'),
    output: Output.object({ schema: parseResultSchema }),
    system: `あなたは稼働報告テキストから稼働時間情報を抽出するアシスタントです。

## ${year}年${month}月のカレンダー
${calendarContext}

## 抽出ルール

1. 日付の解釈:
   - 「1/15」「1月15日」「15日」などの日付表記を見つけたら、指定された年月（${year}年${month}月）のYYYY-MM-DD形式に変換
   - 曜日表記（月曜、火曜など）がある場合は、上記カレンダーと照合して正しい日付を特定する
   - 日付が明示されていない場合は、前後の文脈から推測

2. 時間の解釈:
   - 「9:00-18:00」「9時〜18時」「9:00から18:00まで」などの表記から開始・終了時刻を抽出
   - 「午前」「午後」の表記があれば24時間表記に変換（例：午後2時→14:00）
   - 「10:00」のような単独時刻は開始時刻として扱う

3. 休憩時間:
   - 「休憩1時間」「昼休み1h」などから分単位に変換（1時間→60分）
   - 明示的な記載がなければ0

4. 作業内容:
   - 稼働報告に含まれる作業内容を簡潔に要約
   - 複数のタスクがあればカンマ区切りで列挙

5. 注意事項:
   - 稼働報告以外の雑談は無視
   - 同じ日付の複数エントリがあれば1つにまとめる
   - 時刻が不明確な場合はstartTime/endTimeをnullにしてdescriptionだけ記録`,
    prompt: `以下のテキストから稼働時間情報を抽出してください。対象年月は${year}年${month}月です。

---
${text}
---`,
  })

  if (!output) {
    throw new Error('AI解析に失敗しました')
  }
  return output
}
