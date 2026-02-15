import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

interface CliConfig {
  token: string
  serverUrl: string
  organizationId?: string
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
