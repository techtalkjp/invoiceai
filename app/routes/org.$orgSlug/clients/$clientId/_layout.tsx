import { Link, Outlet, useLocation } from 'react-router'
import { PageHeader } from '~/components/layout/page-header'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { cn } from '~/lib/utils'
import { getClient } from '../+queries.server'
import type { Route } from './+types/_layout'

export const handle = {
  breadcrumb: (data: { orgSlug: string; client: { name: string } }) => [
    { label: 'クライアント', to: `/org/${data.orgSlug}/clients` },
    { label: data.client.name },
  ],
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug, clientId } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const client = await getClient(organization.id, clientId)
  if (!client) {
    throw new Response('クライアントが見つかりません', { status: 404 })
  }

  const canSync = !!organization.freeeCompanyId && !!client.freeePartnerId

  return { orgSlug, client, organization, canSync }
}

const tabs = [
  { label: '基本設定', path: '' },
  { label: '経費項目', path: '/expenses' },
] as const

export default function ClientDetailLayout({
  loaderData: { orgSlug, client },
}: Route.ComponentProps) {
  const location = useLocation()
  const basePath = `/org/${orgSlug}/clients/${client.id}`

  return (
    <div className="grid gap-4">
      <PageHeader title={client.name} subtitle="クライアント設定" />
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const tabPath = `${basePath}${tab.path}`
          const isActive =
            tab.path === ''
              ? location.pathname === basePath ||
                location.pathname === `${basePath}/`
              : location.pathname.startsWith(tabPath)
          return (
            <Link
              key={tab.path}
              to={tabPath}
              className={cn(
                'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}
