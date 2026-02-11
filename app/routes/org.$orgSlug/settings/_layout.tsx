import {
  BuildingIcon,
  GitBranchIcon,
  LinkIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Card } from '~/components/ui/card'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import type { Route } from './+types/_layout'

export const handle = {
  breadcrumb: (data: { organization: { slug: string } }) => ({
    label: '設定',
    to: `/org/${data.organization.slug}/settings`,
  }),
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { organization, membership } = await requireOrgAdmin(request, orgSlug)

  return { organization, membership }
}

export default function SettingsLayout({
  loaderData: { organization },
}: Route.ComponentProps) {
  const location = useLocation()
  const basePath = `/org/${organization.slug}/settings`

  const navItems = [
    {
      label: '基本設定',
      to: `${basePath}/general`,
      icon: SettingsIcon,
      description: '組織名やスラッグを変更',
    },
    {
      label: 'freee 連携',
      to: `${basePath}/freee`,
      icon: LinkIcon,
      description: 'freee API との連携設定',
    },
    {
      label: 'メンバー管理',
      to: `${basePath}/members`,
      icon: UsersIcon,
      description: 'メンバーの追加・削除・権限変更',
    },
    {
      label: '外部連携',
      to: `${basePath}/integrations`,
      icon: GitBranchIcon,
      description: 'GitHub等の外部サービス連携',
    },
  ]

  // サブルートもハイライトするための判定
  const isActiveRoute = (to: string) => {
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BuildingIcon className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">{organization.name} の設定</h1>
          <p className="text-muted-foreground text-sm">
            組織の設定を管理します
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = isActiveRoute(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <Card>
          <Outlet />
        </Card>
      </div>
    </div>
  )
}
