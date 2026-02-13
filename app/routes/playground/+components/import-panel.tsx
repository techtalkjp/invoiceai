import { GithubIcon, SparklesIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { toast } from 'sonner'
import { useActivityStore } from '~/components/timesheet/activity-store'
import { Collapsible, CollapsibleContent } from '~/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import type { GitHubResult } from '../+lib/github-oauth.server'
import type { ParsedWorkEntry } from '../../org.$orgSlug/work-hours/+ai-parse.server'
import { applyEntries } from './apply-entries'
import { GitHubTab } from './github-tab'
import { TextTab } from './text-tab'
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
