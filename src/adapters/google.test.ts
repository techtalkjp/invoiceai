import { afterEach, describe, expect, it, vi } from 'vitest'
import { googleRequest } from './google'

type MockResponse = {
  status: number
  ok: boolean
  statusText: string
  json: () => Promise<unknown>
  text: () => Promise<string>
}

function mockResponse(data: Partial<MockResponse>): MockResponse {
  return {
    status: data.status ?? 200,
    ok: data.ok ?? true,
    statusText: data.statusText ?? 'OK',
    json: data.json ?? (async () => ({})),
    text: data.text ?? (async () => ''),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('googleRequest', () => {
  it('retries once on 401 after refresh', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ status: 401, ok: false, statusText: 'Unauthorized' }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          ok: true,
          json: async () => ({ ok: true }),
        }),
      )

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const deps = {
      getAccessToken: vi.fn().mockResolvedValue('token'),
      refreshToken: vi.fn().mockResolvedValue('new-token'),
    }

    const result = await googleRequest<{ ok: boolean }>(
      'https://example.com',
      deps,
    )

    expect(result.ok).toBe(true)
    expect(deps.refreshToken).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        status: 500,
        ok: false,
        statusText: 'Server Error',
        text: async () => 'boom',
      }),
    )

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const deps = {
      getAccessToken: vi.fn().mockResolvedValue('token'),
      refreshToken: vi.fn().mockResolvedValue('new-token'),
    }

    await expect(googleRequest('https://example.com', deps)).rejects.toThrow(
      'Google API Error: 500 Server Error',
    )
  })
})
