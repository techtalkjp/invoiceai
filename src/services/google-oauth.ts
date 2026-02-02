export type GoogleOauthDeps = {
  tokenUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
}

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

export async function requestGoogleTokenWithCode(
  deps: GoogleOauthDeps,
  code: string,
) {
  const response = await fetch(deps.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: deps.clientId,
      client_secret: deps.clientSecret,
      redirect_uri: deps.redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token Error: ${response.status}\n${error}`)
  }

  return response.json()
}

export async function refreshGoogleAccessToken(
  deps: GoogleOauthDeps,
  refreshToken: string,
) {
  const response = await fetch(deps.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: deps.clientId,
      client_secret: deps.clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Refresh Error: ${response.status}\n${error}`)
  }

  return response.json()
}
