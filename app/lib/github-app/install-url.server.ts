import { decrypt, encrypt } from '~/lib/activity-sources/encryption.server'

function getGitHubAppSlug(): string {
  const slug = process.env.GITHUB_APP_SLUG
  if (!slug) throw new Error('GITHUB_APP_SLUG is not set')
  return slug
}

interface InstallState {
  orgSlug: string
  ts: number
}

export function buildGitHubAppInstallUrl(orgSlug: string): string {
  const slug = getGitHubAppSlug()
  const state: InstallState = { orgSlug, ts: Date.now() }
  const encrypted = encrypt(JSON.stringify(state))
  return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(encrypted)}`
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes

export function parseInstallState(encryptedState: string): InstallState | null {
  try {
    const json = decrypt(decodeURIComponent(encryptedState))
    const state = JSON.parse(json) as InstallState
    if (Date.now() - state.ts > STATE_MAX_AGE_MS) return null
    if (!state.orgSlug) return null
    return state
  } catch {
    return null
  }
}
