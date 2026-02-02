import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { PencilIcon, PlusIcon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { Form, Link, useActionData } from 'react-router'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
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
import type { Route } from './+types/organizations'

const createOrgSchema = z.object({
  intent: z.literal('create'),
  name: z.string().min(1, '組織名を入力してください'),
  slug: z.string().optional(),
  freeeCompanyId: z.coerce.number().int().positive().optional(),
})

const updateOrgSchema = z.object({
  intent: z.literal('update'),
  organizationId: z.string().min(1),
  name: z.string().min(1, '組織名を入力してください'),
  slug: z.string().optional(),
  freeeCompanyId: z.coerce.number().int().positive().optional(),
})

const formSchema = z.discriminatedUnion('intent', [
  createOrgSchema,
  updateOrgSchema,
])

export async function loader() {
  const organizations = await db
    .selectFrom('organization')
    .leftJoin('member', 'organization.id', 'member.organizationId')
    .select([
      'organization.id',
      'organization.name',
      'organization.slug',
      'organization.freeeCompanyId',
      'organization.createdAt',
    ])
    .select((eb) => eb.fn.count('member.id').as('memberCount'))
    .groupBy('organization.id')
    .orderBy('organization.createdAt', 'desc')
    .execute()

  return { organizations }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: formSchema })

  if (submission.status !== 'success') {
    return { lastResult: submission.reply(), success: false }
  }

  const { intent } = submission.value

  if (intent === 'create') {
    const { name, slug, freeeCompanyId } = submission.value
    const now = new Date().toISOString()

    await db
      .insertInto('organization')
      .values({
        id: crypto.randomUUID(),
        name,
        slug: slug || null,
        freeeCompanyId: freeeCompanyId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    return { lastResult: submission.reply(), success: true, action: 'created' }
  }

  if (intent === 'update') {
    const { organizationId, name, slug, freeeCompanyId } = submission.value
    const now = new Date().toISOString()

    await db
      .updateTable('organization')
      .set({
        name,
        slug: slug || null,
        freeeCompanyId: freeeCompanyId ?? null,
        updatedAt: now,
      })
      .where('id', '=', organizationId)
      .execute()

    return { lastResult: submission.reply(), success: true, action: 'updated' }
  }

  return { lastResult: submission.reply(), success: false }
}

export default function AdminOrganizations({
  loaderData: { organizations },
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editOrg, setEditOrg] = useState<(typeof organizations)[0] | null>(null)

  // 成功時にダイアログを閉じる
  if (actionData?.success && createDialogOpen) {
    setCreateDialogOpen(false)
  }
  if (actionData?.success && editOrg) {
    setEditOrg(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">組織管理</h2>
          <p className="text-muted-foreground">
            システムに登録されている組織を管理します
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              組織を作成
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新規組織作成</DialogTitle>
              <DialogDescription>新しい組織を作成します。</DialogDescription>
            </DialogHeader>
            <CreateOrgForm />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>組織一覧</CardTitle>
          <CardDescription>全 {organizations.length} 件の組織</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>組織名</TableHead>
                <TableHead>スラッグ</TableHead>
                <TableHead>freee会社ID</TableHead>
                <TableHead>メンバー数</TableHead>
                <TableHead>作成日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>
                    {org.slug ? (
                      <Badge variant="outline">{org.slug}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {org.freeeCompanyId ? (
                      <Badge variant="secondary">{org.freeeCompanyId}</Badge>
                    ) : (
                      <span className="text-muted-foreground">未設定</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/admin/organizations/${org.id}`}
                      className="flex items-center gap-1 hover:underline"
                    >
                      <UsersIcon className="h-4 w-4" />
                      <span>{Number(org.memberCount)}</span>
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(org.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Dialog
                      open={editOrg?.id === org.id}
                      onOpenChange={(open: boolean) =>
                        setEditOrg(open ? org : null)
                      }
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <PencilIcon className="mr-1 h-4 w-4" />
                          編集
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>組織を編集</DialogTitle>
                          <DialogDescription>
                            組織情報を更新します。
                          </DialogDescription>
                        </DialogHeader>
                        <EditOrgForm org={org} />
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
              {organizations.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground text-center"
                  >
                    組織が登録されていません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function CreateOrgForm() {
  const actionData = useActionData<typeof action>()
  const [form, fields] = useForm({
    lastResult: actionData?.lastResult,
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: createOrgSchema }),
    shouldRevalidate: 'onBlur',
  })

  return (
    <Form method="POST" {...getFormProps(form)} className="space-y-4">
      <input type="hidden" name="intent" value="create" />

      <div className="space-y-2">
        <Label htmlFor={fields.name.id}>組織名 *</Label>
        <Input
          {...getInputProps(fields.name, { type: 'text' })}
          placeholder="例: 株式会社サンプル"
        />
        <div className="text-destructive text-sm">{fields.name.errors}</div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={fields.slug.id}>スラッグ</Label>
        <Input
          {...getInputProps(fields.slug, { type: 'text' })}
          placeholder="例: sample-corp"
        />
        <div className="text-destructive text-sm">{fields.slug.errors}</div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={fields.freeeCompanyId.id}>freee 会社ID</Label>
        <Input
          {...getInputProps(fields.freeeCompanyId, { type: 'number' })}
          placeholder="例: 12345"
        />
        <p className="text-muted-foreground text-xs">
          freee API で使用する会社IDを設定します
        </p>
        <div className="text-destructive text-sm">
          {fields.freeeCompanyId.errors}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">作成</Button>
      </div>
    </Form>
  )
}

function EditOrgForm({
  org,
}: {
  org: {
    id: string
    name: string
    slug: string | null
    freeeCompanyId: number | null
  }
}) {
  const actionData = useActionData<typeof action>()
  const [form, fields] = useForm({
    lastResult: actionData?.lastResult,
    defaultValue: {
      organizationId: org.id,
      name: org.name,
      slug: org.slug ?? '',
      freeeCompanyId: org.freeeCompanyId?.toString() ?? '',
    },
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: updateOrgSchema }),
    shouldRevalidate: 'onBlur',
  })

  return (
    <Form method="POST" {...getFormProps(form)} className="space-y-4">
      <input type="hidden" name="intent" value="update" />
      <input type="hidden" name="organizationId" value={org.id} />

      <div className="space-y-2">
        <Label htmlFor={fields.name.id}>組織名 *</Label>
        <Input {...getInputProps(fields.name, { type: 'text' })} />
        <div className="text-destructive text-sm">{fields.name.errors}</div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={fields.slug.id}>スラッグ</Label>
        <Input {...getInputProps(fields.slug, { type: 'text' })} />
        <div className="text-destructive text-sm">{fields.slug.errors}</div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={fields.freeeCompanyId.id}>freee 会社ID</Label>
        <Input {...getInputProps(fields.freeeCompanyId, { type: 'number' })} />
        <p className="text-muted-foreground text-xs">
          freee API で使用する会社IDを設定します
        </p>
        <div className="text-destructive text-sm">
          {fields.freeeCompanyId.errors}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">更新</Button>
      </div>
    </Form>
  )
}
