import { cac } from 'cac'
import 'dotenv/config'
import { runCli } from './cli/run'
import { clients } from './clients'

function main() {
  const cli = cac('invoice')

  cli.command('list', 'クライアント一覧を表示').action(() => {
    console.log('=== タイムチャージ型クライアント一覧 ===\n')
    for (const c of clients) {
      console.log(`${c.id}`)
      console.log(`  名前: ${c.name}`)
      console.log(`  freee: ${c.freeePartnerName}`)
      console.log(`  単価: ¥${c.hourlyRate.toLocaleString()}/時`)
      console.log('')
    }
  })

  cli.command('', 'ヘルプを表示').action(() => {
    console.log(`請求書作成 CLI

Usage:
  pnpm invoice <command>

Commands:
  list                          クライアント一覧を表示

Note:
  請求書の作成・稼働時間の確認はWebアプリから行ってください。
  pnpm dev でアプリを起動し、ブラウザからアクセスしてください。
`)
  })

  cli.parse()
}

runCli(main)
