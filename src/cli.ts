import { cac } from 'cac'
import 'dotenv/config'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { runCli } from './cli/run'
import { fetchClients, fetchMe, type MeResponse } from './services/cli-api'
import { cliLogin } from './services/cli-auth'
import {
  deleteConfig,
  discoverGitRepos,
  loadConfig,
  pickActiveRepositories,
  resolveRepoRoots,
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

function parseRootOption(value?: string): string[] {
  if (!value) {
    return []
  }
  return value
    .split(',')
    .map((path) => path.trim())
    .filter((path) => path.length > 0)
}

function parseDetectOption(value?: string): boolean | undefined {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'on') {
    return true
  }
  if (normalized === 'off') {
    return false
  }
  throw new Error('--repo-detect は on または off を指定してください。')
}

async function askYesNo(question: string, defaultYes = true): Promise<boolean> {
  const answer = (await askQuestion(question)).toLowerCase()
  if (answer.length === 0) {
    return defaultYes
  }
  if (['y', 'yes'].includes(answer)) {
    return true
  }
  if (['n', 'no'].includes(answer)) {
    return false
  }
  return defaultYes
}

async function askChoice(
  question: string,
  choices: string[],
  defaultChoice: string,
): Promise<string> {
  while (true) {
    const answer = (await askQuestion(question)).trim()
    if (answer.length === 0) {
      return defaultChoice
    }
    if (choices.includes(answer)) {
      return answer
    }
    console.log(`無効な入力です。選択肢: ${choices.join(', ')}`)
  }
}

function compactPath(path: string): string {
  const home = process.env.HOME
  if (home && path.startsWith(home)) {
    return `~${path.slice(home.length)}`
  }
  return path
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/株式会社|有限会社|合同会社|inc\.?|llc|co\.?,?\s*ltd\.?/g, '')
    .replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '')
}

function inferClientIdFromRepoPath(
  repoPath: string,
  clients: Array<{ id: string; name: string }>,
): string | null {
  const normalizedPath = normalizeForMatch(repoPath)
  let winner: { id: string; score: number } | null = null

  for (const client of clients) {
    const key = normalizeForMatch(client.name)
    if (key.length < 2) {
      continue
    }
    if (!normalizedPath.includes(key)) {
      continue
    }
    const score = key.length
    if (!winner || score > winner.score) {
      winner = { id: client.id, score }
    }
  }

  return winner?.id ?? null
}

function filterByKeyword(paths: string[], keyword: string): string[] {
  const lower = keyword.toLowerCase()
  return paths.filter((path) => path.toLowerCase().includes(lower))
}

function countNewRepositories(
  discovered: string[],
  existingMappings: RepoMapping[],
): number {
  const existing = new Set(existingMappings.map((mapping) => mapping.path))
  return discovered.filter((path) => !existing.has(path)).length
}

function printSetupOverview(params: {
  repoDetectEnabled: boolean
  roots: string[]
  existingCount: number
  discoveredCount: number
  newCount: number
  recommendedCount: number
}): void {
  const settingsPath = join(homedir(), '.config', 'invoiceai', 'settings.json')
  const credentialsPath = join(
    homedir(),
    '.config',
    'invoiceai',
    'credentials.json',
  )

  console.log('\n=== Setup Overview ===')
  console.log(`repo自動検出: ${params.repoDetectEnabled ? 'on' : 'off'}`)
  console.log(
    `既存設定repo: ${params.existingCount} / 新規検出repo: ${params.newCount} / 検出合計: ${params.discoveredCount}`,
  )
  console.log(
    `おすすめ候補: ${params.recommendedCount}件 (抽出ルール: 直近30日 / 最大40件)`,
  )
  console.log('保存先:')
  console.log(`  - setup設定: ${settingsPath}`)
  console.log(`  - 認証情報: ${credentialsPath}`)
  if (params.repoDetectEnabled) {
    console.log('探索ルート:')
    for (const root of params.roots) {
      console.log(`  - ${root}`)
    }
  }
}

function printUpdatedFiles(paths: string[]): void {
  if (paths.length === 0) {
    return
  }
  console.log('  更新ファイル:')
  for (const path of paths) {
    console.log(`    - ${path}`)
  }
}

function printMappingOverview(
  mappings: RepoMapping[],
  clients: Array<{ id: string; name: string }>,
): void {
  const mapped = mappings.filter((mapping) => mapping.clientId).length
  const unmapped = mappings.length - mapped
  console.log('\n=== Mapping Overview ===')
  console.log(`対象repo: ${mappings.length}`)
  console.log(`既存で紐づけ済み: ${mapped}`)
  console.log(`未紐づけ: ${unmapped}`)

  if (unmapped > 0) {
    if (clients.length === 1) {
      const client = clients[0]
      if (client) {
        console.log(
          `自動紐づけ予定: ${unmapped}件 (クライアントが1件: ${client.name})`,
        )
      }
    } else {
      let inferredPreviewCount = 0
      for (const mapping of mappings) {
        if (mapping.clientId) continue
        if (inferClientIdFromRepoPath(mapping.path, clients)) {
          inferredPreviewCount += 1
        }
      }
      console.log(`自動推定で紐づけ可能: ${inferredPreviewCount}件`)
      console.log(`手動確認が必要: ${unmapped - inferredPreviewCount}件`)
    }
  }
}

async function pickRepositoriesBySearch(
  selectable: string[],
  selected: Set<string>,
): Promise<void> {
  while (true) {
    const keyword = await askQuestion(
      '\n追加したいrepoのキーワードを入力 (Enter=終了): ',
    )
    if (!keyword) {
      return
    }

    const candidates = filterByKeyword(
      selectable.filter((path) => !selected.has(path)),
      keyword,
    ).slice(0, 20)

    if (candidates.length === 0) {
      console.log('一致するrepoが見つかりませんでした。')
      continue
    }

    console.log(`候補 (${candidates.length}件 / 最大20件表示):`)
    candidates.forEach((repo, index) => {
      console.log(`  ${index + 1}. ${compactPath(repo)}`)
    })

    while (true) {
      const answer = await askQuestion(
        '追加する番号を入力 (カンマ区切り, Enter=この検索をスキップ): ',
      )
      if (!answer) {
        break
      }
      const numbers = parseNumberList(answer, candidates.length)
      if (!numbers) {
        console.log('無効な入力です。例: 1,3,5')
        continue
      }
      for (const index of numbers) {
        const repo = candidates[index - 1]
        if (repo) {
          selected.add(repo)
        }
      }
      console.log(`${numbers.length}件を追加しました。`)
      break
    }
  }
}

async function selectRepositories(
  repositories: string[],
  existingMappings: RepoMapping[],
  recommendedRepositories: string[],
  force?: boolean,
): Promise<RepoMapping[]> {
  if (repositories.length === 0) {
    return []
  }

  const preserved = new Map(
    existingMappings
      .filter(() => !force)
      .map((mapping) => [mapping.path, mapping]),
  )

  const selectable = repositories.filter((path) => !preserved.has(path))
  const selected = new Set<string>(preserved.keys())
  const recommended = recommendedRepositories.filter((path) =>
    selectable.includes(path),
  )
  const allowNewSelection = selected.size === 0

  if (!force && selected.size > 0 && selectable.length > 0) {
    const shouldAddNew = await askYesNo(
      `\n新しく検出されたrepoが ${selectable.length} 件あります。既存設定に追加しますか？ (y/N): `,
      false,
    )
    if (!shouldAddNew) {
      return Array.from(selected)
        .sort((a, b) => a.localeCompare(b))
        .map((path) => preserved.get(path) ?? { path, clientId: null })
    }
    for (const path of selectable) {
      selected.add(path)
    }
    console.log(`${selectable.length}件を既存設定に追加しました。`)
    return Array.from(selected)
      .sort((a, b) => a.localeCompare(b))
      .map((path) => preserved.get(path) ?? { path, clientId: null })
  }

  if (allowNewSelection && recommended.length > 0) {
    const autoSuggested = recommended.filter((path) => !selected.has(path))
    for (const path of autoSuggested) {
      selected.add(path)
    }
    console.log('\n最近活動のあるrepoを追加候補として選択しました:')
    for (const repo of autoSuggested.slice(0, 20)) {
      console.log(`  + ${compactPath(repo)}`)
    }
    if (autoSuggested.length > 20) {
      console.log(`  ... 他 ${autoSuggested.length - 20} 件`)
    }
    if (
      await askYesNo(
        'このまま進めますか？ (Enter=Yes, n=手動で選び直す): ',
        true,
      )
    ) {
      return Array.from(selected)
        .sort((a, b) => a.localeCompare(b))
        .map((path) => preserved.get(path) ?? { path, clientId: null })
    }
    for (const path of autoSuggested) {
      selected.delete(path)
    }
  }

  if (allowNewSelection && selectable.length > 0) {
    console.log('\nrepo追加方法を選択してください:')
    console.log('  1. 最近活動のあるrepoのみ追加 (推奨)')
    console.log('  2. 検出されたrepoを全件追加')
    console.log('  3. キーワード検索しながら追加')
    console.log('  0. スキップ')

    const choice = await askChoice(
      '選択 (0-3, Enter=1): ',
      ['0', '1', '2', '3'],
      '1',
    )
    if (choice === '0') {
      return Array.from(selected)
        .sort((a, b) => a.localeCompare(b))
        .map((path) => preserved.get(path) ?? { path, clientId: null })
    }
    if (choice === '1') {
      const targets = recommended.filter((path) => !selected.has(path))
      for (const path of targets) {
        selected.add(path)
      }
      console.log(`${targets.length}件を追加しました。`)
    } else if (choice === '2') {
      const targets = selectable.filter((path) => !selected.has(path))
      for (const path of targets) {
        selected.add(path)
      }
      console.log(`${targets.length}件を追加しました。`)
    } else {
      await pickRepositoriesBySearch(selectable, selected)
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

  if (clients.length === 1) {
    const onlyClient = clients[0]
    if (onlyClient) {
      let autoAssignedCount = 0
      for (const path of sortedPaths) {
        const current = byPath.get(path)
        if (!current) continue
        if (!force && current.clientId) continue
        current.clientId = onlyClient.id
        autoAssignedCount += 1
      }
      if (autoAssignedCount > 0) {
        console.log(
          `クライアントが1件のため、${autoAssignedCount}件を自動で「${onlyClient.name}」に紐づけました。`,
        )
      }
      return sortedPaths
        .map((path) => byPath.get(path))
        .filter((x): x is RepoMapping => Boolean(x))
    }
  }

  let inferredCount = 0
  for (const path of sortedPaths) {
    const current = byPath.get(path)
    if (!current) continue
    if (!force && current.clientId) continue
    const inferred = inferClientIdFromRepoPath(path, clients)
    if (inferred) {
      current.clientId = inferred
      inferredCount += 1
    }
  }

  if (inferredCount > 0) {
    console.log(`自動推定で ${inferredCount} 件をクライアント紐づけしました。`)
  }

  const unresolved = sortedPaths.filter((path) => {
    const current = byPath.get(path)
    if (!current) return false
    return !current.clientId
  })

  if (unresolved.length > 0) {
    const skipUnresolved = await askYesNo(
      `未確定が ${unresolved.length} 件あります。未分類のまま進めますか？ (Enter=Yes, n=個別指定): `,
      true,
    )
    if (skipUnresolved) {
      return sortedPaths
        .map((path) => byPath.get(path))
        .filter((x): x is RepoMapping => Boolean(x))
    }
  }

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
  options: {
    force?: boolean
    roots?: string[]
    repoDetectEnabled?: boolean
  },
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

  const repoDetectEnabled =
    options.repoDetectEnabled ?? config.repoDetectEnabled ?? true
  const resolvedRoots = resolveRepoRoots(
    config.repoRoots ?? [],
    options.roots ?? [],
  )

  let discovered: string[] = []
  let recommended: string[] = []

  if (repoDetectEnabled) {
    if (resolvedRoots.length === 0) {
      console.log(
        'repo探索先が見つかりません。`invoiceai setup --roots "/path/to/work,/path/to/src"` を指定してください。',
      )
      return
    }

    discovered = discoverGitRepos(
      (config.repositories ?? []).map((x) => x.path),
      resolvedRoots,
    )
    recommended = pickActiveRepositories(discovered, { days: 30, max: 40 })
  } else {
    discovered = (config.repositories ?? []).map((repo) => repo.path)
    if (discovered.length === 0) {
      console.log(
        'repo自動検出がoffで、既存repo設定がありません。`invoiceai setup --repo-detect on` で検出を有効化してください。',
      )
      return
    }
    console.log('\nrepo自動検出はoffです。既存のrepo設定のみを使用します。')
  }

  const existingRepoCount = (config.repositories ?? []).length
  const newRepoCount = countNewRepositories(
    discovered,
    config.repositories ?? [],
  )
  printSetupOverview({
    repoDetectEnabled,
    roots: resolvedRoots,
    existingCount: existingRepoCount,
    discoveredCount: discovered.length,
    newCount: newRepoCount,
    recommendedCount: recommended.length,
  })

  const selectedMappings = await selectRepositories(
    discovered,
    config.repositories ?? [],
    recommended,
    options.force,
  )
  if (selectedMappings.length === 0) {
    saveConfig({
      ...config,
      organizationId: selectedOrg.id,
      repoRoots: resolvedRoots,
      repoDetectEnabled,
      repositories: [],
    })
    console.log('対象リポジトリが未設定のため、セットアップを終了しました。')
    return
  }

  printMappingOverview(selectedMappings, clients)

  const repositories = await assignClientsToRepositories(
    selectedMappings,
    clients,
    options.force,
  )

  saveConfig({
    ...config,
    organizationId: selectedOrg.id,
    repoRoots: resolvedRoots,
    repoDetectEnabled,
    repositories,
  })

  const mappedCount = repositories.filter((repo) => repo.clientId).length
  const previousRepoCount = (config.repositories ?? []).length
  const finalRepoCount = repositories.length
  const changedCount = Math.abs(finalRepoCount - previousRepoCount)
  console.log('\nセットアップが完了しました')
  console.log(`  組織: ${selectedOrg.name}`)
  console.log(`  対象repo: ${finalRepoCount}`)
  console.log(`  変更件数: ${changedCount}`)
  console.log(`  紐づけ済み: ${mappedCount}`)
  if (mappedCount < finalRepoCount) {
    console.log(`  未分類: ${finalRepoCount - mappedCount}`)
  }
  printUpdatedFiles([join(homedir(), '.config', 'invoiceai', 'settings.json')])
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
    .option('--reset', '保存済みのsetup設定を初期化してやりなおす')
    .option('--roots <paths>', 'repo探索ルートをカンマ区切りで指定')
    .option('--repo-detect <on|off>', 'repo自動検出の有効/無効')
    .action(
      async (options: {
        server?: string | undefined
        force?: boolean
        reset?: boolean
        roots?: string | undefined
        repoDetect?: string | undefined
      }) => {
        let config = loadConfig()
        if (!config) {
          await cliLogin(options.server)
          config = loadConfig()
          if (!config) {
            throw new Error('ログイン情報の保存に失敗しました。')
          }
        }

        if (options.reset) {
          config = {
            token: config.token,
            serverUrl: config.serverUrl,
          }
          saveConfig(config)
          const settingsPath = join(
            homedir(),
            '.config',
            'invoiceai',
            'settings.json',
          )
          console.log(
            '保存済みのsetup設定を初期化しました（ログイン状態は維持されます）。',
          )
          console.log(`初期化対象: ${settingsPath}`)
        }

        const repoDetectEnabled = parseDetectOption(options.repoDetect)

        await runSetupFlow(config, {
          force: Boolean(options.force || options.reset),
          roots: parseRootOption(options.roots),
          ...(repoDetectEnabled === undefined ? {} : { repoDetectEnabled }),
        })
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
