import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface RepoConfig {
  orgSlug: string
  clientId: string
  remoteUrl: string
  lastSyncCommit: string | null
  lastSyncedAt: string | null
}

export interface CliConfig {
  auth: { serverUrl: string; token: string }
  repos: Record<string, RepoConfig> // key = absolute repo path
}

function getConfigDir(): string {
  return join(homedir(), '.config', 'invoiceai')
}

function getConfigPath(): string {
  return join(getConfigDir(), 'config.json')
}

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return null
  }
}

function writeJsonFile(path: string, value: unknown): void {
  const dir = getConfigDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8')
}

export function loadConfig(): CliConfig | null {
  return readJsonFile<CliConfig>(getConfigPath())
}

export function saveConfig(config: CliConfig): void {
  writeJsonFile(getConfigPath(), config)
}

export function saveAuth(token: string, serverUrl: string): void {
  const existing = loadConfig()
  const config: CliConfig = {
    auth: { token, serverUrl },
    repos: existing?.repos ?? {},
  }
  saveConfig(config)
}

export function getRepoConfig(repoPath: string): RepoConfig | null {
  const config = loadConfig()
  return config?.repos[repoPath] ?? null
}

export function saveRepoConfig(repoPath: string, repoConfig: RepoConfig): void {
  const config = loadConfig()
  if (!config) {
    throw new Error('ログインしていません。先にログインしてください。')
  }
  config.repos[repoPath] = repoConfig
  saveConfig(config)
}

export function updateSyncState(
  repoPath: string,
  lastSyncCommit: string,
  lastSyncedAt: string,
): void {
  const config = loadConfig()
  if (!config) {
    throw new Error('ログインしていません。')
  }
  const repo = config.repos[repoPath]
  if (!repo) {
    throw new Error(`リポジトリ ${repoPath} の設定が見つかりません。`)
  }
  repo.lastSyncCommit = lastSyncCommit
  repo.lastSyncedAt = lastSyncedAt
  saveConfig(config)
}

export function deleteConfig(): boolean {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    return false
  }
  unlinkSync(configPath)
  return true
}
