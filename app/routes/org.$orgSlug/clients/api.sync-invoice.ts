import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { fetchLatestInvoiceInfo, getClient } from './+queries.server'
import type { Route } from './+types/api.sync-invoice'

/**
 * クライアントの最新請求書情報を取得するリソースルート
 * GET /org/:orgSlug/clients/api/sync-invoice?clientId=xxx
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const url = new URL(request.url)
  const clientId = url.searchParams.get('clientId')

  if (!clientId) {
    return Response.json({ error: 'clientId is required' }, { status: 400 })
  }

  const client = await getClient(organization.id, clientId)
  if (!client) {
    return Response.json(
      { error: 'クライアントが見つかりません' },
      { status: 404 },
    )
  }

  if (!organization.freeeCompanyId || !client.freeePartnerId) {
    return Response.json(
      { error: '同期に必要な情報が不足しています' },
      { status: 400 },
    )
  }

  const info = await fetchLatestInvoiceInfo(
    organization.id,
    organization.freeeCompanyId,
    client.freeePartnerId,
  )

  if (!info) {
    return Response.json(
      { error: '請求書が見つかりませんでした' },
      { status: 404 },
    )
  }

  return Response.json({
    success: true,
    invoiceSubjectTemplate: info.invoiceSubjectTemplate,
    invoiceNote: info.invoiceNote,
  })
}
