import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function getRepoRoot(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(currentDir, '../../')
}

export function getRepoEnvPath(): string {
  return path.join(getRepoRoot(), '.env')
}
