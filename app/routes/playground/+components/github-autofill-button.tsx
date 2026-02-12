import { GithubIcon, Loader2Icon } from 'lucide-react'
import { useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'

interface GitHubAutoFillButtonProps {
  year: number
  month: number
}

export function GitHubAutoFillButton({
  year,
  month,
}: GitHubAutoFillButtonProps) {
  const fetcher = useFetcher({ key: 'github-oauth' })
  const isLoading = fetcher.state !== 'idle'

  return (
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
  )
}
