import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSetupState: vi.fn(),
  completeSetup: vi.fn(),
}))

vi.mock('./+queries.server', () => ({
  getSetupState: mocks.getSetupState,
}))

vi.mock('./+services.server', () => ({
  completeSetup: mocks.completeSetup,
}))

import { action } from './cli'

function buildRequest(payload: Record<string, string>) {
  return new Request('http://localhost:5173/setup/cli', {
    method: 'POST',
    body: new URLSearchParams(payload),
  })
}

async function expectRedirect(
  promise: Promise<unknown>,
  expectedLocation: string,
) {
  try {
    await promise
    throw new Error('Expected redirect response to be thrown')
  } catch (error) {
    expect(error).toBeInstanceOf(Response)
    const response = error as Response
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(expectedLocation)
  }
}

describe('setup cli action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSetupState.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'user-1',
      orgSlug: 'acme',
    })
    mocks.completeSetup.mockResolvedValue(undefined)
  })

  it('completes setup and redirects to organization top', async () => {
    const request = buildRequest({ intent: 'complete-setup' })
    await expectRedirect(action({ request } as never), '/org/acme')

    expect(mocks.completeSetup).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
    })
  })

  it('redirects to / when org slug is empty', async () => {
    mocks.getSetupState.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'user-1',
      orgSlug: '',
    })

    const request = buildRequest({ intent: 'complete-setup' })
    await expectRedirect(action({ request } as never), '/')
  })

  it('redirects back to cli step for unknown intent', async () => {
    const request = buildRequest({ intent: 'noop' })
    await expectRedirect(action({ request } as never), '/setup/cli')

    expect(mocks.completeSetup).not.toHaveBeenCalled()
  })
})
