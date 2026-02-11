import { nanoid } from 'nanoid'
import { db } from '~/lib/db/kysely'

const MONTHLY_LIMIT = 5

export async function checkAiUsage(githubUsername: string, yearMonth: string) {
  const row = await db
    .selectFrom('playgroundAiUsage')
    .select(['requestCount'])
    .where('githubUsername', '=', githubUsername)
    .where('yearMonth', '=', yearMonth)
    .executeTakeFirst()

  return {
    used: row?.requestCount ?? 0,
    limit: MONTHLY_LIMIT,
    allowed: (row?.requestCount ?? 0) < MONTHLY_LIMIT,
  }
}

export async function recordAiUsage(
  githubUsername: string,
  yearMonth: string,
  inputTokens: number,
  outputTokens: number,
) {
  await db
    .insertInto('playgroundAiUsage')
    .values({
      id: nanoid(),
      githubUsername,
      yearMonth,
      requestCount: 1,
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
    })
    .onConflict((oc) =>
      oc.columns(['githubUsername', 'yearMonth']).doUpdateSet((eb) => ({
        requestCount: eb('requestCount', '+', 1),
        totalInputTokens: eb('totalInputTokens', '+', inputTokens),
        totalOutputTokens: eb('totalOutputTokens', '+', outputTokens),
        updatedAt: new Date().toISOString(),
      })),
    )
    .execute()
}
