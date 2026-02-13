import {
  ChevronDownIcon,
  GithubIcon,
  Loader2Icon,
  SparklesIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { toast } from 'sonner'
import { calculateWorkDuration } from '~/components/time/time-utils'
import { useActivityStore } from '~/components/timesheet/activity-store'
import { useTimesheetStore } from '~/components/timesheet/store'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Textarea } from '~/components/ui/textarea'
import type { GitHubResult } from '../+lib/github-oauth.server'
import type { ParsedWorkEntry } from '../../org.$orgSlug/work-hours/+ai-parse.server'
import { saveActivities } from './use-auto-save'

interface ImportPanelProps {
  year: number
  month: number
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: 'text' | 'github' | undefined
  githubResult?: GitHubResult | null | undefined
}

export function ImportPanel({
  year,
  month,
  isOpen,
  onOpenChange,
  defaultTab,
  githubResult,
}: ImportPanelProps) {
  const [inputText, setInputText] = useState('')
  // テキスト解析の結果を反映済みかどうか追跡
  const appliedRef = useRef(false)

  const parseFetcher = useFetcher<{
    entries?: ParsedWorkEntry[]
    parseErrors?: string[]
    error?: string
  }>({ key: 'parse-text-playground' })

  const isParsing = parseFetcher.state !== 'idle'

  const handleParse = () => {
    if (!inputText.trim()) return
    appliedRef.current = false
    parseFetcher.submit(
      {
        intent: 'parseText',
        text: inputText,
        year: String(year),
        month: String(month),
      },
      { method: 'POST' },
    )
  }

  // fetcher result との同期: 解析完了時に即反映
  useEffect(() => {
    if (parseFetcher.state !== 'idle' || appliedRef.current) return
    if (!parseFetcher.data?.entries) return

    const entries = parseFetcher.data.entries
    if (entries.length === 0) {
      toast.info('解析できるデータがありませんでした')
      return
    }

    appliedRef.current = true
    applyEntries(
      entries.map((e) => ({
        workDate: e.workDate,
        startTime: e.startTime ?? '',
        endTime: e.endTime ?? '',
        breakMinutes: e.breakMinutes ?? 0,
        description: e.description ?? '',
      })),
    )
    toast.success(`${entries.length}件を反映しました`)
    setInputText('')
    onOpenChange(false)
  }, [parseFetcher.state, parseFetcher.data, onOpenChange])

  const handleApplyGitHub = () => {
    if (!githubResult?.entries.length) return

    // アクティビティを store にセット + localStorage に保存（indicator 表示用）
    if (githubResult.activities) {
      useActivityStore.getState().setActivities(githubResult.activities)
      const monthKey = `${year}-${String(month).padStart(2, '0')}`
      saveActivities(monthKey, useActivityStore.getState().activitiesByDate)
    }

    applyEntries(githubResult.entries)
    toast.success(
      `@${githubResult.username}: ${githubResult.entries.length}件を反映しました`,
    )
    onOpenChange(false)
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <CollapsibleContent>
        <div className="bg-muted/30 rounded-md border p-3">
          <Tabs defaultValue={defaultTab ?? 'text'}>
            <TabsList className="mb-3">
              <TabsTrigger value="text">
                <SparklesIcon className="size-4" />
                テキスト
              </TabsTrigger>
              <TabsTrigger value="github">
                <GithubIcon className="size-4" />
                GitHub
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text">
              <TextTab
                inputText={inputText}
                onInputTextChange={setInputText}
                isParsing={isParsing}
                onParse={handleParse}
                error={parseFetcher.data?.error}
                parseErrors={parseFetcher.data?.parseErrors}
              />
            </TabsContent>

            <TabsContent value="github">
              <GitHubTab
                year={year}
                month={month}
                githubResult={githubResult}
                onApply={handleApplyGitHub}
              />
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// --- テキストタブ ---

interface TextTabProps {
  inputText: string
  onInputTextChange: (text: string) => void
  isParsing: boolean
  onParse: () => void
  error?: string | undefined
  parseErrors?: string[] | undefined
}

function TextTab({
  inputText,
  onInputTextChange,
  isParsing,
  onParse,
  error,
  parseErrors,
}: TextTabProps) {
  return (
    <div className="grid gap-2">
      <Textarea
        placeholder={`稼働テキストを貼り付け（例）\n1/15 9:00-18:00 休憩1h タスクA対応\n1/16 10:00-17:00 MTG、ドキュメント作成`}
        className="max-h-40 min-h-20 resize-none"
        rows={3}
        value={inputText}
        onChange={(e) => onInputTextChange(e.target.value)}
        disabled={isParsing}
      />

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {parseErrors && parseErrors.length > 0 && (
        <div className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
          {parseErrors.map((msg, i) => (
            <p key={i}>{msg}</p>
          ))}
        </div>
      )}

      <Button
        size="sm"
        onClick={onParse}
        disabled={!inputText.trim() || isParsing}
        className="self-center"
      >
        {isParsing ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            解析中...
          </>
        ) : (
          <>
            <SparklesIcon className="size-4" />
            AIで解析して反映
          </>
        )}
      </Button>
    </div>
  )
}

// --- GitHubタブ ---

interface GitHubTabProps {
  year: number
  month: number
  githubResult?: GitHubResult | null | undefined
  onApply: () => void
}

function GitHubTab({ year, month, githubResult, onApply }: GitHubTabProps) {
  const fetcher = useFetcher({ key: 'github-oauth' })
  const isLoading = fetcher.state !== 'idle'

  if (githubResult) {
    const totalWorkMinutes = githubResult.entries.reduce((sum, e) => {
      if (!e.startTime || !e.endTime) return sum
      const d = calculateWorkDuration(e.startTime, e.endTime, e.breakMinutes)
      return sum + d.workMinutes
    }, 0)
    const totalH = Math.floor(totalWorkMinutes / 60)
    const totalM = totalWorkMinutes % 60

    return (
      <div className="grid min-w-0 gap-3 overflow-hidden">
        <div className="bg-muted/50 rounded-md px-3 py-2 text-sm">
          <span className="font-medium">@{githubResult.username}</span> の
          {githubResult.activityCount}
          件のアクティビティから
          <span className="font-medium">{githubResult.entries.length}日分</span>
          を検出
          {totalWorkMinutes > 0 && (
            <span className="text-muted-foreground">
              （合計{totalH}h{totalM > 0 ? `${totalM}m` : ''}）
            </span>
          )}
        </div>

        {githubResult.reasoning && (
          <p className="text-muted-foreground text-xs">
            {githubResult.reasoning}
          </p>
        )}

        {githubResult.entries.length > 0 ? (
          <>
            <EntryPreviewList entries={githubResult.entries} />
            <div className="flex justify-center">
              <Button size="sm" onClick={onApply}>
                {githubResult.entries.length}件を反映
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            この月のアクティビティが見つかりませんでした
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <p className="text-muted-foreground text-center text-sm">
        コミットやPRから稼働時間を自動推定します
      </p>
      <fetcher.Form method="POST">
        <input type="hidden" name="intent" value="startGitHubOAuth" />
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <Button type="submit" size="sm" disabled={isLoading}>
          {isLoading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <GithubIcon className="size-4" />
          )}
          GitHubに接続
        </Button>
      </fetcher.Form>
    </div>
  )
}

// --- エントリプレビューリスト（折りたたみ） ---

function EntryPreviewList({
  entries,
}: {
  entries: Array<{
    workDate: string
    startTime: string
    endTime: string
    breakMinutes: number
    description: string
  }>
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="min-w-0">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground inline-flex w-auto items-center gap-1 text-xs transition-colors">
        <ChevronDownIcon
          className={`size-3 transition-transform ${isOpen ? '' : '-rotate-90'}`}
        />
        内訳を{isOpen ? '閉じる' : '見る'}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 max-h-48 space-y-0.5 overflow-x-hidden overflow-y-auto">
          {entries.map((e) => {
            const d = new Date(e.workDate)
            const work =
              e.startTime && e.endTime
                ? calculateWorkDuration(e.startTime, e.endTime, e.breakMinutes)
                : null
            return (
              <div
                key={e.workDate}
                className="text-muted-foreground flex min-w-0 items-baseline gap-2 text-xs"
              >
                <span className="w-10 shrink-0 font-medium tabular-nums">
                  {d.getMonth() + 1}/{d.getDate()}
                </span>
                <span className="w-20 shrink-0 tabular-nums">
                  {e.startTime}–{e.endTime}
                </span>
                {work && work.workMinutes > 0 && (
                  <span className="w-10 shrink-0 text-right tabular-nums">
                    {Math.floor(work.workMinutes / 60)}h
                    {work.workMinutes % 60 > 0 && `${work.workMinutes % 60}m`}
                  </span>
                )}
                <span className="truncate">{e.description}</span>
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// --- 共通: entries をストアに即反映 + ハイライト ---

function applyEntries(
  entries: Array<{
    workDate: string
    startTime: string
    endTime: string
    breakMinutes: number
    description: string
  }>,
) {
  const store = useTimesheetStore.getState()
  const dates: string[] = []

  store.setMonthData((prev) => {
    const next = { ...prev }
    for (const entry of entries) {
      next[entry.workDate] = {
        startTime: entry.startTime,
        endTime: entry.endTime,
        breakMinutes: entry.breakMinutes,
        description: entry.description,
      }
      dates.push(entry.workDate)
    }
    return next
  })

  // ハイライト → 自動クリア
  store.setHighlightedDates(dates)
  setTimeout(() => store.setHighlightedDates([]), 1500)
}
