import { describe, expect, it } from 'vitest'
import { buildFreeeAuthUrl } from './freee-oauth'

describe('buildFreeeAuthUrl', () => {
  it('builds auth url with required params', () => {
    const url = buildFreeeAuthUrl(
      'https://example.com/auth',
      'client-id',
      'urn:example:redirect',
    )
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://example.com/auth')
    expect(parsed.searchParams.get('client_id')).toBe('client-id')
    expect(parsed.searchParams.get('redirect_uri')).toBe('urn:example:redirect')
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('prompt')).toBe('consent')
  })
})
