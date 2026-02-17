import { getFormProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  GitBranchIcon,
  GithubIcon,
  Loader2Icon,
  PlusIcon,
  TrashIcon,
  UnlinkIcon,
  UsersIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Form,
  redirect,
  useActionData,
  useFetcher,
  useNavigation,
} from 'react-router'
import { z } from 'zod'
import { RepoSelector } from '~/components/github/repo-selector'
import { useRepoFetcher } from '~/components/github/use-repo-fetcher'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  deleteClientSourceMapping,
  getClientSourceMappings,
  saveClientSourceMapping,
} from '~/lib/activity-sources/activity-queries.server'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { db } from '~/lib/db/kysely'
import {
  deleteInstallationFromGitHub,
  listAppInstallations,
} from '~/lib/github-app/api.server'
import { buildGitHubAppInstallUrl } from '~/lib/github-app/install-url.server'
import {
  deleteAllUserMappings,
  deleteGitHubInstallation,
  getGitHubInstallation,
  getUserMappings,
  saveGitHubInstallation,
  saveUserMapping,
} from '~/lib/github-app/queries.server'
import type { Route } from './+types/index'

const installGitHubAppSchema = z.object({
  intent: z.literal('installGitHubApp'),
})

const disconnectGitHubAppSchema = z.object({
  intent: z.literal('disconnectGitHubApp'),
})

const saveUserMappingsSchema = z.object({
  intent: z.literal('saveUserMappings'),
  mappings: z.string().min(1),
})

const addRepoMappingSchema = z.object({
  intent: z.literal('addRepoMapping'),
  clientId: z.string().min(1, 'クライアントを選択してください'),
  repoFullName: z.string().min(1, 'リポジトリを入力してください'),
})

const removeRepoMappingSchema = z.object({
  intent: z.literal('removeRepoMapping'),
  clientId: z.string().min(1),
  sourceIdentifier: z.string().min(1),
})

const formSchema = z.discriminatedUnion('intent', [
  installGitHubAppSchema,
  disconnectGitHubAppSchema,
  saveUserMappingsSchema,
  addRepoMappingSchema,
  removeRepoMappingSchema,
])

export const handle = {
  breadcrumb: () => ({ label: '外部連携' }),
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)

  const installation = await getGitHubInstallation(organization.id)
  const isInstalled = !!installation

  // 組織メンバー一覧
  const members = await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .select(['member.userId', 'user.name', 'user.email'])
    .where('member.organizationId', '=', organization.id)
    .orderBy('user.name', 'asc')
    .execute()

  // ユーザーマッピング
  const userMappings = isInstalled ? await getUserMappings(organization.id) : []

  // クライアント一覧
  const clients = await db
    .selectFrom('client')
    .select(['id', 'name'])
    .where('organizationId', '=', organization.id)
    .where('isActive', '=', 1)
    .where('billingType', '=', 'time')
    .orderBy('name', 'asc')
    .execute()

  const clientIds = clients.map((c) => c.id)
  const repoMappings =
    clientIds.length > 0
      ? await getClientSourceMappings(clientIds, 'github')
      : []

  return {
    organization,
    isInstalled,
    installation: installation
      ? {
          accountLogin: installation.accountLogin,
          repositorySelection: installation.repositorySelection,
          suspendedAt: installation.suspendedAt,
        }
      : null,
    members,
    userMappings,
    clients,
    repoMappings,
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)

  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: formSchema })

  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
  }

  const { intent } = submission.value

  if (intent === 'installGitHubApp') {
    // まず既存のインストールを自動検出
    try {
      const installations = await listAppInstallations()
      const first = installations[0]
      if (first) {
        // 既存インストールを紐付ける
        await saveGitHubInstallation(organization.id, first)
        return { lastResult: submission.reply() }
      }
    } catch {
      // API エラー時はインストール URL にフォールバック
    }
    const url = buildGitHubAppInstallUrl(params.orgSlug)
    return redirect(url)
  }

  if (intent === 'disconnectGitHubApp') {
    const installation = await getGitHubInstallation(organization.id)
    if (installation) {
      try {
        await deleteInstallationFromGitHub(installation.installationId)
      } catch {
        // GitHub 側の削除に失敗しても DB 側は解除する
      }
    }
    await deleteGitHubInstallation(organization.id)
    await deleteAllUserMappings(organization.id)
    return { lastResult: submission.reply() }
  }

  if (intent === 'saveUserMappings') {
    const entries = JSON.parse(submission.value.mappings) as Array<{
      userId: string
      githubUsername: string
    }>
    // 既存のマッピングを全削除して再作成
    await deleteAllUserMappings(organization.id)
    for (const entry of entries) {
      if (entry.githubUsername.trim()) {
        await saveUserMapping(
          organization.id,
          entry.userId,
          entry.githubUsername.trim(),
        )
      }
    }
    return { lastResult: submission.reply() }
  }

  if (intent === 'addRepoMapping') {
    const { clientId, repoFullName } = submission.value
    await saveClientSourceMapping(clientId, 'github', repoFullName)
    return { lastResult: submission.reply() }
  }

  if (intent === 'removeRepoMapping') {
    const { clientId, sourceIdentifier } = submission.value
    await deleteClientSourceMapping(clientId, 'github', sourceIdentifier)
    return { lastResult: submission.reply() }
  }

  return { lastResult: submission.reply() }
}

export default function IntegrationsSettings({
  loaderData: {
    isInstalled,
    installation,
    members,
    userMappings,
    clients,
    repoMappings,
  },
  params: { orgSlug },
}: Route.ComponentProps) {
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
          GitHub App を組織にインストールしてアクティビティを自動記録します
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: GitHub App インストール */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isInstalled ? (
              <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />
            ) : (
              <span className="bg-muted flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium">
                1
              </span>
            )}
            <h4 className="font-medium">GitHub App</h4>
            {isInstalled && installation && (
              <Badge variant="outline" className="text-emerald-600">
                {installation.accountLogin}
              </Badge>
            )}
            {installation?.suspendedAt && (
              <Badge variant="destructive">一時停止中</Badge>
            )}
          </div>

          <div className="ml-7 space-y-3">
            {isInstalled ? (
              <div className="flex items-center gap-3">
                <p className="text-muted-foreground text-sm">
                  GitHub App がインストール済みです
                  {installation?.repositorySelection === 'all'
                    ? '（全リポジトリ）'
                    : '（選択されたリポジトリ）'}
                </p>
                <Form method="POST">
                  <input
                    type="hidden"
                    name="intent"
                    value="disconnectGitHubApp"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    disabled={isSubmitting}
                  >
                    <UnlinkIcon className="mr-1 h-4 w-4" />
                    連携解除
                  </Button>
                </Form>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  GitHub App
                  をインストールして、リポジトリへの読み取りアクセスを許可します。
                  書き込み権限は一切要求しません。
                </p>
                <Form method="POST">
                  <input type="hidden" name="intent" value="installGitHubApp" />
                  <Button type="submit" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2Icon className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <GithubIcon className="mr-1 h-4 w-4" />
                    )}
                    GitHub App をインストール
                  </Button>
                </Form>
              </>
            )}
          </div>
        </div>

        {/* Step 2: ユーザーマッピング */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {userMappings.length > 0 ? (
              <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />
            ) : (
              <span className="bg-muted flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium">
                2
              </span>
            )}
            <h4 className="font-medium">ユーザーマッピング</h4>
          </div>

          {isInstalled ? (
            <div className="ml-7 space-y-3">
              <p className="text-muted-foreground text-sm">
                組織メンバーと GitHub
                ユーザー名を対応付けて、アクティビティを正しく記録します。
              </p>
              <UserMappingForm
                orgSlug={orgSlug}
                members={members}
                existingMappings={userMappings}
              />
            </div>
          ) : (
            <p className="text-muted-foreground ml-7 text-sm">
              まず GitHub App をインストールしてください
            </p>
          )}
        </div>

        {/* Step 3: リポジトリマッピング */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {repoMappings.length > 0 ? (
              <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />
            ) : (
              <span className="bg-muted flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium">
                3
              </span>
            )}
            <h4 className="font-medium">リポジトリとクライアントの対応付け</h4>
          </div>

          {isInstalled ? (
            <div className="ml-7 space-y-3">
              <p className="text-muted-foreground text-sm">
                GitHub リポジトリをクライアントに対応付けると、
                アクティビティがクライアント別に集計されます。
              </p>

              {repoMappings.length > 0 && (
                <div className="space-y-2">
                  {repoMappings.map((m) => {
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
                            value="removeRepoMapping"
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

              <AddRepoMappingForm orgSlug={orgSlug} clients={clients} />
            </div>
          ) : (
            <p className="text-muted-foreground ml-7 text-sm">
              まず GitHub App をインストールしてください
            </p>
          )}
        </div>
      </CardContent>
    </>
  )
}

function UserMappingForm({
  orgSlug,
  members,
  existingMappings,
}: {
  orgSlug: string
  members: Array<{ userId: string; name: string | null; email: string }>
  existingMappings: Array<{ userId: string; githubUsername: string }>
}) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const fetcher = useFetcher<{
    contributors: Array<{ login: string; avatarUrl: string }>
    error: 'token_failed' | 'repos_failed' | 'no_repos' | 'fetch_failed' | null
  }>({ key: 'contributors' })
  const mappingMap = new Map(
    existingMappings.map((m) => [m.userId, m.githubUsername]),
  )
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const m of members) {
      initial[m.userId] = mappingMap.get(m.userId) ?? ''
    }
    return initial
  })

  // コントリビューター一覧を取得
  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(`/org/${orgSlug}/settings/integrations/contributors`)
    }
  }, [fetcher, orgSlug])

  const contributors = fetcher.data?.contributors ?? []
  const contributorError = fetcher.data?.error ?? null

  const errorMessages: Record<string, string> = {
    token_failed:
      'GitHub トークンの取得に失敗しました。連携を再設定してください。',
    repos_failed: 'リポジトリ一覧の取得に失敗しました。',
    no_repos:
      'アクセス可能なリポジトリがありません。GitHub App のリポジトリ設定を確認してください。',
    fetch_failed: 'コントリビューター情報の取得に失敗しました。',
  }

  const mappingsJson = JSON.stringify(
    members.map((m) => ({
      userId: m.userId,
      githubUsername: values[m.userId] ?? '',
    })),
  )

  return (
    <Form method="POST" className="space-y-3">
      <input type="hidden" name="intent" value="saveUserMappings" />
      <input type="hidden" name="mappings" value={mappingsJson} />

      {contributorError && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" />
          {errorMessages[contributorError]}
        </div>
      )}

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-3">
            <div className="flex w-[180px] items-center gap-2 text-sm">
              <UsersIcon className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="truncate font-medium">{m.name ?? m.email}</span>
            </div>
            <span className="text-muted-foreground text-sm">→</span>
            <div className="flex items-center gap-1">
              <Select
                value={values[m.userId] ?? ''}
                onValueChange={(v) =>
                  setValues((prev) => ({ ...prev, [m.userId]: v }))
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="GitHub ユーザーを選択" />
                </SelectTrigger>
                <SelectContent>
                  {contributors.map((c) => (
                    <SelectItem key={c.login} value={c.login}>
                      <div className="flex items-center gap-2">
                        <img
                          src={c.avatarUrl}
                          alt=""
                          className="h-4 w-4 rounded-full"
                        />
                        {c.login}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {values[m.userId] && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() =>
                    setValues((prev) => ({ ...prev, [m.userId]: '' }))
                  }
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2Icon className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2Icon className="mr-1 h-4 w-4" />
        )}
        保存
      </Button>
    </Form>
  )
}

function AddRepoMappingForm({
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
      parseWithZod(formData, { schema: addRepoMappingSchema }),
    shouldRevalidate: 'onBlur',
  })

  const {
    repoValue,
    setRepoValue,
    repoQuery,
    setRepoQuery,
    repos,
    error: repoError,
    isLoadingRepos,
    handleRepoQueryChange,
  } = useRepoFetcher(orgSlug, 'repos-fetcher')

  const repoErrorMessages: Record<string, string> = {
    not_installed:
      'GitHub App がインストールされていません。連携を設定してください。',
    token_expired:
      'GitHub トークンの有効期限が切れています。連携を再設定してください。',
    fetch_failed: 'リポジトリ一覧の取得に失敗しました。',
  }

  if (repoError) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
        <AlertTriangleIcon className="h-4 w-4 shrink-0" />
        {repoErrorMessages[repoError] ?? repoError}
      </div>
    )
  }

  return (
    <Form method="POST" {...getFormProps(form)} className="space-y-3">
      <input type="hidden" name="intent" value="addRepoMapping" />
      <input type="hidden" name={fields.repoFullName.name} value={repoValue} />

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

      <div className="flex items-end gap-2">
        <RepoSelector
          repoValue={repoValue}
          onRepoValueChange={setRepoValue}
          repoQuery={repoQuery}
          onRepoQueryChange={(v) => {
            setRepoQuery(v)
            handleRepoQueryChange(v)
          }}
          isLoadingRepos={isLoadingRepos}
          repos={repos}
        />
        <Button type="submit" size="sm">
          <PlusIcon className="mr-1 h-4 w-4" />
          追加
        </Button>
      </div>
      {fields.repoFullName.errors && (
        <div className="text-destructive text-sm">
          {fields.repoFullName.errors}
        </div>
      )}
    </Form>
  )
}
