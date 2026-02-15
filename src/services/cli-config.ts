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
}

function getConfigDir(): string {
  return join(homedir(), '.config', 'invoiceai')
}

function getConfigPath(): string {
  return join(getConfigDir(), 'credentials.json')
}

export function saveConfig(config: CliConfig): void {
  const dir = getConfigDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

export function loadConfig(): CliConfig | null {
  const path = getConfigPath()
  if (!existsSync(path)) {
    return null
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as CliConfig
  } catch {
    return null
  }
}

export function deleteConfig(): boolean {
  const path = getConfigPath()
  if (!existsSync(path)) {
    return false
  }
  unlinkSync(path)
  return true
}

function normalizePath(path: string): string {
  return resolve(path)
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

export function discoverGitRepos(existingPaths: string[] = []): string[] {
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

  const home = homedir()
  const defaults = ['work', 'src', 'dev', 'projects'].map((name) =>
    join(home, name),
  )
  for (const path of discoverFromBaseDirs(defaults, 3)) {
    found.add(path)
  }

  return Array.from(found).sort((a, b) => a.localeCompare(b))
}
