import { cac } from 'cac'
import 'dotenv/config'
import { getActivitiesByMonth } from '~/lib/activity-sources/activity-queries.server'
import { runCli } from './cli/run'
import {
  syncAllGitHubActivities,
  syncOrgGitHubActivities,
} from './services/activity-sync'

function getDateRange(monthArg?: string): {
  startDate: string
  endDate: string
} {
  if (monthArg) {
    if (!/^\d{4}-\d{1,2}$/.test(monthArg)) {
      throw new Error(
        `無効な月指定です: ${monthArg} (YYYY-MM 形式で指定してください)`,
      )
    }
    const [yearStr, monthStr] = monthArg.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    if (month < 1 || month > 12) {
      throw new Error(
        `無効な月指定です: ${monthArg} (月は1〜12で指定してください)`,
      )
    }
    const lastDay = new Date(year, month, 0).getDate()
    return {
      startDate: `${year}-${String(month).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    }
  }
  // デフォルト: 過去7日間
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { startDate: fmt(start), endDate: fmt(end) }
}

function main() {
  const cli = cac('invoiceai')

  cli
    .command('sync', 'GitHubアクティビティを同期')
    .option('--org <orgId>', '組織ID (省略時は全組織)')
    .option('--month <YYYY-MM>', '対象月 (省略時は過去7日間)')
    .action(async (options: { org?: string; month?: string }) => {
      const { startDate, endDate } = getDateRange(options.month)
      console.log(`同期期間: ${startDate} ～ ${endDate}`)

      if (options.org) {
        const results = await syncOrgGitHubActivities(
          options.org,
          startDate,
          endDate,
        )
        for (const r of results) {
          const status = r.error ? `エラー: ${r.error}` : `${r.inserted} 件追加`
          console.log(`  [${r.userId}] ${status}`)
        }
      } else {
        console.log('全組織のアクティビティを同期中...')
        const results = await syncAllGitHubActivities(startDate, endDate)
        for (const r of results) {
          const status = r.error ? `エラー: ${r.error}` : `${r.inserted} 件追加`
          console.log(`  [${r.organizationId}/${r.userId}] ${status}`)
        }
        console.log(`合計: ${results.length} ユーザーを処理しました`)
      }
    })

  cli
    .command('activities', 'アクティビティ一覧を表示')
    .option('--org <orgId>', '組織ID (必須)')
    .option('--user <userId>', 'ユーザーID (必須)')
    .option('--month <YYYY-MM>', '対象月 (省略時は今月)')
    .action(
      async (options: { org?: string; user?: string; month?: string }) => {
        if (!options.org || !options.user) {
          console.error('--org と --user は必須です')
          process.exitCode = 1
          return
        }

        const now = new Date()
        const monthArg =
          options.month ??
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        if (!/^\d{4}-\d{1,2}$/.test(monthArg)) {
          console.error(
            `無効な月指定です: ${monthArg} (YYYY-MM 形式で指定してください)`,
          )
          process.exitCode = 1
          return
        }
        const [yearStr, monthStr] = monthArg.split('-')
        const year = Number(yearStr)
        const month = Number(monthStr)
        if (month < 1 || month > 12) {
          console.error(
            `無効な月指定です: ${monthArg} (月は1〜12で指定してください)`,
          )
          process.exitCode = 1
          return
        }

        const activities = await getActivitiesByMonth(
          options.org,
          options.user,
          year,
          month,
        )

        if (activities.length === 0) {
          console.log(`${year}年${month}月のアクティビティはありません`)
          return
        }

        console.log(
          `=== ${year}年${month}月のアクティビティ (${activities.length}件) ===\n`,
        )

        let currentDate = ''
        for (const a of activities) {
          if (a.eventDate !== currentDate) {
            currentDate = a.eventDate
            console.log(`\n📅 ${currentDate}`)
          }
          const repo = a.repo ? ` [${a.repo}]` : ''
          const title = a.title ? ` ${a.title}` : ''
          console.log(`  ${a.eventType}${repo}${title}`)
        }
      },
    )

  cli.command('mcp', 'MCPサーバーとして起動 (stdio)').action(async () => {
    // MCPサーバーは別モジュールで起動
    const { startMcpServer } = await import('./mcp-server')
    await startMcpServer()
  })

  cli.command('', 'ヘルプを表示').action(() => {
    cli.outputHelp()
  })

  cli.help()
  cli.parse()
}

runCli(main)
