import { LoaderIcon, SparklesIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useFetcher } from 'react-router'
import { formatMinutesToDuration } from '~/components/time-utils'
import { useTimesheetStore } from '~/components/timesheet/store'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Textarea } from '~/components/ui/textarea'
import type { ParsedWorkEntry } from '../+ai-parse.server'

type Props = {
  clientId: string
  year: number
  month: number
}

export function TextImportDialog({ clientId, year, month }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set())

  const parseFetcher = useFetcher<{
    entries?: ParsedWorkEntry[]
    parseErrors?: string[]
    error?: string
  }>({ key: `parse-text-${clientId}` })

  const isParsing = parseFetcher.state !== 'idle'

  // fetcher.data から直接導出（removedIndices でフィルタ）
  const parsedEntries = useMemo(() => {
    const entries = parseFetcher.data?.entries ?? []
    if (removedIndices.size === 0) return entries
    return entries.filter((_, i) => !removedIndices.has(i))
  }, [parseFetcher.data?.entries, removedIndices])

  const parseErrors = parseFetcher.data?.parseErrors ?? []

  const handleParse = () => {
    if (!inputText.trim()) return
    setRemovedIndices(new Set())

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

  const handleSave = () => {
    if (parsedEntries.length === 0) return

    // store にマージ（auto-save が自動的にサーバーに保存する）
    useTimesheetStore.getState().setMonthData((prev) => {
      const newData = { ...prev }
      for (const entry of parsedEntries) {
        newData[entry.workDate] = {
          startTime: entry.startTime ?? '',
          endTime: entry.endTime ?? '',
          breakMinutes: entry.breakMinutes ?? 0,
          description: entry.description ?? '',
        }
      }
      return newData
    })

    setIsOpen(false)
    setInputText('')
    setRemovedIndices(new Set())
  }

  const handleRemoveEntry = (index: number) => {
    // 元の entries 配列でのインデックスを計算
    const allEntries = parseFetcher.data?.entries ?? []
    let originalIndex = -1
    let visibleCount = 0
    for (let i = 0; i < allEntries.length; i++) {
      if (!removedIndices.has(i)) {
        if (visibleCount === index) {
          originalIndex = i
          break
        }
        visibleCount++
      }
    }
    if (originalIndex >= 0) {
      setRemovedIndices((prev) => new Set(prev).add(originalIndex))
    }
  }

  const formatTime = (time: string | undefined) => {
    return time ?? '-'
  }

  const formatBreak = (minutes: number | undefined) => {
    if (!minutes) return '-'
    return formatMinutesToDuration(minutes)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SparklesIcon className="mr-2 h-4 w-4" />
          AI解析で入力
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5" />
            テキストからインポート
          </DialogTitle>
          <DialogDescription>
            稼働報告のテキストをペーストすると、AIが自動で解析します
          </DialogDescription>
        </DialogHeader>

        {/* 入力エリア（スクロール可能） */}
        <div className="grid min-h-0 flex-1 gap-2 overflow-hidden">
          <Label htmlFor="input-text">稼働報告テキスト</Label>
          <Textarea
            id="input-text"
            placeholder={`例:
1/15 9:00-18:00 休憩1h
タスクA対応、レビュー

1/16 10:00-17:00
MTG、ドキュメント作成`}
            className="min-h-32 flex-1 resize-none"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isParsing}
          />
        </div>

        {/* 解析ボタン（常に表示） */}
        <Button
          className="shrink-0"
          onClick={handleParse}
          disabled={!inputText.trim() || isParsing}
        >
          {isParsing ? (
            <>
              <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
              解析中...
            </>
          ) : (
            <>
              <SparklesIcon className="mr-2 h-4 w-4" />
              AIで解析
            </>
          )}
        </Button>

        {/* 解析結果エリア（スクロール可能） */}
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto">
          {/* エラー表示 */}
          {parseFetcher.data?.error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {parseFetcher.data.error}
            </div>
          )}

          {/* 解析エラー */}
          {parseErrors.length > 0 && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
              <p className="font-medium">一部の内容を解析できませんでした：</p>
              <ul className="mt-1 list-inside list-disc">
                {parseErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 解析結果プレビュー */}
          {parsedEntries.length > 0 && (
            <div className="grid gap-2">
              <Label>解析結果（{parsedEntries.length}件）</Label>
              <div className="max-h-64 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">日付</TableHead>
                      <TableHead className="w-20">開始</TableHead>
                      <TableHead className="w-20">終了</TableHead>
                      <TableHead className="w-16">休憩</TableHead>
                      <TableHead>作業内容</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedEntries.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {entry.workDate}
                        </TableCell>
                        <TableCell>{formatTime(entry.startTime)}</TableCell>
                        <TableCell>{formatTime(entry.endTime)}</TableCell>
                        <TableCell>{formatBreak(entry.breakMinutes)}</TableCell>
                        <TableCell className="max-w-48 truncate">
                          {entry.description ?? '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive h-6 px-2"
                            onClick={() => handleRemoveEntry(index)}
                          >
                            削除
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={parsedEntries.length === 0}>
            {`${parsedEntries.length}件を反映`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
