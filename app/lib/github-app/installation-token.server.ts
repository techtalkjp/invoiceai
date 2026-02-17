import { generateGitHubAppJWT } from './jwt.server'

interface CachedToken {
  token: string
  expiresAt: number
}

const tokenCache = new Map<number, CachedToken>()
const TOKEN_TTL_MS = 50 * 60 * 1000 // 50 minutes (10-minute safety margin)

interface InstallationTokenResponse {
  token: string
  expires_at: string
}

export async function getInstallationAccessToken(
  installationId: number,
): Promise<string> {
  const cached = tokenCache.get(installationId)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token
  }

  const jwtToken = generateGitHubAppJWT()
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `Failed to get installation token: ${res.status} ${res.statusText} - ${body}`,
    )
  }

  const data = (await res.json()) as InstallationTokenResponse

  tokenCache.set(installationId, {
    token: data.token,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  })

  return data.token
}

export function invalidateInstallationToken(installationId: number): void {
  tokenCache.delete(installationId)
}
