import { syncUserGitHubActivities } from '@shared/services/activity-sync'
import { getFormProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import {
  CheckCircle2Icon,
  GitBranchIcon,
  GithubIcon,
  Loader2Icon,
  PlusIcon,
  TrashIcon,
  UnlinkIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Form, useActionData, useFetcher, useNavigation } from 'react-router'
import { z } from 'zod'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
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
import {
  deleteActivitySource,
  deleteClientSourceMapping,
  getActivitySource,
  getClientSourceMappings,
  saveClientSourceMapping,
} from '~/lib/activity-sources/activity-queries.server'
import { decrypt } from '~/lib/activity-sources/encryption.server'
import { fetchGitHubUsername } from '~/lib/activity-sources/github.server'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { db } from '~/lib/db/kysely'
import { startGitHubOAuth } from '~/lib/github-oauth.server'
import type { Route } from './+types/index'
import type { loader as reposLoader } from './repos'

const startOAuthSchema = z.object({
  intent: z.literal('startOAuth'),
})

const disconnectGitHubSchema = z.object({
  intent: z.literal('disconnectGitHub'),
})

const addMappingSchema = z.object({
  intent: z.literal('addMapping'),
  clientId: z.string().min(1, 'クライアントを選択してください'),
  repoFullName: z.string().min(1, 'リポジトリを入力してください'),
})

const removeMappingSchema = z.object({
  intent: z.literal('removeMapping'),
  clientId: z.string().min(1),
  sourceIdentifier: z.string().min(1),
})

const syncSchema = z.object({
  intent: z.literal('sync'),
})

const formSchema = z.discriminatedUnion('intent', [
  startOAuthSchema,
  disconnectGitHubSchema,
  addMappingSchema,
  removeMappingSchema,
  syncSchema,
])

export const handle = {
  breadcrumb: () => ({ label: '外部連携' }),
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { organization, user } = await requireOrgAdmin(request, params.orgSlug)

  const source = await getActivitySource(organization.id, user.id, 'github')
  const isConnected = !!source

  // クライアント一覧
  const clients = await db
    .selectFrom('client')
    .select(['id', 'name'])
    .where('organizationId', '=', organization.id)
    .where('isActive', '=', 1)
    .where('billingType', '=', 'time')
    .orderBy('name', 'asc')
    .execute()

  // 既存のマッピング
  const clientIds = clients.map((c) => c.id)
  const mappings =
    clientIds.length > 0
      ? await getClientSourceMappings(clientIds, 'github')
      : []

  // GitHub username (連携済みの場合のみ)
  let githubUsername: string | null = null
  if (source) {
    try {
      const token = decrypt(source.credentials)
      githubUsername = await fetchGitHubUsername(token)
    } catch {
      // token が無効な場合
    }
  }

  return {
    organization,
    isConnected,
    githubUsername,
    clients,
    mappings,
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { organization, user } = await requireOrgAdmin(request, params.orgSlug)

  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: formSchema })

  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
  }

  const { intent } = submission.value

  if (intent === 'startOAuth') {
    return startGitHubOAuth({
      request,
      returnTo: 'integrations',
      metadata: { orgSlug: params.orgSlug },
      scope: 'read:user repo',
    })
  }

  if (intent === 'disconnectGitHub') {
    await deleteActivitySource(organization.id, user.id, 'github')
    return { lastResult: submission.reply(), disconnected: true }
  }

  if (intent === 'addMapping') {
    const { clientId, repoFullName } = submission.value
    await saveClientSourceMapping(clientId, 'github', repoFullName)
    return { lastResult: submission.reply(), mappingAdded: true }
  }

  if (intent === 'removeMapping') {
    const { clientId, sourceIdentifier } = submission.value
    await deleteClientSourceMapping(clientId, 'github', sourceIdentifier)
    return { lastResult: submission.reply(), mappingRemoved: true }
  }

  if (intent === 'sync') {
    // 過去7日間を同期
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 7)
    const startDate = start.toISOString().slice(0, 10)
    const endDate = end.toISOString().slice(0, 10)

    const result = await syncUserGitHubActivities(
      organization.id,
      user.id,
      startDate,
      endDate,
    )

    if (result.error) {
      return {
        lastResult: submission.reply({
          formErrors: [`同期エラー: ${result.error}`],
        }),
      }
    }

    return {
      lastResult: submission.reply(),
      synced: true,
      insertedCount: result.inserted,
    }
  }

  return { lastResult: submission.reply() }
}

export default function IntegrationsSettings({
  loaderData: { isConnected, githubUsername, clients, mappings },
  params: { orgSlug },
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranchIcon className="h-5 w-5" />
          外部連携設定
        </CardTitle>
        <CardDescription>
          GitHub 等の外部サービスと連携してアクティビティを自動記録します
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* GitHub 連携 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />
            ) : (
              <span className="bg-muted flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium">
                1
              </span>
            )}
            <h4 className="font-medium">GitHub 認証</h4>
            {isConnected && githubUsername && (
              <Badge variant="outline" className="text-emerald-600">
                @{githubUsername}
              </Badge>
            )}
          </div>

          <div className="ml-7 space-y-3">
            {isConnected ? (
              <div className="flex items-center gap-3">
                <p className="text-muted-foreground text-sm">
                  GitHub アカウントと連携済みです。
                </p>
                <Form method="POST">
                  <input type="hidden" name="intent" value="disconnectGitHub" />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                  >
                    <UnlinkIcon className="mr-1 h-4 w-4" />
                    連携解除
                  </Button>
                </Form>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  GitHub アカウントと連携して、アクティビティを自動記録します。
                </p>
                <Form method="POST">
                  <input type="hidden" name="intent" value="startOAuth" />
                  <Button type="submit" size="sm">
                    <GithubIcon className="mr-1 h-4 w-4" />
                    GitHub と連携
                  </Button>
                </Form>
              </>
            )}
          </div>
        </div>

        {/* リポジトリマッピング */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {mappings.length > 0 ? (
              <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />
            ) : (
              <span className="bg-muted flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium">
                2
              </span>
            )}
            <h4 className="font-medium">リポジトリとクライアントの対応付け</h4>
          </div>

          {isConnected ? (
            <div className="ml-7 space-y-3">
              <p className="text-muted-foreground text-sm">
                GitHub リポジトリをクライアントに対応付けると、
                アクティビティがクライアント別に集計されます。
              </p>

              {/* 既存マッピング一覧 */}
              {mappings.length > 0 && (
                <div className="space-y-2">
                  {mappings.map((m) => {
                    const client = clients.find((c) => c.id === m.clientId)
                    return (
                      <div
                        key={`${m.clientId}-${m.sourceIdentifier}`}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="text-sm">
                          <span className="font-medium">
                            {client?.name ?? m.clientId}
                          </span>
                          <span className="text-muted-foreground"> ← </span>
                          <code className="text-xs">{m.sourceIdentifier}</code>
                        </div>
                        <Form method="POST">
                          <input
                            type="hidden"
                            name="intent"
                            value="removeMapping"
                          />
                          <input
                            type="hidden"
                            name="clientId"
                            value={m.clientId}
                          />
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
                    )
                  })}
                </div>
              )}

              {/* 新規マッピング追加 */}
              <AddMappingForm orgSlug={orgSlug} clients={clients} />
            </div>
          ) : (
            <p className="text-muted-foreground ml-7 text-sm">
              まず GitHub と連携してください
            </p>
          )}
        </div>

        {/* 同期 */}
        {isConnected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="bg-muted flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium">
                3
              </span>
              <h4 className="font-medium">アクティビティ同期</h4>
            </div>
            <div className="ml-7 space-y-3">
              <p className="text-muted-foreground text-sm">
                GitHub のアクティビティを取得して記録します（過去7日間）。
              </p>
              <Form method="POST">
                <input type="hidden" name="intent" value="sync" />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  今すぐ同期
                </Button>
              </Form>
              {actionData && 'synced' in actionData && actionData.synced && (
                <p className="text-sm text-emerald-600">
                  {'insertedCount' in actionData
                    ? `${actionData.insertedCount} 件のアクティビティを追加しました`
                    : '同期が完了しました'}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </>
  )
}

function AddMappingForm({
  orgSlug,
  clients,
}: {
  orgSlug: string
  clients: Array<{ id: string; name: string }>
}) {
  const actionData = useActionData<typeof action>()
  const [form, fields] = useForm({
    lastResult: actionData?.lastResult,
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: addMappingSchema }),
    shouldRevalidate: 'onBlur',
  })

  // fetcher でリポジトリ一覧を取得
  const reposFetcher = useFetcher<typeof reposLoader>({
    key: 'repos-fetcher',
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

  // debounce でサーバーサイド検索
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
    <Form method="POST" {...getFormProps(form)} className="space-y-3">
      <input type="hidden" name="intent" value="addMapping" />
      <input type="hidden" name={fields.repoFullName.name} value={repoValue} />

      {/* クライアント選択 */}
      <div className="space-y-1">
        <Label>クライアント</Label>
        <Select name={fields.clientId.name}>
          <SelectTrigger>
            <SelectValue placeholder="クライアントを選択" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fields.clientId.errors && (
          <div className="text-destructive text-sm">
            {fields.clientId.errors}
          </div>
        )}
      </div>

      {/* 組織 → リポジトリ選択 */}
      <div className="flex items-end gap-2">
        {ghOrgs.length > 0 && (
          <div className="w-[180px] space-y-1">
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
            <Input name={fields.repoFullName.name} placeholder="owner/repo" />
          )}
          {fields.repoFullName.errors && (
            <div className="text-destructive text-sm">
              {fields.repoFullName.errors}
            </div>
          )}
        </div>
        <Button type="submit" size="sm">
          <PlusIcon className="mr-1 h-4 w-4" />
          追加
        </Button>
      </div>
    </Form>
  )
}
