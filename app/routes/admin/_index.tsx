import { Building2Icon, FileTextIcon, UsersIcon } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { db } from '~/lib/db/kysely'
import type { Route } from './+types/_index'

export async function loader() {
  const [userCount, organizationCount, invoiceCount] = await Promise.all([
    db
      .selectFrom('user')
      .select((eb) => eb.fn.countAll().as('count'))
      .executeTakeFirst(),
    db
      .selectFrom('organization')
      .select((eb) => eb.fn.countAll().as('count'))
      .executeTakeFirst(),
    db
      .selectFrom('invoice')
      .select((eb) => eb.fn.countAll().as('count'))
      .executeTakeFirst(),
  ])

  return {
    stats: {
      users: Number(userCount?.count ?? 0),
      organizations: Number(organizationCount?.count ?? 0),
      invoices: Number(invoiceCount?.count ?? 0),
    },
  }
}

export default function AdminDashboard({
  loaderData: { stats },
}: Route.ComponentProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2>
        <p className="text-muted-foreground">
          システム全体の概要を確認できます
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ユーザー数</CardTitle>
            <UsersIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users}</div>
            <p className="text-muted-foreground text-xs">登録済みユーザー</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">組織数</CardTitle>
            <Building2Icon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.organizations}</div>
            <p className="text-muted-foreground text-xs">登録済み組織</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">請求書数</CardTitle>
            <FileTextIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.invoices}</div>
            <p className="text-muted-foreground text-xs">作成済み請求書</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>クイックアクション</CardTitle>
          <CardDescription>よく使う管理機能にアクセスできます</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <a
            href="/admin/users"
            className="hover:bg-muted flex items-center gap-3 rounded-lg border p-4 transition-colors"
          >
            <UsersIcon className="h-8 w-8" />
            <div>
              <div className="font-medium">ユーザー管理</div>
              <div className="text-muted-foreground text-sm">
                ユーザーの一覧表示、BAN、ロール変更
              </div>
            </div>
          </a>
          <a
            href="/admin/organizations"
            className="hover:bg-muted flex items-center gap-3 rounded-lg border p-4 transition-colors"
          >
            <Building2Icon className="h-8 w-8" />
            <div>
              <div className="font-medium">組織管理</div>
              <div className="text-muted-foreground text-sm">
                組織の一覧表示、メンバー確認
              </div>
            </div>
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
