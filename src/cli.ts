import { defineCommand, runMain } from 'citty'
import 'dotenv/config'
import {
  AuthError,
  completeSetup,
  createClient,
  createOrg,
  fetchClients,
  fetchMe,
  syncActivities,
  type CliClient,
  type MeResponse,
} from './services/cli-api'
import { cliLogin } from './services/cli-auth'
import {
  deleteConfig,
  getRepoConfig,
  loadConfig,
  saveRepoConfig,
  updateSyncState,
} from './services/cli-config'
import { checkGhAuth, type GhAuthStatus } from './services/cli-gh'
import { detectGitRepo } from './services/cli-git'
import {
  askClientName,
  askQuestion,
  askYesNo,
  selectFromList,
} from './services/cli-prompts'
import { collectActivities, printSyncSummary } from './services/cli-sync'

const DEFAULT_SERVER_URL =
  process.env.INVOICEAI_SERVER_URL ?? 'https://www.invoiceai.dev'

// ─── ログインフロー ───

async function loginFlow(): Promise<void> {
  console.log('InvoiceAI にログインします...\n')
  await cliLogin(DEFAULT_SERVER_URL)
}

// ─── セットアップフロー ───

async function setupFlow(): Promise<void> {
  // 1. リポジトリ検出
  const gitRepo = detectGitRepo()
  if (!gitRepo) {
    console.error(
      'Git リポジトリが見つかりません。Git リポジトリのルートで実行してください。',
    )
    process.exitCode = 1
    return
  }
  console.log(`リポジトリ: ${gitRepo.rootPath}`)
  if (gitRepo.remoteUrl) {
    console.log(`リモート: ${gitRepo.remoteUrl}`)
  }

  // 2. gh CLI チェック
  const ghStatus = checkGhAuth()
  if (ghStatus.authenticated) {
    console.log(`gh CLI: 認証済み (${ghStatus.username})`)
  } else {
    console.log('gh CLI: 未認証（コミットのみ同期します）')
  }

  // 3. ユーザー情報取得 → 組織選択 or 作成
  const me = await fetchMeWithReauth()
  console.log(`\nログインユーザー: ${me.user.name} (${me.user.email})`)

  const org = await selectOrCreateOrg(me)

  // 4. クライアント選択 or 作成
  const client = await selectOrCreateClient(org.id)
  console.log(`クライアント: ${client.name}`)

  // 5. 設定保存
  saveRepoConfig(gitRepo.rootPath, {
    orgSlug: org.slug,
    clientId: client.id,
    remoteUrl: gitRepo.remoteUrl,
    lastSyncCommit: null,
    lastSyncedAt: null,
  })
  console.log('\nリポジトリ設定を保存しました。')

  // 6. 初回同期
  console.log('\n初回同期を実行します...')
  await runSync(gitRepo.rootPath, ghStatus)

  // 7. Web 側の setup 完了をマーク
  await completeSetup(org.id)
}

// ─── 同期フロー ───

async function syncFlow(): Promise<void> {
  const gitRepo = detectGitRepo()
  if (!gitRepo) {
    console.error('Git リポジトリが見つかりません。')
    process.exitCode = 1
    return
  }

  const repoConfig = getRepoConfig(gitRepo.rootPath)
  if (!repoConfig) {
    console.log(
      'このリポジトリはまだ設定されていません。セットアップを開始します...\n',
    )
    await setupFlow()
    return
  }

  const ghStatus = checkGhAuth()
  await runSync(gitRepo.rootPath, ghStatus)
}

async function runSync(
  repoPath: string,
  ghStatus: GhAuthStatus,
): Promise<void> {
  const repoConfig = getRepoConfig(repoPath)
  if (!repoConfig) {
    throw new Error('リポジトリ設定が見つかりません。')
  }

  const activities = collectActivities(repoPath, repoConfig, ghStatus)
  if (activities.length === 0) {
    console.log('新しいアクティビティはありません。')
    return
  }

  console.log(`${activities.length} 件のアクティビティを送信中...`)

  let response: Awaited<ReturnType<typeof syncActivities>>
  try {
    response = await syncActivities({
      orgSlug: repoConfig.orgSlug,
      clientId: repoConfig.clientId,
      remoteUrl: repoConfig.remoteUrl,
      activities,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      console.log('\nセッションが切れています。再ログインします...')
      await loginFlow()
      response = await syncActivities({
        orgSlug: repoConfig.orgSlug,
        clientId: repoConfig.clientId,
        remoteUrl: repoConfig.remoteUrl,
        activities,
      })
    } else if (err instanceof Error && err.message.includes('404')) {
      console.error(
        '組織またはクライアントが見つかりません。\n`invoiceai logout` で設定を削除し、再セットアップしてください。',
      )
      process.exitCode = 1
      return
    } else {
      throw err
    }
  }

  // 最新のコミットハッシュで sync 状態を更新
  const latestCommit = activities.find((a) => a.eventType === 'commit')
  if (latestCommit && latestCommit.eventType === 'commit') {
    updateSyncState(
      repoPath,
      latestCommit.metadata.oid,
      new Date().toISOString(),
    )
  }

  printSyncSummary(response)
}

// ─── ヘルパー ───

async function fetchMeWithReauth(): Promise<MeResponse> {
  try {
    return await fetchMe()
  } catch (err) {
    if (err instanceof AuthError) {
      console.log('\nセッションが切れています。再ログインします...')
      await loginFlow()
      return await fetchMe()
    }
    throw err
  }
}

async function selectOrCreateOrg(
  me: MeResponse,
): Promise<{ id: string; name: string; slug: string }> {
  const orgs = me.organizations.filter((o) => o.slug !== null) as Array<{
    id: string
    name: string
    slug: string
    role: string
  }>

  if (orgs.length === 1) {
    const org = orgs[0]
    if (org) {
      console.log(`組織: ${org.name}（自動選択）`)
      return { id: org.id, name: org.name, slug: org.slug }
    }
  }

  if (orgs.length > 1) {
    const selected = await selectFromList(orgs, '組織')
    console.log(`組織: ${selected.name}`)
    return { id: selected.id, name: selected.name, slug: selected.slug }
  }

  // 組織がない場合は新規作成
  console.log('\n組織が見つかりません。新しい組織を作成します。')
  const name = await askQuestion('組織名を入力してください: ')
  if (!name) {
    throw new Error('組織名が空です。')
  }
  return await createOrg(name)
}

async function selectOrCreateClient(
  organizationId: string,
): Promise<CliClient> {
  const clients = await fetchClients(organizationId)

  if (clients.length > 0) {
    console.log('\n既存のクライアントを使用しますか？')
    const useExisting = await askYesNo('既存のクライアントから選択')

    if (useExisting) {
      return await selectFromList(clients, 'クライアント')
    }
  }

  // 新規作成
  const name = await askClientName()
  return await createClient(organizationId, name)
}

// ─── 状態判定 ───

async function autoRun(): Promise<void> {
  const config = loadConfig()

  // 1. config なし or auth なし → ログイン
  if (!config?.auth?.token) {
    await loginFlow()
    await setupFlow()
    return
  }

  // 2. カレントディレクトリの git repo チェック
  const gitRepo = detectGitRepo()
  if (!gitRepo) {
    console.log(
      'Git リポジトリが見つかりません。Git リポジトリのルートで実行してください。',
    )
    process.exitCode = 1
    return
  }

  const repoConfig = getRepoConfig(gitRepo.rootPath)
  if (!repoConfig) {
    // 3. 未設定リポジトリ → セットアップ
    await setupFlow()
    return
  }

  // 4. 設定済み → sync
  await syncFlow()
}

// ─── コマンド定義 ───

const syncCommand = defineCommand({
  meta: {
    name: 'sync',
    description: '差分アクティビティを同期',
  },
  run: async () => {
    await syncFlow()
  },
})

const logoutCommand = defineCommand({
  meta: {
    name: 'logout',
    description: 'ログアウト（設定削除）',
  },
  run: () => {
    if (deleteConfig()) {
      console.log('ログアウトしました。')
    } else {
      console.log('ログイン情報がありません。')
    }
  },
})

const main = defineCommand({
  meta: {
    name: 'invoiceai',
    description: '状態に応じて自動実行（ログイン/セットアップ/同期）',
  },
  subCommands: {
    sync: syncCommand,
    logout: logoutCommand,
  },
  run: async () => {
    await autoRun()
  },
})

runMain(main)
