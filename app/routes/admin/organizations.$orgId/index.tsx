import { parseWithZod } from '@conform-to/zod/v4'
import {
  ExternalLinkIcon,
  Trash2Icon,
  UserMinusIcon,
  UserPlusIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Form, Link, redirect, useActionData, useFetcher } from 'react-router'
import { z } from 'zod'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { formatDate } from '~/utils/date'
import { UserCombobox } from './+components/user-combobox'
import {
  addMember,
  deleteOrganization,
  getMembers,
  getOrganization,
  removeMember,
} from './+queries.server'
import type { Route } from './+types/index'

const actionSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('deleteOrg'),
  }),
  z.object({
    intent: z.literal('addMember'),
    userId: z.string().min(1),
    role: z.enum(['owner', 'admin', 'member']),
  }),
  z.object({
    intent: z.literal('removeMember'),
    memberId: z.string().min(1),
  }),
])

export const handle = {
  breadcrumb: (data: { organization: { name: string } }) => [
    { label: '組織管理', to: '/admin/organizations' },
    { label: data.organization.name },
  ],
}

export async function loader({ params }: Route.LoaderArgs) {
  const { orgId } = params

  const organization = await getOrganization(orgId)
  if (!organization) {
    throw new Response('組織が見つかりません', { status: 404 })
  }

  const members = await getMembers(orgId)

  return { organization, members }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgId } = params
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: actionSchema })

  if (submission.status !== 'success') {
    return { error: 'Invalid request' }
  }

  const { intent } = submission.value

  switch (intent) {
    case 'deleteOrg': {
      await deleteOrganization(orgId)
      return redirect('/admin/organizations')
    }

    case 'addMember': {
      const { userId, role } = submission.value
      await addMember(orgId, userId, role)
      return { success: true }
    }

    case 'removeMember': {
      const { memberId } = submission.value
      await removeMember(memberId)
      return { success: true }
    }
  }
}

export default function AdminOrganizationDetail({
  loaderData: { organization, members },
  params,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>()
  const fetcher = useFetcher()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<
    'owner' | 'admin' | 'member'
  >('member')

  const isSubmitting = fetcher.state !== 'idle'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {organization.name}
          </h2>
          <p className="text-muted-foreground">組織の詳細情報</p>
        </div>
        {organization.slug && (
          <Button variant="outline" asChild>
            <Link to={`/org/${organization.slug}/settings`}>
              組織設定を開く
              <ExternalLinkIcon className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">スラッグ</CardTitle>
          </CardHeader>
          <CardContent>
            {organization.slug ? (
              <Badge variant="outline">{organization.slug}</Badge>
            ) : (
              <span className="text-muted-foreground">未設定</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">freee 会社ID</CardTitle>
          </CardHeader>
          <CardContent>
            {organization.freeeCompanyId ? (
              <Badge variant="secondary">{organization.freeeCompanyId}</Badge>
            ) : (
              <span className="text-muted-foreground">未設定</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">メンバー数</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{members.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">作成日</CardTitle>
          </CardHeader>
          <CardContent>{formatDate(organization.createdAt)}</CardContent>
        </Card>
      </div>

      {/* メンバー追加 */}
      <Card>
        <CardHeader>
          <CardTitle>メンバーを追加</CardTitle>
          <CardDescription>ユーザーを選択して組織に追加します</CardDescription>
        </CardHeader>
        <CardContent>
          <fetcher.Form method="post" className="flex items-end gap-4">
            <input type="hidden" name="intent" value="addMember" />
            <div className="flex-1 space-y-2">
              <span className="text-sm font-medium">ユーザー</span>
              <input type="hidden" name="userId" value={selectedUserId} />
              <UserCombobox
                orgId={params.orgId}
                value={selectedUserId}
                onValueChange={setSelectedUserId}
              />
            </div>
            <div className="w-40 space-y-2">
              <span className="text-sm font-medium">ロール</span>
              <Select
                name="role"
                value={selectedRole}
                onValueChange={(v) =>
                  setSelectedRole(v as 'owner' | 'admin' | 'member')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">オーナー</SelectItem>
                  <SelectItem value="admin">管理者</SelectItem>
                  <SelectItem value="member">メンバー</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={!selectedUserId || isSubmitting}>
              <UserPlusIcon className="mr-2 h-4 w-4" />
              追加
            </Button>
          </fetcher.Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>メンバー一覧</CardTitle>
          <CardDescription>
            この組織に所属しているメンバーの一覧
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>ロール</TableHead>
                <TableHead>参加日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.userName}
                  </TableCell>
                  <TableCell>{member.userEmail}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {member.role === 'owner'
                        ? 'オーナー'
                        : member.role === 'admin'
                          ? '管理者'
                          : 'メンバー'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(member.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <fetcher.Form method="post" className="inline">
                      <input type="hidden" name="intent" value="removeMember" />
                      <input type="hidden" name="memberId" value={member.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={(e) => {
                          if (
                            !confirm(
                              `${member.userName}を組織から削除しますか？`,
                            )
                          ) {
                            e.preventDefault()
                          }
                        }}
                      >
                        <UserMinusIcon className="h-4 w-4" />
                      </Button>
                    </fetcher.Form>
                  </TableCell>
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground text-center"
                  >
                    メンバーがいません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 危険な操作 */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">危険な操作</CardTitle>
          <CardDescription>
            以下の操作は取り消すことができません。十分ご注意ください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="POST">
            <input type="hidden" name="intent" value="deleteOrg" />
            <Button
              type="submit"
              variant="destructive"
              onClick={(e) => {
                if (
                  !confirm(
                    `本当に「${organization.name}」を削除しますか？この操作は取り消せません。`,
                  )
                ) {
                  e.preventDefault()
                }
              }}
            >
              <Trash2Icon className="mr-2 h-4 w-4" />
              この組織を削除
            </Button>
          </Form>
          {actionData?.error && (
            <p className="text-destructive mt-2 text-sm">{actionData.error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
