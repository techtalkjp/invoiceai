import { GithubIcon, Loader2Icon, SettingsIcon } from 'lucide-react'
import { useFetcher } from 'react-router'
import { calculateWorkDuration } from '~/components/time/time-utils'
import { useTimesheetStore } from '~/components/timesheet/store'
import { Button } from '~/components/ui/button'
import { RepoMappingPanel } from '../$clientId/+components/repo-mapping-panel'
import type { SuggestResult } from '../+work-entry-suggest.server'
import { EntryPreviewList } from './entry-preview-list'

interface GitHubTabProps {
  clientId: string
  year: number
  month: number
  orgSlug: string
  hasGitHubPat: boolean
  mappings: Array<{ clientId: string; sourceIdentifier: string }>
  onApply: (
    entries: Array<{
      workDate: string
      startTime: string
      endTime: string
      breakMinutes: number
      description: string
    }>,
  ) => void
}

export function GitHubTab({
  clientId,
  year,
  month,
  orgSlug,
  hasGitHubPat,
  mappings,
  onApply,
}: GitHubTabProps) {
  const fetcher = useFetcher<{
    suggestion?: SuggestResult | null | undefined
    noActivities?: boolean | undefined
  }>({ key: `suggest-github-${clientId}` })
  const isLoading = fetcher.state !== 'idle'

  // PAT 未設定
  if (!hasGitHubPat) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-muted-foreground text-center text-sm">
          GitHub 連携が未設定です
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={`/org/${orgSlug}/settings/integrations`}>
            <SettingsIcon className="size-4" />
            外部連携設定を開く
          </a>
        </Button>
      </div>
    )
  }

  // マッピング未設定
  if (mappings.length === 0) {
    return (
      <div className="grid gap-3">
        <p className="text-muted-foreground text-sm">
          リポジトリの紐付けを設定してください
        </p>
        <RepoMappingPanel
          orgSlug={orgSlug}
          clientId={clientId}
          mappings={mappings}
        />
      </div>
    )
  }

  // 候補が取得済み
  const suggestion = fetcher.data?.suggestion
  if (suggestion && suggestion.entries.length > 0) {
    const totalWorkMinutes = suggestion.entries.reduce((sum, e) => {
      if (!e.startTime || !e.endTime) return sum
      const d = calculateWorkDuration(e.startTime, e.endTime, e.breakMinutes)
      return sum + d.workMinutes
    }, 0)
    const totalH = Math.floor(totalWorkMinutes / 60)
    const totalM = totalWorkMinutes % 60

    // コンフリクト検出
    const monthData = useTimesheetStore.getState().monthData
    const conflictCount = suggestion.entries.filter((e) => {
      const existing = monthData[e.workDate]
      return existing && (existing.startTime || existing.endTime)
    }).length

    return (
      <div className="grid min-w-0 gap-3 overflow-hidden">
        <div className="bg-muted/50 rounded-md px-3 py-2 text-sm">
          <span className="font-medium">{suggestion.entries.length}日分</span>
          を検出
          {totalWorkMinutes > 0 && (
            <span className="text-muted-foreground">
              （合計{totalH}h{totalM > 0 ? `${totalM}m` : ''}）
            </span>
          )}
        </div>

        {suggestion.reasoning && (
          <p className="text-muted-foreground text-xs">
            {suggestion.reasoning}
          </p>
        )}

        {conflictCount > 0 && (
          <div className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
            {conflictCount}件の既存データが上書きされます
          </div>
        )}

        <EntryPreviewList entries={suggestion.entries} />
        <div className="flex justify-center">
          <Button size="sm" onClick={() => onApply(suggestion.entries)}>
            {suggestion.entries.length}件を反映
          </Button>
        </div>
      </div>
    )
  }

  // アクティビティなし
  if (fetcher.data?.noActivities) {
    return (
      <div className="grid gap-3">
        <p className="text-muted-foreground text-center text-sm">
          この月のアクティビティが見つかりませんでした
        </p>
        <RepoMappingPanel
          orgSlug={orgSlug}
          clientId={clientId}
          mappings={mappings}
        />
      </div>
    )
  }

  // 候補なしの結果が返ってきた場合
  if (suggestion && suggestion.entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-muted-foreground text-center text-sm">
          候補を生成できませんでした
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            fetcher.submit(
              {
                intent: 'suggestFromGitHub',
                year: String(year),
                month: String(month),
              },
              { method: 'POST' },
            )
          }
        >
          再試行
        </Button>
      </div>
    )
  }

  // 初期状態: 候補生成ボタン
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <p className="text-muted-foreground text-center text-sm">
        GitHub アクティビティから稼働時間を自動推定します
      </p>
      <Button
        size="sm"
        disabled={isLoading}
        onClick={() =>
          fetcher.submit(
            {
              intent: 'suggestFromGitHub',
              year: String(year),
              month: String(month),
            },
            { method: 'POST' },
          )
        }
      >
        {isLoading ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <GithubIcon className="size-4" />
            候補を生成
          </>
        )}
      </Button>
    </div>
  )
}
