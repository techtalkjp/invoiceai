import { redirect, useActionData } from 'react-router'
import { useSmartNavigation } from '~/hooks/use-smart-navigation'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { ClientForm } from './+components/client-form'
import { upsertClient } from './+mutations.server'
import { getClient } from './+queries.server'
import type { Route } from './+types/$clientId'

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

  // 同期可能かどうか（freee連携済みかどうか）
  const canSync = !!organization.freeeCompanyId && !!client.freeePartnerId

  return { orgSlug, client, organization, canSync }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const formData = await request.formData()
  const result = await upsertClient(organization.id, formData)

  if (result.success) {
    return redirect(`/org/${orgSlug}/clients`)
  }

  return result
}

export default function EditClient({
  loaderData: { orgSlug, client, canSync },
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>()
  const baseUrl = `/org/${orgSlug}/clients`
  const { backUrl } = useSmartNavigation({ baseUrl })

  return (
    <ClientForm
      defaultValue={{
        id: client.id,
        name: client.name,
        billingType: client.billingType as 'fixed' | 'time',
        hourlyRate: client.hourlyRate ?? undefined,
        monthlyFee: client.monthlyFee ?? undefined,
        unitLabel: client.unitLabel ?? undefined,
        hasWorkDescription: client.hasWorkDescription ?? undefined,
        freeePartnerId: client.freeePartnerId ?? undefined,
        freeePartnerName: client.freeePartnerName ?? undefined,
        invoiceSubjectTemplate: client.invoiceSubjectTemplate ?? undefined,
        invoiceNote: client.invoiceNote ?? undefined,
        paymentTerms: client.paymentTerms as
          | 'next_month_end'
          | 'next_next_month_1st'
          | 'next_next_month_end'
          | undefined,
      }}
      lastResult={
        actionData && 'lastResult' in actionData
          ? actionData.lastResult
          : undefined
      }
      cancelUrl={backUrl}
      submitLabel="更新"
      canSync={canSync}
      orgSlug={orgSlug}
    />
  )
}
