import { cac } from 'cac'
import 'dotenv/config'
import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { runCli } from './cli/run'
import { fetchMe, type MeResponse } from './services/cli-api'
import { cliLogin } from './services/cli-auth'
import { deleteConfig, loadConfig, saveConfig } from './services/cli-config'

function printOrganizations(organizations: MeResponse['organizations']): void {
  if (organizations.length === 0) {
    return
  }
  console.log('  所属組織:')
  for (const org of organizations) {
    console.log(`    - ${org.name} (${org.role})`)
  }
}

async function selectOrganization(
  organizations: MeResponse['organizations'],
  currentOrganizationId?: string,
): Promise<MeResponse['organizations'][number]> {
  if (organizations.length === 1) {
    const first = organizations[0]
    if (!first) {
      throw new Error('組織が見つかりませんでした。')
    }
    return first
  }

  if (currentOrganizationId) {
    const current = organizations.find(
      (org) => org.id === currentOrganizationId,
    )
    if (current) {
      return current
    }
  }

  console.log('利用する組織を選択してください:')
  organizations.forEach((org, index) => {
    console.log(`  ${index + 1}. ${org.name} (${org.role})`)
  })

  const rl = createInterface({ input, output })
  try {
    while (true) {
      const answer = await rl.question(
        `組織番号を入力 (1-${organizations.length}): `,
      )
      const selected = Number(answer)
      if (
        Number.isInteger(selected) &&
        selected >= 1 &&
        selected <= organizations.length
      ) {
        const organization = organizations[selected - 1]
        if (!organization) {
          continue
        }
        return organization
      }
      console.log('無効な入力です。番号で入力してください。')
    }
  } finally {
    rl.close()
  }
}

function main() {
  const cli = cac('invoiceai')

  cli
    .command('login', 'InvoiceAI にログイン')
    .option(
      '--server <url>',
      'サーバーURL (デフォルト: https://www.invoiceai.dev)',
    )
    .action(async (options: { server?: string | undefined }) => {
      await cliLogin(options.server)

      // ログイン確認
      try {
        const me = await fetchMe()
        console.log(`  ユーザー: ${me.user.name} (${me.user.email})`)
        printOrganizations(me.organizations)
      } catch {
        console.log('  ユーザー情報の取得に失敗しました')
      }
    })

  cli
    .command('setup', '初期設定 (未ログイン時は認証を含む)')
    .option(
      '--server <url>',
      'サーバーURL (デフォルト: https://www.invoiceai.dev)',
    )
    .option('--force', '組織選択をやり直す')
    .action(
      async (options: { server?: string | undefined; force?: boolean }) => {
        let config = loadConfig()
        if (!config) {
          await cliLogin(options.server)
          config = loadConfig()
          if (!config) {
            throw new Error('ログイン情報の保存に失敗しました。')
          }
        }

        const me = await fetchMe()
        if (me.organizations.length === 0) {
          console.log(
            '所属組織がありません。Webで組織を作成してから再実行してください。',
          )
          return
        }

        let selectedOrg: MeResponse['organizations'][number]
        if (!options.force && config.organizationId) {
          const existing = me.organizations.find(
            (org) => org.id === config.organizationId,
          )
          if (existing) {
            selectedOrg = existing
          } else {
            selectedOrg = await selectOrganization(me.organizations)
          }
        } else {
          selectedOrg = await selectOrganization(
            me.organizations,
            config.organizationId,
          )
        }

        saveConfig({
          ...config,
          organizationId: selectedOrg.id,
        })

        console.log('セットアップが完了しました')
        console.log(`  組織: ${selectedOrg.name}`)
        console.log('  次は `invoiceai month-close` を実行してください。')
      },
    )

  cli.command('whoami', 'ログイン中のユーザー情報を表示').action(async () => {
    const config = loadConfig()
    if (!config) {
      console.log(
        'ログインしていません。`invoiceai login` を実行してください。',
      )
      return
    }

    try {
      const me = await fetchMe()
      console.log(`ユーザー: ${me.user.name} (${me.user.email})`)
      console.log(`サーバー: ${config.serverUrl}`)
      if (config.organizationId) {
        const org = me.organizations.find((x) => x.id === config.organizationId)
        if (org) {
          console.log(`選択中の組織: ${org.name}`)
        } else {
          console.log('選択中の組織: 設定済みですが見つかりませんでした')
        }
      }
      if (me.organizations.length > 0) {
        console.log('所属組織:')
        for (const org of me.organizations) {
          console.log(`  - ${org.name} (${org.role})`)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(message)
    }
  })

  cli.command('logout', 'ログアウト').action(() => {
    const deleted = deleteConfig()
    if (deleted) {
      console.log('ログアウトしました')
    } else {
      console.log('ログイン情報がありません')
    }
  })

  cli.command('', 'ヘルプを表示').action(() => {
    cli.outputHelp()
  })

  cli.help()
  cli.parse()
}

runCli(main)
