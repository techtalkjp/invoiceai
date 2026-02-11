import holidayJp from '@holiday-jp/holiday_jp'

interface Activity {
  eventDate: string
  eventTimestamp: string
  eventType: string
  repo: string | null
  title: string | null
  metadata: string | null
}

export type SuggestedEntry = {
  workDate: string
  startTime: string
  endTime: string
  breakMinutes: number
  description: string
}

export type SuggestResult = {
  entries: SuggestedEntry[]
  reasoning: string
}

/**
 * JSTでの時刻を分に変換（30時制: 0:00-5:59 は 24:00-29:59 として扱う）
 */
function toJstMinutes(isoTimestamp: string): number {
  const date = new Date(isoTimestamp)
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const hours = jst.getUTCHours()
  const minutes = jst.getUTCMinutes()
  // 6時前は前日の深夜扱い（24時超え）
  if (hours < 6) return (hours + 24) * 60 + minutes
  return hours * 60 + minutes
}

/**
 * 分をHH:MM形式に変換
 */
function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 日付が祝日・土日かどうかを判定
 */
function isNonWorkingDay(dateStr: string): boolean {
  const date = new Date(dateStr)
  const dow = date.getDay()
  if (dow === 0 || dow === 6) return true
  const holidays = holidayJp.between(date, date)
  return holidays.length > 0
}

/**
 * アクティビティから作業内容を機械的に生成
 */
function buildDescription(activities: Activity[]): string {
  const parts: string[] = []

  // イベントタイプ別に集計
  const commits = activities.filter((a) => a.eventType === 'commit')
  const prs = activities.filter((a) => a.eventType === 'pr')
  const reviews = activities.filter((a) => a.eventType === 'review')
  const comments = activities.filter((a) => a.eventType === 'issue_comment')

  if (commits.length > 0) {
    let totalCount = 0
    const repos = new Set<string>()
    for (const c of commits) {
      if (c.metadata) {
        try {
          const meta = JSON.parse(c.metadata) as { count?: number }
          totalCount += meta.count ?? 0
        } catch {
          totalCount += 1
        }
      }
      if (c.repo) repos.add(c.repo.split('/')[1] ?? c.repo)
    }
    parts.push(`${totalCount}commits(${[...repos].join(',')})`)
  }

  if (prs.length > 0) {
    // 同じPRのopened/merged/closedを重複排除（titleベース）
    const seen = new Map<string, string>() // title → best action
    for (const p of prs) {
      const title = p.title ?? ''
      if (!title) continue
      let action: string | null = null
      if (p.metadata) {
        try {
          const meta = JSON.parse(p.metadata) as { action?: string }
          action = meta.action ?? null
        } catch {
          // ignore
        }
      }
      const prev = seen.get(title)
      // merged > closed > opened の優先度
      if (
        !prev ||
        action === 'merged' ||
        (action === 'closed' && prev !== 'merged')
      ) {
        seen.set(title, action ?? 'opened')
      }
    }
    const titles: string[] = []
    for (const [title, action] of seen) {
      if (titles.length >= 3) break
      const suffix =
        action === 'merged' || action === 'closed' ? ` (${action})` : ''
      titles.push(`${title}${suffix}`)
    }
    parts.push(`PR: ${titles.join(', ')}`)
  }

  if (reviews.length > 0) {
    parts.push(`レビュー${reviews.length}件`)
  }

  if (comments.length > 0) {
    parts.push(`コメント${comments.length}件`)
  }

  return parts.join(' / ') || '開発作業'
}

/**
 * ルールベースでタイムシートの候補を生成する
 *
 * ルール:
 * 1. 開始 = 最初のアクティビティの時刻（下限 6:00）
 * 2. 終了 = 最後のアクティビティの時刻（上限 29:59）
 * 3. 休憩 = 6h以上なら60min、それ以下は0
 * 4. 土日祝・アクティビティなしの日はスキップ
 */
export function suggestWorkEntriesFromActivities(
  activities: Activity[],
): SuggestResult {
  // 日付ごとにグループ化
  const byDate = new Map<string, Activity[]>()
  for (const a of activities) {
    const existing = byDate.get(a.eventDate) ?? []
    existing.push(a)
    byDate.set(a.eventDate, existing)
  }

  const entries: SuggestedEntry[] = []

  for (const [date, acts] of [...byDate.entries()].sort()) {
    // 土日祝はスキップ
    if (isNonWorkingDay(date)) continue

    // タイムスタンプを持つアクティビティのみで時間推定
    const timestamps = acts
      .filter((a) => a.eventTimestamp)
      .map((a) => toJstMinutes(a.eventTimestamp))
      .filter((m) => m >= 0)

    let startMin: number
    let endMin: number

    if (timestamps.length > 0) {
      const earliest = Math.min(...timestamps)
      const latest = Math.max(...timestamps)

      // 開始: 最初のアクティビティの時刻（下限 6:00）
      startMin = Math.max(6 * 60, earliest)
      // 終了: 最後のアクティビティの時刻（上限 29:59）
      endMin = Math.min(29 * 60 + 59, latest)
      // 開始と終了が逆転しないようにする
      if (endMin <= startMin) endMin = startMin + 60
    } else {
      // タイムスタンプなし: デフォルト 9:00-18:00
      startMin = 9 * 60
      endMin = 18 * 60
    }

    // 休憩: 6h以上なら60min
    const workDuration = endMin - startMin
    const breakMinutes = workDuration >= 6 * 60 ? 60 : 0

    const description = buildDescription(acts)

    entries.push({
      workDate: date,
      startTime: minutesToHHMM(startMin),
      endTime: minutesToHHMM(endMin),
      breakMinutes,
      description,
    })
  }

  const totalHours = entries.reduce((sum, e) => {
    const start = timeToMin(e.startTime)
    const end = timeToMin(e.endTime)
    return sum + (end - start - e.breakMinutes) / 60
  }, 0)

  const reasoning = `${entries.length}日分のアクティビティから稼働時間を推定（合計${totalHours.toFixed(1)}h）`

  return { entries, reasoning }
}

function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
