import { createCookieSessionStorage } from 'react-router'
export { startGitHubOAuth } from '~/lib/github-oauth.server'

// --- Playground 用 Result Flash Session ---

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
