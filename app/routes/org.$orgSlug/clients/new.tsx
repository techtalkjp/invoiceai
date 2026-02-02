import { redirect, useActionData } from 'react-router'
import { useSmartNavigation } from '~/hooks/use-smart-navigation'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { ClientForm } from './+components/client-form'
import { upsertClient } from './+mutations.server'
import type { Route } from './+types/new'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  await requireOrgAdmin(request, orgSlug)
  return { orgSlug }
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

export default function NewClient({
  loaderData: { orgSlug },
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>()
  const baseUrl = `/org/${orgSlug}/clients`
  const { backUrl } = useSmartNavigation({ baseUrl })

  return (
    <ClientForm
      lastResult={actionData?.lastResult}
      backTo={backUrl}
      submitLabel="追加"
    />
  )
}
