import { parseWithZod } from '@conform-to/zod/v4'
import { ArrowLeftIcon, ExternalLinkIcon, Trash2Icon } from 'lucide-react'
import { Form, Link, redirect, useActionData } from 'react-router'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { db } from '~/lib/db/kysely'
import { formatDate } from '~/utils/date'
import type { Route } from './+types/organizations.$orgId'

const deleteOrgSchema = z.object({
  intent: z.literal('deleteOrg'),
})

export async function loader({ params }: Route.LoaderArgs) {
  const { orgId } = params

  const organization = await db
    .selectFrom('organization')
    .select(['id', 'name', 'slug', 'freeeCompanyId', 'createdAt'])
    .where('id', '=', orgId)
    .executeTakeFirst()

  if (!organization) {
    throw new Response('組織が見つかりません', { status: 404 })
  }

  const members = await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .select([
      'member.id',
      'member.role',
      'member.createdAt',
      'user.name as userName',
      'user.email as userEmail',
    ])
    .where('member.organizationId', '=', orgId)
    .orderBy('member.createdAt', 'asc')
    .execute()

  return { organization, members }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgId } = params
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: deleteOrgSchema })

  if (submission.status !== 'success') {
    return { error: 'Invalid request' }
  }

  // メンバーを先に削除（外部キー制約）
  await db.deleteFrom('member').where('organizationId', '=', orgId).execute()

  // 組織を削除
  await db.deleteFrom('organization').where('id', '=', orgId).execute()

  return redirect('/admin/organizations')
}

export default function AdminOrganizationDetail({
  loaderData: { organization, members },
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link to="/admin/organizations">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {organization.name}
            </h2>
            <p className="text-muted-foreground">組織の詳細情報</p>
          </div>
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

      <Card>
        <CardHeader>
          <CardTitle>メンバー一覧</CardTitle>
          <CardDescription>
            この組織に所属しているメンバーの一覧（読み取り専用）
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
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
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
