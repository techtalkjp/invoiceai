import { Loader2Icon } from 'lucide-react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '~/components/ui/combobox'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

interface RepoSelectorProps {
  repoValue: string
  onRepoValueChange: (value: string) => void
  repoQuery: string
  onRepoQueryChange: (value: string) => void
  isLoadingRepos: boolean
  repos: Array<{ fullName: string; pushedAt: string | null }>
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffMin < 1) return 'たった今'
  if (diffMin < 60) return `${diffMin}分前`
  if (diffHours < 24) return `${diffHours}時間前`
  if (diffDays < 30) return `${diffDays}日前`
  if (diffMonths < 12) return `${diffMonths}ヶ月前`
  return `${diffYears}年前`
}

/**
 * GitHub リポジトリ検索 Combobox
 */
export function RepoSelector({
  repoValue,
  onRepoValueChange,
  repoQuery,
  onRepoQueryChange,
  isLoadingRepos,
  repos,
}: RepoSelectorProps) {
  return (
    <div className="flex-1 space-y-1">
      <Label>リポジトリ</Label>
      {isLoadingRepos && repos.length === 0 && !repoQuery ? (
        <div className="border-input flex h-9 items-center rounded-md border px-3">
          <Loader2Icon className="text-muted-foreground h-4 w-4 animate-spin" />
          <span className="text-muted-foreground ml-2 text-sm">
            読み込み中...
          </span>
        </div>
      ) : repos.length > 0 || repoQuery ? (
        <Combobox
          value={repoValue}
          onValueChange={(v) => {
            onRepoValueChange(v ?? '')
            onRepoQueryChange(v ?? '')
          }}
        >
          <ComboboxInput
            placeholder="リポジトリを検索..."
            value={repoQuery}
            onChange={(e) => onRepoQueryChange(e.target.value)}
          />
          <ComboboxContent>
            <ComboboxList>
              <ComboboxEmpty>
                {isLoadingRepos ? '検索中...' : '見つかりません'}
              </ComboboxEmpty>
              {repos.map((r) => (
                <ComboboxItem key={r.fullName} value={r.fullName}>
                  <div className="flex w-full items-center justify-between">
                    <span>{r.fullName}</span>
                    {r.pushedAt && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {formatRelativeDate(r.pushedAt)}
                      </span>
                    )}
                  </div>
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      ) : (
        <Input
          placeholder="owner/repo"
          value={repoValue}
          onChange={(e) => {
            onRepoValueChange(e.target.value)
            onRepoQueryChange(e.target.value)
          }}
        />
      )}
    </div>
  )
}
