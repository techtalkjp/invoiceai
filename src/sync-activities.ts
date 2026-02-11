import { cac } from 'cac'
import 'dotenv/config'
import { getActivitiesByMonth } from '~/lib/activity-sources/activity-queries.server'
import { runCli } from './cli/run'
import {
  syncAllGitHubActivities,
  syncUserGitHubActivities,
} from './services/activity-sync'

function getDateRange(monthArg?: string): {
  startDate: string
  endDate: string
} {
  if (monthArg) {
    const [yearStr, monthStr] = monthArg.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
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
    .option('--org <orgId>', '組織ID')
    .option('--user <userId>', 'ユーザーID')
    .option('--month <YYYY-MM>', '対象月 (省略時は過去7日間)')
    .action(
      async (options: { org?: string; user?: string; month?: string }) => {
        const { startDate, endDate } = getDateRange(options.month)
        console.log(`同期期間: ${startDate} ～ ${endDate}`)

        if (options.org && options.user) {
          const result = await syncUserGitHubActivities(
            options.org,
            options.user,
            startDate,
            endDate,
          )
          if (result.error) {
            console.error(`エラー: ${result.error}`)
          } else {
            console.log(`${result.inserted} 件のアクティビティを追加しました`)
          }
        } else {
          console.log('全ユーザーのアクティビティを同期中...')
          const results = await syncAllGitHubActivities(startDate, endDate)
          for (const r of results) {
            const status = r.error
              ? `エラー: ${r.error}`
              : `${r.inserted} 件追加`
            console.log(`  [${r.organizationId}/${r.userId}] ${status}`)
          }
          console.log(`合計: ${results.length} ユーザーを処理しました`)
        }
      },
    )

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
        const [yearStr, monthStr] = monthArg.split('-')
        const year = Number(yearStr)
        const month = Number(monthStr)

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
