import {
  Building2Icon,
  FlagIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  UsersIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { AppLogo } from '~/components/app-logo'
import { Header } from '~/components/layout/header'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from '~/components/ui/sidebar'
import { requireAdmin } from '~/lib/auth-helpers.server'
import type { Route } from './+types/_layout'

export const handle = {
  breadcrumb: () => ({
    label: '管理画面',
    to: '/admin',
  }),
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAdmin(request)
  return { user }
}

const navItems = [
  {
    title: 'ダッシュボード',
    url: '/admin',
    icon: LayoutDashboardIcon,
  },
  {
    title: 'ユーザー管理',
    url: '/admin/users',
    icon: UsersIcon,
  },
  {
    title: '組織管理',
    url: '/admin/organizations',
    icon: Building2Icon,
  },
  {
    title: 'Feature Flags',
    url: '/admin/feature-flags',
    icon: FlagIcon,
  },
]

export default function AdminLayout({
  loaderData: { user },
}: Route.ComponentProps) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="floating">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/admin">
                  <AppLogo size="sm" showText={false} />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Invoice AI</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>メニュー</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <NavLink to={item.url} end={item.url === '/admin'}>
                      {({ isActive }) => (
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={item.title}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <div className="bg-muted flex aspect-square size-8 items-center justify-center rounded-lg">
                  {user.name?.charAt(0) ?? user.email?.charAt(0) ?? 'U'}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="アプリに戻る">
                <Link to="/">
                  <LogOutIcon />
                  <span>アプリに戻る</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <Header />
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
