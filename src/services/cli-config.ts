import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export interface RepoMapping {
  path: string
  clientId: string | null
}

export interface CliConfig {
  token: string
  serverUrl: string
  organizationId?: string
  repositories?: RepoMapping[]
  repoRoots?: string[]
  repoDetectEnabled?: boolean
}

type AuthConfig = {
  token: string
  serverUrl: string
}

type SetupConfig = {
  organizationId?: string
  repositories?: RepoMapping[]
  repoRoots?: string[]
  repoDetectEnabled?: boolean
}

function getConfigDir(): string {
  return join(homedir(), '.config', 'invoiceai')
}

function getConfigPath(): string {
  return join(getConfigDir(), 'credentials.json')
}

function getSetupConfigPath(): string {
  return join(getConfigDir(), 'settings.json')
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

function pickAuthConfig(config: CliConfig): AuthConfig {
  return {
    token: config.token,
    serverUrl: config.serverUrl,
  }
}

function pickSetupConfig(config: Partial<CliConfig>): SetupConfig {
  return {
    ...(config.organizationId === undefined
      ? {}
      : { organizationId: config.organizationId }),
    ...(config.repositories === undefined
      ? {}
      : { repositories: config.repositories }),
    ...(config.repoRoots === undefined ? {} : { repoRoots: config.repoRoots }),
    ...(config.repoDetectEnabled === undefined
      ? {}
      : { repoDetectEnabled: config.repoDetectEnabled }),
  }
}

export function saveConfig(config: CliConfig): void {
  writeJsonFile(getConfigPath(), pickAuthConfig(config))

  const setupConfig = pickSetupConfig(config)
  const hasSetupValues = Object.values(setupConfig).some(
    (value) => value !== undefined,
  )

  if (hasSetupValues) {
    writeJsonFile(getSetupConfigPath(), setupConfig)
  } else if (existsSync(getSetupConfigPath())) {
    unlinkSync(getSetupConfigPath())
  }
}

export function loadConfig(): CliConfig | null {
  const auth = readJsonFile<AuthConfig>(getConfigPath())
  if (!auth?.token || !auth.serverUrl) {
    return null
  }

  const setup = readJsonFile<SetupConfig>(getSetupConfigPath())
  const legacy = readJsonFile<Partial<CliConfig>>(getConfigPath())

  // 旧形式(credentials.json に setup 情報を同居)からの互換読み込み
  const fallbackSetup = pickSetupConfig(legacy ?? {})
  const legacyHasSetupValues = Object.keys(fallbackSetup).length > 0
  if (!setup && legacyHasSetupValues) {
    writeJsonFile(getSetupConfigPath(), fallbackSetup)
    writeJsonFile(
      getConfigPath(),
      pickAuthConfig({ token: auth.token, serverUrl: auth.serverUrl }),
    )
  }

  return {
    token: auth.token,
    serverUrl: auth.serverUrl,
    ...((setup?.organizationId ?? fallbackSetup.organizationId) === undefined
      ? {}
      : {
          organizationId: setup?.organizationId ?? fallbackSetup.organizationId,
        }),
    ...((setup?.repositories ?? fallbackSetup.repositories) === undefined
      ? {}
      : { repositories: setup?.repositories ?? fallbackSetup.repositories }),
    ...((setup?.repoRoots ?? fallbackSetup.repoRoots) === undefined
      ? {}
      : { repoRoots: setup?.repoRoots ?? fallbackSetup.repoRoots }),
    ...((setup?.repoDetectEnabled ?? fallbackSetup.repoDetectEnabled) ===
    undefined
      ? {}
      : {
          repoDetectEnabled:
            setup?.repoDetectEnabled ?? fallbackSetup.repoDetectEnabled,
        }),
  }
}

export function deleteConfig(): boolean {
  const authPath = getConfigPath()
  const setupPath = getSetupConfigPath()

  const hasAuth = existsSync(authPath)
  const hasSetup = existsSync(setupPath)
  if (!hasAuth && !hasSetup) {
    return false
  }

  if (hasAuth) {
    unlinkSync(authPath)
  }
  if (hasSetup) {
    unlinkSync(setupPath)
  }
  return true
}

function normalizePath(path: string): string {
  return resolve(path)
}

function uniqueNormalizedPaths(paths: string[]): string[] {
  return Array.from(new Set(paths.map((path) => normalizePath(path))))
}

function isGitRepository(path: string): boolean {
  try {
    execFileSync('git', ['-C', path, 'rev-parse', '--is-inside-work-tree'], {
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

function discoverFromBaseDirs(baseDirs: string[], maxDepth = 3): string[] {
  const found = new Set<string>()
  const skipNames = new Set([
    '.git',
    'node_modules',
    '.pnpm-store',
    '.turbo',
    'dist',
    'build',
    'output',
  ])

  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth) {
      return
    }
    let entries: string[] = []
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }

    if (entries.includes('.git')) {
      found.add(normalizePath(dir))
      return
    }

    for (const entry of entries) {
      if (skipNames.has(entry)) {
        continue
      }
      const child = join(dir, entry)
      let isDir = false
      try {
        isDir = statSync(child).isDirectory()
      } catch {
        continue
      }
      if (!isDir) {
        continue
      }
      walk(child, depth + 1)
    }
  }

  for (const baseDir of baseDirs) {
    if (!existsSync(baseDir)) {
      continue
    }
    walk(baseDir, 0)
  }

  return Array.from(found).sort((a, b) => a.localeCompare(b))
}

function getDefaultRepoRoots(): string[] {
  const home = homedir()
  return ['work', 'src', 'dev', 'projects'].map((name) => join(home, name))
}

export function resolveRepoRoots(
  configuredRoots: string[] = [],
  extraRoots: string[] = [],
): string[] {
  const merged = uniqueNormalizedPaths([
    ...configuredRoots,
    ...extraRoots,
    ...getDefaultRepoRoots(),
  ])
  return merged.filter((path) => existsSync(path))
}

export function discoverGitRepos(
  existingPaths: string[] = [],
  repoRoots: string[] = [],
): string[] {
  const found = new Set<string>()

  for (const path of existingPaths) {
    if (existsSync(path) && isGitRepository(path)) {
      found.add(normalizePath(path))
    }
  }

  const cwd = process.cwd()
  if (isGitRepository(cwd)) {
    try {
      const gitRoot = execFileSync(
        'git',
        ['-C', cwd, 'rev-parse', '--show-toplevel'],
        { encoding: 'utf-8' },
      ).trim()
      if (gitRoot) {
        found.add(normalizePath(gitRoot))
      }
    } catch {
      found.add(normalizePath(cwd))
    }
  }

  const roots = repoRoots.length > 0 ? repoRoots : resolveRepoRoots()
  for (const path of discoverFromBaseDirs(roots, 3)) {
    found.add(path)
  }

  return Array.from(found).sort((a, b) => a.localeCompare(b))
}

function getRepositoryLastCommitAt(path: string): number {
  try {
    const output = execFileSync(
      'git',
      ['-C', path, 'log', '-1', '--format=%ct'],
      {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim()
    const unix = Number(output)
    if (!Number.isFinite(unix) || unix <= 0) {
      return 0
    }
    return unix * 1000
  } catch {
    return 0
  }
}

export function pickActiveRepositories(
  repositories: string[],
  options: { days?: number; max?: number } = {},
): string[] {
  const days = options.days ?? 30
  const max = options.max ?? 40
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000

  return repositories
    .map((path) => ({
      path,
      lastCommitAt: getRepositoryLastCommitAt(path),
    }))
    .filter((repo) => repo.lastCommitAt >= threshold)
    .sort((a, b) => b.lastCommitAt - a.lastCommitAt)
    .slice(0, max)
    .map((repo) => repo.path)
}
