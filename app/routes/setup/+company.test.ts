import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSetupState: vi.fn(),
  confirmWorkspaceName: vi.fn(),
}))

vi.mock('./+queries.server', () => ({
  getSetupState: mocks.getSetupState,
}))

vi.mock('./+services.server', () => ({
  confirmWorkspaceName: mocks.confirmWorkspaceName,
}))

import { action } from './company'

function buildRequest(payload: Record<string, string>) {
  return new Request('http://localhost:5173/setup/company', {
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

describe('setup company action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSetupState.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'user-1',
    })
  })

  it('updates workspace name then redirects to client step', async () => {
    const request = buildRequest({ workspaceName: '株式会社サンプル' })

    await expectRedirect(
      action({ request } as never),
      '/setup/client?updated=company',
    )

    expect(mocks.confirmWorkspaceName).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
      workspaceName: '株式会社サンプル',
    })
  })

  it('returns validation result when workspace name is empty', async () => {
    const request = buildRequest({ workspaceName: '' })

    const result = await action({ request } as never)

    expect(result).toBeTruthy()
    expect(mocks.confirmWorkspaceName).not.toHaveBeenCalled()
  })
})
