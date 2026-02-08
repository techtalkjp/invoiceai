import {
  BriefcaseIcon,
  ChevronsUpDownIcon,
  ClockIcon,
  HomeIcon,
  LogOutIcon,
  SettingsIcon,
  ShieldIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { AppLogo } from '~/components/app-logo'
import { Header } from '~/components/layout/header'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
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
import { signOut } from '~/lib/auth-client'
import {
  getUserOrganizations,
  requireOrgMember,
} from '~/lib/auth-helpers.server'
import type { Route } from './+types/_layout'

export const handle = {
  breadcrumb: (data: { organization: { name: string; slug: string } }) => ({
    label: data.organization.name,
    to: `/org/${data.organization.slug}`,
  }),
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { user, organization, membership } = await requireOrgMember(
    request,
    orgSlug,
  )

  const organizations = await getUserOrganizations(user.id)

  return { user, organization, membership, organizations }
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
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to={`/org/${organization.slug}`}>
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
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <div className="bg-muted flex aspect-square size-8 items-center justify-center rounded-lg">
                      {user.name?.charAt(0) ?? user.email?.charAt(0) ?? 'U'}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {membership.role}
                      </span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-56 rounded-lg"
                  side="right"
                  align="end"
                  sideOffset={4}
                >
                  {isSuperAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/admin">
                          <ShieldIcon />
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
                    <LogOutIcon />
                    サインアウト
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <Header />
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          <Outlet context={{ organization, membership, user }} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
