import { GithubIcon, Loader2Icon } from 'lucide-react'
import { useFetcher } from 'react-router'
import { calculateWorkDuration } from '~/components/time/time-utils'
import { Button } from '~/components/ui/button'
import type { GitHubResult } from '../+lib/github-oauth.server'
import { EntryPreviewList } from './entry-preview-list'

interface GitHubTabProps {
  year: number
  month: number
  githubResult?: GitHubResult | null | undefined
  onApply: () => void
}

export function GitHubTab({
  year,
  month,
  githubResult,
  onApply,
}: GitHubTabProps) {
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
