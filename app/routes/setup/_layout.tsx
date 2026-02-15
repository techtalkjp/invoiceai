import { Outlet, redirect, useLocation } from 'react-router'
import { SetupShell } from './+components/setup-shell'
import { resolveSetupRedirectPath } from './+navigation.server'
import { getSetupState } from './+queries.server'
import type { Route } from './+types/_layout'

export async function loader({ request }: Route.LoaderArgs) {
  const setup = await getSetupState(request)
  const url = new URL(request.url)
  const pathname = url.pathname
  const redirectPath = resolveSetupRedirectPath(setup, pathname)

  if (redirectPath && redirectPath !== pathname) {
    throw redirect(redirectPath)
  }

  return setup
}

export type SetupContext = Route.ComponentProps['loaderData']

export default function SetupLayout({ loaderData }: Route.ComponentProps) {
  const location = useLocation()
  const currentStep = location.pathname.endsWith('/company')
    ? 1
    : location.pathname.endsWith('/client')
      ? 2
      : 3

  return (
    <SetupShell
      currentStep={currentStep}
      orgSlug={loaderData.orgSlug}
      workspaceName={loaderData.workspaceName}
      workspaceNameConfirmed={loaderData.workspaceNameConfirmed}
      hasClient={loaderData.clientCount > 0}
      setupCompleted={loaderData.setupCompleted}
    >
      <Outlet context={loaderData} />
    </SetupShell>
  )
}
