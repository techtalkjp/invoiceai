import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSetupState: vi.fn(),
  findDuplicateClientName: vi.fn(),
  upsertPrimaryClient: vi.fn(),
}))

vi.mock('./+queries.server', () => ({
  getSetupState: mocks.getSetupState,
}))

vi.mock('./+services.server', () => ({
  findDuplicateClientName: mocks.findDuplicateClientName,
  upsertPrimaryClient: mocks.upsertPrimaryClient,
}))

import { action } from './client'

function buildRequest(payload: Record<string, string>) {
  return new Request('http://localhost:5173/setup/client', {
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

describe('setup client action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSetupState.mockResolvedValue({
      organizationId: 'org-1',
      primaryClient: null,
    })
    mocks.findDuplicateClientName.mockResolvedValue(null)
    mocks.upsertPrimaryClient.mockResolvedValue(undefined)
  })

  it('upserts client and redirects to cli step', async () => {
    const request = buildRequest({
      name: '株式会社A',
      billingType: 'time',
      hourlyRate: '10000',
    })

    await expectRedirect(action({ request } as never), '/setup/cli')

    expect(mocks.findDuplicateClientName).toHaveBeenCalledWith({
      organizationId: 'org-1',
      primaryClientId: null,
      name: '株式会社A',
    })
    expect(mocks.upsertPrimaryClient).toHaveBeenCalledWith({
      organizationId: 'org-1',
      primaryClientId: null,
      value: expect.objectContaining({
        name: '株式会社A',
        billingType: 'time',
        hourlyRate: 10000,
      }),
    })
  })

  it('returns form error when duplicate name exists', async () => {
    mocks.findDuplicateClientName.mockResolvedValue({ id: 'client-2' })
    const request = buildRequest({
      name: '株式会社A',
      billingType: 'fixed',
      monthlyFee: '300000',
    })

    const result = (await action({ request } as never)) as {
      data?: { errorMessage?: string }
    }

    expect(result.data?.errorMessage).toBe(
      '同じ名前のクライアントが既に存在します。',
    )
    expect(mocks.upsertPrimaryClient).not.toHaveBeenCalled()
  })
})
