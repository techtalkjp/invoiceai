import { PlusIcon, TrashIcon } from 'lucide-react'
import { Form } from 'react-router'
import { RepoSelector } from '~/components/github/repo-selector'
import { useRepoFetcher } from '~/components/github/use-repo-fetcher'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'

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
  const {
    selectedOrg,
    repoValue,
    setRepoValue,
    repoQuery,
    setRepoQuery,
    ghOrgs,
    repos,
    isLoadingRepos,
    handleOrgChange,
    handleRepoQueryChange,
  } = useRepoFetcher(orgSlug, `repos-fetcher-${clientId}`)

  return (
    <Form method="POST" className="space-y-3">
      <input type="hidden" name="intent" value="addMapping" />
      <input type="hidden" name="repoFullName" value={repoValue} />

      <RepoSelector
        selectedOrg={selectedOrg}
        onOrgChange={handleOrgChange}
        repoValue={repoValue}
        onRepoValueChange={setRepoValue}
        repoQuery={repoQuery}
        onRepoQueryChange={(v) => {
          setRepoQuery(v)
          handleRepoQueryChange(v)
        }}
        isLoadingRepos={isLoadingRepos}
        ghOrgs={ghOrgs}
        repos={repos}
      />
      <Button type="submit" size="sm" disabled={!repoValue}>
        <PlusIcon className="mr-1 h-4 w-4" />
        追加
      </Button>
    </Form>
  )
}
