import crypto from 'node:crypto'
import {
  createCookie,
  createCookieSessionStorage,
  redirect,
} from 'react-router'

// --- 環境変数 ---

function getGitHubClientId(): string {
  const id = process.env.GITHUB_CLIENT_ID
  if (!id) throw new Error('GITHUB_CLIENT_ID is not set')
  return id
}

function getGitHubClientSecret(): string {
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

// --- OAuth State Cookie (PKCE verifier + state + year/month) ---

const oauthStateCookie = createCookie('playground_oauth', {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 300, // 5分
  secure: process.env.NODE_ENV === 'production',
})

interface OAuthState {
  state: string
  codeVerifier: string
  year: number
  month: number
}

export async function createOAuthStateCookie(
  oauthState: OAuthState,
): Promise<string> {
  return oauthStateCookie.serialize(oauthState)
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
  return oauthStateCookie.serialize(null, { maxAge: 0 })
}

// --- Result Flash Session ---

interface ResultSessionData {
  _unused?: string | undefined
}

interface ResultFlashData {
  githubResult: string // JSON encoded
}

const resultSessionStorage = createCookieSessionStorage<
  ResultSessionData,
  ResultFlashData
>({
  cookie: {
    name: 'playground_result',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60, // 1分 (flash なのですぐ消える)
    secure: process.env.NODE_ENV === 'production',
  },
})

export interface GitHubResult {
  entries: Array<{
    workDate: string
    startTime: string
    endTime: string
    breakMinutes: number
    description: string
  }>
  reasoning: string
  username: string
  activityCount: number
}

export async function setResultFlash(
  request: Request,
  result: GitHubResult,
): Promise<string> {
  const session = await resultSessionStorage.getSession(
    request.headers.get('Cookie'),
  )
  session.flash('githubResult', JSON.stringify(result))
  return resultSessionStorage.commitSession(session)
}

export async function getResultFlash(
  request: Request,
): Promise<{ result: GitHubResult | null; setCookie: string }> {
  const session = await resultSessionStorage.getSession(
    request.headers.get('Cookie'),
  )
  const raw = session.get('githubResult')
  const result = raw ? (JSON.parse(raw) as GitHubResult) : null
  const setCookie = await resultSessionStorage.commitSession(session)
  return { result, setCookie }
}

// --- GitHub OAuth URLs ---

export function buildGitHubAuthUrl(
  state: string,
  codeChallenge: string,
  redirectUri: string,
): string {
  const params = new URLSearchParams({
    client_id: getGitHubClientId(),
    redirect_uri: redirectUri,
    scope: 'read:user',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `https://github.com/login/oauth/authorize?${params.toString()}`
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

// --- OAuth フロー開始 ---

export async function startGitHubOAuth(
  request: Request,
  year: number,
  month: number,
): Promise<Response> {
  const { codeVerifier, codeChallenge } = generatePKCEPair()
  const state = crypto.randomBytes(16).toString('hex')

  const url = new URL(request.url)
  const redirectUri = `${url.origin}/playground/callback`
  const authUrl = buildGitHubAuthUrl(state, codeChallenge, redirectUri)

  const cookie = await createOAuthStateCookie({
    state,
    codeVerifier,
    year,
    month,
  })

  return redirect(authUrl, {
    headers: { 'Set-Cookie': cookie },
  })
}
