import { type OAuthDeps, requestToken } from './oauth'

export type FreeeOauthDeps = OAuthDeps

export function buildFreeeAuthUrl(
  authUrl: string,
  clientId: string,
  redirectUri: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    prompt: 'consent',
  })
  return `${authUrl}?${params}`
}

export function requestFreeeTokenWithCode(deps: FreeeOauthDeps, code: string) {
  return requestToken(deps.tokenUrl, {
    grant_type: 'authorization_code',
    client_id: deps.clientId,
    client_secret: deps.clientSecret,
    code,
    redirect_uri: deps.redirectUri,
  })
}

export function refreshFreeeToken(deps: FreeeOauthDeps, refreshToken: string) {
  return requestToken(deps.tokenUrl, {
    grant_type: 'refresh_token',
    client_id: deps.clientId,
    client_secret: deps.clientSecret,
    refresh_token: refreshToken,
  })
}
