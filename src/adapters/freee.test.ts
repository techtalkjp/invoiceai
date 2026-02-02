import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFreeeClient } from './freee'

type MockResponse = {
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
  text: () => Promise<string>
  arrayBuffer: () => Promise<ArrayBuffer>
}

function mockResponse(data: Partial<MockResponse>): MockResponse {
  return {
    ok: data.ok ?? true,
    status: data.status ?? 200,
    statusText: data.statusText ?? 'OK',
    json: data.json ?? (async () => ({})),
    text: data.text ?? (async () => ''),
    arrayBuffer: data.arrayBuffer ?? (async () => new ArrayBuffer(8)),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createFreeeClient', () => {
  it('includes Authorization header and returns data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        json: async () => ({
          companies: [{ id: 1, name: 'A', display_name: 'A', role: 'admin' }],
        }),
      }),
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const client = createFreeeClient({
      getAccessToken: () => 'token-1',
    })

    const result = await client.getCompanies()
    expect(result.companies.length).toBe(1)
    const call = fetchMock.mock.calls[0]
    if (!call) {
      throw new Error('fetch was not called')
    }
    const [, options] = call
    expect(options.headers.Authorization).toBe('Bearer token-1')
  })

  it('throws on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: async () => 'boom',
      }),
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const client = createFreeeClient({
      getAccessToken: () => 'token-1',
    })

    await expect(client.getCompanies()).rejects.toThrow(
      'API Error: 500 Server Error',
    )
  })

  it('downloads invoice pdf as ArrayBuffer', async () => {
    const buffer = new ArrayBuffer(4)
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        arrayBuffer: async () => buffer,
      }),
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const client = createFreeeClient({
      getAccessToken: () => 'token-1',
    })

    const result = await client.getInvoicePdf(1, 2)
    expect(result).toBe(buffer)
    const call = fetchMock.mock.calls[0]
    if (!call) {
      throw new Error('fetch was not called')
    }
    const [url, options] = call
    expect(String(url)).toContain('/invoices/2.pdf?company_id=1')
    expect(options.headers.Accept).toBe('application/pdf')
  })
})
