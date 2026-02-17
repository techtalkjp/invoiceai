export type FreeeOauthDeps = {
  tokenUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
}

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

export async function requestFreeeTokenWithCode(
  deps: FreeeOauthDeps,
  code: string,
) {
  const response = await fetch(deps.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: deps.clientId,
      client_secret: deps.clientSecret,
      code,
      redirect_uri: deps.redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token Error: ${response.status}\n${error}`)
  }

  return response.json()
}

export async function refreshFreeeToken(
  deps: FreeeOauthDeps,
  refreshToken: string,
) {
  const response = await fetch(deps.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: deps.clientId,
      client_secret: deps.clientSecret,
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Refresh Error: ${response.status}\n${error}`)
  }

  return response.json()
}
