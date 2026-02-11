import { GithubIcon, Loader2Icon } from 'lucide-react'
import { useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
import type { GitHubResult } from '../+lib/github-oauth.server'

interface GitHubAutoFillButtonProps {
  year: number
  month: number
  githubResult: GitHubResult | null
}

export function GitHubAutoFillButton({
  year,
  month,
  githubResult,
}: GitHubAutoFillButtonProps) {
  const fetcher = useFetcher({ key: 'github-oauth' })
  const isLoading = fetcher.state !== 'idle'

  return (
    <div className="flex items-center gap-2">
      <fetcher.Form method="POST">
        <input type="hidden" name="intent" value="startGitHubOAuth" />
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={isLoading}
          className="text-muted-foreground"
        >
          {isLoading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <GithubIcon className="size-4" />
          )}
          GitHubから取込
        </Button>
      </fetcher.Form>
      {githubResult && githubResult.activityCount > 0 && (
        <span className="text-muted-foreground text-xs">
          {githubResult.username}: {githubResult.activityCount}件 →{' '}
          {githubResult.entries.length}日分
        </span>
      )}
    </div>
  )
}
