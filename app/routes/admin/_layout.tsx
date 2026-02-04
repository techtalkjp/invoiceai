import {
  Building2Icon,
  FlagIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  UsersIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '~/components/ui/sidebar'
import { requireAdmin } from '~/lib/auth-helpers.server'
import { cn } from '~/lib/utils'
import type { Route } from './+types/_layout'

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
          <Link
            to="/admin"
            className="flex items-center gap-2 px-2 py-1.5 font-semibold"
          >
            <span className="bg-foreground text-background inline-flex h-8 w-8 items-center justify-center rounded-md text-sm">
              A
            </span>
            <span className="group-data-[collapsible=icon]:hidden">
              管理画面
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>メニュー</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.url === '/admin'}
                        className={({ isActive }) =>
                          cn(isActive && 'bg-sidebar-accent')
                        }
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
              {user.name?.charAt(0) ?? user.email?.charAt(0) ?? 'U'}
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="font-medium">{user.name}</span>
              <span className="text-muted-foreground text-xs">
                {user.email}
              </span>
            </div>
          </div>
          <Separator className="my-2" />
          <SidebarMenu>
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

      <div
        className={cn(
          'ml-auto w-full max-w-full',
          'peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)]',
          'peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))]',
          'transition-[width] duration-200 ease-linear',
          'flex h-svh flex-col',
        )}
      >
        <header className="bg-background flex items-center gap-3 border-b px-4 py-2">
          <SidebarTrigger variant="outline" />
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-lg font-semibold">管理画面</h1>
          <div className="ml-auto">
            <Button variant="outline" size="sm" asChild>
              <Link to="/">アプリに戻る</Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  )
}
