import { nanoid } from 'nanoid'
import { db } from '~/lib/db/kysely'

/** 月あたりAI生成できる日数の上限 */
const MONTHLY_DAYS_LIMIT = 25

export async function checkAiUsage(githubUsername: string, yearMonth: string) {
  const row = await db
    .selectFrom('playgroundAiUsage')
    .select(['requestCount'])
    .where('githubUsername', '=', githubUsername)
    .where('yearMonth', '=', yearMonth)
    .executeTakeFirst()

  const usedDays = row?.requestCount ?? 0
  const remainingDays = Math.max(0, MONTHLY_DAYS_LIMIT - usedDays)

  return {
    used: usedDays,
    limit: MONTHLY_DAYS_LIMIT,
    remainingDays,
  }
}

/**
 * AI生成した日数分を記録する
 * @param aiDaysUsed 今回AIで生成した日数
 */
export async function recordAiUsage(
  githubUsername: string,
  yearMonth: string,
  aiDaysUsed: number,
  inputTokens: number,
  outputTokens: number,
) {
  await db
    .insertInto('playgroundAiUsage')
    .values({
      id: nanoid(),
      githubUsername,
      yearMonth,
      requestCount: aiDaysUsed,
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
    })
    .onConflict((oc) =>
      oc.columns(['githubUsername', 'yearMonth']).doUpdateSet((eb) => ({
        requestCount: eb('requestCount', '+', aiDaysUsed),
        totalInputTokens: eb('totalInputTokens', '+', inputTokens),
        totalOutputTokens: eb('totalOutputTokens', '+', outputTokens),
        updatedAt: new Date().toISOString(),
      })),
    )
    .execute()
}
