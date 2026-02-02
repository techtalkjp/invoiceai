import { describe, expect, it } from 'vitest'
import { buildGoogleAuthUrl } from './google-oauth'

describe('buildGoogleAuthUrl', () => {
  it('builds auth url with required params', () => {
    const url = buildGoogleAuthUrl(
      'https://example.com/auth',
      'client-id',
      'http://localhost/callback',
      ['scope-a', 'scope-b'],
    )
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://example.com/auth')
    expect(parsed.searchParams.get('client_id')).toBe('client-id')
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'http://localhost/callback',
    )
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('scope')).toBe('scope-a scope-b')
    expect(parsed.searchParams.get('access_type')).toBe('offline')
    expect(parsed.searchParams.get('prompt')).toBe('consent')
  })
})
