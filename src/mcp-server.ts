import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import 'dotenv/config'
import { z } from 'zod'
import {
  getActivities,
  getActivitiesByMonth,
} from '~/lib/activity-sources/activity-queries.server'
import { db } from '~/lib/db/kysely'
import { saveEntries } from '~/routes/org.$orgSlug/work-hours/+mutations.server'
import {
  getMonthEntries,
  getMonthlySummary,
} from '~/routes/org.$orgSlug/work-hours/+queries.server'

type EntryInput = {
  clientId: string
  workDate: string
  startTime?: string
  endTime?: string
  breakMinutes?: number
  description?: string
}

/** undefinedフィールドを除外してEntryInput互換オブジェクトを作成 */
function toEntryInput(e: {
  clientId: string
  workDate: string
  startTime?: string | undefined
  endTime?: string | undefined
  breakMinutes?: number | undefined
  description?: string | undefined
}): EntryInput {
  const entry: EntryInput = { clientId: e.clientId, workDate: e.workDate }
  if (e.startTime !== undefined) entry.startTime = e.startTime
  if (e.endTime !== undefined) entry.endTime = e.endTime
  if (e.breakMinutes !== undefined) entry.breakMinutes = e.breakMinutes
  if (e.description !== undefined) entry.description = e.description
  return entry
}

function parseMonth(monthStr: string): { year: number; month: number } {
  const [y, m] = monthStr.split('-').map(Number)
  return { year: y ?? 0, month: m ?? 0 }
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function startMcpServer() {
  const server = new McpServer({
    name: 'invoiceai',
    version: '1.0.0',
  })

  // list_activities: 指定期間のアクティビティ一覧を取得
  server.tool(
    'list_activities',
    '指定期間のアクティビティ(GitHubコミット・PR等)一覧を取得。月単位またはカスタム日付範囲で指定可能',
    {
      organizationId: z.string().describe('組織ID'),
      userId: z.string().describe('ユーザーID'),
      month: z
        .string()
        .optional()
        .describe('対象月 (YYYY-MM形式)。省略時は今月'),
      startDate: z
        .string()
        .optional()
        .describe('開始日 (YYYY-MM-DD形式)。monthより優先'),
      endDate: z
        .string()
        .optional()
        .describe('終了日 (YYYY-MM-DD形式)。monthより優先'),
    },
    async ({ organizationId, userId, month, startDate, endDate }) => {
      const m = parseMonth(month ?? currentMonth())
      const activities =
        startDate && endDate
          ? await getActivities(organizationId, userId, startDate, endDate)
          : await getActivitiesByMonth(organizationId, userId, m.year, m.month)

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(activities, null, 2),
          },
        ],
      }
    },
  )

  // list_clients: クライアント一覧を取得
  server.tool(
    'list_clients',
    'クライアント一覧を取得。時間制（time）のアクティブなクライアントを返す',
    {
      organizationId: z.string().describe('組織ID'),
    },
    async ({ organizationId }) => {
      const clients = await db
        .selectFrom('client')
        .select(['id', 'name', 'billingType', 'hourlyRate', 'isActive'])
        .where('organizationId', '=', organizationId)
        .where('isActive', '=', 1)
        .where('billingType', '=', 'time')
        .orderBy('name', 'asc')
        .execute()

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(clients, null, 2),
          },
        ],
      }
    },
  )

  // list_work_entries: 既存のタイムシートエントリ一覧を取得
  server.tool(
    'list_work_entries',
    '指定月のタイムシートエントリをクライアントごとに取得',
    {
      organizationId: z.string().describe('組織ID'),
      userId: z.string().describe('ユーザーID'),
      month: z
        .string()
        .optional()
        .describe('対象月 (YYYY-MM形式)。省略時は今月'),
    },
    async ({ organizationId, userId, month }) => {
      const m = parseMonth(month ?? currentMonth())
      const entries = await getMonthEntries(
        organizationId,
        userId,
        m.year,
        m.month,
      )

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(entries, null, 2),
          },
        ],
      }
    },
  )

  // save_work_entry: 1日分のタイムシートエントリを保存
  server.tool(
    'save_work_entry',
    'タイムシートに1日分のエントリを保存（既存エントリがあればupsert）',
    {
      organizationId: z.string().describe('組織ID'),
      userId: z.string().describe('ユーザーID'),
      clientId: z.string().describe('クライアントID'),
      workDate: z.string().describe('稼働日 (YYYY-MM-DD形式)'),
      startTime: z
        .string()
        .optional()
        .describe('開始時刻 (HH:MM形式、24時間表記)'),
      endTime: z
        .string()
        .optional()
        .describe('終了時刻 (HH:MM形式、24時間表記)'),
      breakMinutes: z
        .number()
        .optional()
        .describe('休憩時間（分単位）。省略時は0'),
      description: z.string().optional().describe('作業内容の説明'),
    },
    async ({
      organizationId,
      userId,
      clientId,
      workDate,
      startTime,
      endTime,
      breakMinutes,
      description,
    }) => {
      const entry = toEntryInput({
        clientId,
        workDate,
        startTime,
        endTime,
        breakMinutes,
        description,
      })
      const result = await saveEntries(organizationId, userId, [entry])

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              ...result,
            }),
          },
        ],
      }
    },
  )

  // save_work_entries: 複数日分を一括保存
  server.tool(
    'save_work_entries',
    'タイムシートに複数日分のエントリを一括保存。同一クライアントの複数日分をまとめて登録する場合に使用',
    {
      organizationId: z.string().describe('組織ID'),
      userId: z.string().describe('ユーザーID'),
      entries: z
        .array(
          z.object({
            clientId: z.string().describe('クライアントID'),
            workDate: z.string().describe('稼働日 (YYYY-MM-DD形式)'),
            startTime: z.string().optional().describe('開始時刻 (HH:MM)'),
            endTime: z.string().optional().describe('終了時刻 (HH:MM)'),
            breakMinutes: z.number().optional().describe('休憩時間（分）'),
            description: z.string().optional().describe('作業内容'),
          }),
        )
        .describe('保存するエントリの配列'),
    },
    async ({ organizationId, userId, entries }) => {
      const result = await saveEntries(
        organizationId,
        userId,
        entries.map(toEntryInput),
      )

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              ...result,
            }),
          },
        ],
      }
    },
  )

  // get_monthly_summary: 月次サマリー
  server.tool(
    'get_monthly_summary',
    '月次の稼働サマリーを取得。クライアント別の合計稼働時間を返す',
    {
      organizationId: z.string().describe('組織ID'),
      userId: z.string().describe('ユーザーID'),
      month: z
        .string()
        .optional()
        .describe('対象月 (YYYY-MM形式)。省略時は今月'),
    },
    async ({ organizationId, userId, month }) => {
      const m = parseMonth(month ?? currentMonth())
      const summary = await getMonthlySummary(
        organizationId,
        userId,
        m.year,
        m.month,
      )

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(summary, null, 2),
          },
        ],
      }
    },
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
