import { type OAuthDeps, requestToken } from './oauth'

export type GoogleOauthDeps = OAuthDeps

export function buildGoogleAuthUrl(
  authUrl: string,
  clientId: string,
  redirectUri: string,
  scopes: string[],
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  })
  return `${authUrl}?${params}`
}

export function requestGoogleTokenWithCode(
  deps: GoogleOauthDeps,
  code: string,
) {
  return requestToken(deps.tokenUrl, {
    code,
    client_id: deps.clientId,
    client_secret: deps.clientSecret,
    redirect_uri: deps.redirectUri,
    grant_type: 'authorization_code',
  })
}

export function refreshGoogleAccessToken(
  deps: GoogleOauthDeps,
  refreshToken: string,
) {
  return requestToken(deps.tokenUrl, {
    refresh_token: refreshToken,
    client_id: deps.clientId,
    client_secret: deps.clientSecret,
    grant_type: 'refresh_token',
  })
}
