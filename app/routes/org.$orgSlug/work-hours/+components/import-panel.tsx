import { GithubIcon, SparklesIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { toast } from 'sonner'
import { Collapsible, CollapsibleContent } from '~/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import type { ParsedWorkEntry } from '../+ai-parse.server'
import { applyEntries } from './apply-entries'
import { GitHubTab } from './github-tab'
import { TextTab } from './text-tab'

interface ImportPanelProps {
  clientId: string
  year: number
  month: number
  orgSlug: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  hasGitHubPat: boolean
  mappings: Array<{ clientId: string; sourceIdentifier: string }>
}

export function ImportPanel({
  clientId,
  year,
  month,
  orgSlug,
  isOpen,
  onOpenChange,
  hasGitHubPat,
  mappings,
}: ImportPanelProps) {
  const [inputText, setInputText] = useState('')
  const appliedRef = useRef(false)

  const parseFetcher = useFetcher<{
    entries?: ParsedWorkEntry[]
    parseErrors?: string[]
    error?: string
  }>({ key: `parse-text-${clientId}` })

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

  // 解析完了時に即反映
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

  const handleApplyGitHub = (
    entries: Array<{
      workDate: string
      startTime: string
      endTime: string
      breakMinutes: number
      description: string
    }>,
  ) => {
    if (entries.length === 0) return
    applyEntries(entries)
    toast.success(`${entries.length}件を反映しました`)
    onOpenChange(false)
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <CollapsibleContent>
        <div className="bg-muted/30 rounded-md border p-3">
          <Tabs defaultValue="text">
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
                clientId={clientId}
                year={year}
                month={month}
                orgSlug={orgSlug}
                hasGitHubPat={hasGitHubPat}
                mappings={mappings}
                onApply={handleApplyGitHub}
              />
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
