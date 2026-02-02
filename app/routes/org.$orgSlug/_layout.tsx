import {
  BriefcaseIcon,
  BuildingIcon,
  ClockIcon,
  HomeIcon,
  LogOutIcon,
  SettingsIcon,
  ShieldIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
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
import { signOut } from '~/lib/auth-client'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import { cn } from '~/lib/utils'
import type { Route } from './+types/_layout'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { user, organization, membership } = await requireOrgMember(
    request,
    orgSlug,
  )

  return { user, organization, membership }
}

export default function OrgLayout({
  loaderData: { user, organization, membership },
}: Route.ComponentProps) {
  const navigate = useNavigate()
  const isOwner = membership.role === 'owner'
  const isBillingStaff =
    membership.role === 'owner' || membership.role === 'admin'
  const isSuperAdmin = user.role === 'admin'

  // 全スタッフ向けメニュー
  const staffItems = [
    {
      title: '稼働時間',
      url: `/org/${organization.slug}/work-hours`,
      icon: ClockIcon,
      end: false,
    },
  ]

  // 請求担当者向けメニュー（owner, admin）
  const billingItems = [
    {
      title: '月次請求',
      url: `/org/${organization.slug}/invoices`,
      icon: HomeIcon,
      end: false,
    },
    {
      title: 'クライアント',
      url: `/org/${organization.slug}/clients`,
      icon: BriefcaseIcon,
      end: false,
    },
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/signin')
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="floating">
        <SidebarHeader>
          <Link
            to={`/org/${organization.slug}`}
            className="flex items-center gap-2 px-2 py-1.5 font-semibold"
          >
            <span className="bg-foreground text-background inline-flex h-8 w-8 items-center justify-center rounded-md text-sm">
              <BuildingIcon className="h-4 w-4" />
            </span>
            <span className="truncate group-data-[collapsible=icon]:hidden">
              {organization.name}
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          {/* 全スタッフ向け */}
          <SidebarGroup>
            <SidebarGroupLabel>スタッフ</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {staffItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <NavLink to={item.url} end={item.end}>
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

          {/* 請求担当者向け（owner, admin） */}
          {isBillingStaff && (
            <SidebarGroup>
              <SidebarGroupLabel>請求管理</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {billingItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <NavLink to={item.url} end={item.end}>
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
          )}

          {/* オーナー向け */}
          {isOwner && (
            <SidebarGroup>
              <SidebarGroupLabel>管理</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <NavLink to={`/org/${organization.slug}/settings`}>
                      {({ isActive }) => (
                        <SidebarMenuButton isActive={isActive} tooltip="設定">
                          <SettingsIcon />
                          <span>設定</span>
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="hover:bg-sidebar-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                  {user.name?.charAt(0) ?? user.email?.charAt(0) ?? 'U'}
                </div>
                <div className="flex flex-col items-start group-data-[collapsible=icon]:hidden">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {membership.role}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {isSuperAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2">
                      <ShieldIcon className="h-4 w-4" />
                      管理者ダッシュボード
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOutIcon className="mr-2 h-4 w-4" />
                サインアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          <h1 className="text-lg font-semibold">{organization.name}</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet context={{ organization, membership, user }} />
        </main>
      </div>
    </SidebarProvider>
  )
}
