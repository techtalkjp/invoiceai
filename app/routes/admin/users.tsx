import { ShieldCheckIcon, ShieldOffIcon, UserXIcon } from 'lucide-react'
import { useFetcher } from 'react-router'
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
import type { Route } from './+types/users'

export const handle = {
  breadcrumb: () => ({ label: 'ユーザー管理' }),
}

export async function loader() {
  const users = await db
    .selectFrom('user')
    .select(['id', 'name', 'email', 'role', 'banned', 'banReason', 'createdAt'])
    .orderBy('createdAt', 'desc')
    .execute()

  return { users }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const intent = formData.get('intent')
  const userId = formData.get('userId') as string

  if (!userId) {
    return { error: 'ユーザーIDが指定されていません' }
  }

  switch (intent) {
    case 'ban': {
      await db
        .updateTable('user')
        .set({ banned: 1, banReason: '管理者によるBAN' })
        .where('id', '=', userId)
        .execute()
      return { success: true }
    }
    case 'unban': {
      await db
        .updateTable('user')
        .set({ banned: 0, banReason: null })
        .where('id', '=', userId)
        .execute()
      return { success: true }
    }
    case 'makeAdmin': {
      await db
        .updateTable('user')
        .set({ role: 'admin' })
        .where('id', '=', userId)
        .execute()
      return { success: true }
    }
    case 'removeAdmin': {
      await db
        .updateTable('user')
        .set({ role: 'user' })
        .where('id', '=', userId)
        .execute()
      return { success: true }
    }
    default:
      return { error: '不明な操作です' }
  }
}

export default function AdminUsers({
  loaderData: { users },
}: Route.ComponentProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ユーザー管理</h2>
        <p className="text-muted-foreground">
          システムに登録されているユーザーを管理します
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ユーザー一覧</CardTitle>
          <CardDescription>全 {users.length} 件のユーザー</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>ロール</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>登録日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <UserRow key={user.id} user={user} />
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground text-center"
                  >
                    ユーザーが登録されていません
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

function UserRow({
  user,
}: {
  user: {
    id: string
    name: string
    email: string
    role: string | null
    banned: number | null
    banReason: string | null
    createdAt: string
  }
}) {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== 'idle'

  return (
    <TableRow>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>
        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
          {user.role === 'admin' ? '管理者' : 'ユーザー'}
        </Badge>
      </TableCell>
      <TableCell>
        {user.banned ? (
          <Badge variant="destructive">BAN済み</Badge>
        ) : (
          <Badge variant="outline">有効</Badge>
        )}
      </TableCell>
      <TableCell>{formatDate(user.createdAt)}</TableCell>
      <TableCell className="text-right">
        <fetcher.Form method="post" className="inline-flex gap-2">
          <input type="hidden" name="userId" value={user.id} />

          {user.banned ? (
            <Button
              type="submit"
              name="intent"
              value="unban"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
            >
              <ShieldCheckIcon className="mr-1 h-4 w-4" />
              BAN解除
            </Button>
          ) : (
            <Button
              type="submit"
              name="intent"
              value="ban"
              variant="destructive"
              size="sm"
              disabled={isSubmitting}
            >
              <UserXIcon className="mr-1 h-4 w-4" />
              BAN
            </Button>
          )}

          {user.role === 'admin' ? (
            <Button
              type="submit"
              name="intent"
              value="removeAdmin"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
            >
              <ShieldOffIcon className="mr-1 h-4 w-4" />
              管理者解除
            </Button>
          ) : (
            <Button
              type="submit"
              name="intent"
              value="makeAdmin"
              variant="secondary"
              size="sm"
              disabled={isSubmitting}
            >
              <ShieldCheckIcon className="mr-1 h-4 w-4" />
              管理者に
            </Button>
          )}
        </fetcher.Form>
      </TableCell>
    </TableRow>
  )
}
