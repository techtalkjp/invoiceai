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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface RepoSelectorProps {
  selectedOrg: string
  onOrgChange: (org: string) => void
  repoValue: string
  onRepoValueChange: (value: string) => void
  repoQuery: string
  onRepoQueryChange: (value: string) => void
  isLoadingRepos: boolean
  ghOrgs: Array<{ login: string }>
  repos: Array<{ fullName: string }>
  /** フォールバック用 Input の name 属性 */
  fallbackInputName?: string | undefined
}

/**
 * GitHub 組織選択 + リポジトリ検索 Combobox の共通 UI
 */
export function RepoSelector({
  selectedOrg,
  onOrgChange,
  repoValue,
  onRepoValueChange,
  repoQuery,
  onRepoQueryChange,
  isLoadingRepos,
  ghOrgs,
  repos,
  fallbackInputName,
}: RepoSelectorProps) {
  return (
    <div className="flex items-end gap-2">
      {ghOrgs.length > 0 && (
        <div className="w-[180px] space-y-1">
          <Label>GitHub 組織</Label>
          <Select value={selectedOrg} onValueChange={onOrgChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__personal__">個人</SelectItem>
              {ghOrgs.map((org) => (
                <SelectItem key={org.login} value={org.login}>
                  {org.login}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
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
                    {r.fullName}
                  </ComboboxItem>
                ))}
                {!repoQuery && repos.length >= 20 && (
                  <div className="text-muted-foreground px-2 py-1.5 text-xs">
                    最新20件を表示中。キーワードで検索できます
                  </div>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        ) : (
          <Input
            name={fallbackInputName ?? 'repoFullName'}
            placeholder="owner/repo"
          />
        )}
      </div>
    </div>
  )
}
