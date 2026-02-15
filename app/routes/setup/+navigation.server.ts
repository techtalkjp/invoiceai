import type { SetupState } from './+queries.server'

export function resolveSetupRedirectPath(
  setup: SetupState,
  pathname: string,
): string | null {
  if (setup.setupCompleted) {
    return setup.orgSlug ? `/org/${setup.orgSlug}` : '/'
  }

  if (pathname === '/setup' || pathname === '/setup/') {
    if (!setup.workspaceNameConfirmed) return '/setup/company'
    if (setup.clientCount === 0) return '/setup/client'
    return '/setup/cli'
  }

  if (pathname === '/setup/client' && !setup.workspaceNameConfirmed) {
    return '/setup/company'
  }

  if (pathname === '/setup/cli') {
    if (!setup.workspaceNameConfirmed) return '/setup/company'
    if (setup.clientCount === 0) return '/setup/client'
  }

  return null
}
