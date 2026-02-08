import {
  BriefcaseIcon,
  ClockIcon,
  FileTextIcon,
  SettingsIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '~/components/layout/page-header'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import type { Route } from './+types/_index'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { organization, membership } = await requireOrgMember(request, orgSlug)

  return { organization, membership, orgSlug }
}

export default function OrgIndex({
  loaderData: { organization, membership, orgSlug },
}: Route.ComponentProps) {
  const isOwner = membership.role === 'owner'
  const isBillingStaff =
    membership.role === 'owner' || membership.role === 'admin'

  return (
    <div className="grid gap-6">
      <PageHeader
        title={organization.name}
        subtitle={`ようこそ、${membership.role === 'owner' ? 'オーナー' : membership.role === 'admin' ? '管理者' : 'スタッフ'}としてログインしています`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 全スタッフ向け */}
        <Link to={`/org/${orgSlug}/work-hours`}>
          <Card className="hover:bg-accent h-full transition-colors">
            <CardHeader>
              <ClockIcon className="text-muted-foreground mb-2 h-8 w-8" />
              <CardTitle>稼働時間</CardTitle>
              <CardDescription>稼働時間を記録・確認</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        {/* 請求担当者向け */}
        {isBillingStaff && (
          <>
            <Link to={`/org/${orgSlug}/invoices`}>
              <Card className="hover:bg-accent h-full transition-colors">
                <CardHeader>
                  <FileTextIcon className="text-muted-foreground mb-2 h-8 w-8" />
                  <CardTitle>月次請求</CardTitle>
                  <CardDescription>請求書の作成・管理</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link to={`/org/${orgSlug}/clients`}>
              <Card className="hover:bg-accent h-full transition-colors">
                <CardHeader>
                  <BriefcaseIcon className="text-muted-foreground mb-2 h-8 w-8" />
                  <CardTitle>クライアント</CardTitle>
                  <CardDescription>クライアント情報の管理</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </>
        )}

        {/* オーナー向け */}
        {isOwner && (
          <Link to={`/org/${orgSlug}/settings`}>
            <Card className="hover:bg-accent h-full transition-colors">
              <CardHeader>
                <SettingsIcon className="text-muted-foreground mb-2 h-8 w-8" />
                <CardTitle>設定</CardTitle>
                <CardDescription>組織の設定を管理</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
      </div>
    </div>
  )
}
