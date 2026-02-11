import { google } from '@ai-sdk/google'
import holidayJp from '@holiday-jp/holiday_jp'
import { Output, generateText } from 'ai'
import { z } from 'zod'

const suggestedEntrySchema = z.object({
  workDate: z.string().describe('日付 (YYYY-MM-DD形式)'),
  startTime: z.string().describe('推定開始時刻 (HH:MM形式、24時間表記)'),
  endTime: z.string().describe('推定終了時刻 (HH:MM形式、24時間表記)'),
  breakMinutes: z.number().describe('休憩時間（分単位）。通常は60'),
  description: z.string().describe('その日の作業内容の要約'),
})

const suggestResultSchema = z.object({
  entries: z.array(suggestedEntrySchema).describe('提案する稼働エントリの配列'),
  reasoning: z.string().describe('提案の根拠の説明'),
})

export type SuggestedEntry = z.infer<typeof suggestedEntrySchema>
export type SuggestResult = z.infer<typeof suggestResultSchema>

interface Activity {
  eventDate: string
  eventTimestamp: string
  eventType: string
  repo: string | null
  title: string | null
  metadata: string | null
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

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

function formatActivities(activities: Activity[]): string {
  if (activities.length === 0) return '（アクティビティなし）'

  const byDate = new Map<string, Activity[]>()
  for (const a of activities) {
    const existing = byDate.get(a.eventDate) ?? []
    existing.push(a)
    byDate.set(a.eventDate, existing)
  }

  const lines: string[] = []
  for (const [date, acts] of [...byDate.entries()].sort()) {
    lines.push(`\n## ${date}`)
    for (const a of acts) {
      const repo = a.repo ? `[${a.repo}]` : ''
      const title = a.title ? ` ${a.title}` : ''
      const time = a.eventTimestamp
        ? ` (${new Date(a.eventTimestamp).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })})`
        : ''
      lines.push(`- ${a.eventType}${repo}${title}${time}`)
    }
  }
  return lines.join('\n')
}

/**
 * アクティビティからタイムシートを提案する
 */
export async function suggestWorkEntries(
  activities: Activity[],
  clientName: string,
  year: number,
  month: number,
): Promise<SuggestResult> {
  const calendarContext = buildCalendarContext(year, month)
  const activityText = formatActivities(activities)

  const { output } = await generateText({
    model: google('gemini-flash-latest'),
    output: Output.object({ schema: suggestResultSchema }),
    system: `あなたはプログラマーの稼働時間を推定するアシスタントです。
GitHubのアクティビティ（コミット、PR、レビュー等）から、1日ごとの稼働時間を推定してください。

## ${year}年${month}月のカレンダー
${calendarContext}

## 推定ルール

1. アクティビティの時間帯から稼働開始・終了時刻を推定する
   - 最初のアクティビティの30分前を開始時刻とする
   - 最後のアクティビティの30分後を終了時刻とする
   - ただし、開始は9:00〜10:30の間、終了は17:00〜20:00の間に収める

2. 休憩時間
   - 6時間以上の稼働なら60分の休憩を設定
   - それ以下なら0分

3. 作業内容
   - その日のアクティビティを要約する
   - コミット、PR、レビュー等の内容を簡潔にまとめる

4. アクティビティがない日
   - 平日でアクティビティがない日は含めない
   - 土日祝日は含めない

5. クライアント: ${clientName}`,
    prompt: `以下のGitHubアクティビティから、${year}年${month}月のタイムシートを提案してください。

${activityText}`,
  })

  if (!output) {
    throw new Error('AI提案の生成に失敗しました')
  }
  return output
}
