import { createCookieSessionStorage } from 'react-router'
export { startGitHubOAuth } from '~/lib/github-oauth.server'

// --- Playground 用 Token Flash Session ---
// OAuth callback で暗号化トークンを一時保存し、serverLoader で復号して GitHub API を呼ぶ

interface TokenSessionData {
  _unused?: string | undefined
}

interface TokenFlashData {
  tokenData: string // JSON encoded
}

const tokenSessionStorage = createCookieSessionStorage<
  TokenSessionData,
  TokenFlashData
>({
  cookie: {
    name: 'playground_token',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60, // 1分 (flash なのですぐ消える)
    secure: process.env.NODE_ENV === 'production',
  },
})

export interface TokenFlash {
  encryptedToken: string
  username: string
}

export async function setTokenFlash(
  request: Request,
  tokenData: TokenFlash,
): Promise<string> {
  const session = await tokenSessionStorage.getSession(
    request.headers.get('Cookie'),
  )
  session.flash('tokenData', JSON.stringify(tokenData))
  return tokenSessionStorage.commitSession(session)
}

export async function getTokenFlash(
  request: Request,
): Promise<{ tokenData: TokenFlash | null; setCookie: string }> {
  const session = await tokenSessionStorage.getSession(
    request.headers.get('Cookie'),
  )
  const raw = session.get('tokenData')
  const tokenData = raw ? (JSON.parse(raw) as TokenFlash) : null
  const setCookie = await tokenSessionStorage.commitSession(session)
  return { tokenData, setCookie }
}

// --- serverLoader から返す GitHub 結果の型 ---

export interface GitHubActivityDetail {
  eventType: string
  eventDate: string
  eventTimestamp: string
  repo: string | null
  title: string | null
  url: string | null
  metadata: string | null
}

export interface GitHubResult {
  entries: Array<{
    workDate: string
    startTime: string
    endTime: string
    breakMinutes: number
    description: string
  }>
  activities: GitHubActivityDetail[]
  reasoning: string
  username: string
  activityCount: number
}
