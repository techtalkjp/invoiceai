import { getFormProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { Form, useActionData } from 'react-router'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
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
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { db } from '~/lib/db/kysely'
import { formatDate } from '~/utils/date'
import type { Route } from './+types/members'

const addMemberSchema = z.object({
  intent: z.literal('addMember'),
  userId: z.string().min(1, 'ユーザーを選択してください'),
  role: z.enum(['owner', 'admin', 'member']),
})

const removeMemberSchema = z.object({
  intent: z.literal('removeMember'),
  memberId: z.string().min(1),
})

const updateRoleSchema = z.object({
  intent: z.literal('updateRole'),
  memberId: z.string().min(1),
  role: z.enum(['owner', 'admin', 'member']),
})

const formSchema = z.discriminatedUnion('intent', [
  addMemberSchema,
  removeMemberSchema,
  updateRoleSchema,
])

export const handle = {
  breadcrumb: () => ({ label: 'メンバー管理' }),
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { organization, membership: currentMembership } = await requireOrgAdmin(
    request,
    orgSlug,
  )

  const members = await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .select([
      'member.id',
      'member.role',
      'member.createdAt',
      'user.id as userId',
      'user.name as userName',
      'user.email as userEmail',
    ])
    .where('member.organizationId', '=', organization.id)
    .orderBy('member.createdAt', 'asc')
    .execute()

  // 組織に所属していないユーザー一覧（追加候補）
  const availableUsers = await db
    .selectFrom('user')
    .select(['id', 'name', 'email'])
    .where(
      'id',
      'not in',
      db
        .selectFrom('member')
        .select('userId')
        .where('organizationId', '=', organization.id),
    )
    .orderBy('name', 'asc')
    .execute()

  return { organization, members, availableUsers, currentMembership }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug } = params
  const { organization, membership: currentMembership } = await requireOrgAdmin(
    request,
    orgSlug,
  )

  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: formSchema })

  if (submission.status !== 'success') {
    return { lastResult: submission.reply(), success: false }
  }

  const { intent } = submission.value

  if (intent === 'addMember') {
    const { userId, role } = submission.value
    const now = new Date().toISOString()

    await db
      .insertInto('member')
      .values({
        id: crypto.randomUUID(),
        organizationId: organization.id,
        userId,
        role,
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    return { lastResult: submission.reply(), success: true }
  }

  if (intent === 'removeMember') {
    const { memberId } = submission.value

    // 自分自身は削除不可
    if (memberId === currentMembership.id) {
      return {
        lastResult: submission.reply({
          formErrors: ['自分自身を削除することはできません'],
        }),
        success: false,
      }
    }

    await db.deleteFrom('member').where('id', '=', memberId).execute()

    return { lastResult: submission.reply(), success: true }
  }

  if (intent === 'updateRole') {
    const { memberId, role } = submission.value
    const now = new Date().toISOString()

    // 自分自身のロール変更は不可
    if (memberId === currentMembership.id) {
      return {
        lastResult: submission.reply({
          formErrors: ['自分自身のロールは変更できません'],
        }),
        success: false,
      }
    }

    await db
      .updateTable('member')
      .set({ role, updatedAt: now })
      .where('id', '=', memberId)
      .execute()

    return { lastResult: submission.reply(), success: true }
  }

  return { lastResult: submission.reply(), success: false }
}

export default function MembersSettings({
  loaderData: { members, availableUsers, currentMembership },
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>()
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  if (actionData?.success && addDialogOpen) {
    setAddDialogOpen(false)
  }

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>メンバー管理</CardTitle>
          <CardDescription>{members.length} 人のメンバー</CardDescription>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={availableUsers.length === 0}>
              <PlusIcon className="mr-2 h-4 w-4" />
              メンバーを追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>メンバーを追加</DialogTitle>
              <DialogDescription>
                この組織に新しいメンバーを追加します。
              </DialogDescription>
            </DialogHeader>
            <AddMemberForm availableUsers={availableUsers} />
          </DialogContent>
        </Dialog>
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
              <MemberRow
                key={member.id}
                member={member}
                isCurrentUser={member.id === currentMembership.id}
              />
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
    </>
  )
}

function AddMemberForm({
  availableUsers,
}: {
  availableUsers: Array<{ id: string; name: string; email: string }>
}) {
  const actionData = useActionData<typeof action>()
  const [form, fields] = useForm({
    lastResult: actionData?.lastResult,
    defaultValue: {
      role: 'member',
    },
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: addMemberSchema }),
    shouldRevalidate: 'onBlur',
  })

  return (
    <Form method="POST" {...getFormProps(form)} className="space-y-4">
      <input type="hidden" name="intent" value="addMember" />

      <div className="space-y-2">
        <span className="text-sm font-medium">ユーザー *</span>
        <Select name="userId" defaultValue="">
          <SelectTrigger>
            <SelectValue placeholder="ユーザーを選択" />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name} ({user.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-destructive text-sm">{fields.userId.errors}</div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">ロール *</span>
        <Select name="role" defaultValue="member">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="owner">オーナー</SelectItem>
            <SelectItem value="admin">管理者</SelectItem>
            <SelectItem value="member">メンバー</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-destructive text-sm">{fields.role.errors}</div>
      </div>

      <div className="flex justify-end">
        <Button type="submit">追加</Button>
      </div>
    </Form>
  )
}

function MemberRow({
  member,
  isCurrentUser,
}: {
  member: {
    id: string
    role: string
    createdAt: string
    userId: string
    userName: string
    userEmail: string
  }
  isCurrentUser: boolean
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {member.userName}
        {isCurrentUser && (
          <Badge variant="outline" className="ml-2">
            あなた
          </Badge>
        )}
      </TableCell>
      <TableCell>{member.userEmail}</TableCell>
      <TableCell>
        {isCurrentUser ? (
          <Badge variant="secondary">
            {member.role === 'owner'
              ? 'オーナー'
              : member.role === 'admin'
                ? '管理者'
                : 'メンバー'}
          </Badge>
        ) : (
          <Form method="POST" className="inline">
            <input type="hidden" name="intent" value="updateRole" />
            <input type="hidden" name="memberId" value={member.id} />
            <Select
              name="role"
              defaultValue={member.role}
              onValueChange={(value) => {
                const form = document.createElement('form')
                form.method = 'POST'
                form.innerHTML = `
                  <input type="hidden" name="intent" value="updateRole" />
                  <input type="hidden" name="memberId" value="${member.id}" />
                  <input type="hidden" name="role" value="${value}" />
                `
                document.body.appendChild(form)
                form.submit()
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">オーナー</SelectItem>
                <SelectItem value="admin">管理者</SelectItem>
                <SelectItem value="member">メンバー</SelectItem>
              </SelectContent>
            </Select>
          </Form>
        )}
      </TableCell>
      <TableCell>{formatDate(member.createdAt)}</TableCell>
      <TableCell className="text-right">
        {!isCurrentUser && (
          <Form method="POST" className="inline">
            <input type="hidden" name="intent" value="removeMember" />
            <input type="hidden" name="memberId" value={member.id} />
            <Button variant="destructive" size="sm" type="submit">
              <Trash2Icon className="mr-1 h-4 w-4" />
              削除
            </Button>
          </Form>
        )}
      </TableCell>
    </TableRow>
  )
}
