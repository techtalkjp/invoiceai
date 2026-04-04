import { redirect, useActionData, useRouteLoaderData } from 'react-router'
import { useSmartNavigation } from '~/hooks/use-smart-navigation'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { ClientForm } from '../+components/client-form'
import { upsertClient } from '../+mutations.server'
import type { Route } from './+types/_index'

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

export default function ClientBasicSettings({
  params: { orgSlug },
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>()
  const { backUrl } = useSmartNavigation({
    baseUrl: `/org/${orgSlug}/clients`,
  })
  const layoutData = useRouteLoaderData(
    'routes/org.$orgSlug/clients/$clientId/_layout',
  ) as
    | {
        client: {
          id: string
          name: string
          billingType: string
          hourlyRate: number | null
          monthlyFee: number | null
          unitLabel: string | null
          hasWorkDescription: number | null
          freeePartnerId: number | null
          freeePartnerName: string | null
          invoiceSubjectTemplate: string | null
          invoiceNote: string | null
          paymentTerms: string
        }
        canSync: boolean
      }
    | undefined

  if (!layoutData) return null

  const { client, canSync } = layoutData

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
