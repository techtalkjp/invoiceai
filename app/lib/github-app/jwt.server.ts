import jwt from 'jsonwebtoken'

export function getGitHubAppId(): number {
  const id = process.env.GITHUB_APP_ID
  if (!id) throw new Error('GITHUB_APP_ID is not set')
  return Number.parseInt(id, 10)
}

function getGitHubAppPrivateKey(): string {
  const key = process.env.GITHUB_APP_PRIVATE_KEY
  if (!key) throw new Error('GITHUB_APP_PRIVATE_KEY is not set')
  return key.replace(/\\n/g, '\n')
}

export function generateGitHubAppJWT(): string {
  const appId = getGitHubAppId()
  const privateKey = getGitHubAppPrivateKey()

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  }

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' })
}
