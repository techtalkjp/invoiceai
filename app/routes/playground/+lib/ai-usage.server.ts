import { nanoid } from 'nanoid'
import { db } from '~/lib/db/kysely'

/** 月あたりAI生成できる回数の上限 */
const MONTHLY_LIMIT = 30

export async function checkAiUsage(userId: string, yearMonth: string) {
  // recordAiUsage と同一トランザクションではないため、
  // 同時リクエストで上限を超える可能性がある（TOCTOU）。
  // recordAiUsage 側の INSERT ... ON CONFLICT で加算するため、
  // 最悪でも 2 倍程度の超過で済む（Playground の制限なので許容）。
  const row = await db
    .selectFrom('playgroundAiUsage')
    .select(['requestCount'])
    .where('userId', '=', userId)
    .where('yearMonth', '=', yearMonth)
    .executeTakeFirst()

  const used = row?.requestCount ?? 0
  const remaining = Math.max(0, MONTHLY_LIMIT - used)

  return {
    used,
    limit: MONTHLY_LIMIT,
    remaining,
  }
}

/**
 * AI利用回数を記録する
 * @param count 今回の利用回数
 * @param githubUsername GitHub連携済みの場合に記録（オプショナル）
 */
export async function recordAiUsage(
  userId: string,
  yearMonth: string,
  count: number,
  inputTokens: number,
  outputTokens: number,
  githubUsername?: string | undefined,
) {
  await db
    .insertInto('playgroundAiUsage')
    .values({
      id: nanoid(),
      userId,
      githubUsername: githubUsername ?? null,
      yearMonth,
      requestCount: count,
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
    })
    .onConflict((oc) =>
      oc.columns(['userId', 'yearMonth']).doUpdateSet((eb) => ({
        requestCount: eb('requestCount', '+', count),
        totalInputTokens: eb('totalInputTokens', '+', inputTokens),
        totalOutputTokens: eb('totalOutputTokens', '+', outputTokens),
        // GitHub連携後に更新されたら username も記録
        ...(githubUsername ? { githubUsername } : {}),
        updatedAt: new Date().toISOString(),
      })),
    )
    .execute()
}
