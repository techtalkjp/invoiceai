import crypto from 'node:crypto'
import { createCookie, redirect } from 'react-router'

// --- 環境変数 ---

export function getGitHubClientId(): string {
  const id = process.env.GITHUB_CLIENT_ID
  if (!id) throw new Error('GITHUB_CLIENT_ID is not set')
  return id
}

export function getGitHubClientSecret(): string {
  const secret = process.env.GITHUB_CLIENT_SECRET
  if (!secret) throw new Error('GITHUB_CLIENT_SECRET is not set')
  return secret
}

// --- PKCE ---

export function generatePKCEPair(): {
  codeVerifier: string
  codeChallenge: string
} {
  // RFC 7636: 43-128 文字のランダム文字列
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  return { codeVerifier, codeChallenge }
}

// --- 共通 OAuth State Cookie ---

export type OAuthReturnTo = 'playground' | 'integrations'

export type OAuthState =
  | {
      state: string
      codeVerifier: string
      returnTo: 'playground'
      metadata: { year: number; month: number }
    }
  | {
      state: string
      codeVerifier: string
      returnTo: 'integrations'
      metadata: { orgSlug: string }
    }

const oauthStateCookie = createCookie('github_oauth', {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 300, // 5分
  secure: process.env.NODE_ENV === 'production',
  secrets: [process.env.BETTER_AUTH_SECRET ?? 'dev-oauth-secret'],
})

export async function createOAuthStateCookie(
  oauthState: OAuthState,
): Promise<string> {
  return await oauthStateCookie.serialize(oauthState)
}

export async function parseOAuthStateCookie(
  request: Request,
): Promise<OAuthState | null> {
  const cookieHeader = request.headers.get('Cookie')
  const value = await oauthStateCookie.parse(cookieHeader)
  if (!value || typeof value !== 'object') return null
  return value as OAuthState
}

export async function clearOAuthStateCookie(): Promise<string> {
  return await oauthStateCookie.serialize(null, { maxAge: 0 })
}

// --- GitHub OAuth URLs ---

export function buildGitHubAuthUrl(params: {
  state: string
  codeChallenge: string
  redirectUri: string
  scope: string
}): string {
  const searchParams = new URLSearchParams({
    client_id: getGitHubClientId(),
    redirect_uri: params.redirectUri,
    scope: params.scope,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  })
  return `https://github.com/login/oauth/authorize?${searchParams.toString()}`
}

export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: getGitHubClientId(),
      client_secret: getGitHubClientSecret(),
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`)
  }

  const json = (await res.json()) as {
    access_token?: string
    error?: string
    error_description?: string
  }

  if (json.error || !json.access_token) {
    throw new Error(
      json.error_description ?? json.error ?? 'Token exchange failed',
    )
  }

  return json.access_token
}

// --- OAuth フロー開始ヘルパー ---

export async function startGitHubOAuth(params: {
  request: Request
  returnTo: OAuthReturnTo
  metadata: OAuthState['metadata']
  scope?: string | undefined
}): Promise<Response> {
  const { codeVerifier, codeChallenge } = generatePKCEPair()
  const state = crypto.randomBytes(16).toString('hex')

  const url = new URL(params.request.url)
  const redirectUri = `${url.origin}/auth/callback/github`
  const authUrl = buildGitHubAuthUrl({
    state,
    codeChallenge,
    redirectUri,
    scope: params.scope ?? 'read:user',
  })

  const cookie = await createOAuthStateCookie({
    state,
    codeVerifier,
    returnTo: params.returnTo,
    metadata: params.metadata,
  } as OAuthState)

  return redirect(authUrl, {
    headers: { 'Set-Cookie': cookie },
  })
}
