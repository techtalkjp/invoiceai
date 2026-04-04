export type OAuthDeps = {
  tokenUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
}

export async function requestToken(
  tokenUrl: string,
  params: Record<string, string>,
) {
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })

  if (!response.ok) {
    const error = await response.text()
    const label = params.grant_type === 'refresh_token' ? 'Refresh' : 'Token'
    throw new Error(`${label} Error: ${response.status}\n${error}`)
  }

  return response.json()
}
