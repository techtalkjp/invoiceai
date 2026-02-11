import { Loader2Icon, PlusIcon, TrashIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Form, useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
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
import type { loader as reposLoader } from '~/routes/org.$orgSlug/settings/integrations.repos'

interface Mapping {
  clientId: string
  sourceIdentifier: string
}

export function RepoMappingPanel({
  orgSlug,
  clientId,
  mappings,
}: {
  orgSlug: string
  clientId: string
  mappings: Mapping[]
}) {
  return (
    <div className="space-y-4">
      {/* 既存マッピング一覧 */}
      {mappings.length > 0 && (
        <div className="space-y-2">
          <Label>紐付け済みリポジトリ</Label>
          {mappings.map((m) => (
            <div
              key={m.sourceIdentifier}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <code className="text-sm">{m.sourceIdentifier}</code>
              <Form method="POST">
                <input type="hidden" name="intent" value="removeMapping" />
                <input
                  type="hidden"
                  name="sourceIdentifier"
                  value={m.sourceIdentifier}
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </Form>
            </div>
          ))}
        </div>
      )}

      {/* リポジトリ追加 */}
      <AddRepoForm orgSlug={orgSlug} clientId={clientId} />
    </div>
  )
}

function AddRepoForm({
  orgSlug,
  clientId,
}: {
  orgSlug: string
  clientId: string
}) {
  const reposFetcher = useFetcher<typeof reposLoader>({
    key: `repos-fetcher-${clientId}`,
  })
  const [selectedOrg, setSelectedOrg] = useState<string>('__personal__')
  const [repoValue, setRepoValue] = useState('')
  const [repoQuery, setRepoQuery] = useState('')

  const reposBasePath = `/org/${orgSlug}/settings/integrations/repos`

  // sync with external resource: resource route からリポジトリ一覧を取得
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial load only, fetcher.load identity is unstable
  useEffect(() => {
    reposFetcher.load(reposBasePath)
  }, [reposBasePath])

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetcher.load identity is unstable
  const handleOrgChange = useCallback(
    (org: string) => {
      setSelectedOrg(org)
      setRepoValue('')
      setRepoQuery('')
      const url =
        org === '__personal__' ? reposBasePath : `${reposBasePath}?ghOrg=${org}`
      reposFetcher.load(url)
    },
    [reposBasePath],
  )

  const ghOrgs = reposFetcher.data?.ghOrgs ?? []
  const repos = reposFetcher.data?.repos ?? []
  const isLoadingRepos = reposFetcher.state === 'loading'

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetcher.load identity is unstable
  const handleRepoQueryChange = useCallback(
    (value: string) => {
      setRepoQuery(value)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams()
        if (selectedOrg !== '__personal__') params.set('ghOrg', selectedOrg)
        if (value) params.set('q', value)
        const qs = params.toString()
        reposFetcher.load(qs ? `${reposBasePath}?${qs}` : reposBasePath)
      }, 300)
    },
    [reposBasePath, selectedOrg],
  )

  return (
    <Form method="POST" className="space-y-3">
      <input type="hidden" name="intent" value="addMapping" />
      <input type="hidden" name="repoFullName" value={repoValue} />

      <div className="flex items-end gap-2">
        {ghOrgs.length > 0 && (
          <div className="w-[160px] space-y-1">
            <Label>GitHub 組織</Label>
            <Select value={selectedOrg} onValueChange={handleOrgChange}>
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
                setRepoValue(v ?? '')
                setRepoQuery(v ?? '')
              }}
            >
              <ComboboxInput
                placeholder="リポジトリを検索..."
                value={repoQuery}
                onChange={(e) => handleRepoQueryChange(e.target.value)}
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
            <Input name="repoFullName" placeholder="owner/repo" />
          )}
        </div>
        <Button type="submit" size="sm" disabled={!repoValue}>
          <PlusIcon className="mr-1 h-4 w-4" />
          追加
        </Button>
      </div>
    </Form>
  )
}
