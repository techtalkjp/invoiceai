import { cac } from 'cac'
import 'dotenv/config'
import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { runCli } from './cli/run'
import { fetchClients, fetchMe, type MeResponse } from './services/cli-api'
import { cliLogin } from './services/cli-auth'
import {
  deleteConfig,
  discoverGitRepos,
  loadConfig,
  saveConfig,
  type CliConfig,
  type RepoMapping,
} from './services/cli-config'

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

async function askQuestion(question: string): Promise<string> {
  const rl = createInterface({ input, output })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

function parseNumberList(inputValue: string, max: number): number[] | null {
  const trimmed = inputValue.trim()
  if (trimmed.length === 0) {
    return []
  }
  const values = trimmed.split(',').map((token) => Number(token.trim()))
  if (
    values.some((value) => !Number.isInteger(value) || value < 1 || value > max)
  ) {
    return null
  }
  return Array.from(new Set(values))
}

async function selectRepositories(
  repositories: string[],
  existingMappings: RepoMapping[],
  force?: boolean,
): Promise<RepoMapping[]> {
  if (repositories.length === 0) {
    return []
  }

  const preserved = new Map(
    existingMappings
      .filter((mapping) => !force)
      .map((mapping) => [mapping.path, mapping]),
  )

  const selectable = repositories.filter((path) => !preserved.has(path))
  const selected = new Set<string>(preserved.keys())

  if (selectable.length > 0) {
    console.log('\n検出されたリポジトリ:')
    selectable.forEach((repo, index) => {
      console.log(`  ${index + 1}. ${repo}`)
    })

    while (true) {
      const answer = await askQuestion(
        `対象repo番号をカンマ区切りで入力 (Enter=全選択, 0=スキップ): `,
      )
      if (answer === '0') {
        break
      }
      const numbers = parseNumberList(answer, selectable.length)
      if (!numbers) {
        console.log('無効な入力です。例: 1,3,5')
        continue
      }
      if (numbers.length === 0) {
        for (const repo of selectable) {
          selected.add(repo)
        }
      } else {
        for (const index of numbers) {
          const repo = selectable[index - 1]
          if (repo) {
            selected.add(repo)
          }
        }
      }
      break
    }
  }

  return Array.from(selected)
    .sort((a, b) => a.localeCompare(b))
    .map((path) => preserved.get(path) ?? { path, clientId: null })
}

async function assignClientsToRepositories(
  mappings: RepoMapping[],
  clients: Array<{ id: string; name: string }>,
  force?: boolean,
): Promise<RepoMapping[]> {
  const byPath = new Map(mappings.map((mapping) => [mapping.path, mapping]))
  const sortedPaths = Array.from(byPath.keys()).sort((a, b) =>
    a.localeCompare(b),
  )

  console.log('\nrepoとクライアントを紐づけます。')
  console.log('未分類にする場合は 0 を選択してください。')

  for (const path of sortedPaths) {
    const current = byPath.get(path)
    if (!current) {
      continue
    }

    if (!force && current.clientId) {
      continue
    }

    const currentClientName =
      clients.find((client) => client.id === current.clientId)?.name ?? '未分類'

    console.log(`\nrepo: ${path}`)
    console.log(`現在: ${currentClientName}`)
    console.log('  0. 未分類')
    clients.forEach((client, index) => {
      console.log(`  ${index + 1}. ${client.name}`)
    })

    while (true) {
      const answer = await askQuestion(`選択 (0-${clients.length}): `)
      const selected = Number(answer)
      if (
        !Number.isInteger(selected) ||
        selected < 0 ||
        selected > clients.length
      ) {
        console.log('無効な入力です。番号で入力してください。')
        continue
      }
      if (selected === 0) {
        current.clientId = null
      } else {
        const client = clients[selected - 1]
        current.clientId = client?.id ?? null
      }
      break
    }
  }

  return sortedPaths
    .map((path) => byPath.get(path))
    .filter((x): x is RepoMapping => Boolean(x))
}

async function runSetupFlow(
  config: CliConfig,
  options: { force?: boolean },
): Promise<void> {
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

  const clients = await fetchClients(selectedOrg.id)
  if (clients.length === 0) {
    if (selectedOrg.slug) {
      console.log(
        `クライアントが未登録です。先に ${config.serverUrl}/setup で初期設定を完了してください。`,
      )
    } else {
      console.log(
        'クライアントが未登録です。Webでクライアントを作成してから再実行してください。',
      )
    }
    saveConfig({
      ...config,
      organizationId: selectedOrg.id,
    })
    return
  }

  const discovered = discoverGitRepos(
    (config.repositories ?? []).map((x) => x.path),
  )
  const selectedMappings = await selectRepositories(
    discovered,
    config.repositories ?? [],
    options.force,
  )
  if (selectedMappings.length === 0) {
    saveConfig({
      ...config,
      organizationId: selectedOrg.id,
      repositories: [],
    })
    console.log('対象リポジトリが未設定のため、セットアップを終了しました。')
    return
  }

  const repositories = await assignClientsToRepositories(
    selectedMappings,
    clients,
    options.force,
  )

  saveConfig({
    ...config,
    organizationId: selectedOrg.id,
    repositories,
  })

  const mappedCount = repositories.filter((repo) => repo.clientId).length
  console.log('\nセットアップが完了しました')
  console.log(`  組織: ${selectedOrg.name}`)
  console.log(`  対象repo: ${repositories.length}`)
  console.log(`  紐づけ済み: ${mappedCount}`)
  if (mappedCount < repositories.length) {
    console.log(`  未分類: ${repositories.length - mappedCount}`)
  }
  console.log('  次は `invoiceai month-close` を実行してください。')
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

        await runSetupFlow(config, options.force ? { force: true } : {})
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
