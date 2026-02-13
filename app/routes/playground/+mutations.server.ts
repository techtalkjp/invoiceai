import { redirect } from 'react-router'
import { getSession } from '~/lib/auth-helpers.server'
import type { ParsedWorkEntry } from '../org.$orgSlug/work-hours/+ai-parse.server'
import { parseWorkHoursText } from '../org.$orgSlug/work-hours/+ai-parse.server'
import { checkAiUsage, recordAiUsage } from './+lib/ai-usage.server'
import { startGitHubOAuth } from './+lib/github-oauth.server'

export async function handleStartGitHubOAuth(
  formData: FormData,
  request: Request,
) {
  const year = Number(formData.get('year'))
  const month = Number(formData.get('month'))
  if (!year || !month) {
    return redirect('/playground')
  }
  return await startGitHubOAuth({
    request,
    returnTo: 'playground',
    metadata: { year, month },
  })
}

export async function handleParseText(
  formData: FormData,
  request: Request,
): Promise<{
  entries?: ParsedWorkEntry[] | undefined
  parseErrors?: string[] | undefined
  error?: string | undefined
}> {
  const session = await getSession(request)
  if (!session?.user) {
    return { error: 'セッションが見つかりません' }
  }

  const text = formData.get('text')
  const year = Number(formData.get('year'))
  const month = Number(formData.get('month'))
  if (!text || typeof text !== 'string' || !year || !month) {
    return { error: 'パラメータが不正です' }
  }

  const currentMonth = `${year}-${String(month).padStart(2, '0')}`
  const usage = await checkAiUsage(session.user.id, currentMonth)
  if (usage.remaining <= 0) {
    return { error: `AI解析の月間上限（${usage.limit}回）に達しました` }
  }

  try {
    const result = await parseWorkHoursText(text, year, month)
    await recordAiUsage(session.user.id, currentMonth, 1, 0, 0)
    return { entries: result.entries, parseErrors: result.parseErrors }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'AI解析に失敗しました' }
  }
}
