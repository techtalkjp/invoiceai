import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

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
  totalInputTokens: number
  totalOutputTokens: number
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
 * アクティビティから作業内容を機械的に生成（フォールバック用）
 */
function buildMechanicalDescription(activities: Activity[]): string {
  const parts: string[] = []

  // イベントタイプ別に集計
  const commits = activities.filter((a) => a.eventType === 'commit')
  const prs = activities.filter((a) => a.eventType === 'pr')
  const reviews = activities.filter((a) => a.eventType === 'review')
  const comments = activities.filter((a) => a.eventType === 'issue_comment')

  if (commits.length > 0) {
    const repos = new Set<string>()
    const messages: string[] = []
    for (const c of commits) {
      if (c.repo) repos.add(c.repo.split('/')[1] ?? c.repo)
      if (c.title) messages.push(c.title)
    }
    const repoStr = [...repos].join(',')
    // コミットメッセージを最大5件まで含める（LLMが具体的な概要を書けるように）
    const msgStr =
      messages.length > 0
        ? `: ${messages.slice(0, 5).join(', ')}${messages.length > 5 ? ` 他${messages.length - 5}件` : ''}`
        : ''
    parts.push(`${commits.length}commits(${repoStr})${msgStr}`)
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
 * AI で作業内容を自然な日本語に要約。失敗時はルールベースにフォールバック。
 */
type DescriptionResult = {
  text: string
  inputTokens: number
  outputTokens: number
}

async function buildDescription(
  activities: Activity[],
  useAi = true,
): Promise<DescriptionResult> {
  const fallback = buildMechanicalDescription(activities)
  const noTokens = { text: fallback, inputTokens: 0, outputTokens: 0 }

  if (!useAi) return noTokens
  if (fallback === '開発作業') return noTokens
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return noTokens

  try {
    const { text, usage } = await generateText({
      model: google('gemini-flash-lite-latest'),
      system: `あなたはGitHubのアクティビティログを、クライアント向けの勤怠表（タイムシート）に記載する作業概要に変換するアシスタントです。

ルール:
- 出力は日本語1行のみ（30文字以内厳守）。説明や補足は一切不要
- 1日の作業を「何のためにやったか」の観点で最大2項目に要約する
- 技術的な手段（memo化、モジュール分離、リファクタリング等）ではなく、その目的・効果をクライアントに伝わる言葉で表現する
- リポジトリ名・コミット数・ハッシュなどのGit固有の情報は省略する
- feat:/fix:/refactor:などのプレフィックスは除去して自然な日本語にする

例:
入力: 5commits(api-server): Add user endpoint, Add validation, Fix error handling / PR: Add user API (merged) / レビュー1件
出力: ユーザーAPI追加、コードレビュー

入力: 3commits(invoiceai): migrate schema, update codegen config, fix types / PR: feat: migrate from Prisma to Atlas + kysely-codegen (merged)
出力: DB基盤の移行による保守性向上

入力: 17commits(invoiceai): prevent zoom on iOS, extract timesheet module, fix mobile scroll, update store / PR: fix: iOS input zoom prevention, PR: refactor: timesheet module extraction
出力: モバイル操作性の改善、タイムシート保守性向上

入力: 8commits(invoiceai): add page header, unify layout, add sidebar, simplify root.tsx, add useEffect policy, fix props
出力: 画面レイアウトの統一、ナビゲーション改善

入力: 6commits(invoiceai): memo cell component, fix filter rerender, perf: batch updates, extract shared timesheet component
出力: タイムシート表示の高速化`,
      prompt: fallback,
    })
    return {
      text: text.trim() || fallback,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    }
  } catch (e) {
    console.error('[AI Description] Failed:', e)
    return noTokens
  }
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
export async function suggestWorkEntriesFromActivities(
  activities: Activity[],
  options?: { useAi?: boolean | undefined } | undefined,
): Promise<SuggestResult> {
  const useAi = options?.useAi ?? true

  // 日付ごとにグループ化
  const byDate = new Map<string, Activity[]>()
  for (const a of activities) {
    const existing = byDate.get(a.eventDate) ?? []
    existing.push(a)
    byDate.set(a.eventDate, existing)
  }

  // 各日のエントリを並列で生成
  type EntryWithTokens = SuggestedEntry & {
    inputTokens: number
    outputTokens: number
  }
  const entryPromises: Promise<EntryWithTokens | null>[] = []

  for (const [date, acts] of [...byDate.entries()].sort()) {
    entryPromises.push(
      (async () => {
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

        const desc = await buildDescription(acts, useAi)

        return {
          workDate: date,
          startTime: minutesToHHMM(startMin),
          endTime: minutesToHHMM(endMin),
          breakMinutes,
          description: desc.text,
          inputTokens: desc.inputTokens,
          outputTokens: desc.outputTokens,
        }
      })(),
    )
  }

  const results = await Promise.all(entryPromises)
  const entries: SuggestedEntry[] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0
  for (const r of results) {
    if (r) {
      totalInputTokens += r.inputTokens
      totalOutputTokens += r.outputTokens
      entries.push({
        workDate: r.workDate,
        startTime: r.startTime,
        endTime: r.endTime,
        breakMinutes: r.breakMinutes,
        description: r.description,
      })
    }
  }

  const totalHours = entries.reduce((sum, e) => {
    const start = timeToMin(e.startTime)
    const end = timeToMin(e.endTime)
    return sum + (end - start - e.breakMinutes) / 60
  }, 0)

  const reasoning = `${entries.length}日分のアクティビティから稼働時間を推定（合計${totalHours.toFixed(1)}h）`

  return { entries, reasoning, totalInputTokens, totalOutputTokens }
}

function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
