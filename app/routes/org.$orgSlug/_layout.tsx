import {
  BriefcaseIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  ClockIcon,
  HomeIcon,
  LogOutIcon,
  SettingsIcon,
  ShieldIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { AppLogo } from '~/components/app-logo'
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
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '~/components/ui/sidebar'
import { signOut } from '~/lib/auth-client'
import {
  getUserOrganizations,
  requireOrgMember,
} from '~/lib/auth-helpers.server'
import type { Route } from './+types/_layout'

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
  loaderData: { user, organization, membership, organizations },
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
        <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            {organizations.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hover:bg-accent flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold"
                  >
                    {organization.name}
                    <ChevronsUpDownIcon className="text-muted-foreground h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {organizations.map((org) => (
                    <DropdownMenuItem key={org.id} asChild>
                      <Link
                        to={`/org/${org.slug}`}
                        className="flex items-center justify-between"
                      >
                        {org.name}
                        {org.id === organization.id && (
                          <CheckIcon className="h-4 w-4" />
                        )}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="text-sm font-semibold">{organization.name}</span>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <Outlet context={{ organization, membership, user }} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
