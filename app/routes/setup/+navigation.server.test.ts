import { describe, expect, it } from 'vitest'
import { resolveSetupRedirectPath } from './+navigation.server'
import type { SetupState } from './+queries.server'

function createSetupState(overrides: Partial<SetupState> = {}): SetupState {
  return {
    userId: 'user-1',
    organizationId: 'org-1',
    orgSlug: 'acme',
    workspaceName: 'Acme Inc.',
    clientCount: 0,
    primaryClient: null,
    setupCompleted: false,
    workspaceNameConfirmed: false,
    companyUpdated: false,
    ...overrides,
  }
}

describe('resolveSetupRedirectPath', () => {
  it('redirects completed setup to organization top', () => {
    const setup = createSetupState({ setupCompleted: true })
    const result = resolveSetupRedirectPath(setup, '/setup/client')
    expect(result).toBe('/org/acme')
  })

  it('redirects /setup to company step when workspace name is not confirmed', () => {
    const setup = createSetupState({
      workspaceNameConfirmed: false,
      clientCount: 0,
    })
    const result = resolveSetupRedirectPath(setup, '/setup')
    expect(result).toBe('/setup/company')
  })

  it('redirects /setup to client step when workspace name is confirmed and client does not exist', () => {
    const setup = createSetupState({
      workspaceNameConfirmed: true,
      clientCount: 0,
    })
    const result = resolveSetupRedirectPath(setup, '/setup')
    expect(result).toBe('/setup/client')
  })

  it('redirects /setup to cli step when prerequisites are complete', () => {
    const setup = createSetupState({
      workspaceNameConfirmed: true,
      clientCount: 1,
    })
    const result = resolveSetupRedirectPath(setup, '/setup')
    expect(result).toBe('/setup/cli')
  })

  it('redirects client step to company step when workspace name is not confirmed', () => {
    const setup = createSetupState({
      workspaceNameConfirmed: false,
      clientCount: 0,
    })
    const result = resolveSetupRedirectPath(setup, '/setup/client')
    expect(result).toBe('/setup/company')
  })

  it('redirects cli step to client step when client does not exist', () => {
    const setup = createSetupState({
      workspaceNameConfirmed: true,
      clientCount: 0,
    })
    const result = resolveSetupRedirectPath(setup, '/setup/cli')
    expect(result).toBe('/setup/client')
  })

  it('returns null when current step is valid', () => {
    const setup = createSetupState({
      workspaceNameConfirmed: true,
      clientCount: 1,
    })
    const result = resolveSetupRedirectPath(setup, '/setup/client')
    expect(result).toBeNull()
  })
})
